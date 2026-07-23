import AutoLaunch from 'auto-launch'

const autoLauncher = new AutoLaunch({ name: 'Personal Tracker' })

export async function applyAutoLaunch(enabled: boolean): Promise<void> {
  const isEnabled = await autoLauncher.isEnabled()
  if (enabled && !isEnabled) await autoLauncher.enable()
  if (!enabled && isEnabled) await autoLauncher.disable()
}
