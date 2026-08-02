import { app } from 'electron'
import { existsSync, mkdirSync, copyFileSync, statSync, readdirSync, readFileSync } from 'fs'
import { homedir } from 'os'
import { join, basename, dirname } from 'path'
import ExcelJS from 'exceljs'
import { findHeaderRowIndex } from '../shared/sheetUtils'
import type { ParsedWorkbook } from '../shared/types'
import { getRoutines, upsertRoutineFromDisk, getLatestRunSourceMtime, upsertRoutineRun } from './routinesDb'

const SCHEDULED_TASKS_DIR = join(homedir(), '.claude', 'scheduled-tasks')

function parseSkillMd(content: string): { name: string; description: string; prompt: string } {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/)
  if (!match) return { name: '', description: '', prompt: content.trim() }

  const [, frontmatter, body] = match
  const fields: Record<string, string> = {}
  for (const line of frontmatter.split('\n')) {
    const colonIndex = line.indexOf(':')
    if (colonIndex === -1) continue
    const key = line.slice(0, colonIndex).trim()
    const value = line.slice(colonIndex + 1).trim()
    fields[key] = value
  }
  return { name: fields.name ?? '', description: fields.description ?? '', prompt: body.trim() }
}

/** Scans ~/.claude/scheduled-tasks/*\/SKILL.md and syncs each routine's name/description/prompt.
 *  Never touches watch_path/schedule_label — those are user-set. */
export function syncRoutinesFromDisk(): void {
  if (!existsSync(SCHEDULED_TASKS_DIR)) return

  for (const taskId of readdirSync(SCHEDULED_TASKS_DIR)) {
    const skillPath = join(SCHEDULED_TASKS_DIR, taskId, 'SKILL.md')
    if (!existsSync(skillPath)) continue
    try {
      const content = readFileSync(skillPath, 'utf-8')
      const { name, description, prompt } = parseSkillMd(content)
      upsertRoutineFromDisk(taskId, name || taskId, description, prompt)
    } catch (err) {
      console.error(`Failed to read scheduled task "${taskId}"`, err)
    }
  }
}

async function parseWorkbook(filePath: string): Promise<ParsedWorkbook> {
  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.readFile(filePath)
  const sheets: ParsedWorkbook['sheets'] = []

  workbook.eachSheet((worksheet) => {
    const rows: string[][] = []
    worksheet.eachRow({ includeEmpty: false }, (row) => {
      const cells: string[] = []
      row.eachCell({ includeEmpty: true }, (cell) => {
        cells.push(cell.text ?? '')
      })
      rows.push(cells)
    })
    sheets.push({ name: worksheet.name, rows })
  })

  return { sheets }
}

/** Some routines generate per-row sidecar files (e.g. a tailored resume PDF for a job
 *  listing) referenced by filename in a "Tailored Resume" column. Copies any that exist
 *  next to the watched file into the same per-run archive folder as the main workbook. */
function archiveSidecarFiles(parsed: ParsedWorkbook, sourceDir: string, archiveDir: string): void {
  for (const sheet of parsed.sheets) {
    if (sheet.rows.length === 0) continue

    const headerIndex = findHeaderRowIndex(sheet.rows)
    const headerRow = sheet.rows[headerIndex]
    const colIndex = headerRow.findIndex((h) => /tailored resume/i.test(h.trim()))
    if (colIndex === -1) continue

    for (const row of sheet.rows.slice(headerIndex + 1)) {
      const filename = row[colIndex]?.trim()
      if (!filename) continue

      const sourcePath = join(sourceDir, basename(filename))
      const destPath = join(archiveDir, basename(filename))
      if (existsSync(destPath) || !existsSync(sourcePath)) continue

      try {
        copyFileSync(sourcePath, destPath)
      } catch (err) {
        console.error(`Failed to archive sidecar file "${filename}"`, err)
      }
    }
  }
}

/** For every routine with a watch_path set, checks if the output file changed since the
 *  last recorded run and, if so, archives + parses a dated snapshot. */
export async function checkRoutineRuns(): Promise<void> {
  for (const routine of getRoutines()) {
    if (!routine.watchPath) continue
    if (!existsSync(routine.watchPath)) continue

    const stat = statSync(routine.watchPath)
    const mtime = stat.mtime.toISOString()
    const lastMtime = getLatestRunSourceMtime(routine.id)
    if (lastMtime === mtime) continue

    const now = new Date()
    const runDate = now.toISOString().slice(0, 10)
    const archiveDir = join(app.getPath('userData'), 'routine-archives', String(routine.id), runDate)
    mkdirSync(archiveDir, { recursive: true })
    const archivedPath = join(archiveDir, basename(routine.watchPath))

    try {
      copyFileSync(routine.watchPath, archivedPath)
      const parsed = await parseWorkbook(archivedPath)
      archiveSidecarFiles(parsed, dirname(routine.watchPath), archiveDir)
      upsertRoutineRun({
        routineId: routine.id,
        runDate,
        detectedAt: now.toISOString(),
        sourceMtime: mtime,
        archivedPath,
        status: 'parsed',
        errorMessage: null,
        parsed
      })
    } catch (err) {
      upsertRoutineRun({
        routineId: routine.id,
        runDate,
        detectedAt: now.toISOString(),
        sourceMtime: mtime,
        archivedPath,
        status: 'error',
        errorMessage: err instanceof Error ? err.message : String(err),
        parsed: null
      })
    }
  }
}

export async function checkRoutinesNow(): Promise<void> {
  syncRoutinesFromDisk()
  await checkRoutineRuns()
}

export function startRoutinesWatcher(): () => void {
  checkRoutinesNow().catch((err) => console.error('routine check failed', err))
  const interval = setInterval(() => {
    checkRoutinesNow().catch((err) => console.error('routine check failed', err))
  }, 5 * 60_000)
  return () => clearInterval(interval)
}
