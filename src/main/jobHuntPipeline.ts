import { basename } from 'path'
import { getRoutineRunDetail, getRoutineRuns, getRoutines } from './routinesDb'
import { findHeaderRowIndex } from '../shared/sheetUtils'
import type { JobHuntPipelineSummary, JobListing, ParsedSheet } from '../shared/types'

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

function findExcludeNote(sheet: ParsedSheet | undefined): string | null {
  if (!sheet) return null
  for (const row of sheet.rows) {
    const text = row.join(' ')
    if (/\.NET/i.test(text) && /exclud/i.test(text)) return '▲ .NET roles auto-filtered'
  }
  return null
}

function listingKey(listing: JobListing): string {
  return listing.url || `${listing.title}::${listing.company}`
}

const EMPTY_SUMMARY: JobHuntPipelineSummary = {
  linked: false,
  scheduleLabel: null,
  lastRunDate: null,
  scanned: 0,
  strongFits: 0,
  newSinceLastRun: 0,
  topMatches: [],
  bestMatchEver: null,
  cities: [],
  sources: [],
  excludeNote: null
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

  const runs = getRoutineRuns(routine.id).filter((r) => r.status === 'parsed')
  if (runs.length === 0) {
    return { ...EMPTY_SUMMARY, linked: true, scheduleLabel: routine.scheduleLabel }
  }

  // Walk every archived run once: the first (latest) and second give us the
  // "since last run" diff, while scanning all of them finds the all-time best match.
  let latestListings: JobListing[] = []
  let previousKeys: Set<string> | null = null
  let notesSheet: ParsedSheet | undefined
  let bestMatchEver: (JobListing & { runDate: string }) | null = null

  runs.forEach((run, index) => {
    const detail = getRoutineRunDetail(run.id)
    const jobSheet = detail?.parsed?.sheets.find((s) => /job/i.test(s.name))
    const listings = jobSheet ? parseJobSheet(jobSheet) : []

    if (index === 0) {
      latestListings = listings
      notesSheet = detail?.parsed?.sheets.find((s) => /notes/i.test(s.name))
    } else if (index === 1) {
      previousKeys = new Set(listings.map(listingKey))
    }

    for (const listing of listings) {
      if (!bestMatchEver || listing.score > bestMatchEver.score) {
        bestMatchEver = { ...listing, runDate: run.runDate }
      }
    }
  })

  const newSinceLastRun = previousKeys
    ? latestListings.filter((l) => !previousKeys!.has(listingKey(l))).length
    : 0

  const topMatches = [...latestListings].sort((a, b) => b.score - a.score).slice(0, 3)

  const cityCounts = new Map<string, number>()
  const sourceCounts = new Map<string, number>()
  for (const l of latestListings) {
    if (l.location) cityCounts.set(l.location, (cityCounts.get(l.location) ?? 0) + 1)
    if (l.source) sourceCounts.set(l.source, (sourceCounts.get(l.source) ?? 0) + 1)
  }
  const byCountDesc = (a: [string, number], b: [string, number]): number => b[1] - a[1]

  return {
    linked: true,
    scheduleLabel: routine.scheduleLabel,
    lastRunDate: runs[0].runDate,
    scanned: latestListings.length,
    strongFits: latestListings.filter((l) => l.score >= STRONG_FIT_THRESHOLD).length,
    newSinceLastRun,
    topMatches,
    bestMatchEver,
    cities: [...cityCounts.entries()].sort(byCountDesc).map(([name, count]) => ({ name, count })),
    sources: [...sourceCounts.entries()]
      .sort(byCountDesc)
      .map(([name, count]) => ({ name, count })),
    excludeNote: findExcludeNote(notesSheet)
  }
}
