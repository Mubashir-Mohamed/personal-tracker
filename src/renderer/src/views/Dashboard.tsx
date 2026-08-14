import { useCallback, useEffect, useState } from 'react'
import { api } from '../api'
import type {
  PrepPlan,
  PrepWeek,
  QuickLink,
  RoutineOverviewEntry,
  Todo,
  WeatherSnapshot
} from '../api'

function greeting(hour: number): string {
  if (hour < 12) return 'good morning'
  if (hour < 17) return 'good afternoon'
  return 'good evening'
}

function BootBar(): React.JSX.Element {
  const [now, setNow] = useState(new Date())
  const [weather, setWeather] = useState<WeatherSnapshot | null>(null)
  const [displayName, setDisplayName] = useState('')

  useEffect(() => {
    const clock = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(clock)
  }, [])

  useEffect(() => {
    api.getWeather().then(setWeather)
    const interval = setInterval(() => api.getWeather().then(setWeather), 5 * 60_000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    api.getSettings().then((s) => setDisplayName(s.displayName))
  }, [])

  const hour12 = now.getHours() % 12 === 0 ? 12 : now.getHours() % 12
  const clockStr = `${String(hour12).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')} ${now.getHours() >= 12 ? 'PM' : 'AM'}`
  const dateStr = now.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric'
  })
  const slug = displayName.trim() ? displayName.trim().toLowerCase().replace(/\s+/g, '-') : 'user'

  return (
    <div className="card bootbar">
      <div className="scan-glow" aria-hidden="true" />
      <div className="boot-left">
        <div className="boot-prompt">{slug}@personal-tracker ~ %</div>
        <div className="boot-line">
          {greeting(now.getHours())}
          {displayName.trim() ? `, ${displayName.trim()}` : ''}
          <span className="cursor" />
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

function RoutinesOverviewCard(): React.JSX.Element {
  const [routines, setRoutines] = useState<RoutineOverviewEntry[] | null>(null)

  useEffect(() => {
    const load = (): void => {
      api.getRoutinesOverview().then(setRoutines)
    }
    load()
    const interval = setInterval(load, 5 * 60_000)
    return () => clearInterval(interval)
  }, [])

  const openRun = (runId: number): void => {
    api.openRoutineRunFile(runId)
  }

  if (!routines) return <div className="card card-pad db-col-7">Loading routines…</div>

  return (
    <div className="card card-pad db-col-7">
      <div className="term-head">
        <div className="term-title">
          ~/routines<span className="term-sep"> %</span> ls -la --latest
        </div>
      </div>

      {routines.length === 0 ? (
        <div className="task-empty">
          No routines linked to an output file yet — set one up with the <code>/schedule</code>{' '}
          skill in Claude Code, then link its output file from the Routines page and it&apos;ll show
          up here automatically.
        </div>
      ) : (
        <div className="run-list">
          {routines.map((r) => (
            <div className="run-row" key={r.routineId}>
              <div className="run-date">
                {r.latestRunDate ? (
                  (() => {
                    const { dow, dom } = formatRunDate(r.latestRunDate!)
                    return (
                      <>
                        <div className="dow">{dow}</div>
                        <div className="dom">{dom}</div>
                      </>
                    )
                  })()
                ) : (
                  <div className="dom">—</div>
                )}
              </div>
              <div className="run-stats">
                <b>{r.name}</b>
                {r.scheduleLabel && <span className="new-tag">{r.scheduleLabel}</span>}
                {r.scored ? (
                  <div className="run-top">
                    {r.scored.scanned} scanned · {r.scored.strongFits} strong fits · +
                    {r.scored.newSinceLastRun} new
                    {r.scored.topMatch &&
                      ` · top: ${r.scored.topMatch.score}% ${r.scored.topMatch.title}`}
                  </div>
                ) : r.sheetSummary ? (
                  <div className="run-top">
                    {r.sheetSummary.sheetCount} sheet{r.sheetSummary.sheetCount === 1 ? '' : 's'} ·{' '}
                    {r.sheetSummary.rowCount} row{r.sheetSummary.rowCount === 1 ? '' : 's'} in
                    latest snapshot
                  </div>
                ) : (
                  <div className="run-top">No runs archived yet</div>
                )}
              </div>
              <div className="run-actions">
                {r.latestRunId != null && (
                  <button
                    className="icon-btn download"
                    title="Open original report"
                    onClick={() => openRun(r.latestRunId!)}
                  >
                    <DownloadIcon />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function PrepWeekEditRow({
  week,
  onSaved,
  onDeleted
}: {
  week: PrepWeek
  onSaved: () => void
  onDeleted: () => void
}): React.JSX.Element {
  const [title, setTitle] = useState(week.title)
  const [description, setDescription] = useState(week.description)

  const commit = (): void => {
    if (title === week.title && description === week.description) return
    api.updatePrepWeek(week.id, { title, description }).then(onSaved)
  }

  return (
    <div className={`plan-week${week.current ? ' current' : ''}`}>
      <div className="plan-badge">WK {week.weekNumber}</div>
      <div
        className="plan-body"
        style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 1 }}
      >
        <input
          type="text"
          value={title}
          placeholder="Week title"
          onChange={(e) => setTitle(e.target.value)}
          onBlur={commit}
          style={{
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border)',
            borderRadius: 8,
            padding: '5px 8px',
            fontSize: 12.5,
            color: 'var(--text-primary)'
          }}
        />
        <textarea
          value={description}
          placeholder="Comma-separated topics"
          onChange={(e) => setDescription(e.target.value)}
          onBlur={commit}
          rows={2}
          style={{
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border)',
            borderRadius: 8,
            padding: '5px 8px',
            fontSize: 12,
            color: 'var(--text-primary)',
            resize: 'vertical'
          }}
        />
      </div>
      <button
        className="icon-btn"
        onClick={onDeleted}
        title="Delete week"
        style={{ alignSelf: 'flex-start' }}
      >
        ×
      </button>
    </div>
  )
}

function PrepPlanCard(): React.JSX.Element {
  const [plan, setPlan] = useState<PrepPlan | null>(null)
  const [editing, setEditing] = useState(false)

  const refresh = useCallback(() => {
    api.getPrepPlan().then(setPlan)
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  const markStudied = (): void => {
    api.markStudiedToday().then(setPlan)
  }

  const deleteWeek = (id: number): void => {
    api.deletePrepWeek(id).then(refresh)
  }

  const addWeek = (): void => {
    api
      .addPrepWeek({
        title: 'New week',
        description: 'Topic one, topic two',
        startDate: new Date().toISOString().slice(0, 10),
        endDate: new Date().toISOString().slice(0, 10)
      })
      .then(refresh)
  }

  if (!plan) return <div className="card card-pad db-col-5">Loading interview prep plan…</div>

  return (
    <div className="card card-pad db-col-5">
      <div className="term-head">
        <div className="term-title">
          ~/interview-prep<span className="term-sep"> %</span> cat plan.md
        </div>
        <button
          className="btn btn-ghost"
          style={{ padding: '3px 10px', fontSize: 11.5 }}
          onClick={() => setEditing((e) => !e)}
        >
          {editing ? 'Done' : 'Edit plan'}
        </button>
      </div>

      {editing
        ? plan.weeks.map((w) => (
            <PrepWeekEditRow
              key={w.id}
              week={w}
              onSaved={refresh}
              onDeleted={() => deleteWeek(w.id)}
            />
          ))
        : plan.weeks.map((w) => (
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

      {editing && (
        <button className="btn" style={{ marginTop: 8 }} onClick={addWeek}>
          + Add week
        </button>
      )}

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
        <RoutinesOverviewCard />
        <PrepPlanCard />
        <TodoCard />
        <LinksCard />
      </div>
    </>
  )
}
