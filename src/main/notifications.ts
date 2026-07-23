import { Notification } from 'electron'
import { exec } from 'child_process'
import { getBlocksNeedingNotification, markNotified, updateBlockStatus, getSetting } from './db'
import { todayString } from './scheduler'
import type { BlockInstanceWithCategory, CategoryKind } from '../shared/types'

const DEFAULT_SOUND_BY_KIND: Record<CategoryKind, string> = {
  work: '/System/Library/Sounds/Tink.aiff',
  job_hunt: '/System/Library/Sounds/Glass.aiff',
  family: '/System/Library/Sounds/Hero.aiff',
  break: '/System/Library/Sounds/Pop.aiff',
  leisure: '/System/Library/Sounds/Purr.aiff',
  other: '/System/Library/Sounds/Ping.aiff'
}

function playSound(block: BlockInstanceWithCategory): void {
  if (process.platform !== 'darwin') return
  const soundPath =
    block.category.soundFile ?? DEFAULT_SOUND_BY_KIND[block.category.kind] ?? DEFAULT_SOUND_BY_KIND.other
  exec(`afplay "${soundPath}"`, () => {
    // best-effort; a missing/renamed sound file shouldn't crash the notification flow
  })
}

function notify(title: string, body: string, block: BlockInstanceWithCategory): void {
  new Notification({ title, body }).show()
  playSound(block)
}

function parseTimeToday(hhmm: string, base: Date): Date {
  const [h, m] = hhmm.split(':').map(Number)
  const d = new Date(base)
  d.setHours(h, m, 0, 0)
  return d
}

function runTick(): void {
  const now = new Date()
  const dateStr = todayString(now)
  const leadMinutes = getSetting('notificationLeadMinutes')

  for (const block of getBlocksNeedingNotification('notified_pre', dateStr)) {
    const start = parseTimeToday(block.plannedStart, now)
    const leadTime = new Date(start.getTime() - leadMinutes * 60_000)
    if (now >= leadTime && now < start) {
      notify(`Starting soon: ${block.label}`, `Starts at ${block.plannedStart}`, block)
      markNotified(block.id, 'notified_pre')
    }
  }

  for (const block of getBlocksNeedingNotification('notified_start', dateStr)) {
    const start = parseTimeToday(block.plannedStart, now)
    if (now >= start) {
      notify(`Now: ${block.label}`, `Started at ${block.plannedStart}`, block)
      markNotified(block.id, 'notified_start')
      updateBlockStatus(block.id, 'active')
    }
  }

  for (const block of getBlocksNeedingNotification('notified_end', dateStr)) {
    const end = parseTimeToday(block.plannedEnd, now)
    if (now >= end) {
      const suffix = block.category.kind === 'job_hunt' ? ' — log your applications in the dashboard' : ''
      notify(`Ended: ${block.label}`, `Wrapped up at ${block.plannedEnd}${suffix}`, block)
      markNotified(block.id, 'notified_end')
      updateBlockStatus(block.id, 'done')
    }
  }
}

export function startNotificationTicker(): () => void {
  runTick()
  const interval = setInterval(runTick, 30_000)
  return () => clearInterval(interval)
}
