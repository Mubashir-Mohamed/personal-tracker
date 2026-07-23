import { useEffect, useState } from 'react'
import { format, parseISO } from 'date-fns'
import { api } from '../api'
import type { ParsedSheet, RoutineRun, RoutineRunDetail as RoutineRunDetailType, RoutineWithLatestRun } from '../api'

function isUrl(text: string): boolean {
  return /^https?:\/\//i.test(text.trim())
}

function nonEmptyDistinctValues(row: string[]): string[] {
  return [...new Set(row.map((cell) => cell.trim()).filter((cell) => cell.length > 0))]
}

/** Heuristic: within the first ~10 rows, the row with the most *distinct* non-empty cells is
 *  the header; anything above it (title/subtitle rows in generated reports) renders as a banner.
 *  Distinct (not just non-empty) matters because merged title/subtitle cells come back from
 *  ExcelJS with the same value repeated across every column in the merge range. */
function findHeaderRowIndex(rows: string[][]): number {
  let bestIndex = 0
  let bestCount = -1
  const searchLimit = Math.min(rows.length, 10)
  for (let i = 0; i < searchLimit; i++) {
    const count = nonEmptyDistinctValues(rows[i]).length
    if (count > bestCount) {
      bestCount = count
      bestIndex = i
    }
  }
  return bestIndex
}

function SheetView({ sheet }: { sheet: ParsedSheet }): React.JSX.Element {
  if (sheet.rows.length === 0) return <div className="empty-state">This sheet is empty.</div>

  const headerIndex = findHeaderRowIndex(sheet.rows)
  const bannerRows = sheet.rows.slice(0, headerIndex)
  const headerRow = sheet.rows[headerIndex]
  const dataRows = sheet.rows.slice(headerIndex + 1)

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
                {row.map((cell, j) =>
                  isUrl(cell) ? (
                    <td key={j}>
                      <a href={cell} target="_blank" rel="noreferrer">
                        Open
                      </a>
                    </td>
                  ) : (
                    <td key={j}>{cell}</td>
                  )
                )}
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
                <SheetView sheet={detail.parsed.sheets[activeSheet]} />
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
