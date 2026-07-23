import Database from 'better-sqlite3'
import { app } from 'electron'
import { join } from 'path'
import type {
  AppSettings,
  BlockInstance,
  BlockInstanceWithCategory,
  BlockStatus,
  Category,
  DayType,
  JobHuntLogEntry,
  ScheduleRule
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
  `)

  seedDefaults()

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
  throw new Error(`Unknown setting key: ${String(key)}`)
}

export function setSetting<T extends keyof AppSettings>(key: T, value: AppSettings[T]): void {
  db.prepare(
    `INSERT INTO settings (key, value) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`
  ).run(key, String(value))
}

export function getDb(): Database.Database {
  return db
}
