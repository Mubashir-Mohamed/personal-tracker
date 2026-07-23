import { useCallback, useEffect, useState } from 'react'
import { format as formatDate } from 'date-fns'
import { api } from '../api'
import type { BlockInstanceWithCategory, BlockStatus, DayType, JobHuntLogEntry } from '../api'

interface TodayData {
  date: string
  dayType: DayType
  blocks: BlockInstanceWithCategory[]
}

function toMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}

function to12Hour(t: string): string {
  const [h, m] = t.split(':').map(Number)
  const period = h >= 12 ? 'PM' : 'AM'
  const hour12 = h % 12 === 0 ? 12 : h % 12
  return `${hour12}:${String(m).padStart(2, '0')} ${period}`
}

function addMinutesToTime(t: string, delta: number): string {
  const total = Math.max(0, Math.min(23 * 60 + 59, toMinutes(t) + delta))
  const h = Math.floor(total / 60)
  const m = total % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

function statusChip(
  status: BlockStatus,
  color: string,
  liveLabel: string | null
): React.JSX.Element {
  if (status === 'done') return <span className="status-chip status-chip-done">Done</span>
  if (status === 'skipped') return <span className="status-chip status-chip-skipped">Skipped</span>
  if (status === 'active')
    return (
      <span className="status-chip status-chip-active" style={{ color }}>
        <span className="pulse-dot" />
        {liveLabel ?? 'Active'}
      </span>
    )
  return <span className="status-chip status-chip-pending">{liveLabel ?? 'Upcoming'}</span>
}

function JobHuntLogWidget({ date }: { date: string }): React.JSX.Element {
  const [log, setLog] = useState<JobHuntLogEntry | null>(null)
  const [count, setCount] = useState(0)
  const [companies, setCompanies] = useState('')
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    api.getJobHuntLog(date).then((entry) => {
      setLog(entry)
      setCount(entry?.applicationsCount ?? 0)
      setCompanies(entry?.companies.join(', ') ?? '')
    })
  }, [date])

  const save = useCallback(() => {
    const entry: JobHuntLogEntry = {
      date,
      applicationsCount: count,
      companies: companies
        .split(',')
        .map((c) => c.trim())
        .filter(Boolean),
      notes: log?.notes ?? ''
    }
    api.upsertJobHuntLog(entry).then((updated) => {
      setLog(updated)
      setSaved(true)
      setTimeout(() => setSaved(false), 1500)
    })
  }, [date, count, companies, log])

  return (
    <div className="job-hunt-log">
      <label>Applications sent</label>
      <input
        type="number"
        min={0}
        value={count}
        onChange={(e) => setCount(Number(e.target.value))}
      />
      <label>Companies</label>
      <input
        type="text"
        placeholder="Acme, Globex, ..."
        value={companies}
        onChange={(e) => setCompanies(e.target.value)}
        style={{
          flex: 1,
          minWidth: 140,
          background: 'var(--bg-card)',
          border: '1px solid var(--border)',
          borderRadius: 8,
          padding: '5px 8px',
          fontSize: 13
        }}
      />
      <button className="btn btn-primary" onClick={save}>
        {saved ? 'Saved' : 'Save'}
      </button>
    </div>
  )
}

export default function Timeline(): React.JSX.Element {
  const [today, setToday] = useState<TodayData | null>(null)
  const [now, setNow] = useState(new Date())

  const refresh = useCallback(() => {
    api.getToday().then(setToday)
  }, [])

  useEffect(() => {
    refresh()
    const dataInterval = setInterval(refresh, 30_000)
    const clockInterval = setInterval(() => setNow(new Date()), 1000)
    const unsubscribe = api.onDayChanged(refresh)
    return () => {
      clearInterval(dataInterval)
      clearInterval(clockInterval)
      unsubscribe()
    }
  }, [refresh])

  const setStatus = (blockId: number, status: BlockStatus): void => {
    api.updateBlockStatus(blockId, status).then((blocks) =>
      setToday((prev) => (prev ? { ...prev, blocks } : prev)
      )
    )
  }

  const delay = (block: BlockInstanceWithCategory): void => {
    const newStart = addMinutesToTime(block.plannedStart, 15)
    const newEnd = addMinutesToTime(block.plannedEnd, 15)
    api.rescheduleBlock(block.id, newStart, newEnd).then((blocks) =>
      setToday((prev) => (prev ? { ...prev, blocks } : prev))
    )
  }

  if (!today) return <div className="empty-state">Loading today's schedule…</div>

  const nowMinutes = now.getHours() * 60 + now.getMinutes()

  return (
    <>
      <div className="page-header">
        <div>
          <div className="page-title">{formatDate(now, 'EEEE, MMMM d')}</div>
          <div className="page-subtitle">
            <span className={`badge badge-accent`} style={{ marginRight: 8 }}>
              {today.dayType === 'weekday' ? 'Weekday' : 'Weekend'}
            </span>
            {today.blocks.filter((b) => b.status === 'done').length} of {today.blocks.length} blocks done
          </div>
        </div>
        <div className="clock">{formatDate(now, 'h:mm:ss a')}</div>
      </div>

      {today.blocks.length === 0 ? (
        <div className="empty-state">No blocks scheduled for today yet.</div>
      ) : (
        <ul className="timeline-list">
          {today.blocks.map((block) => {
            const start = toMinutes(block.plannedStart)
            const end = toMinutes(block.plannedEnd)
            let liveLabel: string | null = null
            if (block.status === 'pending' || block.status === 'active') {
              if (nowMinutes < start) liveLabel = `starts in ${start - nowMinutes}m`
              else if (nowMinutes < end) liveLabel = `ends in ${end - nowMinutes}m`
              else liveLabel = 'wrapping up'
            }

            return (
              <li
                key={block.id}
                className={`block-card status-${block.status}`}
                style={{ '--cat-color': block.category.color } as React.CSSProperties}
              >
                <div className="block-rail" />
                <div className="block-body">
                  <div className="block-top-row">
                    <div>
                      <div className="block-time">
                        {to12Hour(block.plannedStart)} – {to12Hour(block.plannedEnd)}
                      </div>
                      <div className={`block-label${block.status === 'skipped' ? ' strike' : ''}`}>
                        {block.label}
                      </div>
                    </div>
                    {statusChip(block.status, block.category.color, liveLabel)}
                  </div>

                  {block.status !== 'skipped' && (
                    <div className="block-actions">
                      {block.status !== 'done' && (
                        <button className="btn btn-primary" onClick={() => setStatus(block.id, 'done')}>
                          Mark done
                        </button>
                      )}
                      {block.status === 'pending' && (
                        <button className="btn" onClick={() => delay(block)}>
                          Delay 15m
                        </button>
                      )}
                      {block.status !== 'done' && (
                        <button
                          className="btn btn-ghost btn-danger"
                          onClick={() => setStatus(block.id, 'skipped')}
                        >
                          Skip
                        </button>
                      )}
                    </div>
                  )}

                  {block.category.kind === 'job_hunt' && <JobHuntLogWidget date={today.date} />}
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </>
  )
}
