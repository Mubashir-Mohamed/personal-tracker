import { useEffect, useState } from 'react'
import { format, parseISO } from 'date-fns'
import { api } from '../api'
import type { ClaudeSessionSummary, ClaudeTranscriptEntry } from '../api'

export default function ClaudeSessionDetail({
  session,
  onBack,
  onResume
}: {
  session: ClaudeSessionSummary
  onBack: () => void
  onResume: (cwd: string, sessionId: string) => void
}): React.JSX.Element {
  // Parent mounts this component with key={session.filePath}, so a session switch remounts
  // it fresh — entries naturally resets to null without needing to clear it inside the effect.
  const [entries, setEntries] = useState<ClaudeTranscriptEntry[] | null>(null)

  useEffect(() => {
    api.getClaudeTranscript(session.filePath).then(setEntries)
  }, [session.filePath])

  return (
    <>
      <div className="page-header">
        <div>
          <button className="btn btn-ghost" onClick={onBack} style={{ marginBottom: 10 }}>
            &larr; Back to History
          </button>
          <div className="page-title">{session.title ?? 'Untitled session'}</div>
          <div className="page-subtitle" title={session.cwd}>
            {session.cwd} &middot; {session.messageCount} message
            {session.messageCount === 1 ? '' : 's'}
          </div>
        </div>
        <button
          className="btn btn-primary"
          onClick={() => onResume(session.cwd, session.sessionId)}
        >
          Resume this session
        </button>
      </div>

      <div className="card card-pad">
        {entries === null ? (
          <div className="empty-state">Loading…</div>
        ) : entries.length === 0 ? (
          <div className="empty-state">This transcript has no renderable messages.</div>
        ) : (
          entries.map((entry) => (
            <div
              key={entry.uuid || `${entry.role}-${entry.timestamp}`}
              className={`claude-transcript-msg role-${entry.role}`}
            >
              <div className="claude-msg-header">
                <span className="claude-msg-role">{entry.role}</span>
                {entry.timestamp && (
                  <span>{format(parseISO(entry.timestamp), 'EEE, MMM d HH:mm')}</span>
                )}
              </div>
              {entry.blocks.map((block, i) => {
                if (block.type === 'text') {
                  return (
                    <p className="claude-msg-text" key={i}>
                      {block.text}
                    </p>
                  )
                }
                return (
                  <div
                    key={i}
                    className={`claude-tool-line${block.type === 'tool_result' && block.isError ? ' error' : ''}`}
                  >
                    {block.label}
                  </div>
                )
              })}
            </div>
          ))
        )}
      </div>
    </>
  )
}
