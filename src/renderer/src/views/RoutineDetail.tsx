import { useEffect, useState } from 'react'
import { format, parseISO } from 'date-fns'
import { api } from '../api'
import { findHeaderRowIndex, nonEmptyDistinctValues } from '../../../shared/sheetUtils'
import type { ParsedSheet, RoutineRun, RoutineRunDetail as RoutineRunDetailType, RoutineWithLatestRun } from '../api'

function isUrl(text: string): boolean {
  return /^https?:\/\//i.test(text.trim())
}

function SheetView({ sheet, runId }: { sheet: ParsedSheet; runId: number }): React.JSX.Element {
  const [resumeError, setResumeError] = useState<string | null>(null)

  if (sheet.rows.length === 0) return <div className="empty-state">This sheet is empty.</div>

  const headerIndex = findHeaderRowIndex(sheet.rows)
  const bannerRows = sheet.rows.slice(0, headerIndex)
  const headerRow = sheet.rows[headerIndex]
  const dataRows = sheet.rows.slice(headerIndex + 1)
  const resumeColIndex = headerRow.findIndex((h) => /tailored resume/i.test(h.trim()))

  const openResume = async (filename: string): Promise<void> => {
    const result = await api.openRoutineRunSidecarFile(runId, filename)
    if (!result.ok) {
      setResumeError(result.error ?? "Couldn't open that file.")
      setTimeout(() => setResumeError(null), 3000)
    }
  }

  return (
    <div>
      {bannerRows.map((row, i) => {
        const text = nonEmptyDistinctValues(row).join('  ')
        if (!text) return null
        return (
          <div key={i} className="report-banner">
            {text}
          </div>
        )
      })}
      {resumeError && <div className="report-banner" style={{ color: 'var(--danger)' }}>{resumeError}</div>}
      <div className="data-table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              {headerRow.map((cell, i) => (
                <th key={i}>{cell}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {dataRows.map((row, i) => (
              <tr key={i}>
                {row.map((cell, j) => {
                  if (j === resumeColIndex) {
                    const filename = cell.trim()
                    return (
                      <td key={j}>
                        {filename ? (
                          <button className="btn btn-ghost" style={{ padding: '3px 10px', fontSize: 11.5 }} onClick={() => openResume(filename)}>
                            Open resume
                          </button>
                        ) : (
                          <span style={{ color: 'var(--text-tertiary)' }}>—</span>
                        )}
                      </td>
                    )
                  }
                  if (isUrl(cell)) {
                    return (
                      <td key={j}>
                        <a href={cell} target="_blank" rel="noreferrer">
                          Open
                        </a>
                      </td>
                    )
                  }
                  return <td key={j}>{cell}</td>
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default function RoutineDetail({
  routine,
  onBack
}: {
  routine: RoutineWithLatestRun
  onBack: () => void
}): React.JSX.Element {
  const [runs, setRuns] = useState<RoutineRun[]>([])
  const [selectedRunId, setSelectedRunId] = useState<number | null>(null)
  const [detail, setDetail] = useState<RoutineRunDetailType | null>(null)
  const [activeSheet, setActiveSheet] = useState(0)

  useEffect(() => {
    api.getRoutineRuns(routine.id).then((r) => {
      setRuns(r)
      if (r.length > 0) setSelectedRunId(r[0].id)
    })
  }, [routine.id])

  useEffect(() => {
    if (selectedRunId == null) {
      setDetail(null)
      return
    }
    api.getRoutineRunDetail(selectedRunId).then((d) => {
      setDetail(d)
      setActiveSheet(0)
    })
  }, [selectedRunId])

  return (
    <>
      <div className="page-header">
        <div>
          <button className="btn btn-ghost" onClick={onBack} style={{ marginBottom: 10 }}>
            &larr; Back to Routines
          </button>
          <div className="page-title">{routine.name}</div>
          <div className="page-subtitle">
            {routine.scheduleLabel && <span className="badge badge-accent">{routine.scheduleLabel}</span>}
            {'  '}
            {runs.length} snapshot{runs.length === 1 ? '' : 's'} saved
          </div>
        </div>
        {selectedRunId != null && (
          <button className="btn" onClick={() => api.openRoutineRunFile(selectedRunId)}>
            Reveal original file
          </button>
        )}
      </div>

      {runs.length === 0 ? (
        <div className="empty-state">No snapshots yet — this routine hasn't produced output since being linked.</div>
      ) : (
        <div style={{ display: 'flex', gap: 20 }}>
          <div className="card card-pad run-date-list">
            <div className="section-title">Runs</div>
            {runs.map((run) => (
              <button
                key={run.id}
                className={`run-date-item${run.id === selectedRunId ? ' active' : ''}`}
                onClick={() => setSelectedRunId(run.id)}
              >
                {format(parseISO(run.runDate), 'EEE, MMM d')}
                {run.status === 'error' && <span className="badge badge-neutral">error</span>}
              </button>
            ))}
          </div>

          <div style={{ flex: 1, minWidth: 0 }}>
            {detail?.status === 'error' ? (
              <div className="card card-pad">
                <div className="section-title">Parse error</div>
                <div className="empty-state">{detail.errorMessage}</div>
              </div>
            ) : detail?.parsed ? (
              <div className="card card-pad">
                {detail.parsed.sheets.length > 1 && (
                  <div className="sheet-tabs">
                    {detail.parsed.sheets.map((sheet, i) => (
                      <button
                        key={sheet.name}
                        className={`sheet-tab${i === activeSheet ? ' active' : ''}`}
                        onClick={() => setActiveSheet(i)}
                      >
                        {sheet.name}
                      </button>
                    ))}
                  </div>
                )}
                <SheetView sheet={detail.parsed.sheets[activeSheet]} runId={detail.id} />
              </div>
            ) : (
              <div className="empty-state">Loading…</div>
            )}
          </div>
        </div>
      )}
    </>
  )
}
