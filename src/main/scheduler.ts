import { format, isWeekend } from 'date-fns'
import type { DayType } from '../shared/types'
import { getRulesForDayType, insertBlockInstance, getBlocksForDate } from './db'

export function dayTypeFor(date: Date): DayType {
  return isWeekend(date) ? 'weekend' : 'weekday'
}

export function todayString(date = new Date()): string {
  return format(date, 'yyyy-MM-dd')
}

/** Materializes block_instances for `date` from schedule_rules if not already generated. Idempotent. */
export function ensureBlocksForDate(date: Date): void {
  const dateStr = todayString(date)
  const existing = getBlocksForDate(dateStr)
  if (existing.length > 0) return

  const dayType = dayTypeFor(date)
  const rules = getRulesForDayType(dayType)

  for (const rule of rules) {
    insertBlockInstance({
      date: dateStr,
      ruleId: rule.id,
      categoryId: rule.categoryId,
      label: rule.label,
      plannedStart: rule.startTime,
      plannedEnd: rule.endTime,
      sortOrder: rule.sortOrder
    })
  }
}

/** Call on startup and on an interval to catch day rollover while the app is running. */
export function startDayRolloverWatcher(onNewDay: (date: Date) => void): () => void {
  let currentDate = todayString()
  ensureBlocksForDate(new Date())

  const interval = setInterval(() => {
    const now = new Date()
    const nowDate = todayString(now)
    if (nowDate !== currentDate) {
      currentDate = nowDate
      ensureBlocksForDate(now)
      onNewDay(now)
    }
  }, 60_000)

  return () => clearInterval(interval)
}
