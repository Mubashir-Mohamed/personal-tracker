import { ElectronAPI } from '@electron-toolkit/preload'
import type { PersonalTrackerApi } from './index'

declare global {
  interface Window {
    electron: ElectronAPI
    api: PersonalTrackerApi
  }
}
