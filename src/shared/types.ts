export type DayType = 'weekday' | 'weekend'

export type CategoryKind = 'work' | 'job_hunt' | 'family' | 'break' | 'leisure' | 'other'

export type BlockStatus = 'pending' | 'active' | 'done' | 'skipped'

export interface Category {
  id: number
  name: string
  color: string
  soundFile: string | null
  kind: CategoryKind
}

export interface ScheduleRule {
  id: number
  dayType: DayType
  categoryId: number
  startTime: string // 'HH:MM'
  endTime: string // 'HH:MM'
  label: string
  sortOrder: number
}

export interface BlockInstance {
  id: number
  date: string // 'YYYY-MM-DD'
  ruleId: number | null
  categoryId: number
  label: string
  plannedStart: string // 'HH:MM'
  plannedEnd: string // 'HH:MM'
  status: BlockStatus
  sortOrder: number
}

export interface BlockInstanceWithCategory extends BlockInstance {
  category: Category
}

export interface TodaySnapshot {
  date: string
  dayType: DayType
  blocks: BlockInstanceWithCategory[]
  enabled: boolean
}

export interface JobHuntLogEntry {
  date: string
  applicationsCount: number
  companies: string[]
  notes: string
}

export interface AppSettings {
  notificationLeadMinutes: number
  autoLaunch: boolean
  timeTrackerEnabled: boolean
  /** Shown in the Home dashboard's boot-bar prompt/greeting. Empty string = generic greeting. */
  displayName: string
  /** Weather chip on the Home dashboard — all default to Kochi, India but are editable in Settings. */
  weatherLocationLabel: string
  weatherLat: number
  weatherLon: number
}

export interface ScheduleRuleInput {
  dayType: DayType
  categoryId: number
  startTime: string // 'HH:MM'
  endTime: string // 'HH:MM'
  label: string
}

export interface CategoryInput {
  name: string
  color: string
  kind: CategoryKind
  soundFile?: string | null
}

export interface PrepWeekInput {
  weekNumber: number
  title: string
  description: string
  startDate: string // 'YYYY-MM-DD'
  endDate: string // 'YYYY-MM-DD'
}

export interface DeleteResult {
  ok: boolean
  error?: string
}

export interface CategoryStat {
  categoryId: number
  category: Category
  plannedMinutes: number
  doneMinutes: number
}

export interface DayStat {
  date: string
  dayType: DayType
  categories: CategoryStat[]
  adherencePct: number
}

export interface WeekStats {
  days: DayStat[]
  jobHuntStreak: number
  familyStreak: number
  totalApplications: number
}

export type RunStatus = 'parsed' | 'error'

export interface ParsedSheet {
  name: string
  rows: string[][]
}

export interface ParsedWorkbook {
  sheets: ParsedSheet[]
}

export interface Routine {
  id: number
  taskId: string
  name: string
  description: string
  prompt: string
  scheduleLabel: string | null
  watchPath: string | null
  createdAt: string
}

export interface RoutineWithLatestRun extends Routine {
  latestRunDate: string | null
  runCount: number
}

export interface RoutineRun {
  id: number
  routineId: number
  runDate: string
  detectedAt: string
  sourceMtime: string
  archivedPath: string
  status: RunStatus
  errorMessage: string | null
}

export interface RoutineRunDetail extends RoutineRun {
  parsed: ParsedWorkbook | null
}

// ---- Dashboard (landing page) ----

export interface Todo {
  id: number
  text: string
  done: boolean
  sortOrder: number
}

export interface QuickLink {
  id: number
  label: string
  url: string
  sortOrder: number
}

/** A row from any routine's output sheet that happens to look like a scored list — has both a
 *  "title" and a "score" column (job listings, leads, deals, whatever the routine produces). */
export interface ScoredItem {
  title: string
  company: string
  location: string
  datePosted: string
  score: number
  reason: string
  source: string
  url: string
}

export interface ScoredRunStats {
  scanned: number
  strongFits: number
  newSinceLastRun: number
  topMatch: { title: string; company: string; score: number } | null
}

/** One row of the Home dashboard's Routines card — every routine that's linked to an output
 *  file, regardless of what it's for. `scored` is populated automatically when the latest run's
 *  output looks like a scored list; otherwise `sheetSummary` gives a generic row/sheet count. */
export interface RoutineOverviewEntry {
  routineId: number
  name: string
  scheduleLabel: string | null
  latestRunId: number | null
  latestRunDate: string | null
  runCount: number
  scored: ScoredRunStats | null
  sheetSummary: { sheetCount: number; rowCount: number } | null
}

export interface PrepWeek {
  id: number
  weekNumber: number
  title: string
  description: string
  startDate: string // 'YYYY-MM-DD'
  endDate: string // 'YYYY-MM-DD'
  current: boolean
}

export interface PrepPlan {
  weeks: PrepWeek[]
  studyStreakDays: number
  studiedToday: boolean
}

export interface WeatherSnapshot {
  locationLabel: string
  tempC: number
  condition: string
  isDay: boolean
  highC: number
  lowC: number
  precipChancePct: number
  fetchedAt: string
}

// ---- Claude Code session viewer + embedded terminal ----

export interface ClaudeSessionSummary {
  sessionId: string
  filePath: string // absolute path to the .jsonl; primary key for get-transcript
  cwd: string
  title: string | null
  lastActiveAt: string // ISO, from fs.stat mtime
  messageCount: number
}

export type ClaudeContentBlockSummary =
  | { type: 'text'; text: string }
  | { type: 'tool_use'; label: string }
  | { type: 'tool_result'; label: string; isError: boolean }

export interface ClaudeTranscriptEntry {
  uuid: string
  role: 'user' | 'assistant'
  timestamp: string | null
  blocks: ClaudeContentBlockSummary[]
}

export type ClaudeBinarySource = 'override' | 'login-shell' | 'well-known-path' | 'not-found'
export interface ClaudeBinaryStatus {
  path: string | null
  source: ClaudeBinarySource
}

export type ClaudePtyStartRequest =
  | { mode: 'new'; cwd: string; cols: number; rows: number }
  | { mode: 'resume'; cwd: string; sessionId: string; cols: number; rows: number }

export interface ClaudePtyStartResult {
  ok: boolean
  error?: string
  pid?: number
}
export interface ClaudePtyStatus {
  running: boolean
  cwd: string | null
  sessionId: string | null
  pid: number | null
}
export interface ClaudePtyExitInfo {
  code: number | null
  signal: string | null
}
