import { existsSync, readdirSync } from 'fs'
import { homedir } from 'os'
import { join } from 'path'
import { exec } from 'child_process'
import { getRawMeta, setRawMeta } from './db'
import type { ClaudeBinaryStatus } from '../shared/types'

let cached: ClaudeBinaryStatus | null = null

function wellKnownPaths(): string[] {
  const home = homedir()
  const paths: string[] = []

  const nvmVersionsDir = join(home, '.nvm', 'versions', 'node')
  try {
    for (const entry of readdirSync(nvmVersionsDir, { withFileTypes: true })) {
      if (entry.isDirectory()) paths.push(join(nvmVersionsDir, entry.name, 'bin', 'claude'))
    }
  } catch {
    // no nvm install on this machine
  }

  paths.push(
    '/opt/homebrew/bin/claude',
    '/usr/local/bin/claude',
    join(home, '.volta', 'bin', 'claude')
  )
  return paths
}

function detectViaLoginShell(): Promise<string | null> {
  const shell = process.env.SHELL || '/bin/zsh'
  return new Promise((resolve) => {
    exec(`${shell} -lic 'command -v claude'`, { timeout: 5000 }, (error, stdout) => {
      if (error) {
        resolve(null)
        return
      }
      const path = stdout.trim().split('\n').pop()?.trim() ?? ''
      resolve(path && existsSync(path) ? path : null)
    })
  })
}

async function resolve(): Promise<ClaudeBinaryStatus> {
  const override = getRawMeta('claudeBinaryOverride')
  if (override) {
    // An explicit override that doesn't exist must surface as not-found rather than
    // silently falling through to auto-detection — otherwise a bad override would
    // never be visible to the user in Settings.
    return existsSync(override)
      ? { path: override, source: 'override' }
      : { path: null, source: 'not-found' }
  }

  const viaShell = await detectViaLoginShell()
  if (viaShell) return { path: viaShell, source: 'login-shell' }

  for (const candidate of wellKnownPaths()) {
    if (existsSync(candidate)) return { path: candidate, source: 'well-known-path' }
  }

  return { path: null, source: 'not-found' }
}

export async function resolveClaudeBinary(forceRefresh = false): Promise<ClaudeBinaryStatus> {
  if (cached && !forceRefresh) return cached
  cached = await resolve()
  return cached
}

export async function setBinaryOverride(path: string | null): Promise<ClaudeBinaryStatus> {
  setRawMeta('claudeBinaryOverride', path ?? '')
  cached = null
  return resolveClaudeBinary(true)
}
