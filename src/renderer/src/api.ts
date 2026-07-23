import type {
  AppSettings,
  BlockInstanceWithCategory,
  BlockStatus,
  Category,
  DayType,
  JobHuntLogEntry,
  ScheduleRule,
  WeekStats
} from '../../shared/types'

function toMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}

/** Dev-only fallback so the UI is previewable in a plain browser tab (no Electron
 *  contextBridge available there). Never used inside the real Electron app. */
function buildMockApi(): Window['api'] {
  const categories: Category[] = [
    { id: 1, name: 'Job Work', color: '#5b8def', soundFile: null, kind: 'work' },
    { id: 2, name: 'Lunch Break', color: '#f2b134', soundFile: null, kind: 'break' },
    { id: 3, name: 'Job Hunt', color: '#e0575b', soundFile: null, kind: 'job_hunt' },
    { id: 4, name: 'Family Time', color: '#2fbf71', soundFile: null, kind: 'family' },
    { id: 5, name: 'Leisure & Job Hunt', color: '#9b59b6', soundFile: null, kind: 'job_hunt' }
  ]

  const rulesByDay: Record<DayType, ScheduleRule[]> = {
    weekday: [
      { id: 1, dayType: 'weekday', categoryId: 1, startTime: '09:00', endTime: '13:15', label: 'Job Work', sortOrder: 0 },
      { id: 2, dayType: 'weekday', categoryId: 2, startTime: '13:15', endTime: '14:15', label: 'Lunch Break', sortOrder: 1 },
      { id: 3, dayType: 'weekday', categoryId: 1, startTime: '14:15', endTime: '18:00', label: 'Job Work', sortOrder: 2 },
      { id: 4, dayType: 'weekday', categoryId: 3, startTime: '18:30', endTime: '19:30', label: 'Job Hunt', sortOrder: 3 },
      { id: 5, dayType: 'weekday', categoryId: 4, startTime: '19:30', endTime: '21:00', label: 'Family Time', sortOrder: 4 }
    ],
    weekend: [
      { id: 6, dayType: 'weekend', categoryId: 4, startTime: '09:00', endTime: '16:00', label: 'Family Time', sortOrder: 0 },
      { id: 7, dayType: 'weekend', categoryId: 5, startTime: '16:00', endTime: '23:00', label: 'Leisure & Job Hunt', sortOrder: 1 }
    ]
  }

  const today = new Date()
  const dateStr = today.toISOString().slice(0, 10)
  const nowMin = today.getHours() * 60 + today.getMinutes()

  const blocks: BlockInstanceWithCategory[] = rulesByDay.weekday.map((rule, i) => {
    const s = toMinutes(rule.startTime)
    const e = toMinutes(rule.endTime)
    const status: BlockStatus = nowMin < s ? 'pending' : nowMin < e ? 'active' : 'done'
    return {
      id: rule.id,
      date: dateStr,
      ruleId: rule.id,
      categoryId: rule.categoryId,
      label: rule.label,
      plannedStart: rule.startTime,
      plannedEnd: rule.endTime,
      status,
      sortOrder: i,
      category: categories.find((c) => c.id === rule.categoryId)!
    }
  })

  let jobHuntLog: JobHuntLogEntry = { date: dateStr, applicationsCount: 2, companies: ['Acme', 'Globex'], notes: '' }
  const settings: AppSettings = { notificationLeadMinutes: 10, autoLaunch: true }

  const weekStats: WeekStats = {
    days: [-3, -2, -1, 0].map((offset) => {
      const d = new Date(today.getTime() + offset * 86_400_000)
      const iso = d.toISOString().slice(0, 10)
      return {
        date: iso,
        dayType: 'weekday' as DayType,
        adherencePct: [62, 78, 91, 70][offset + 3],
        categories: [
          { categoryId: 1, category: categories[0], plannedMinutes: 465, doneMinutes: 420 },
          { categoryId: 3, category: categories[2], plannedMinutes: 60, doneMinutes: offset === 0 ? 0 : 60 },
          { categoryId: 4, category: categories[3], plannedMinutes: 90, doneMinutes: offset === 0 ? 0 : 90 }
        ]
      }
    }),
    jobHuntStreak: 3,
    familyStreak: 4,
    totalApplications: 7
  }

  return {
    getToday: async () => ({ date: dateStr, dayType: 'weekday', blocks }),
    getCategories: async () => categories,
    updateBlockStatus: async (blockId, status) => {
      const b = blocks.find((x) => x.id === blockId)
      if (b) b.status = status
      return blocks
    },
    rescheduleBlock: async (blockId, start, end) => {
      const b = blocks.find((x) => x.id === blockId)
      if (b) {
        b.plannedStart = start
        b.plannedEnd = end
      }
      return blocks
    },
    getJobHuntLog: async () => jobHuntLog,
    upsertJobHuntLog: async (entry) => {
      jobHuntLog = entry
      return jobHuntLog
    },
    getRules: async (dayType) => rulesByDay[dayType],
    updateRuleTimes: async (ruleId, start, end) => {
      for (const rules of Object.values(rulesByDay)) {
        const r = rules.find((x) => x.id === ruleId)
        if (r) {
          r.startTime = start
          r.endTime = end
        }
      }
    },
    getWeekStats: async () => weekStats,
    getSettings: async () => settings,
    setSetting: async (key, value) => {
      ;(settings as unknown as Record<string, unknown>)[key] = value
    },
    onDayChanged: () => () => {}
  }
}

export const api = window.api ?? buildMockApi()

export type {
  AppSettings,
  BlockInstanceWithCategory,
  BlockStatus,
  Category,
  CategoryKind,
  CategoryStat,
  DayStat,
  DayType,
  JobHuntLogEntry,
  ScheduleRule,
  WeekStats
} from '../../shared/types'
