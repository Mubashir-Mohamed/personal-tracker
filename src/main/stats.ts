import { startOfWeek, endOfWeek, eachDayOfInterval, format, subDays } from 'date-fns'
import { getBlocksInRange, getBlocksForDate, getCategories, getJobHuntLog } from './db'
import { dayTypeFor, todayString } from './scheduler'
import type { CategoryKind, CategoryStat, DayStat } from '../shared/types'

function toMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}

function durationMinutes(start: string, end: string): number {
  return toMinutes(end) - toMinutes(start)
}

/** Per-day category breakdown for the current Mon-Sun week, trimmed to not project past today. */
export function getWeekDayStats(referenceDate = new Date()): { days: DayStat[]; totalApplications: number } {
  const weekStart = startOfWeek(referenceDate, { weekStartsOn: 1 })
  const weekEnd = endOfWeek(referenceDate, { weekStartsOn: 1 })
  const startStr = format(weekStart, 'yyyy-MM-dd')
  const endStr = format(weekEnd, 'yyyy-MM-dd')
  const todayStr = todayString(referenceDate)

  const blocks = getBlocksInRange(startStr, endStr)
  const categories = getCategories()

  const days: DayStat[] = eachDayOfInterval({ start: weekStart, end: weekEnd })
    .map((d) => format(d, 'yyyy-MM-dd'))
    .filter((dateStr) => dateStr <= todayStr)
    .map((dateStr) => {
      const dayBlocks = blocks.filter((b) => b.date === dateStr)

      const categoryStats: CategoryStat[] = categories
        .map((category) => {
          const catBlocks = dayBlocks.filter((b) => b.categoryId === category.id)
          const plannedMinutes = catBlocks.reduce(
            (sum, b) => sum + durationMinutes(b.plannedStart, b.plannedEnd),
            0
          )
          const doneMinutes = catBlocks
            .filter((b) => b.status === 'done')
            .reduce((sum, b) => sum + durationMinutes(b.plannedStart, b.plannedEnd), 0)
          return { categoryId: category.id, category, plannedMinutes, doneMinutes }
        })
        .filter((c) => c.plannedMinutes > 0)

      const totalPlanned = categoryStats.reduce((s, c) => s + c.plannedMinutes, 0)
      const totalDone = categoryStats.reduce((s, c) => s + c.doneMinutes, 0)
      const adherencePct = totalPlanned > 0 ? Math.round((totalDone / totalPlanned) * 100) : 0

      return {
        date: dateStr,
        dayType: dayTypeFor(new Date(`${dateStr}T00:00:00`)),
        categories: categoryStats,
        adherencePct
      }
    })

  const totalApplications = days.reduce((sum, day) => {
    const log = getJobHuntLog(day.date)
    return sum + (log?.applicationsCount ?? 0)
  }, 0)

  return { days, totalApplications }
}

/** Consecutive-day streak for a category kind, counted backward from today. An in-progress
 *  today (not yet marked done) doesn't break yesterday's streak, it just isn't counted yet. */
export function getStreakForKind(kind: CategoryKind): number {
  const now = new Date()
  const todayBlocks = getBlocksForDate(todayString(now))
  const todayMet = todayBlocks.some((b) => b.category.kind === kind && b.status === 'done')

  let streak = todayMet ? 1 : 0
  let cursor = subDays(now, 1)

  for (let i = 0; i < 365; i++) {
    const dateStr = todayString(cursor)
    const blocks = getBlocksForDate(dateStr)
    if (blocks.length === 0) break
    const met = blocks.some((b) => b.category.kind === kind && b.status === 'done')
    if (!met) break
    streak++
    cursor = subDays(cursor, 1)
  }

  return streak
}
