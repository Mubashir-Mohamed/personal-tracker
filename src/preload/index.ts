import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import type {
  AppSettings,
  BlockInstanceWithCategory,
  BlockStatus,
  Category,
  ClaudeBinaryStatus,
  ClaudePtyExitInfo,
  ClaudePtyStartRequest,
  ClaudePtyStartResult,
  ClaudePtyStatus,
  ClaudeSessionSummary,
  ClaudeTranscriptEntry,
  DayType,
  JobHuntLogEntry,
  JobHuntPipelineSummary,
  PrepPlan,
  QuickLink,
  RoutineRun,
  RoutineRunDetail,
  RoutineWithLatestRun,
  ScheduleRule,
  Todo,
  TodaySnapshot,
  WeatherSnapshot,
  WeekStats
} from '../shared/types'

const api = {
  getToday: (): Promise<TodaySnapshot> => ipcRenderer.invoke('get-today'),
  getCategories: (): Promise<Category[]> => ipcRenderer.invoke('get-categories'),
  updateBlockStatus: (blockId: number, status: BlockStatus): Promise<BlockInstanceWithCategory[]> =>
    ipcRenderer.invoke('update-block-status', blockId, status),
  rescheduleBlock: (
    blockId: number,
    start: string,
    end: string
  ): Promise<BlockInstanceWithCategory[]> =>
    ipcRenderer.invoke('reschedule-block', blockId, start, end),
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
  openRoutineRunFile: (runId: number): Promise<void> =>
    ipcRenderer.invoke('open-routine-run-file', runId),
  openRoutineRunSidecarFile: (
    runId: number,
    filename: string
  ): Promise<{ ok: boolean; error?: string }> =>
    ipcRenderer.invoke('open-routine-run-sidecar-file', runId, filename),

  getTodos: (): Promise<Todo[]> => ipcRenderer.invoke('get-todos'),
  addTodo: (text: string): Promise<Todo[]> => ipcRenderer.invoke('add-todo', text),
  toggleTodo: (id: number): Promise<Todo[]> => ipcRenderer.invoke('toggle-todo', id),
  deleteTodo: (id: number): Promise<Todo[]> => ipcRenderer.invoke('delete-todo', id),

  getLinks: (): Promise<QuickLink[]> => ipcRenderer.invoke('get-links'),
  addLink: (label: string, url: string): Promise<QuickLink[]> =>
    ipcRenderer.invoke('add-link', label, url),
  deleteLink: (id: number): Promise<QuickLink[]> => ipcRenderer.invoke('delete-link', id),
  openExternal: (url: string): Promise<void> => ipcRenderer.invoke('open-external', url),

  getJobHuntPipeline: (): Promise<JobHuntPipelineSummary> =>
    ipcRenderer.invoke('get-job-hunt-pipeline'),

  getPrepPlan: (): Promise<PrepPlan> => ipcRenderer.invoke('get-prep-plan'),
  markStudiedToday: (): Promise<PrepPlan> => ipcRenderer.invoke('mark-studied-today'),

  getWeather: (): Promise<WeatherSnapshot | null> => ipcRenderer.invoke('get-weather'),

  getClaudeSessions: (): Promise<ClaudeSessionSummary[]> =>
    ipcRenderer.invoke('get-claude-sessions'),
  getClaudeTranscript: (filePath: string): Promise<ClaudeTranscriptEntry[]> =>
    ipcRenderer.invoke('get-claude-transcript', filePath),
  getClaudeBinaryStatus: (forceRefresh?: boolean): Promise<ClaudeBinaryStatus> =>
    ipcRenderer.invoke('get-claude-binary-status', forceRefresh),
  setClaudeBinaryOverride: (path: string | null): Promise<ClaudeBinaryStatus> =>
    ipcRenderer.invoke('set-claude-binary-override', path),
  getClaudeLastCwd: (): Promise<string> => ipcRenderer.invoke('get-claude-last-cwd'),
  pickClaudeBinaryFile: (): Promise<string | null> => ipcRenderer.invoke('pick-claude-binary-file'),
  pickClaudeWorkingDirectory: (): Promise<string | null> =>
    ipcRenderer.invoke('pick-claude-working-directory'),
  startClaudeSession: (req: ClaudePtyStartRequest): Promise<ClaudePtyStartResult> =>
    ipcRenderer.invoke('start-claude-session', req),
  stopClaudeSession: (): Promise<void> => ipcRenderer.invoke('stop-claude-session'),
  getClaudePtyStatus: (): Promise<ClaudePtyStatus> => ipcRenderer.invoke('get-claude-pty-status'),
  getClaudePtyBuffer: (): Promise<string> => ipcRenderer.invoke('get-claude-pty-buffer'),
  writeClaudePtyInput: (data: string): void => ipcRenderer.send('write-claude-pty-input', data),
  resizeClaudePty: (cols: number, rows: number): void =>
    ipcRenderer.send('resize-claude-pty', cols, rows),
  onClaudePtyData: (callback: (data: string) => void): (() => void) => {
    const listener = (_e: unknown, data: string): void => callback(data)
    ipcRenderer.on('claude-pty-data', listener)
    return () => ipcRenderer.removeListener('claude-pty-data', listener)
  },
  onClaudePtyExit: (callback: (info: ClaudePtyExitInfo) => void): (() => void) => {
    const listener = (_e: unknown, info: ClaudePtyExitInfo): void => callback(info)
    ipcRenderer.on('claude-pty-exit', listener)
    return () => ipcRenderer.removeListener('claude-pty-exit', listener)
  }
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
