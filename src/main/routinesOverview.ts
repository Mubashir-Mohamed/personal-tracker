import { getRoutineRunDetail, getRoutineRuns, getRoutines } from './routinesDb'
import { findHeaderRowIndex } from '../shared/sheetUtils'
import type { ParsedSheet, RoutineOverviewEntry, ScoredItem } from '../shared/types'

const STRONG_FIT_THRESHOLD = 70

function findColumn(header: string[], pattern: RegExp): number {
  return header.findIndex((cell) => pattern.test(cell.trim()))
}

/** Any routine's output sheet counts as "scored" if it has both a title and a score column —
 *  works for job listings, leads, deals, or anything else a routine scores and ranks. Sheets
 *  that don't look like this just fall back to a generic row/sheet count (see getRoutinesOverview). */
function looksScored(sheet: ParsedSheet): boolean {
  const headerIndex = findHeaderRowIndex(sheet.rows)
  const header = sheet.rows[headerIndex] ?? []
  return findColumn(header, /title/i) !== -1 && findColumn(header, /score/i) !== -1
}

function parseScoredSheet(sheet: ParsedSheet): ScoredItem[] {
  const headerIndex = findHeaderRowIndex(sheet.rows)
  const header = sheet.rows[headerIndex] ?? []

  const col = {
    title: findColumn(header, /title/i),
    company: findColumn(header, /company/i),
    location: findColumn(header, /location/i),
    datePosted: findColumn(header, /date posted/i),
    score: findColumn(header, /score/i),
    reason: findColumn(header, /reason/i),
    source: findColumn(header, /source/i),
    url: findColumn(header, /link/i)
  }
  if (col.title === -1) return []

  const items: ScoredItem[] = []
  for (const row of sheet.rows.slice(headerIndex + 1)) {
    const title = row[col.title]?.trim()
    if (!title) continue
    items.push({
      title,
      company: col.company >= 0 ? (row[col.company]?.trim() ?? '') : '',
      location: col.location >= 0 ? (row[col.location]?.trim() ?? '') : '',
      datePosted: col.datePosted >= 0 ? (row[col.datePosted]?.trim() ?? '') : '',
      score: col.score >= 0 ? Number(row[col.score]) || 0 : 0,
      reason: col.reason >= 0 ? (row[col.reason]?.trim() ?? '') : '',
      source: col.source >= 0 ? (row[col.source]?.trim() ?? '') : '',
      url: col.url >= 0 ? (row[col.url]?.trim() ?? '') : ''
    })
  }
  return items
}

function itemKey(item: ScoredItem): string {
  return item.url || `${item.title}::${item.company}`
}

/** Summarizes every routine that's linked to an output file — not just one picked routine, and
 *  not filtered to any particular subject. Each entry's latest run is auto-classified: if its
 *  primary sheet looks like a scored list (see looksScored), it gets scanned/strong-fit/top-match
 *  stats; otherwise it gets a generic sheet/row count. Powers the Home dashboard's Routines card. */
export function getRoutinesOverview(): RoutineOverviewEntry[] {
  return getRoutines()
    .filter((r) => r.watchPath)
    .map((routine): RoutineOverviewEntry => {
      const base = {
        routineId: routine.id,
        name: routine.name,
        scheduleLabel: routine.scheduleLabel
      }
      const runs = getRoutineRuns(routine.id).filter((r) => r.status === 'parsed')
      if (runs.length === 0) {
        return {
          ...base,
          latestRunId: null,
          latestRunDate: null,
          runCount: 0,
          scored: null,
          sheetSummary: null
        }
      }

      const [latest, previous] = runs // getRoutineRuns orders newest-first
      const latestDetail = getRoutineRunDetail(latest.id)
      const scoredSheet = latestDetail?.parsed?.sheets.find(looksScored)

      if (!scoredSheet) {
        const sheetSummary = latestDetail?.parsed
          ? {
              sheetCount: latestDetail.parsed.sheets.length,
              rowCount: latestDetail.parsed.sheets.reduce(
                (sum, s) => sum + Math.max(0, s.rows.length - 1),
                0
              )
            }
          : null
        return {
          ...base,
          latestRunId: latest.id,
          latestRunDate: latest.runDate,
          runCount: runs.length,
          scored: null,
          sheetSummary
        }
      }

      const items = parseScoredSheet(scoredSheet)
      let newSinceLastRun = items.length
      if (previous) {
        const previousSheet = getRoutineRunDetail(previous.id)?.parsed?.sheets.find(looksScored)
        if (previousSheet) {
          const previousKeys = new Set(parseScoredSheet(previousSheet).map(itemKey))
          newSinceLastRun = items.filter((i) => !previousKeys.has(itemKey(i))).length
        }
      }
      const top = [...items].sort((a, b) => b.score - a.score)[0]

      return {
        ...base,
        latestRunId: latest.id,
        latestRunDate: latest.runDate,
        runCount: runs.length,
        scored: {
          scanned: items.length,
          strongFits: items.filter((i) => i.score >= STRONG_FIT_THRESHOLD).length,
          newSinceLastRun,
          topMatch: top ? { title: top.title, company: top.company, score: top.score } : null
        },
        sheetSummary: null
      }
    })
    .sort((a, b) => (b.latestRunDate ?? '').localeCompare(a.latestRunDate ?? ''))
}
