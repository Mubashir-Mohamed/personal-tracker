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

export interface JobHuntLogEntry {
  date: string
  applicationsCount: number
  companies: string[]
  notes: string
}

export interface AppSettings {
  notificationLeadMinutes: number
  autoLaunch: boolean
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
