import { useCallback, useEffect, useState } from 'react'
import { api } from '../api'
import type { JobHuntPipelineSummary, PrepPlan, QuickLink, Todo, WeatherSnapshot } from '../api'

function greeting(hour: number): string {
  if (hour < 12) return 'good morning'
  if (hour < 17) return 'good afternoon'
  return 'good evening'
}

function BootBar(): React.JSX.Element {
  const [now, setNow] = useState(new Date())
  const [weather, setWeather] = useState<WeatherSnapshot | null>(null)

  useEffect(() => {
    const clock = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(clock)
  }, [])

  useEffect(() => {
    api.getWeather().then(setWeather)
    const interval = setInterval(() => api.getWeather().then(setWeather), 5 * 60_000)
    return () => clearInterval(interval)
  }, [])

  const hour12 = now.getHours() % 12 === 0 ? 12 : now.getHours() % 12
  const clockStr = `${String(hour12).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')} ${now.getHours() >= 12 ? 'PM' : 'AM'}`
  const dateStr = now.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })

  return (
    <div className="card bootbar">
      <div className="scan-glow" aria-hidden="true" />
      <div className="boot-left">
        <div className="boot-prompt">mubashir@personal-tracker ~ %</div>
        <div className="boot-line">
          {greeting(now.getHours())}, mubashir<span className="cursor" />
        </div>
      </div>
      <div className="boot-right">
        <div className="chip">
          <div className="chip-label">Local Time</div>
          <div className="chip-val green">{clockStr}</div>
        </div>
        <div className="chip">
          <div className="chip-label">Today</div>
          <div className="chip-val">{dateStr}</div>
        </div>
        {weather && (
          <div className="chip">
            <div className="chip-label">{weather.locationLabel} Wx</div>
            <div className="chip-val warn">
              {weather.tempC}°C · {weather.condition}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function DownloadIcon(): React.JSX.Element {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M12 4v11m0 0 4-4m-4 4-4-4" />
      <path d="M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3" />
    </svg>
  )
}

function formatRunDate(dateStr: string): { dow: string; dom: string } {
  const d = new Date(`${dateStr}T00:00:00`)
  return {
    dow: d.toLocaleDateString(undefined, { weekday: 'short' }),
    dom: d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
  }
}

function JobHuntCard(): React.JSX.Element {
  const [summary, setSummary] = useState<JobHuntPipelineSummary | null>(null)

  useEffect(() => {
    const load = (): void => {
      api.getJobHuntPipeline().then(setSummary)
    }
    load()
    const interval = setInterval(load, 5 * 60_000)
    return () => clearInterval(interval)
  }, [])

  const openRun = (runId: number): void => {
    api.openRoutineRunFile(runId)
  }

  if (!summary) return <div className="card card-pad db-col-7">Loading job hunt pipeline…</div>

  if (!summary.linked) {
    return (
      <div className="card card-pad db-col-7">
        <div className="term-head">
          <div className="term-title">
            ~/job-hunt<span className="term-sep"> %</span> pipeline.sh --history
          </div>
        </div>
        <div className="task-empty">
          No job-listing routine linked yet — link one from Routines and it&apos;ll show up here
          automatically.
        </div>
      </div>
    )
  }

  return (
    <div className="card card-pad db-col-7">
      <div className="term-head">
        <div className="term-title">
          ~/job-hunt<span className="term-sep"> %</span> pipeline.sh --history
        </div>
        {summary.scheduleLabel && <div className="term-tag">Apify · {summary.scheduleLabel}</div>}
      </div>

      {summary.bestMatchEver && (
        <div className="best-match">
          <div className="best-match-label">🏆 Best match to date</div>
          <div className="match">
            <div className="co">
              {summary.bestMatchEver.title} <span className="role">
                · {summary.bestMatchEver.company} · {summary.bestMatchEver.location}
              </span>
            </div>
            <div className="bar">
              <div
                className="bar-fill"
                style={{ width: `${Math.min(100, summary.bestMatchEver.score)}%` }}
              />
            </div>
            <div className="score">{summary.bestMatchEver.score}%</div>
          </div>
        </div>
      )}

      {summary.runs.length === 0 ? (
        <div className="task-empty">No runs archived yet — check back after the next run.</div>
      ) : (
        <div className="run-list">
          {summary.runs.map((run) => {
            const { dow, dom } = formatRunDate(run.runDate)
            return (
              <div className="run-row" key={run.runId}>
                <div className="run-date">
                  <div className="dow">{dow}</div>
                  <div className="dom">{dom}</div>
                </div>
                <div className="run-stats">
                  <b>{run.scanned}</b> scanned · <b>{run.strongFits}</b> strong fits ·{' '}
                  <span className="new-tag">+{run.newSinceLastRun} new</span>
                  {run.topMatch && (
                    <div className="run-top">
                      top: {run.topMatch.score}% · {run.topMatch.title} · {run.topMatch.company}
                    </div>
                  )}
                </div>
                <div className="run-actions">
                  <button
                    className="icon-btn download"
                    title="Open original report"
                    onClick={() => openRun(run.runId)}
                  >
                    <DownloadIcon />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function PrepPlanCard(): React.JSX.Element {
  const [plan, setPlan] = useState<PrepPlan | null>(null)

  const refresh = useCallback(() => {
    api.getPrepPlan().then(setPlan)
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  const markStudied = (): void => {
    api.markStudiedToday().then(setPlan)
  }

  if (!plan) return <div className="card card-pad db-col-5">Loading interview prep plan…</div>

  return (
    <div className="card card-pad db-col-5">
      <div className="term-head">
        <div className="term-title">
          ~/interview-prep<span className="term-sep"> %</span> cat plan.md
        </div>
        <div className="term-tag">4-week plan</div>
      </div>

      {plan.weeks.map((w) => (
        <div className={`plan-week${w.current ? ' current' : ''}`} key={w.id}>
          <div className="plan-badge">WK {w.weekNumber}</div>
          <div className="plan-body">
            <div className="plan-title">{w.title}</div>
            <ul className="plan-items">
              {w.description
                .split(',')
                .map((item) => item.replace(/\.$/, '').trim())
                .filter(Boolean)
                .map((item) => (
                  <li key={item}>{item}</li>
                ))}
            </ul>
          </div>
        </div>
      ))}

      <div className="streak-line">
        🔥 {plan.studyStreakDays}-day study streak
        {!plan.studiedToday && (
          <button className="btn" style={{ marginLeft: 10 }} onClick={markStudied}>
            Mark today studied
          </button>
        )}
      </div>
    </div>
  )
}

function TodoCard(): React.JSX.Element {
  const [todos, setTodos] = useState<Todo[]>([])
  const [text, setText] = useState('')

  useEffect(() => {
    api.getTodos().then(setTodos)
  }, [])

  const add = (): void => {
    const value = text.trim()
    if (!value) return
    api.addTodo(value).then(setTodos)
    setText('')
  }
  const toggle = (id: number): void => {
    api.toggleTodo(id).then(setTodos)
  }
  const remove = (id: number): void => {
    api.deleteTodo(id).then(setTodos)
  }

  return (
    <div className="card card-pad db-col-7">
      <div className="term-head">
        <div className="term-title">
          ~/today<span className="term-sep"> %</span> todo
        </div>
      </div>
      {todos.length === 0 ? (
        <div className="task-empty">no tasks yet — add one below</div>
      ) : (
        todos.map((t) => (
          <div className="task" key={t.id}>
            <button className={`box${t.done ? ' checked' : ''}`} onClick={() => toggle(t.id)} />
            <div className={`task-text${t.done ? ' checked' : ''}`}>{t.text}</div>
            <button className="icon-btn" onClick={() => remove(t.id)} title="delete">
              ×
            </button>
          </div>
        ))
      )}
      <div className="add-row">
        <input
          type="text"
          placeholder="add a task and press enter…"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') add()
          }}
        />
        <button className="add-btn" onClick={add}>
          add
        </button>
      </div>
    </div>
  )
}

function LinksCard(): React.JSX.Element {
  const [links, setLinks] = useState<QuickLink[]>([])
  const [label, setLabel] = useState('')
  const [url, setUrl] = useState('')

  useEffect(() => {
    api.getLinks().then(setLinks)
  }, [])

  const add = (): void => {
    const l = label.trim()
    if (!l) return
    let u = url.trim()
    if (u && !/^https?:\/\//i.test(u)) u = `https://${u}`
    api.addLink(l, u || '#').then(setLinks)
    setLabel('')
    setUrl('')
  }
  const remove = (id: number): void => {
    api.deleteLink(id).then(setLinks)
  }
  const open = (targetUrl: string): void => {
    if (targetUrl && targetUrl !== '#') api.openExternal(targetUrl)
  }

  return (
    <div className="card card-pad db-col-5">
      <div className="term-head">
        <div className="term-title">
          ~/links<span className="term-sep"> %</span> ls
        </div>
      </div>
      <div className="links">
        {links.length === 0 ? (
          <div className="task-empty">no links yet — add one below</div>
        ) : (
          links.map((l) => (
            <div className="link-row" key={l.id}>
              <a
                href={l.url}
                onClick={(e) => {
                  e.preventDefault()
                  open(l.url)
                }}
              >
                {l.label}
              </a>
              <div className="link-actions">
                <span style={{ color: 'var(--accent)', fontSize: 11 }}>↗</span>
                <button className="icon-btn" onClick={() => remove(l.id)} title="remove">
                  ×
                </button>
              </div>
            </div>
          ))
        )}
      </div>
      <div className="add-row">
        <input
          type="text"
          placeholder="label (e.g. Portfolio)"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') add()
          }}
        />
        <input
          type="text"
          placeholder="https://…"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') add()
          }}
        />
        <button className="add-btn" onClick={add}>
          add
        </button>
      </div>
    </div>
  )
}

export default function Dashboard(): React.JSX.Element {
  return (
    <>
      <BootBar />
      <div className="db-grid">
        <JobHuntCard />
        <PrepPlanCard />
        <TodoCard />
        <LinksCard />
      </div>
    </>
  )
}
