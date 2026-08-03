import { readdirSync, readFileSync, statSync } from 'fs'
import { homedir } from 'os'
import { join } from 'path'
import type {
  ClaudeContentBlockSummary,
  ClaudeSessionSummary,
  ClaudeTranscriptEntry
} from '../shared/types'

const PROJECTS_DIR = join(homedir(), '.claude', 'projects')

type Json = Record<string, unknown>

function str(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined
}

function obj(value: unknown): Json | undefined {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Json) : undefined
}

interface SummaryCacheEntry {
  mtimeMs: number
  summary: ClaudeSessionSummary
}

const summaryCache = new Map<string, SummaryCacheEntry>()

function listJsonlFiles(): string[] {
  let projectDirs: string[]
  try {
    projectDirs = readdirSync(PROJECTS_DIR, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => join(PROJECTS_DIR, d.name))
  } catch {
    return []
  }

  const files: string[] = []
  for (const dir of projectDirs) {
    let entries: string[]
    try {
      entries = readdirSync(dir)
    } catch {
      continue
    }
    for (const entry of entries) {
      if (entry.endsWith('.jsonl')) files.push(join(dir, entry))
    }
  }
  return files
}

function parseLine(line: string): Json | null {
  const trimmed = line.trim()
  if (!trimmed) return null
  try {
    return obj(JSON.parse(trimmed)) ?? null
  } catch {
    return null
  }
}

function buildSummary(filePath: string, mtimeMs: number): ClaudeSessionSummary | null {
  let content: string
  try {
    content = readFileSync(filePath, 'utf8')
  } catch {
    return null
  }

  let sessionId: string | null = null
  let cwd: string | null = null
  let title: string | null = null
  let messageCount = 0

  for (const line of content.split('\n')) {
    const record = parseLine(line)
    if (!record) continue

    if (!sessionId) sessionId = str(record.sessionId) ?? null
    if (!cwd) cwd = str(record.cwd) ?? null

    if (record.type === 'custom-title') {
      title = str(record.customTitle) ?? title
    } else if (record.type === 'ai-title') {
      title = str(record.aiTitle) ?? title
    } else if (record.type === 'relocated') {
      // A session's working directory can change mid-conversation (e.g. the user cd's the
      // app elsewhere). `claude --resume` looks up the session under its CURRENT directory,
      // not the one captured on the first line, so this must win over the original cwd —
      // last relocation wins, same "overwrite in file order" rule as the title lines above.
      cwd = str(record.relocatedCwd) ?? cwd
    }

    if (record.type === 'user' || record.type === 'assistant') messageCount++
  }

  if (!sessionId) return null

  return {
    sessionId,
    filePath,
    cwd: cwd ?? '',
    title,
    lastActiveAt: new Date(mtimeMs).toISOString(),
    messageCount
  }
}

export function listSessions(): ClaudeSessionSummary[] {
  const files = listJsonlFiles()
  const summaries: ClaudeSessionSummary[] = []

  for (const filePath of files) {
    let mtimeMs: number
    try {
      mtimeMs = statSync(filePath).mtimeMs
    } catch {
      continue
    }

    const cached = summaryCache.get(filePath)
    if (cached && cached.mtimeMs === mtimeMs) {
      summaries.push(cached.summary)
      continue
    }

    const summary = buildSummary(filePath, mtimeMs)
    if (!summary) continue
    summaryCache.set(filePath, { mtimeMs, summary })
    summaries.push(summary)
  }

  return summaries.sort((a, b) => b.lastActiveAt.localeCompare(a.lastActiveAt))
}

function summarizeToolUse(block: Json): ClaudeContentBlockSummary {
  const name = str(block.name) ?? 'tool'
  const input = obj(block.input)
  const detail =
    (input &&
      (str(input.command) ??
        str(input.file_path) ??
        str(input.path) ??
        str(input.pattern) ??
        str(input.query) ??
        str(input.url) ??
        str(input.prompt)?.slice(0, 80))) ||
    ''
  const label = detail ? `${name}(${detail})` : `${name}(...)`
  return { type: 'tool_use', label: label.length > 160 ? `${label.slice(0, 157)}...` : label }
}

function toolResultText(content: unknown): string {
  if (typeof content === 'string') return content
  if (Array.isArray(content)) {
    return content
      .map((c) => str(obj(c)?.text) ?? '')
      .filter(Boolean)
      .join(' ')
  }
  return ''
}

function summarizeToolResult(block: Json): ClaudeContentBlockSummary {
  const text = toolResultText(block.content).trim().replace(/\s+/g, ' ')
  const label = text.length > 160 ? `${text.slice(0, 157)}...` : text || '(no output)'
  return { type: 'tool_result', label, isError: !!block.is_error }
}

function normalizeContent(content: unknown): ClaudeContentBlockSummary[] {
  if (typeof content === 'string') {
    return content.trim() ? [{ type: 'text', text: content }] : []
  }
  if (!Array.isArray(content)) return []

  const blocks: ClaudeContentBlockSummary[] = []
  for (const raw of content) {
    const block = obj(raw)
    if (!block) continue
    switch (block.type) {
      case 'text': {
        const text = str(block.text)
        if (text && text.trim()) blocks.push({ type: 'text', text })
        break
      }
      case 'tool_use':
        blocks.push(summarizeToolUse(block))
        break
      case 'tool_result':
        blocks.push(summarizeToolResult(block))
        break
      // 'thinking' and anything else are skipped in v1.
      default:
        break
    }
  }
  return blocks
}

export function getTranscript(filePath: string): ClaudeTranscriptEntry[] {
  let content: string
  try {
    content = readFileSync(filePath, 'utf8')
  } catch {
    return []
  }

  const entries: ClaudeTranscriptEntry[] = []
  for (const line of content.split('\n')) {
    const record = parseLine(line)
    if (!record) continue
    // Allowlist, not a skip-list: real transcripts have line types beyond user/assistant
    // (relocated, frame-link, custom-title, ...) that must never be rendered as messages.
    if (record.type !== 'user' && record.type !== 'assistant') continue
    const message = obj(record.message)
    if (!message) continue

    const blocks = normalizeContent(message.content)
    if (blocks.length === 0) continue

    entries.push({
      uuid: str(record.uuid) ?? '',
      role: record.type,
      timestamp: str(record.timestamp) ?? null,
      blocks
    })
  }

  return entries
}
