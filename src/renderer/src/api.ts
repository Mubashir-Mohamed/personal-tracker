import type {
  AppSettings,
  BlockInstanceWithCategory,
  BlockStatus,
  Category,
  ClaudeBinaryStatus,
  ClaudePtyStatus,
  ClaudeSessionSummary,
  ClaudeTranscriptEntry,
  DayType,
  JobHuntLogEntry,
  JobHuntPipelineSummary,
  PrepPlan,
  PrepWeek,
  QuickLink,
  RoutineRun,
  RoutineRunDetail,
  RoutineWithLatestRun,
  ScheduleRule,
  Todo,
  WeatherSnapshot,
  WeekStats
} from '../../shared/types'

function toMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}

/** Dev-only fallback so the UI is previewable in a plain browser tab (no Electron
 *  contextBridge available there). Never used inside the real Electron app. */
function buildMockApi(): Window['api'] {
  let nextCategoryId = 100
  let nextRuleId = 100
  let nextPrepWeekId = 100

  const categories: Category[] = [
    { id: 1, name: 'Job Work', color: '#5b8def', soundFile: null, kind: 'work' },
    { id: 2, name: 'Lunch Break', color: '#f2b134', soundFile: null, kind: 'break' },
    { id: 3, name: 'Job Hunt', color: '#e0575b', soundFile: null, kind: 'job_hunt' },
    { id: 4, name: 'Family Time', color: '#2fbf71', soundFile: null, kind: 'family' },
    { id: 5, name: 'Leisure & Job Hunt', color: '#9b59b6', soundFile: null, kind: 'job_hunt' }
  ]

  const rulesByDay: Record<DayType, ScheduleRule[]> = {
    weekday: [
      {
        id: 1,
        dayType: 'weekday',
        categoryId: 1,
        startTime: '09:00',
        endTime: '13:15',
        label: 'Job Work',
        sortOrder: 0
      },
      {
        id: 2,
        dayType: 'weekday',
        categoryId: 2,
        startTime: '13:15',
        endTime: '14:15',
        label: 'Lunch Break',
        sortOrder: 1
      },
      {
        id: 3,
        dayType: 'weekday',
        categoryId: 1,
        startTime: '14:15',
        endTime: '18:00',
        label: 'Job Work',
        sortOrder: 2
      },
      {
        id: 4,
        dayType: 'weekday',
        categoryId: 3,
        startTime: '18:30',
        endTime: '19:30',
        label: 'Job Hunt',
        sortOrder: 3
      },
      {
        id: 5,
        dayType: 'weekday',
        categoryId: 4,
        startTime: '19:30',
        endTime: '21:00',
        label: 'Family Time',
        sortOrder: 4
      }
    ],
    weekend: [
      {
        id: 6,
        dayType: 'weekend',
        categoryId: 4,
        startTime: '09:00',
        endTime: '16:00',
        label: 'Family Time',
        sortOrder: 0
      },
      {
        id: 7,
        dayType: 'weekend',
        categoryId: 5,
        startTime: '16:00',
        endTime: '23:00',
        label: 'Leisure & Job Hunt',
        sortOrder: 1
      }
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

  let jobHuntLog: JobHuntLogEntry = {
    date: dateStr,
    applicationsCount: 2,
    companies: ['Acme', 'Globex'],
    notes: ''
  }
  const settings: AppSettings = {
    notificationLeadMinutes: 10,
    autoLaunch: true,
    timeTrackerEnabled: true,
    displayName: '',
    weatherLocationLabel: 'Kochi',
    weatherLat: 9.9312,
    weatherLon: 76.2673,
    jobHuntRoutineId: 1
  }

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
          {
            categoryId: 3,
            category: categories[2],
            plannedMinutes: 60,
            doneMinutes: offset === 0 ? 0 : 60
          },
          {
            categoryId: 4,
            category: categories[3],
            plannedMinutes: 90,
            doneMinutes: offset === 0 ? 0 : 90
          }
        ]
      }
    }),
    jobHuntStreak: 3,
    familyStreak: 4,
    totalApplications: 7
  }

  const routines: RoutineWithLatestRun[] = [
    {
      id: 1,
      taskId: 'daily-job-listing',
      name: 'daily-job-listing',
      description: 'Job Hunting',
      prompt:
        'Using Apify (LinkedIn, Indeed, Naukri job scrapers), find all jobs posted in the last 24 hours matching my resume...',
      scheduleLabel: 'Daily at 7:03 AM',
      watchPath: '/Users/mock/Job Matches/job_openings_report.xlsx',
      createdAt: today.toISOString(),
      latestRunDate: dateStr,
      runCount: 3
    },
    {
      id: 2,
      taskId: 'weekly-digest',
      name: 'weekly-digest',
      description: 'Summarize saved newsletters into a weekly digest',
      prompt: "Summarize this week's saved newsletters into a short digest.",
      scheduleLabel: null,
      watchPath: null,
      createdAt: today.toISOString(),
      latestRunDate: null,
      runCount: 0
    }
  ]

  const routineRuns: RoutineRun[] = [-2, -1, 0].map((offset, i) => {
    const d = new Date(today.getTime() + offset * 86_400_000)
    return {
      id: i + 1,
      routineId: 1,
      runDate: d.toISOString().slice(0, 10),
      detectedAt: d.toISOString(),
      sourceMtime: d.toISOString(),
      archivedPath: `/Users/mock/routine-archives/1/${d.toISOString().slice(0, 10)}.xlsx`,
      status: 'parsed',
      errorMessage: null
    }
  })

  const runDetails: Record<number, RoutineRunDetail> = Object.fromEntries(
    routineRuns.map((run) => [
      run.id,
      {
        ...run,
        parsed: {
          sheets: [
            {
              name: 'Job Openings',
              rows: [
                ['Daily Job Openings Report — Last 24 Hours'],
                [`Run date: ${run.runDate}  |  Priority locations: Kochi > Thiruvananthapuram`],
                [],
                [
                  'Title',
                  'Company',
                  'Location',
                  'Date Posted',
                  'Source',
                  'Match Score /100',
                  'Reason',
                  'Direct Link',
                  'Tailored Resume'
                ],
                [
                  'Senior Software Engineer',
                  'NOV',
                  'Kochi',
                  run.runDate,
                  'LinkedIn',
                  '68',
                  'Generic senior SWE title at an established engineering company.',
                  'https://in.linkedin.com/jobs/view/example',
                  ''
                ],
                [
                  'Backend Engineer',
                  'Zoho',
                  'Chennai',
                  run.runDate,
                  'Naukri',
                  '85',
                  'Strong stack overlap.',
                  'https://www.naukri.com/job-listings/example',
                  'Zoho_BackendEngineer_resume.pdf'
                ]
              ]
            },
            {
              name: 'Notes',
              rows: [
                ['Notes & Gaps — Daily Job Openings Report'],
                ['1. No resume on file'],
                [
                  'Match scores are generic estimates, not personalized. Attach a resume for accuracy.'
                ]
              ]
            }
          ]
        }
      }
    ])
  )

  let todos: Todo[] = [
    { id: 1, text: 'Review daily job match report', done: true, sortOrder: 0 },
    { id: 2, text: 'Study: RSC & App Router — 1.5h', done: false, sortOrder: 1 },
    { id: 3, text: 'Update resume with latest project', done: false, sortOrder: 2 }
  ]

  let links: QuickLink[] = [
    { id: 1, label: 'Portfolio', url: '#', sortOrder: 0 },
    { id: 2, label: 'Resume PDF', url: '#', sortOrder: 1 },
    { id: 3, label: 'Naukri Profile', url: '#', sortOrder: 2 },
    { id: 4, label: 'GitHub', url: '#', sortOrder: 3 },
    { id: 5, label: 'Storybook', url: '#', sortOrder: 4 }
  ]

  const jobHuntPipeline: JobHuntPipelineSummary = {
    linked: true,
    scheduleLabel: 'Daily at 7:03 AM',
    bestMatchEver: {
      title: 'Full Stack Engineer (Fintech Focused)',
      company: '8byte',
      location: 'Bengaluru',
      datePosted: '2026-07-28',
      score: 100,
      reason: 'Matches: react, typescript, node.js, fintech domain',
      source: 'LinkedIn',
      url: '#',
      runDate: '2026-07-28'
    },
    runs: [
      {
        runId: 8,
        runDate: '2026-08-01',
        scanned: 105,
        strongFits: 7,
        newSinceLastRun: 102,
        topMatch: { title: 'Senior Python Full Stack Lead', company: 'Innova Solutions', score: 77 }
      },
      {
        runId: 7,
        runDate: '2026-07-31',
        scanned: 93,
        strongFits: 5,
        newSinceLastRun: 8,
        topMatch: { title: 'Tech Lead, Full Stack', company: 'CGI', score: 71 }
      },
      {
        runId: 6,
        runDate: '2026-07-30',
        scanned: 88,
        strongFits: 6,
        newSinceLastRun: 15,
        topMatch: { title: 'Full Stack AI Developer', company: 'Composite Structures', score: 74 }
      },
      {
        runId: 5,
        runDate: '2026-07-29',
        scanned: 74,
        strongFits: 4,
        newSinceLastRun: 3,
        topMatch: { title: 'Backend Engineer', company: 'Zoho', score: 68 }
      },
      {
        runId: 4,
        runDate: '2026-07-28',
        scanned: 81,
        strongFits: 9,
        newSinceLastRun: 20,
        topMatch: { title: 'Full Stack Engineer (Fintech Focused)', company: '8byte', score: 100 }
      }
    ]
  }

  let prepPlan: PrepPlan = {
    weeks: [
      {
        id: 1,
        weekNumber: 1,
        title: 'JS/TS & React fundamentals refresh',
        description: 'Closures, event loop, hooks internals, rendering behavior.',
        startDate: dateStr,
        endDate: dateStr,
        current: false
      },
      {
        id: 2,
        weekNumber: 2,
        title: 'Next.js App Router + RSC',
        description: 'Server components, streaming, data fetching patterns, caching.',
        startDate: dateStr,
        endDate: dateStr,
        current: true
      },
      {
        id: 3,
        weekNumber: 3,
        title: 'System design for frontend leads',
        description: 'Micro-frontends, monorepo strategy, performance & scale trade-offs.',
        startDate: dateStr,
        endDate: dateStr,
        current: false
      },
      {
        id: 4,
        weekNumber: 4,
        title: 'Leadership & mock interviews',
        description: 'Behavioral rounds, team-lead scenarios, mock panel sessions.',
        startDate: dateStr,
        endDate: dateStr,
        current: false
      }
    ],
    studyStreakDays: 9,
    studiedToday: false
  }

  const weather: WeatherSnapshot = {
    locationLabel: 'Kochi',
    tempC: 25,
    condition: 'Heavy rain',
    isDay: false,
    highC: 28,
    lowC: 25,
    precipChancePct: 60,
    fetchedAt: today.toISOString()
  }

  const claudeSessions: ClaudeSessionSummary[] = [
    {
      sessionId: 'mock-session-1',
      filePath: '/Users/mock/.claude/projects/-Users-mock-project/mock-session-1.jsonl',
      cwd: '/Users/mock/project',
      title: 'Fix flaky test in checkout flow',
      lastActiveAt: today.toISOString(),
      messageCount: 24
    },
    {
      sessionId: 'mock-session-2',
      filePath: '/Users/mock/.claude/projects/-Users-mock-other/mock-session-2.jsonl',
      cwd: '/Users/mock/other-project',
      title: null,
      lastActiveAt: new Date(today.getTime() - 86_400_000).toISOString(),
      messageCount: 6
    }
  ]

  const claudeTranscripts: Record<string, ClaudeTranscriptEntry[]> = {
    'mock-session-1': [
      {
        uuid: 'u1',
        role: 'user',
        timestamp: today.toISOString(),
        blocks: [{ type: 'text', text: 'Can you fix the flaky checkout test?' }]
      },
      {
        uuid: 'a1',
        role: 'assistant',
        timestamp: today.toISOString(),
        blocks: [
          { type: 'text', text: "Sure, let's look at the test file." },
          { type: 'tool_use', label: 'Bash(npm test -- checkout)' },
          {
            type: 'tool_result',
            label: '1 test failed: timing assertion off by 40ms',
            isError: true
          }
        ]
      }
    ]
  }

  let claudeBinaryStatus: ClaudeBinaryStatus = {
    path: '/opt/homebrew/bin/claude',
    source: 'well-known-path'
  }
  let claudePtyStatus: ClaudePtyStatus = { running: false, cwd: null, sessionId: null, pid: null }
  let lastClaudeCwd = '/Users/mock/project'

  return {
    getToday: async () => ({
      date: dateStr,
      dayType: 'weekday' as DayType,
      blocks,
      enabled: settings.timeTrackerEnabled
    }),
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
    addRule: async (rule) => {
      const created: ScheduleRule = {
        id: nextRuleId++,
        sortOrder: rulesByDay[rule.dayType].length,
        ...rule
      }
      rulesByDay[rule.dayType].push(created)
      return created
    },
    updateRule: async (ruleId, updates) => {
      for (const rules of Object.values(rulesByDay)) {
        const r = rules.find((x) => x.id === ruleId)
        if (r) Object.assign(r, updates)
      }
    },
    deleteRule: async (ruleId, dayType) => {
      rulesByDay[dayType] = rulesByDay[dayType].filter((r) => r.id !== ruleId)
      return rulesByDay[dayType]
    },
    addCategory: async (input) => {
      const created: Category = {
        id: nextCategoryId++,
        soundFile: input.soundFile ?? null,
        ...input
      }
      categories.push(created)
      return created
    },
    updateCategory: async (id, updates) => {
      const c = categories.find((x) => x.id === id)
      if (c) Object.assign(c, updates)
      return categories
    },
    deleteCategory: async (id) => {
      const inUse = Object.values(rulesByDay).some((rules) =>
        rules.some((r) => r.categoryId === id)
      )
      if (inUse) {
        return {
          ok: false,
          error: 'This category is used by one or more schedule blocks. Remove those blocks first.'
        }
      }
      const idx = categories.findIndex((c) => c.id === id)
      if (idx >= 0) categories.splice(idx, 1)
      return { ok: true }
    },
    getWeekStats: async () => weekStats,
    getSettings: async () => settings,
    setSetting: async (key, value) => {
      ;(settings as unknown as Record<string, unknown>)[key] = value
    },
    onDayChanged: () => () => {},
    getRoutines: async () => routines,
    getRoutineRuns: async (routineId) => routineRuns.filter((r) => r.routineId === routineId),
    getRoutineRunDetail: async (runId) => runDetails[runId] ?? null,
    linkRoutineOutput: async (routineId, watchPath, scheduleLabel) => {
      const r = routines.find((x) => x.id === routineId)
      if (r) {
        r.watchPath = watchPath
        r.scheduleLabel = scheduleLabel
      }
      return routines
    },
    checkRoutinesNow: async () => routines,
    pickWatchFile: async () => '/Users/mock/picked-file.xlsx',
    openRoutineRunFile: async () => {},
    openRoutineRunSidecarFile: async (_runId, filename) =>
      filename.endsWith('.pdf')
        ? { ok: true }
        : { ok: false, error: "That file wasn't saved with this run's snapshot" },

    getTodos: async () => todos,
    addTodo: async (text) => {
      todos.push({ id: todos.length + 1, text, done: false, sortOrder: todos.length })
      return todos
    },
    toggleTodo: async (id) => {
      const t = todos.find((x) => x.id === id)
      if (t) t.done = !t.done
      return todos
    },
    deleteTodo: async (id) => {
      todos = todos.filter((x) => x.id !== id)
      return todos
    },

    getLinks: async () => links,
    addLink: async (label, url) => {
      links.push({ id: links.length + 1, label, url, sortOrder: links.length })
      return links
    },
    deleteLink: async (id) => {
      links = links.filter((x) => x.id !== id)
      return links
    },
    openExternal: async () => {},

    getJobHuntPipeline: async () => jobHuntPipeline,
    getPrepPlan: async () => prepPlan,
    markStudiedToday: async () => {
      prepPlan = { ...prepPlan, studiedToday: true, studyStreakDays: prepPlan.studyStreakDays + 1 }
      return prepPlan
    },
    addPrepWeek: async (input) => {
      const week: PrepWeek = {
        id: nextPrepWeekId++,
        weekNumber: prepPlan.weeks.length + 1,
        current: false,
        ...input
      }
      prepPlan = { ...prepPlan, weeks: [...prepPlan.weeks, week] }
      return prepPlan.weeks
    },
    updatePrepWeek: async (id, updates) => {
      prepPlan = {
        ...prepPlan,
        weeks: prepPlan.weeks.map((w) => (w.id === id ? { ...w, ...updates } : w))
      }
      return prepPlan.weeks
    },
    deletePrepWeek: async (id) => {
      prepPlan = { ...prepPlan, weeks: prepPlan.weeks.filter((w) => w.id !== id) }
      return prepPlan.weeks
    },
    getWeather: async () => weather,

    getClaudeSessions: async () => claudeSessions,
    getClaudeTranscript: async (filePath) => {
      const session = claudeSessions.find((s) => s.filePath === filePath)
      return (session && claudeTranscripts[session.sessionId]) ?? []
    },
    getClaudeBinaryStatus: async () => claudeBinaryStatus,
    setClaudeBinaryOverride: async (path) => {
      claudeBinaryStatus = path
        ? { path, source: 'override' }
        : { path: '/opt/homebrew/bin/claude', source: 'well-known-path' }
      return claudeBinaryStatus
    },
    getClaudeLastCwd: async () => lastClaudeCwd,
    pickClaudeBinaryFile: async () => '/opt/homebrew/bin/claude',
    pickClaudeWorkingDirectory: async () => '/Users/mock/project',
    startClaudeSession: async (req) => {
      if (req.mode === 'new') lastClaudeCwd = req.cwd
      claudePtyStatus = {
        running: true,
        cwd: req.cwd,
        sessionId: req.mode === 'resume' ? req.sessionId : null,
        pid: 12345
      }
      return { ok: true, pid: 12345 }
    },
    stopClaudeSession: async () => {
      claudePtyStatus = { running: false, cwd: null, sessionId: null, pid: null }
    },
    getClaudePtyStatus: async () => claudePtyStatus,
    getClaudePtyBuffer: async () => '',
    writeClaudePtyInput: () => {},
    resizeClaudePty: () => {},
    onClaudePtyData: () => () => {},
    onClaudePtyExit: () => () => {}
  }
}

export const api = window.api ?? buildMockApi()

export type {
  AppSettings,
  BlockInstanceWithCategory,
  BlockStatus,
  Category,
  CategoryInput,
  CategoryKind,
  CategoryStat,
  ClaudeBinarySource,
  ClaudeBinaryStatus,
  ClaudeContentBlockSummary,
  ClaudePtyExitInfo,
  ClaudePtyStartRequest,
  ClaudePtyStartResult,
  ClaudePtyStatus,
  ClaudeSessionSummary,
  ClaudeTranscriptEntry,
  DayStat,
  DayType,
  DeleteResult,
  JobHuntLogEntry,
  JobHuntPipelineSummary,
  JobListing,
  ParsedSheet,
  ParsedWorkbook,
  PrepPlan,
  PrepWeek,
  PrepWeekInput,
  QuickLink,
  Routine,
  RoutineRun,
  RoutineRunDetail,
  RoutineWithLatestRun,
  RunStatus,
  ScheduleRule,
  ScheduleRuleInput,
  Todo,
  TodaySnapshot,
  WeatherSnapshot,
  WeekStats
} from '../../shared/types'
