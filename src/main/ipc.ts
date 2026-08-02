import { ipcMain, dialog, shell, BrowserWindow } from 'electron'
import { existsSync } from 'fs'
import { dirname, join, basename } from 'path'
import {
  getBlocksForDate,
  getCategories,
  updateBlockStatus,
  rescheduleBlock,
  getJobHuntLog,
  upsertJobHuntLog,
  getRulesForDayType,
  updateRuleTimes,
  getSetting,
  setSetting
} from './db'
import { dayTypeFor, todayString, ensureBlocksForDate } from './scheduler'
import { getWeekDayStats, getStreakForKind } from './stats'
import { applyAutoLaunch } from './autoLaunch'
import { getRoutines, getRoutineRuns, getRoutineRunDetail, linkRoutineOutput } from './routinesDb'
import { checkRoutinesNow } from './routines'
import type { AppSettings, BlockStatus, DayType, JobHuntLogEntry, TodaySnapshot } from '../shared/types'

export function registerIpcHandlers(): void {
  ipcMain.handle('get-today', (): TodaySnapshot => {
    const now = new Date()
    ensureBlocksForDate(now)
    const date = todayString(now)
    return {
      date,
      dayType: dayTypeFor(now),
      blocks: getBlocksForDate(date),
      enabled: getSetting('timeTrackerEnabled')
    }
  })

  ipcMain.handle('get-categories', () => getCategories())

  ipcMain.handle('update-block-status', (_e, blockId: number, status: BlockStatus) => {
    updateBlockStatus(blockId, status)
    return getBlocksForDate(todayString())
  })

  ipcMain.handle('reschedule-block', (_e, blockId: number, start: string, end: string) => {
    rescheduleBlock(blockId, start, end)
    return getBlocksForDate(todayString())
  })

  ipcMain.handle('get-job-hunt-log', (_e, date: string) => getJobHuntLog(date) ?? null)

  ipcMain.handle('upsert-job-hunt-log', (_e, entry: JobHuntLogEntry) => {
    upsertJobHuntLog(entry)
    return getJobHuntLog(entry.date)
  })

  ipcMain.handle('get-rules', (_e, dayType: DayType) => getRulesForDayType(dayType))

  ipcMain.handle('update-rule-times', (_e, ruleId: number, start: string, end: string) => {
    updateRuleTimes(ruleId, start, end)
  })

  ipcMain.handle('get-week-stats', () => {
    const { days, totalApplications } = getWeekDayStats()
    return {
      days,
      totalApplications,
      jobHuntStreak: getStreakForKind('job_hunt'),
      familyStreak: getStreakForKind('family')
    }
  })

  ipcMain.handle('get-settings', (): AppSettings => ({
    notificationLeadMinutes: getSetting('notificationLeadMinutes'),
    autoLaunch: getSetting('autoLaunch'),
    timeTrackerEnabled: getSetting('timeTrackerEnabled')
  }))

  ipcMain.handle('set-setting', async (_e, key: keyof AppSettings, value: string | number | boolean) => {
    setSetting(key, value as never)
    if (key === 'autoLaunch') await applyAutoLaunch(value as boolean)
  })

  ipcMain.handle('get-routines', () => getRoutines())

  ipcMain.handle('get-routine-runs', (_e, routineId: number) => getRoutineRuns(routineId))

  ipcMain.handle('get-routine-run-detail', (_e, runId: number) => getRoutineRunDetail(runId) ?? null)

  ipcMain.handle(
    'link-routine-output',
    async (_e, routineId: number, watchPath: string, scheduleLabel: string) => {
      linkRoutineOutput(routineId, watchPath, scheduleLabel)
      await checkRoutinesNow()
      return getRoutines()
    }
  )

  ipcMain.handle('check-routines-now', async () => {
    await checkRoutinesNow()
    return getRoutines()
  })

  ipcMain.handle('pick-watch-file', async () => {
    const win = BrowserWindow.getFocusedWindow()
    const result = win
      ? await dialog.showOpenDialog(win, { properties: ['openFile'] })
      : await dialog.showOpenDialog({ properties: ['openFile'] })
    if (result.canceled || result.filePaths.length === 0) return null
    return result.filePaths[0]
  })

  ipcMain.handle('open-routine-run-file', (_e, runId: number) => {
    const run = getRoutineRunDetail(runId)
    if (run) shell.openPath(run.archivedPath)
  })

  ipcMain.handle('open-routine-run-sidecar-file', (_e, runId: number, filename: string) => {
    const run = getRoutineRunDetail(runId)
    if (!run) return { ok: false, error: 'Run not found' }

    const target = join(dirname(run.archivedPath), basename(filename))
    if (!existsSync(target)) {
      return { ok: false, error: "That file wasn't saved with this run's snapshot" }
    }
    shell.openPath(target)
    return { ok: true }
  })
}
