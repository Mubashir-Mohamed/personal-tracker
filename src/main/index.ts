import { app, shell, BrowserWindow } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import { initDb, getSetting } from './db'
import { startDayRolloverWatcher } from './scheduler'
import { startNotificationTicker } from './notifications'
import { createTray } from './tray'
import { registerIpcHandlers } from './ipc'
import { applyAutoLaunch } from './autoLaunch'

let mainWindow: BrowserWindow | null = null
let isQuitting = false

function createWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1040,
    height: 740,
    show: false,
    autoHideMenuBar: true,
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  win.on('ready-to-show', () => win.show())

  // Menu bar app: closing the window just hides it, the tray keeps the app running.
  win.on('close', (event) => {
    if (!isQuitting) {
      event.preventDefault()
      win.hide()
    }
  })

  win.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    win.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'))
  }

  return win
}

function openDashboard(): void {
  if (!mainWindow || mainWindow.isDestroyed()) {
    mainWindow = createWindow()
  } else {
    mainWindow.show()
    mainWindow.focus()
  }
}

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.personaltracker.app')

  // Menu bar app: live in the tray only, not the Dock or Cmd+Tab.
  if (process.platform === 'darwin') app.dock?.hide()

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  initDb()
  registerIpcHandlers()

  mainWindow = createWindow()
  createTray(openDashboard)

  startDayRolloverWatcher(() => {
    mainWindow?.webContents.send('day-changed')
  })
  startNotificationTicker()

  applyAutoLaunch(getSetting('autoLaunch')).catch((err) => console.error('auto-launch setup failed', err))

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      mainWindow = createWindow()
    } else {
      openDashboard()
    }
  })
})

app.on('before-quit', () => {
  isQuitting = true
})

// Keep running in the tray even with no windows open — that's the point of a menu bar app.
app.on('window-all-closed', () => {})
