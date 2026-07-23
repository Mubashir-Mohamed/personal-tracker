import { useEffect, useState } from 'react'
import { format, parseISO } from 'date-fns'
import { api } from '../api'
import type { RoutineWithLatestRun } from '../api'
import RoutineDetail from './RoutineDetail'

function LinkOutputForm({
  routine,
  onLinked
}: {
  routine: RoutineWithLatestRun
  onLinked: () => void
}): React.JSX.Element {
  const [path, setPath] = useState<string | null>(null)
  const [scheduleLabel, setScheduleLabel] = useState('')
  const [saving, setSaving] = useState(false)

  const browse = async (): Promise<void> => {
    const picked = await api.pickWatchFile()
    if (picked) setPath(picked)
  }

  const save = async (): Promise<void> => {
    if (!path) return
    setSaving(true)
    await api.linkRoutineOutput(routine.id, path, scheduleLabel)
    setSaving(false)
    onLinked()
  }

  return (
    <div className="job-hunt-log" style={{ marginTop: 12 }}>
      <button className="btn" onClick={browse}>
        {path ? 'Change file' : 'Browse for output file'}
      </button>
      {path && (
        <span style={{ fontSize: 12, color: 'var(--text-secondary)', wordBreak: 'break-all' }}>{path}</span>
      )}
      <label>Schedule</label>
      <input
        type="text"
        placeholder="e.g. Daily at 7:03 AM"
        value={scheduleLabel}
        onChange={(e) => setScheduleLabel(e.target.value)}
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
      <button className="btn btn-primary" onClick={save} disabled={!path || saving}>
        {saving ? 'Linking…' : 'Link'}
      </button>
    </div>
  )
}

export default function Routines(): React.JSX.Element {
  const [routines, setRoutines] = useState<RoutineWithLatestRun[]>([])
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  const refresh = (): void => {
    api.getRoutines().then(setRoutines)
  }

  useEffect(() => {
    refresh()
    const interval = setInterval(refresh, 30_000)
    return () => clearInterval(interval)
  }, [])

  const checkNow = async (): Promise<void> => {
    setRefreshing(true)
    const updated = await api.checkRoutinesNow()
    setRoutines(updated)
    setRefreshing(false)
  }

  const selected = routines.find((r) => r.id === selectedId)
  if (selected) {
    return <RoutineDetail routine={selected} onBack={() => setSelectedId(null)} />
  }

  return (
    <>
      <div className="page-header">
        <div>
          <div className="page-title">Routines</div>
          <div className="page-subtitle">Claude Code scheduled routines, auto-discovered from your machine</div>
        </div>
        <button className="btn" onClick={checkNow} disabled={refreshing}>
          {refreshing ? 'Checking…' : 'Check for new runs'}
        </button>
      </div>

      {routines.length === 0 ? (
        <div className="empty-state">
          No routines found yet. Set one up with the <code>/schedule</code> skill in Claude Code and it'll show up
          here.
        </div>
      ) : (
        <div className="timeline-list">
          {routines.map((routine) => (
            <div key={routine.id} className="card routine-card">
              <div className="block-top-row">
                <div>
                  <div className="block-label">{routine.name}</div>
                  <div className="block-meta">{routine.description}</div>
                </div>
                {routine.scheduleLabel && <span className="badge badge-accent">{routine.scheduleLabel}</span>}
              </div>

              {routine.watchPath ? (
                <div className="block-actions" style={{ alignItems: 'center' }}>
                  <button className="btn btn-primary" onClick={() => setSelectedId(routine.id)}>
                    View runs ({routine.runCount})
                  </button>
                  {routine.latestRunDate && (
                    <span className="block-meta">
                      Last snapshot: {format(parseISO(routine.latestRunDate), 'EEE, MMM d')}
                    </span>
                  )}
                </div>
              ) : (
                <LinkOutputForm routine={routine} onLinked={refresh} />
              )}
            </div>
          ))}
        </div>
      )}
    </>
  )
}
