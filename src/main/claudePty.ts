import * as pty from 'node-pty'
import { resolveClaudeBinary } from './claudeCli'
import type { ClaudePtyStartRequest, ClaudePtyStartResult, ClaudePtyStatus } from '../shared/types'

const MAX_BUFFER_BYTES = 200_000

type SendFn = (channel: string, ...args: unknown[]) => void

let sendFn: SendFn | null = null
let ptyProcess: pty.IPty | null = null
let currentCwd: string | null = null
let currentSessionId: string | null = null
let outputBuffer = ''

function appendToBuffer(data: string): void {
  outputBuffer += data
  if (outputBuffer.length > MAX_BUFFER_BYTES) {
    outputBuffer = outputBuffer.slice(outputBuffer.length - MAX_BUFFER_BYTES)
  }
}

/** Injected sendFn keeps this module ignorant of BrowserWindow, matching the
 *  startDayRolloverWatcher(onNewDay) pattern already used in scheduler.ts. */
export function initClaudePty(fn: SendFn): void {
  sendFn = fn
}

export function stop(): void {
  if (ptyProcess) {
    ptyProcess.kill()
    ptyProcess = null
  }
  currentCwd = null
  currentSessionId = null
}

export async function start(req: ClaudePtyStartRequest): Promise<ClaudePtyStartResult> {
  stop()

  const binary = await resolveClaudeBinary()
  if (!binary.path) {
    return { ok: false, error: 'Claude Code binary not found. Set an override in Settings.' }
  }

  // Security invariant: never pass --dangerously-skip-permissions (or its aliases) here.
  // Claude Code's normal interactive approval prompts must always appear in this terminal.
  const args = req.mode === 'resume' ? ['--resume', req.sessionId] : []

  let proc: pty.IPty
  try {
    proc = pty.spawn(binary.path, args, {
      name: 'xterm-256color',
      cols: req.cols,
      rows: req.rows,
      cwd: req.cwd,
      env: process.env as Record<string, string>
    })
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) }
  }

  ptyProcess = proc
  currentCwd = req.cwd
  currentSessionId = req.mode === 'resume' ? req.sessionId : null
  outputBuffer = ''

  proc.onData((data) => {
    appendToBuffer(data)
    sendFn?.('claude-pty-data', data)
  })

  proc.onExit(({ exitCode, signal }) => {
    sendFn?.('claude-pty-exit', {
      code: exitCode ?? null,
      signal: signal != null ? String(signal) : null
    })
    if (ptyProcess === proc) {
      ptyProcess = null
      currentCwd = null
      currentSessionId = null
    }
  })

  return { ok: true, pid: proc.pid }
}

export function write(data: string): void {
  ptyProcess?.write(data)
}

export function resize(cols: number, rows: number): void {
  ptyProcess?.resize(cols, rows)
}

export function getStatus(): ClaudePtyStatus {
  return {
    running: ptyProcess != null,
    cwd: currentCwd,
    sessionId: currentSessionId,
    pid: ptyProcess?.pid ?? null
  }
}

export function getBuffer(): string {
  return outputBuffer
}

export function killOnQuit(): void {
  stop()
}
