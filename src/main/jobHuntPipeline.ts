import { basename } from 'path'
import { getRoutineRunDetail, getRoutineRuns, getRoutines } from './routinesDb'
import { findHeaderRowIndex } from '../shared/sheetUtils'
import type { JobHuntPipelineSummary, JobHuntRunSummary, JobListing, ParsedSheet } from '../shared/types'

const STRONG_FIT_THRESHOLD = 70

function findColumn(header: string[], pattern: RegExp): number {
  return header.findIndex((cell) => pattern.test(cell.trim()))
}

function parseJobSheet(sheet: ParsedSheet): JobListing[] {
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

  const listings: JobListing[] = []
  for (const row of sheet.rows.slice(headerIndex + 1)) {
    const title = row[col.title]?.trim()
    if (!title) continue
    listings.push({
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
  return listings
}

function listingKey(listing: JobListing): string {
  return listing.url || `${listing.title}::${listing.company}`
}

const EMPTY_SUMMARY: JobHuntPipelineSummary = {
  linked: false,
  scheduleLabel: null,
  bestMatchEver: null,
  runs: []
}

/** Reads the "daily-job-listing" Claude routine's already-archived xlsx snapshots
 *  (see routines.ts / routinesDb.ts) — no separate import pipeline needed. */
export function getJobHuntPipelineSummary(): JobHuntPipelineSummary {
  const routine = getRoutines().find((r) => {
    if (!r.watchPath) return false
    const haystack = `${basename(r.watchPath)} ${r.taskId} ${r.name}`
    return /job.?openings|job.?listing/i.test(haystack)
  })
  if (!routine) return EMPTY_SUMMARY

  const runsDesc = getRoutineRuns(routine.id).filter((r) => r.status === 'parsed')
  if (runsDesc.length === 0) {
    return { ...EMPTY_SUMMARY, linked: true, scheduleLabel: routine.scheduleLabel }
  }

  // Walk every archived run oldest-first so each run's "new" count diffs against the
  // run immediately before it, and the all-time best match is found along the way.
  const runsAsc = [...runsDesc].reverse()
  const summaryByRunId = new Map<number, JobHuntRunSummary>()
  let previousKeys: Set<string> | null = null
  let bestMatchEver: (JobListing & { runDate: string }) | null = null

  for (const run of runsAsc) {
    const detail = getRoutineRunDetail(run.id)
    const jobSheet = detail?.parsed?.sheets.find((s) => /job/i.test(s.name))
    const listings = jobSheet ? parseJobSheet(jobSheet) : []
    const keys = new Set(listings.map(listingKey))

    const newSinceLastRun = previousKeys
      ? listings.filter((l) => !previousKeys!.has(listingKey(l))).length
      : listings.length

    const top = [...listings].sort((a, b) => b.score - a.score)[0]

    summaryByRunId.set(run.id, {
      runId: run.id,
      runDate: run.runDate,
      scanned: listings.length,
      strongFits: listings.filter((l) => l.score >= STRONG_FIT_THRESHOLD).length,
      newSinceLastRun,
      topMatch: top ? { title: top.title, company: top.company, score: top.score } : null
    })

    for (const listing of listings) {
      if (!bestMatchEver || listing.score > bestMatchEver.score) {
        bestMatchEver = { ...listing, runDate: run.runDate }
      }
    }

    previousKeys = keys
  }

  return {
    linked: true,
    scheduleLabel: routine.scheduleLabel,
    bestMatchEver,
    // Present newest-first for the UI, in the same order as runsDesc.
    runs: runsDesc.map((r) => summaryByRunId.get(r.id)!)
  }
}
