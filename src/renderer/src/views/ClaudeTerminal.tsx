import { useEffect, useRef, useState } from 'react'
import { api } from '../api'
import type { ClaudeBinaryStatus, ClaudePtyExitInfo, ClaudePtyStartRequest } from '../api'
import XtermView, { type XtermHandle } from '../components/XtermView'

type Phase = 'idle' | 'starting' | 'running' | 'exited' | 'binary-missing' | 'error'

interface PendingClaudeAction {
  mode: 'resume'
  cwd: string
  sessionId: string
}

type AutoIntent = { type: 'reattach' } | { type: 'resume'; cwd: string; sessionId: string }

type StartRequestWithoutSize =
  { mode: 'new'; cwd: string } | { mode: 'resume'; cwd: string; sessionId: string }

export default function ClaudeTerminal({
  pendingAction,
  onPendingActionHandled,
  onOpenSettings
}: {
  pendingAction: PendingClaudeAction | null
  onPendingActionHandled: () => void
  onOpenSettings: () => void
}): React.JSX.Element {
  const termHandleRef = useRef<XtermHandle>(null)
  const sizeRef = useRef<{ cols: number; rows: number } | null>(null)
  const initializedRef = useRef(false)
  const pendingActionAtMountRef = useRef(pendingAction)

  const [phase, setPhase] = useState<Phase>('idle')
  const [binaryStatus, setBinaryStatus] = useState<ClaudeBinaryStatus | null>(null)
  const [cwdInput, setCwdInput] = useState('')
  const [exitInfo, setExitInfo] = useState<ClaudePtyExitInfo | null>(null)
  const [startError, setStartError] = useState<string | null>(null)
  const [terminalReady, setTerminalReady] = useState(false)
  const [autoIntent, setAutoIntent] = useState<AutoIntent | null>(null)

  // Push-event subscriptions live for the component's lifetime — unmounting only tears these
  // down, it never stops the pty. A running session survives navigating away.
  useEffect(() => {
    const offData = api.onClaudePtyData((data) => termHandleRef.current?.write(data))
    const offExit = api.onClaudePtyExit((info) => {
      setExitInfo(info)
      setPhase('exited')
    })
    return () => {
      offData()
      offExit()
    }
  }, [])

  useEffect(() => {
    if (initializedRef.current) return
    initializedRef.current = true

    api.getClaudeLastCwd().then(setCwdInput)

    api.getClaudeBinaryStatus().then((status) => {
      setBinaryStatus(status)
      if (!status.path) {
        setPhase('binary-missing')
        return
      }

      api.getClaudePtyStatus().then((ptyStatus) => {
        if (ptyStatus.running) {
          setAutoIntent({ type: 'reattach' })
          setPhase('running')
          return
        }

        const pending = pendingActionAtMountRef.current
        if (pending) {
          setAutoIntent({ type: 'resume', cwd: pending.cwd, sessionId: pending.sessionId })
          setPhase('starting')
        }
      })
    })
  }, [])

  // Fires once the terminal has mounted and reported a real size, satisfying whichever
  // auto-action (reattach or resume) was queued up during the mount-time check above.
  useEffect(() => {
    if (!terminalReady || !autoIntent || !sizeRef.current) return
    const intent = autoIntent
    const { cols, rows } = sizeRef.current
    setAutoIntent(null)

    if (intent.type === 'reattach') {
      api.getClaudePtyBuffer().then((buffer) => termHandleRef.current?.write(buffer))
      api.resizeClaudePty(cols, rows)
      return
    }

    api
      .startClaudeSession({
        mode: 'resume',
        cwd: intent.cwd,
        sessionId: intent.sessionId,
        cols,
        rows
      })
      .then((result) => {
        onPendingActionHandled()
        if (result.ok) {
          setPhase('running')
        } else {
          setStartError(result.error ?? 'Failed to start session')
          setPhase('error')
        }
      })
  }, [terminalReady, autoIntent, onPendingActionHandled])

  const handleTerminalData = (data: string): void => {
    api.writeClaudePtyInput(data)
  }

  const handleTerminalResize = (cols: number, rows: number): void => {
    sizeRef.current = { cols, rows }
    if (!terminalReady) setTerminalReady(true)
    else api.resizeClaudePty(cols, rows)
  }

  const beginStart = async (request: StartRequestWithoutSize): Promise<void> => {
    const size = sizeRef.current
    if (!size) return
    setStartError(null)
    setExitInfo(null)
    termHandleRef.current?.clear()
    setPhase('starting')
    const result = await api.startClaudeSession({
      ...request,
      cols: size.cols,
      rows: size.rows
    } as ClaudePtyStartRequest)
    if (result.ok) {
      setPhase('running')
    } else {
      setStartError(result.error ?? 'Failed to start session')
      setPhase('error')
    }
  }

  const startNewSession = (): void => {
    if (!cwdInput.trim()) return
    if (phase === 'running') {
      if (!window.confirm('A session is already running. Stop it and start a new one?')) return
    }
    beginStart({ mode: 'new', cwd: cwdInput.trim() })
  }

  const browseWorkingDirectory = async (): Promise<void> => {
    const picked = await api.pickClaudeWorkingDirectory()
    if (picked) setCwdInput(picked)
  }

  const stopSession = async (): Promise<void> => {
    if (!window.confirm('Stop the running Claude Code session?')) return
    await api.stopClaudeSession()
  }

  if (phase === 'binary-missing') {
    return (
      <>
        <div className="page-header">
          <div>
            <div className="page-title">Terminal</div>
            <div className="page-subtitle">Live embedded Claude Code session</div>
          </div>
        </div>
        <div className="disabled-banner">
          Couldn&apos;t find the <code>claude</code> CLI on this machine. Set the path manually in{' '}
          <button
            className="btn btn-ghost"
            style={{ display: 'inline', padding: '0 4px' }}
            onClick={onOpenSettings}
          >
            Settings → Claude Code
          </button>
          .
        </div>
      </>
    )
  }

  const showStartForm = phase === 'idle'

  return (
    <div className="terminal-page">
      <div className="page-header">
        <div>
          <div className="page-title">Terminal</div>
          <div className="page-subtitle">
            {binaryStatus?.path
              ? `Using ${binaryStatus.path}`
              : 'Live embedded Claude Code session'}
          </div>
        </div>
        {phase === 'running' && (
          <button className="btn btn-danger" onClick={stopSession}>
            Stop session
          </button>
        )}
      </div>

      {phase === 'exited' && (
        <div className="disabled-banner">
          Session ended{exitInfo?.code != null ? ` (exit code ${exitInfo.code})` : ''}
          {exitInfo?.signal ? ` (signal ${exitInfo.signal})` : ''}.
        </div>
      )}
      {phase === 'error' && startError && <div className="disabled-banner">{startError}</div>}

      {showStartForm && (
        <div className="card card-pad terminal-start-form">
          <div className="section-title">Start a session</div>
          <div className="field-row">
            <input
              type="text"
              value={cwdInput}
              onChange={(e) => setCwdInput(e.target.value)}
              placeholder="Working directory"
            />
            <button className="btn" onClick={browseWorkingDirectory}>
              Browse…
            </button>
          </div>
          <div className="save-row">
            <button
              className="btn btn-primary"
              onClick={startNewSession}
              disabled={!cwdInput.trim()}
            >
              Start new session
            </button>
          </div>
        </div>
      )}

      <XtermView ref={termHandleRef} onData={handleTerminalData} onResize={handleTerminalResize} />
    </div>
  )
}
