import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import type {
  AppSettings,
  BlockInstanceWithCategory,
  BlockStatus,
  Category,
  DayType,
  JobHuntLogEntry,
  RoutineRun,
  RoutineRunDetail,
  RoutineWithLatestRun,
  ScheduleRule,
  WeekStats
} from '../shared/types'

const api = {
  getToday: (): Promise<{ date: string; dayType: DayType; blocks: BlockInstanceWithCategory[] }> =>
    ipcRenderer.invoke('get-today'),
  getCategories: (): Promise<Category[]> => ipcRenderer.invoke('get-categories'),
  updateBlockStatus: (blockId: number, status: BlockStatus): Promise<BlockInstanceWithCategory[]> =>
    ipcRenderer.invoke('update-block-status', blockId, status),
  rescheduleBlock: (
    blockId: number,
    start: string,
    end: string
  ): Promise<BlockInstanceWithCategory[]> => ipcRenderer.invoke('reschedule-block', blockId, start, end),
  getJobHuntLog: (date: string): Promise<JobHuntLogEntry | null> =>
    ipcRenderer.invoke('get-job-hunt-log', date),
  upsertJobHuntLog: (entry: JobHuntLogEntry): Promise<JobHuntLogEntry> =>
    ipcRenderer.invoke('upsert-job-hunt-log', entry),
  getRules: (dayType: DayType): Promise<ScheduleRule[]> => ipcRenderer.invoke('get-rules', dayType),
  updateRuleTimes: (ruleId: number, start: string, end: string): Promise<void> =>
    ipcRenderer.invoke('update-rule-times', ruleId, start, end),
  getWeekStats: (): Promise<WeekStats> => ipcRenderer.invoke('get-week-stats'),
  getSettings: (): Promise<AppSettings> => ipcRenderer.invoke('get-settings'),
  setSetting: (key: keyof AppSettings, value: string | number | boolean): Promise<void> =>
    ipcRenderer.invoke('set-setting', key, value),
  onDayChanged: (callback: () => void): (() => void) => {
    const listener = (): void => callback()
    ipcRenderer.on('day-changed', listener)
    return () => ipcRenderer.removeListener('day-changed', listener)
  },
  getRoutines: (): Promise<RoutineWithLatestRun[]> => ipcRenderer.invoke('get-routines'),
  getRoutineRuns: (routineId: number): Promise<RoutineRun[]> =>
    ipcRenderer.invoke('get-routine-runs', routineId),
  getRoutineRunDetail: (runId: number): Promise<RoutineRunDetail | null> =>
    ipcRenderer.invoke('get-routine-run-detail', runId),
  linkRoutineOutput: (
    routineId: number,
    watchPath: string,
    scheduleLabel: string
  ): Promise<RoutineWithLatestRun[]> =>
    ipcRenderer.invoke('link-routine-output', routineId, watchPath, scheduleLabel),
  checkRoutinesNow: (): Promise<RoutineWithLatestRun[]> => ipcRenderer.invoke('check-routines-now'),
  pickWatchFile: (): Promise<string | null> => ipcRenderer.invoke('pick-watch-file'),
  openRoutineRunFile: (runId: number): Promise<void> => ipcRenderer.invoke('open-routine-run-file', runId)
}

export type PersonalTrackerApi = typeof api

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI
  // @ts-ignore (define in dts)
  window.api = api
}
