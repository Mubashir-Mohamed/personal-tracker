import { Tray, Menu, nativeImage, app } from 'electron'
import icon from '../../resources/icon.png?asset'
import { getBlocksForDate } from './db'
import { todayString } from './scheduler'

let tray: Tray | null = null

function toMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}

function currentAndNext(): { current?: string; next?: string } {
  const now = new Date()
  const blocks = getBlocksForDate(todayString(now))
  const nowMinutes = now.getHours() * 60 + now.getMinutes()

  const current = blocks.find(
    (b) => toMinutes(b.plannedStart) <= nowMinutes && nowMinutes < toMinutes(b.plannedEnd)
  )
  const next = blocks
    .filter((b) => toMinutes(b.plannedStart) > nowMinutes)
    .sort((a, b) => toMinutes(a.plannedStart) - toMinutes(b.plannedStart))[0]

  return { current: current?.label, next: next?.label }
}

export function createTray(openDashboard: () => void): Tray {
  const trayIcon = nativeImage.createFromPath(icon).resize({ width: 18, height: 18 })
  tray = new Tray(trayIcon)
  tray.setToolTip('Personal Tracker')

  const refresh = (): void => {
    const { current, next } = currentAndNext()
    tray?.setToolTip(`Personal Tracker\nNow: ${current ?? 'Free time'}${next ? `\nNext: ${next}` : ''}`)
    tray?.setContextMenu(
      Menu.buildFromTemplate([
        { label: current ? `Now: ${current}` : 'Now: Free time', enabled: false },
        { label: next ? `Next: ${next}` : 'Next: —', enabled: false },
        { type: 'separator' },
        { label: 'Open Dashboard', click: openDashboard },
        { type: 'separator' },
        { label: 'Quit Personal Tracker', click: () => app.quit() }
      ])
    )
  }

  refresh()
  setInterval(refresh, 30_000)
  tray.on('click', openDashboard)

  return tray
}
