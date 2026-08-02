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

export interface JobListing {
  title: string
  company: string
  location: string
  datePosted: string
  score: number
  reason: string
  source: string
  url: string
}

export interface JobHuntPipelineSummary {
  linked: boolean
  scheduleLabel: string | null
  lastRunDate: string | null
  scanned: number
  strongFits: number
  newSinceLastRun: number
  topMatches: JobListing[]
  bestMatchEver: (JobListing & { runDate: string }) | null
  cities: { name: string; count: number }[]
  sources: { name: string; count: number }[]
  excludeNote: string | null
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
