import { ipcMain, dialog, shell, BrowserWindow } from 'electron'
import { existsSync } from 'fs'
import { homedir } from 'os'
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
  setSetting,
  getTodos,
  addTodo,
  toggleTodo,
  deleteTodo,
  getLinks,
  addLink,
  deleteLink,
  getPrepWeeks,
  getStudyStreakState,
  markStudiedToday,
  getRawMeta,
  setRawMeta
} from './db'
import { dayTypeFor, todayString, ensureBlocksForDate } from './scheduler'
import { getWeekDayStats, getStreakForKind } from './stats'
import { applyAutoLaunch } from './autoLaunch'
import { getRoutines, getRoutineRuns, getRoutineRunDetail, linkRoutineOutput } from './routinesDb'
import { checkRoutinesNow } from './routines'
import { getJobHuntPipelineSummary } from './jobHuntPipeline'
import { fetchWeather, getCachedWeather } from './weather'
import { listSessions, getTranscript } from './claudeSessions'
import { resolveClaudeBinary, setBinaryOverride } from './claudeCli'
import * as claudePty from './claudePty'
import type {
  AppSettings,
  BlockStatus,
  ClaudePtyStartRequest,
  DayType,
  JobHuntLogEntry,
  PrepPlan,
  TodaySnapshot
} from '../shared/types'

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

  ipcMain.handle(
    'set-setting',
    async (_e, key: keyof AppSettings, value: string | number | boolean) => {
      setSetting(key, value as never)
      if (key === 'autoLaunch') await applyAutoLaunch(value as boolean)
    }
  )

  ipcMain.handle('get-routines', () => getRoutines())

  ipcMain.handle('get-routine-runs', (_e, routineId: number) => getRoutineRuns(routineId))

  ipcMain.handle(
    'get-routine-run-detail',
    (_e, runId: number) => getRoutineRunDetail(runId) ?? null
  )

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

  // ---- Dashboard (landing page) ----

  ipcMain.handle('get-todos', () => getTodos())
  ipcMain.handle('add-todo', (_e, text: string) => addTodo(text))
  ipcMain.handle('toggle-todo', (_e, id: number) => toggleTodo(id))
  ipcMain.handle('delete-todo', (_e, id: number) => deleteTodo(id))

  ipcMain.handle('get-links', () => getLinks())
  ipcMain.handle('add-link', (_e, label: string, url: string) => addLink(label, url))
  ipcMain.handle('delete-link', (_e, id: number) => deleteLink(id))
  ipcMain.handle('open-external', (_e, url: string) => shell.openExternal(url))

  ipcMain.handle('get-job-hunt-pipeline', () => getJobHuntPipelineSummary())

  ipcMain.handle('get-prep-plan', (): PrepPlan => {
    const { studyStreakDays, studiedToday } = getStudyStreakState()
    return { weeks: getPrepWeeks(), studyStreakDays, studiedToday }
  })
  ipcMain.handle('mark-studied-today', (): PrepPlan => {
    const { studyStreakDays, studiedToday } = markStudiedToday()
    return { weeks: getPrepWeeks(), studyStreakDays, studiedToday }
  })

  ipcMain.handle('get-weather', async () => getCachedWeather() ?? (await fetchWeather()))

  // ---- Claude Code session viewer + embedded terminal ----

  ipcMain.handle('get-claude-sessions', () => listSessions())

  ipcMain.handle('get-claude-transcript', (_e, filePath: string) => getTranscript(filePath))

  ipcMain.handle('get-claude-binary-status', (_e, forceRefresh?: boolean) =>
    resolveClaudeBinary(forceRefresh)
  )

  ipcMain.handle('set-claude-binary-override', (_e, path: string | null) => setBinaryOverride(path))

  ipcMain.handle('get-claude-last-cwd', () => getRawMeta('lastClaudeCwd') || homedir())

  ipcMain.handle('pick-claude-binary-file', async () => {
    const win = BrowserWindow.getFocusedWindow()
    const result = win
      ? await dialog.showOpenDialog(win, { properties: ['openFile'] })
      : await dialog.showOpenDialog({ properties: ['openFile'] })
    if (result.canceled || result.filePaths.length === 0) return null
    return result.filePaths[0]
  })

  ipcMain.handle('pick-claude-working-directory', async () => {
    const win = BrowserWindow.getFocusedWindow()
    const result = win
      ? await dialog.showOpenDialog(win, { properties: ['openDirectory', 'createDirectory'] })
      : await dialog.showOpenDialog({ properties: ['openDirectory', 'createDirectory'] })
    if (result.canceled || result.filePaths.length === 0) return null
    return result.filePaths[0]
  })

  ipcMain.handle('start-claude-session', async (_e, req: ClaudePtyStartRequest) => {
    if (req.mode === 'new') setRawMeta('lastClaudeCwd', req.cwd)
    return claudePty.start(req)
  })

  ipcMain.handle('stop-claude-session', () => {
    claudePty.stop()
  })

  ipcMain.handle('get-claude-pty-status', () => claudePty.getStatus())

  ipcMain.handle('get-claude-pty-buffer', () => claudePty.getBuffer())

  ipcMain.on('write-claude-pty-input', (_e, data: string) => claudePty.write(data))

  ipcMain.on('resize-claude-pty', (_e, cols: number, rows: number) => claudePty.resize(cols, rows))
}
