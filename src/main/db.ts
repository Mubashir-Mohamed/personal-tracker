import Database from 'better-sqlite3'
import { app } from 'electron'
import { join } from 'path'
import { format, addDays } from 'date-fns'
import type {
  AppSettings,
  BlockInstance,
  BlockInstanceWithCategory,
  BlockStatus,
  Category,
  DayType,
  JobHuntLogEntry,
  PrepWeek,
  QuickLink,
  ScheduleRule,
  Todo
} from '../shared/types'

let db: Database.Database

export function initDb(): Database.Database {
  const dbPath = join(app.getPath('userData'), 'personal-tracker.db')
  db = new Database(dbPath)
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')

  db.exec(`
    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      color TEXT NOT NULL,
      sound_file TEXT,
      kind TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS schedule_rules (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      day_type TEXT NOT NULL CHECK (day_type IN ('weekday', 'weekend')),
      category_id INTEGER NOT NULL REFERENCES categories(id),
      start_time TEXT NOT NULL,
      end_time TEXT NOT NULL,
      label TEXT NOT NULL,
      sort_order INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS block_instances (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL,
      rule_id INTEGER REFERENCES schedule_rules(id),
      category_id INTEGER NOT NULL REFERENCES categories(id),
      label TEXT NOT NULL,
      planned_start TEXT NOT NULL,
      planned_end TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      notified_pre INTEGER NOT NULL DEFAULT 0,
      notified_start INTEGER NOT NULL DEFAULT 0,
      notified_end INTEGER NOT NULL DEFAULT 0,
      sort_order INTEGER NOT NULL DEFAULT 0,
      UNIQUE(date, rule_id)
    );

    CREATE TABLE IF NOT EXISTS job_hunt_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL UNIQUE,
      applications_count INTEGER NOT NULL DEFAULT 0,
      companies TEXT NOT NULL DEFAULT '[]',
      notes TEXT NOT NULL DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS routines (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      task_id TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      description TEXT NOT NULL,
      prompt TEXT NOT NULL,
      schedule_label TEXT,
      watch_path TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS routine_runs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      routine_id INTEGER NOT NULL REFERENCES routines(id),
      run_date TEXT NOT NULL,
      detected_at TEXT NOT NULL,
      source_mtime TEXT NOT NULL,
      archived_path TEXT NOT NULL,
      status TEXT NOT NULL,
      error_message TEXT,
      parsed_json TEXT,
      UNIQUE(routine_id, run_date)
    );

    CREATE TABLE IF NOT EXISTS todos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      text TEXT NOT NULL,
      done INTEGER NOT NULL DEFAULT 0,
      sort_order INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS links (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      label TEXT NOT NULL,
      url TEXT NOT NULL,
      sort_order INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS prep_weeks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      week_number INTEGER NOT NULL,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      start_date TEXT NOT NULL,
      end_date TEXT NOT NULL
    );
  `)

  seedDefaults()
  seedDashboardDefaults()

  return db
}

function seedDefaults(): void {
  const categoryCount = db.prepare('SELECT COUNT(*) as n FROM categories').get() as { n: number }
  if (categoryCount.n > 0) return

  const insertCategory = db.prepare(
    'INSERT INTO categories (name, color, sound_file, kind) VALUES (?, ?, ?, ?)'
  )
  const ids = {
    work: insertCategory.run('Job Work', '#5b8def', null, 'work').lastInsertRowid as number,
    lunch: insertCategory.run('Lunch Break', '#f2b134', null, 'break').lastInsertRowid as number,
    jobHunt: insertCategory.run('Job Hunt', '#e0575b', null, 'job_hunt')
      .lastInsertRowid as number,
    family: insertCategory.run('Family Time', '#2fbf71', null, 'family')
      .lastInsertRowid as number,
    weekendLeisure: insertCategory.run('Leisure & Job Hunt', '#9b59b6', null, 'job_hunt')
      .lastInsertRowid as number
  }

  const insertRule = db.prepare(
    `INSERT INTO schedule_rules (day_type, category_id, start_time, end_time, label, sort_order)
     VALUES (?, ?, ?, ?, ?, ?)`
  )

  // Weekday: 9am-6pm job, with 1:15-2:15pm lunch carved out, 1hr job hunt, 1.5hr family
  insertRule.run('weekday', ids.work, '09:00', '13:15', 'Job Work', 0)
  insertRule.run('weekday', ids.lunch, '13:15', '14:15', 'Lunch Break', 1)
  insertRule.run('weekday', ids.work, '14:15', '18:00', 'Job Work', 2)
  insertRule.run('weekday', ids.jobHunt, '18:30', '19:30', 'Job Hunt', 3)
  insertRule.run('weekday', ids.family, '19:30', '21:00', 'Family Time', 4)

  // Weekend: default 50/50 split of waking hours (9am-11pm), editable in Settings
  insertRule.run('weekend', ids.family, '09:00', '16:00', 'Family Time', 0)
  insertRule.run('weekend', ids.weekendLeisure, '16:00', '23:00', 'Leisure & Job Hunt', 1)

  db.prepare("INSERT INTO settings (key, value) VALUES ('notificationLeadMinutes', '10')").run()
  db.prepare("INSERT INTO settings (key, value) VALUES ('autoLaunch', 'true')").run()
  db.prepare("INSERT INTO settings (key, value) VALUES ('timeTrackerEnabled', 'true')").run()
}

function seedDashboardDefaults(): void {
  // Gate the whole thing behind a one-time flag, not "table is currently empty" — otherwise
  // deleting every todo/link down to zero would silently bring the sample data back on next launch.
  if (getRawMeta('dashboardSeeded') === 'true') return

  const todoCount = db.prepare('SELECT COUNT(*) as n FROM todos').get() as { n: number }
  if (todoCount.n === 0) {
    const insert = db.prepare(
      'INSERT INTO todos (text, done, sort_order) VALUES (@text, @done, @sortOrder)'
    )
    ;[
      { text: 'Review daily job match report', done: 1, sortOrder: 0 },
      { text: 'Study: RSC & App Router — 1.5h', done: 0, sortOrder: 1 },
      { text: 'Update resume with latest project', done: 0, sortOrder: 2 }
    ].forEach((t) => insert.run(t))
  }

  const linkCount = db.prepare('SELECT COUNT(*) as n FROM links').get() as { n: number }
  if (linkCount.n === 0) {
    const insert = db.prepare(
      'INSERT INTO links (label, url, sort_order) VALUES (@label, @url, @sortOrder)'
    )
    ;[
      { label: 'Portfolio', url: '#', sortOrder: 0 },
      { label: 'Resume PDF', url: '#', sortOrder: 1 },
      { label: 'Naukri Profile', url: '#', sortOrder: 2 },
      { label: 'GitHub', url: '#', sortOrder: 3 },
      { label: 'Storybook', url: '#', sortOrder: 4 }
    ].forEach((l) => insert.run(l))
  }

  const weekCount = db.prepare('SELECT COUNT(*) as n FROM prep_weeks').get() as { n: number }
  if (weekCount.n === 0) {
    // Plan "started" a week ago so week 2 is active on first run.
    const planStart = addDays(new Date(), -7)
    const insert = db.prepare(
      `INSERT INTO prep_weeks (week_number, title, description, start_date, end_date)
       VALUES (@weekNumber, @title, @description, @startDate, @endDate)`
    )
    const weeks = [
      {
        weekNumber: 1,
        title: 'JS/TS & React fundamentals refresh',
        description: 'Closures, event loop, hooks internals, rendering behavior.'
      },
      {
        weekNumber: 2,
        title: 'Next.js App Router + RSC',
        description: 'Server components, streaming, data fetching patterns, caching.'
      },
      {
        weekNumber: 3,
        title: 'System design for frontend leads',
        description: 'Micro-frontends, monorepo strategy, performance & scale trade-offs.'
      },
      {
        weekNumber: 4,
        title: 'Leadership & mock interviews',
        description: 'Behavioral rounds, team-lead scenarios, mock panel sessions.'
      }
    ]
    weeks.forEach((w, i) => {
      const startDate = addDays(planStart, i * 7)
      const endDate = addDays(startDate, 6)
      insert.run({
        ...w,
        startDate: format(startDate, 'yyyy-MM-dd'),
        endDate: format(endDate, 'yyyy-MM-dd')
      })
    })
  }

  const insertMeta = db.prepare('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)')
  insertMeta.run('studyStreakDays', '9')
  insertMeta.run('lastStudyDate', format(addDays(new Date(), -1), 'yyyy-MM-dd'))
  insertMeta.run('weatherCache', '')

  setRawMeta('dashboardSeeded', 'true')
}

function rowToCategory(row: any): Category {
  return {
    id: row.id,
    name: row.name,
    color: row.color,
    soundFile: row.sound_file,
    kind: row.kind
  }
}

function rowToRule(row: any): ScheduleRule {
  return {
    id: row.id,
    dayType: row.day_type,
    categoryId: row.category_id,
    startTime: row.start_time,
    endTime: row.end_time,
    label: row.label,
    sortOrder: row.sort_order
  }
}

function rowToBlock(row: any): BlockInstance {
  return {
    id: row.id,
    date: row.date,
    ruleId: row.rule_id,
    categoryId: row.category_id,
    label: row.label,
    plannedStart: row.planned_start,
    plannedEnd: row.planned_end,
    status: row.status,
    sortOrder: row.sort_order
  }
}

export function getCategories(): Category[] {
  return (db.prepare('SELECT * FROM categories').all() as any[]).map(rowToCategory)
}

export function getCategory(id: number): Category | undefined {
  const row = db.prepare('SELECT * FROM categories WHERE id = ?').get(id) as any
  return row ? rowToCategory(row) : undefined
}

export function getRulesForDayType(dayType: DayType): ScheduleRule[] {
  return (
    db
      .prepare('SELECT * FROM schedule_rules WHERE day_type = ? ORDER BY sort_order')
      .all(dayType) as any[]
  ).map(rowToRule)
}

export function updateRuleTimes(ruleId: number, startTime: string, endTime: string): void {
  db.prepare('UPDATE schedule_rules SET start_time = ?, end_time = ? WHERE id = ?').run(
    startTime,
    endTime,
    ruleId
  )
}

export function insertBlockInstance(
  block: Omit<BlockInstance, 'id' | 'status'> & { status?: BlockStatus }
): void {
  db.prepare(
    `INSERT OR IGNORE INTO block_instances
       (date, rule_id, category_id, label, planned_start, planned_end, status, sort_order)
     VALUES (@date, @ruleId, @categoryId, @label, @plannedStart, @plannedEnd, @status, @sortOrder)`
  ).run({ ...block, status: block.status ?? 'pending' })
}

export function getBlocksForDate(date: string): BlockInstanceWithCategory[] {
  const rows = db
    .prepare('SELECT * FROM block_instances WHERE date = ? ORDER BY sort_order')
    .all(date) as any[]
  const categories = new Map(getCategories().map((c) => [c.id, c]))
  return rows.map((row) => ({ ...rowToBlock(row), category: categories.get(row.category_id)! }))
}

export function getBlocksInRange(startDate: string, endDate: string): BlockInstanceWithCategory[] {
  const rows = db
    .prepare('SELECT * FROM block_instances WHERE date >= ? AND date <= ? ORDER BY date, sort_order')
    .all(startDate, endDate) as any[]
  const categories = new Map(getCategories().map((c) => [c.id, c]))
  return rows.map((row) => ({ ...rowToBlock(row), category: categories.get(row.category_id)! }))
}

export function updateBlockStatus(blockId: number, status: BlockStatus): void {
  db.prepare('UPDATE block_instances SET status = ? WHERE id = ?').run(status, blockId)
}

export function rescheduleBlock(blockId: number, plannedStart: string, plannedEnd: string): void {
  db.prepare(
    'UPDATE block_instances SET planned_start = ?, planned_end = ? WHERE id = ?'
  ).run(plannedStart, plannedEnd, blockId)
}

export function getBlocksNeedingNotification(
  kind: 'notified_pre' | 'notified_start' | 'notified_end',
  date: string
): BlockInstanceWithCategory[] {
  const rows = db
    .prepare(`SELECT * FROM block_instances WHERE date = ? AND ${kind} = 0 AND status != 'skipped'`)
    .all(date) as any[]
  const categories = new Map(getCategories().map((c) => [c.id, c]))
  return rows.map((row) => ({ ...rowToBlock(row), category: categories.get(row.category_id)! }))
}

export function markNotified(
  blockId: number,
  kind: 'notified_pre' | 'notified_start' | 'notified_end'
): void {
  db.prepare(`UPDATE block_instances SET ${kind} = 1 WHERE id = ?`).run(blockId)
}

export function getJobHuntLog(date: string): JobHuntLogEntry | undefined {
  const row = db.prepare('SELECT * FROM job_hunt_log WHERE date = ?').get(date) as any
  if (!row) return undefined
  return {
    date: row.date,
    applicationsCount: row.applications_count,
    companies: JSON.parse(row.companies),
    notes: row.notes
  }
}

export function upsertJobHuntLog(entry: JobHuntLogEntry): void {
  db.prepare(
    `INSERT INTO job_hunt_log (date, applications_count, companies, notes)
     VALUES (@date, @applicationsCount, @companies, @notes)
     ON CONFLICT(date) DO UPDATE SET
       applications_count = @applicationsCount,
       companies = @companies,
       notes = @notes`
  ).run({
    date: entry.date,
    applicationsCount: entry.applicationsCount,
    companies: JSON.stringify(entry.companies),
    notes: entry.notes
  })
}

export function getSetting<T extends keyof AppSettings>(key: T): AppSettings[T] {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key) as
    | { value: string }
    | undefined
  const raw = row?.value
  if (key === 'notificationLeadMinutes') return Number(raw ?? 10) as AppSettings[T]
  if (key === 'autoLaunch') return ((raw ?? 'true') === 'true') as AppSettings[T]
  if (key === 'timeTrackerEnabled') return ((raw ?? 'true') === 'true') as AppSettings[T]
  throw new Error(`Unknown setting key: ${String(key)}`)
}

export function setSetting<T extends keyof AppSettings>(key: T, value: AppSettings[T]): void {
  db.prepare(
    `INSERT INTO settings (key, value) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`
  ).run(key, String(value))
}

// ---- Generic string metadata (used by the dashboard for the study streak & weather cache;
// separate from the strictly-typed AppSettings above, which is what Settings exposes). ----

export function getRawMeta(key: string): string | undefined {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key) as
    | { value: string }
    | undefined
  return row?.value
}

export function setRawMeta(key: string, value: string): void {
  db.prepare(
    `INSERT INTO settings (key, value) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`
  ).run(key, value)
}

// ---- Todos ----

function rowToTodo(row: any): Todo {
  return { id: row.id, text: row.text, done: !!row.done, sortOrder: row.sort_order }
}

export function getTodos(): Todo[] {
  return (db.prepare('SELECT * FROM todos ORDER BY sort_order, id').all() as any[]).map(rowToTodo)
}

export function addTodo(text: string): Todo[] {
  const maxOrder = db.prepare('SELECT COALESCE(MAX(sort_order), -1) as m FROM todos').get() as {
    m: number
  }
  db.prepare('INSERT INTO todos (text, done, sort_order) VALUES (?, 0, ?)').run(
    text,
    maxOrder.m + 1
  )
  return getTodos()
}

export function toggleTodo(id: number): Todo[] {
  db.prepare('UPDATE todos SET done = 1 - done WHERE id = ?').run(id)
  return getTodos()
}

export function deleteTodo(id: number): Todo[] {
  db.prepare('DELETE FROM todos WHERE id = ?').run(id)
  return getTodos()
}

// ---- Quick links ----

function rowToLink(row: any): QuickLink {
  return { id: row.id, label: row.label, url: row.url, sortOrder: row.sort_order }
}

export function getLinks(): QuickLink[] {
  return (db.prepare('SELECT * FROM links ORDER BY sort_order, id').all() as any[]).map(rowToLink)
}

export function addLink(label: string, url: string): QuickLink[] {
  const maxOrder = db.prepare('SELECT COALESCE(MAX(sort_order), -1) as m FROM links').get() as {
    m: number
  }
  db.prepare('INSERT INTO links (label, url, sort_order) VALUES (?, ?, ?)').run(
    label,
    url,
    maxOrder.m + 1
  )
  return getLinks()
}

export function deleteLink(id: number): QuickLink[] {
  db.prepare('DELETE FROM links WHERE id = ?').run(id)
  return getLinks()
}

// ---- Interview prep plan ----

function rowToPrepWeek(row: any, today: string): PrepWeek {
  return {
    id: row.id,
    weekNumber: row.week_number,
    title: row.title,
    description: row.description,
    startDate: row.start_date,
    endDate: row.end_date,
    current: today >= row.start_date && today <= row.end_date
  }
}

export function getPrepWeeks(): PrepWeek[] {
  const today = format(new Date(), 'yyyy-MM-dd')
  return (db.prepare('SELECT * FROM prep_weeks ORDER BY week_number').all() as any[]).map((row) =>
    rowToPrepWeek(row, today)
  )
}

export function getStudyStreakState(): { studyStreakDays: number; studiedToday: boolean } {
  const today = format(new Date(), 'yyyy-MM-dd')
  const lastStudyDate = getRawMeta('lastStudyDate') ?? ''
  const studyStreakDays = Number(getRawMeta('studyStreakDays') ?? '0')
  return { studyStreakDays, studiedToday: lastStudyDate === today }
}

export function markStudiedToday(): { studyStreakDays: number; studiedToday: boolean } {
  const today = format(new Date(), 'yyyy-MM-dd')
  const yesterday = format(addDays(new Date(), -1), 'yyyy-MM-dd')
  const lastStudyDate = getRawMeta('lastStudyDate') ?? ''
  const currentStreak = Number(getRawMeta('studyStreakDays') ?? '0')

  if (lastStudyDate === today) return { studyStreakDays: currentStreak, studiedToday: true }

  const nextStreak = lastStudyDate === yesterday ? currentStreak + 1 : 1
  setRawMeta('studyStreakDays', String(nextStreak))
  setRawMeta('lastStudyDate', today)
  return { studyStreakDays: nextStreak, studiedToday: true }
}

export function getDb(): Database.Database {
  return db
}
