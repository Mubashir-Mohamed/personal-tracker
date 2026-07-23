import { useCallback, useEffect, useState } from 'react'
import { format as formatDate } from 'date-fns'
import { api } from '../api'
import { CategoryIcon } from '../icons'
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

function greeting(hour: number): string {
  if (hour < 12) return 'Good morning'
  if (hour < 17) return 'Good afternoon'
  return 'Good evening'
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

function ProgressRing({ fraction }: { fraction: number }): React.JSX.Element {
  const radius = 32
  const stroke = 6
  const circumference = 2 * Math.PI * radius
  const offset = circumference * (1 - Math.min(1, Math.max(0, fraction)))
  return (
    <div className="progress-ring">
      <svg width={76} height={76} viewBox="0 0 76 76">
        <circle className="progress-ring-track" cx={38} cy={38} r={radius} strokeWidth={stroke} fill="none" />
        <circle
          className="progress-ring-value"
          cx={38}
          cy={38}
          r={radius}
          strokeWidth={stroke}
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
        />
      </svg>
      <div className="progress-ring-label">{Math.round(fraction * 100)}%</div>
    </div>
  )
}

function DayStrip({ blocks, nowMinutes }: { blocks: BlockInstanceWithCategory[]; nowMinutes: number }): React.JSX.Element | null {
  if (blocks.length === 0) return null
  const dayStart = Math.min(...blocks.map((b) => toMinutes(b.plannedStart)))
  const dayEnd = Math.max(...blocks.map((b) => toMinutes(b.plannedEnd)))
  const span = dayEnd - dayStart
  if (span <= 0) return null
  const nowPct = ((nowMinutes - dayStart) / span) * 100
  const showNow = nowPct >= 0 && nowPct <= 100

  return (
    <>
      <div className="day-strip">
        {blocks.map((b) => {
          const s = toMinutes(b.plannedStart)
          const e = toMinutes(b.plannedEnd)
          const left = ((s - dayStart) / span) * 100
          const width = ((e - s) / span) * 100
          return (
            <div
              key={b.id}
              className="day-strip-segment"
              title={`${b.label} (${to12Hour(b.plannedStart)} – ${to12Hour(b.plannedEnd)})`}
              style={{ left: `${left}%`, width: `${width}%`, background: b.category.color }}
            />
          )
        })}
        {showNow && <div className="day-strip-now" style={{ left: `${nowPct}%` }} />}
      </div>
      <div className="day-strip-labels">
        <span>{to12Hour(`${String(Math.floor(dayStart / 60)).padStart(2, '0')}:${String(dayStart % 60).padStart(2, '0')}`)}</span>
        <span>{to12Hour(`${String(Math.floor(dayEnd / 60)).padStart(2, '0')}:${String(dayEnd % 60).padStart(2, '0')}`)}</span>
      </div>
    </>
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
      setToday((prev) => (prev ? { ...prev, blocks } : prev))
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
  const doneCount = today.blocks.filter((b) => b.status === 'done').length
  const fraction = today.blocks.length > 0 ? doneCount / today.blocks.length : 0

  const activeBlock = today.blocks.find((b) => b.status === 'active')
  const nextBlock = today.blocks
    .filter((b) => b.status === 'pending' && toMinutes(b.plannedStart) >= nowMinutes)
    .sort((a, b) => toMinutes(a.plannedStart) - toMinutes(b.plannedStart))[0]
  const spotlightBlock = activeBlock ?? nextBlock

  return (
    <>
      <div className="card hero-card">
        <div className="hero-top">
          <div>
            <div className="hero-greeting">{greeting(now.getHours())}</div>
            <div className="hero-date">{formatDate(now, 'EEEE, MMMM d')}</div>
            <div className="hero-clock">
              {formatDate(now, 'h:mm:ss a')} &middot;{' '}
              <span className={`badge badge-accent`}>{today.dayType === 'weekday' ? 'Weekday' : 'Weekend'}</span>
              {'  '}
              {doneCount} of {today.blocks.length} blocks done
            </div>
          </div>
          <ProgressRing fraction={fraction} />
        </div>
        <DayStrip blocks={today.blocks} nowMinutes={nowMinutes} />
      </div>

      {spotlightBlock && (
        <div
          className="card spotlight-card"
          style={{ '--cat-color': spotlightBlock.category.color } as React.CSSProperties}
        >
          <div className="spotlight-icon">
            <CategoryIcon kind={spotlightBlock.category.kind} size={24} />
          </div>
          <div>
            <div className="spotlight-eyebrow">{activeBlock ? 'Happening now' : 'Up next'}</div>
            <div className="spotlight-label">{spotlightBlock.label}</div>
            <div className="spotlight-meta">
              {activeBlock
                ? `Ends at ${to12Hour(spotlightBlock.plannedEnd)} • ${Math.max(0, toMinutes(spotlightBlock.plannedEnd) - nowMinutes)}m left`
                : `Starts at ${to12Hour(spotlightBlock.plannedStart)} • in ${Math.max(0, toMinutes(spotlightBlock.plannedStart) - nowMinutes)}m`}
            </div>
          </div>
          <div className="spotlight-actions">
            {activeBlock && (
              <button className="btn btn-primary" onClick={() => setStatus(spotlightBlock.id, 'done')}>
                Mark done
              </button>
            )}
            {!activeBlock && nextBlock && (
              <button className="btn btn-primary" onClick={() => setStatus(spotlightBlock.id, 'active')}>
                Start now
              </button>
            )}
          </div>
        </div>
      )}

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
                      <div className="block-label-row">
                        <span className="cat-icon" style={{ color: block.category.color }}>
                          <CategoryIcon kind={block.category.kind} />
                        </span>
                        <span className={`block-label${block.status === 'skipped' ? ' strike' : ''}`}>
                          {block.label}
                        </span>
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
