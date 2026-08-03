import { useEffect, useState } from 'react'
import { format, parseISO } from 'date-fns'
import { api } from '../api'
import type { ClaudeSessionSummary } from '../api'
import ClaudeSessionDetail from './ClaudeSessionDetail'

function shortenCwd(cwd: string): string {
  const parts = cwd.split('/').filter(Boolean)
  return parts.length <= 2 ? cwd : `…/${parts.slice(-2).join('/')}`
}

export default function ClaudeSessions({
  onResume
}: {
  onResume: (cwd: string, sessionId: string) => void
}): React.JSX.Element {
  const [sessions, setSessions] = useState<ClaudeSessionSummary[]>([])
  const [selectedFilePath, setSelectedFilePath] = useState<string | null>(null)

  useEffect(() => {
    api.getClaudeSessions().then(setSessions)
    const interval = setInterval(() => api.getClaudeSessions().then(setSessions), 30_000)
    return () => clearInterval(interval)
  }, [])

  const selected = sessions.find((s) => s.filePath === selectedFilePath)
  if (selected) {
    return (
      <ClaudeSessionDetail
        key={selected.filePath}
        session={selected}
        onBack={() => setSelectedFilePath(null)}
        onResume={onResume}
      />
    )
  }

  return (
    <>
      <div className="page-header">
        <div>
          <div className="page-title">History</div>
          <div className="page-subtitle">
            Past Claude Code conversations, auto-discovered from your machine
          </div>
        </div>
      </div>

      {sessions.length === 0 ? (
        <div className="empty-state">No Claude Code sessions found yet.</div>
      ) : (
        <div className="timeline-list">
          {sessions.map((session) => (
            <div key={session.filePath} className="card routine-card">
              <div className="block-top-row">
                <div>
                  <div className="block-label">{session.title ?? 'Untitled session'}</div>
                  <div className="block-meta" title={session.cwd}>
                    {shortenCwd(session.cwd)} &middot; {session.messageCount} message
                    {session.messageCount === 1 ? '' : 's'}
                  </div>
                </div>
                <span className="badge badge-neutral">
                  {format(parseISO(session.lastActiveAt), 'EEE, MMM d HH:mm')}
                </span>
              </div>
              <div className="block-actions">
                <button className="btn" onClick={() => setSelectedFilePath(session.filePath)}>
                  View transcript
                </button>
                <button
                  className="btn btn-primary"
                  onClick={() => onResume(session.cwd, session.sessionId)}
                >
                  Resume
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  )
}
