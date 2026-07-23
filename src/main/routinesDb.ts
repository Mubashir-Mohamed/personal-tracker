import { getDb } from './db'
import type { ParsedWorkbook, Routine, RoutineRun, RoutineWithLatestRun, RunStatus } from '../shared/types'

function rowToRoutine(row: any): Routine {
  return {
    id: row.id,
    taskId: row.task_id,
    name: row.name,
    description: row.description,
    prompt: row.prompt,
    scheduleLabel: row.schedule_label,
    watchPath: row.watch_path,
    createdAt: row.created_at
  }
}

function rowToRun(row: any): RoutineRun {
  return {
    id: row.id,
    routineId: row.routine_id,
    runDate: row.run_date,
    detectedAt: row.detected_at,
    sourceMtime: row.source_mtime,
    archivedPath: row.archived_path,
    status: row.status,
    errorMessage: row.error_message
  }
}

export function upsertRoutineFromDisk(taskId: string, name: string, description: string, prompt: string): void {
  const db = getDb()
  db.prepare(
    `INSERT INTO routines (task_id, name, description, prompt, created_at)
     VALUES (@taskId, @name, @description, @prompt, @createdAt)
     ON CONFLICT(task_id) DO UPDATE SET
       name = @name,
       description = @description,
       prompt = @prompt`
  ).run({ taskId, name, description, prompt, createdAt: new Date().toISOString() })
}

export function getRoutines(): RoutineWithLatestRun[] {
  const db = getDb()
  const routines = (db.prepare('SELECT * FROM routines ORDER BY created_at').all() as any[]).map(rowToRoutine)
  return routines.map((routine) => {
    const summary = db
      .prepare(
        'SELECT MAX(run_date) as latestRunDate, COUNT(*) as runCount FROM routine_runs WHERE routine_id = ?'
      )
      .get(routine.id) as { latestRunDate: string | null; runCount: number }
    return { ...routine, latestRunDate: summary.latestRunDate, runCount: summary.runCount }
  })
}

export function getRoutine(routineId: number): Routine | undefined {
  const row = getDb().prepare('SELECT * FROM routines WHERE id = ?').get(routineId) as any
  return row ? rowToRoutine(row) : undefined
}

export function linkRoutineOutput(routineId: number, watchPath: string, scheduleLabel: string): void {
  getDb()
    .prepare('UPDATE routines SET watch_path = ?, schedule_label = ? WHERE id = ?')
    .run(watchPath, scheduleLabel, routineId)
}

export function getRoutineRuns(routineId: number): RoutineRun[] {
  return (
    getDb()
      .prepare('SELECT * FROM routine_runs WHERE routine_id = ? ORDER BY run_date DESC')
      .all(routineId) as any[]
  ).map(rowToRun)
}

export function getLatestRunSourceMtime(routineId: number): string | undefined {
  const row = getDb()
    .prepare('SELECT source_mtime FROM routine_runs WHERE routine_id = ? ORDER BY run_date DESC LIMIT 1')
    .get(routineId) as { source_mtime: string } | undefined
  return row?.source_mtime
}

export function upsertRoutineRun(run: {
  routineId: number
  runDate: string
  detectedAt: string
  sourceMtime: string
  archivedPath: string
  status: RunStatus
  errorMessage: string | null
  parsed: ParsedWorkbook | null
}): void {
  getDb()
    .prepare(
      `INSERT INTO routine_runs
         (routine_id, run_date, detected_at, source_mtime, archived_path, status, error_message, parsed_json)
       VALUES (@routineId, @runDate, @detectedAt, @sourceMtime, @archivedPath, @status, @errorMessage, @parsedJson)
       ON CONFLICT(routine_id, run_date) DO UPDATE SET
         detected_at = @detectedAt,
         source_mtime = @sourceMtime,
         archived_path = @archivedPath,
         status = @status,
         error_message = @errorMessage,
         parsed_json = @parsedJson`
    )
    .run({
      routineId: run.routineId,
      runDate: run.runDate,
      detectedAt: run.detectedAt,
      sourceMtime: run.sourceMtime,
      archivedPath: run.archivedPath,
      status: run.status,
      errorMessage: run.errorMessage,
      parsedJson: run.parsed ? JSON.stringify(run.parsed) : null
    })
}

export function getRoutineRunDetail(runId: number): (RoutineRun & { parsed: ParsedWorkbook | null }) | undefined {
  const row = getDb().prepare('SELECT * FROM routine_runs WHERE id = ?').get(runId) as any
  if (!row) return undefined
  return { ...rowToRun(row), parsed: row.parsed_json ? JSON.parse(row.parsed_json) : null }
}
