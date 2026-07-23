import AutoLaunch from 'auto-launch'

// mac.useLaunchAgent avoids the default AppleScript-via-System-Events path, which
// silently fails without an Automation permission grant we never request.
// A LaunchAgent plist needs no special permission.
const autoLauncher = new AutoLaunch({ name: 'Personal Tracker', mac: { useLaunchAgent: true } })

export async function applyAutoLaunch(enabled: boolean): Promise<void> {
  const isEnabled = await autoLauncher.isEnabled()
  if (enabled && !isEnabled) await autoLauncher.enable()
  if (!enabled && isEnabled) await autoLauncher.disable()
}
