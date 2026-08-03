import { useEffect, useState } from 'react'
import { api } from '../api'
import type { AppSettings, Category, ClaudeBinaryStatus, DayType, ScheduleRule } from '../api'

function RuleEditor({
  dayType,
  categories
}: {
  dayType: DayType
  categories: Category[]
}): React.JSX.Element {
  const [rules, setRules] = useState<ScheduleRule[]>([])
  const [edits, setEdits] = useState<Record<number, { startTime: string; endTime: string }>>({})
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    api.getRules(dayType).then((r) => {
      setRules(r)
      setEdits(
        Object.fromEntries(
          r.map((rule) => [rule.id, { startTime: rule.startTime, endTime: rule.endTime }])
        )
      )
    })
  }, [dayType])

  const categoryFor = (id: number): Category | undefined => categories.find((c) => c.id === id)

  const updateField = (ruleId: number, field: 'startTime' | 'endTime', value: string): void => {
    setEdits((prev) => ({ ...prev, [ruleId]: { ...prev[ruleId], [field]: value } }))
  }

  const save = async (): Promise<void> => {
    setSaving(true)
    for (const rule of rules) {
      const edit = edits[rule.id]
      if (edit && (edit.startTime !== rule.startTime || edit.endTime !== rule.endTime)) {
        await api.updateRuleTimes(rule.id, edit.startTime, edit.endTime)
      }
    }
    const refreshed = await api.getRules(dayType)
    setRules(refreshed)
    setSaving(false)
  }

  return (
    <div className="card card-pad settings-section">
      <div className="section-title">
        {dayType === 'weekday' ? 'Weekday schedule (Mon–Fri)' : 'Weekend schedule (Sat–Sun)'}
      </div>
      {rules.map((rule) => {
        const category = categoryFor(rule.categoryId)
        const edit = edits[rule.id] ?? { startTime: rule.startTime, endTime: rule.endTime }
        return (
          <div className="rule-row" key={rule.id}>
            <span className="rule-color" style={{ background: category?.color }} />
            <span className="rule-label">{rule.label}</span>
            <div className="rule-times">
              <input
                type="time"
                value={edit.startTime}
                onChange={(e) => updateField(rule.id, 'startTime', e.target.value)}
              />
              <span>to</span>
              <input
                type="time"
                value={edit.endTime}
                onChange={(e) => updateField(rule.id, 'endTime', e.target.value)}
              />
            </div>
          </div>
        )
      })}
      <div className="save-row">
        <button className="btn btn-primary" onClick={save} disabled={saving}>
          {saving ? 'Saving…' : 'Save changes'}
        </button>
      </div>
    </div>
  )
}

function claudeSourceLabel(source: ClaudeBinaryStatus['source']): string {
  switch (source) {
    case 'override':
      return 'manual override'
    case 'login-shell':
      return 'detected via login shell'
    case 'well-known-path':
      return 'detected via well-known path'
    case 'not-found':
      return 'not found'
  }
}

function ClaudeCodeSettings(): React.JSX.Element {
  const [status, setStatus] = useState<ClaudeBinaryStatus | null>(null)
  const [overrideInput, setOverrideInput] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    api.getClaudeBinaryStatus().then((s) => {
      setStatus(s)
      if (s.source === 'override' && s.path) setOverrideInput(s.path)
    })
  }, [])

  const browse = async (): Promise<void> => {
    const picked = await api.pickClaudeBinaryFile()
    if (picked) setOverrideInput(picked)
  }

  const save = async (): Promise<void> => {
    setSaving(true)
    const s = await api.setClaudeBinaryOverride(overrideInput.trim() || null)
    setStatus(s)
    setSaving(false)
  }

  const clearOverride = async (): Promise<void> => {
    setSaving(true)
    const s = await api.setClaudeBinaryOverride(null)
    setStatus(s)
    setOverrideInput('')
    setSaving(false)
  }

  return (
    <div className="card card-pad settings-section">
      <div className="section-title">Claude Code</div>
      <div className="settings-field-row">
        <span>Resolved binary</span>
        <span className="block-meta" style={{ marginTop: 0, textAlign: 'right' }}>
          {status ? (status.path ?? 'Not found') : 'Checking…'}
          {status?.path && ` (${claudeSourceLabel(status.source)})`}
        </span>
      </div>
      <div className="settings-field-row">
        <span>Manual override</span>
        <div style={{ display: 'flex', gap: 8, flex: 1, justifyContent: 'flex-end' }}>
          <input
            type="text"
            value={overrideInput}
            onChange={(e) => setOverrideInput(e.target.value)}
            placeholder="/path/to/claude"
            style={{
              flex: 1,
              maxWidth: 320,
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border)',
              borderRadius: 8,
              padding: '6px 8px',
              fontSize: 12.5
            }}
          />
          <button className="btn" onClick={browse}>
            Browse…
          </button>
        </div>
      </div>
      <div className="save-row" style={{ gap: 8 }}>
        <button className="btn btn-ghost" onClick={clearOverride} disabled={saving}>
          Clear override / re-detect
        </button>
        <button className="btn btn-primary" onClick={save} disabled={saving}>
          {saving ? 'Saving…' : 'Save'}
        </button>
      </div>
    </div>
  )
}

export default function Settings(): React.JSX.Element {
  const [categories, setCategories] = useState<Category[]>([])
  const [settings, setSettings] = useState<AppSettings | null>(null)

  useEffect(() => {
    api.getCategories().then(setCategories)
    api.getSettings().then(setSettings)
  }, [])

  const updateSetting = <K extends keyof AppSettings>(key: K, value: AppSettings[K]): void => {
    setSettings((prev) => (prev ? { ...prev, [key]: value } : prev))
    api.setSetting(key, value as string | number | boolean)
  }

  return (
    <>
      <div className="page-header">
        <div>
          <div className="page-title">Settings</div>
          <div className="page-subtitle">
            Adjust your recurring schedule and notification behavior
          </div>
        </div>
      </div>

      {settings && (
        <div className="card card-pad settings-section">
          <div className="section-title">Time Management</div>
          <div className="settings-field-row">
            <span>Track my daily routine</span>
            <button
              className={`toggle${settings.timeTrackerEnabled ? ' on' : ''}`}
              onClick={() => updateSetting('timeTrackerEnabled', !settings.timeTrackerEnabled)}
            >
              <span className="toggle-knob" />
            </button>
          </div>
          {!settings.timeTrackerEnabled && (
            <div className="block-meta" style={{ marginTop: 6 }}>
              Turned off — no new schedule blocks will be created and no notifications will fire
              until you turn this back on.
            </div>
          )}
        </div>
      )}

      {categories.length > 0 && (
        <>
          <RuleEditor dayType="weekday" categories={categories} />
          <RuleEditor dayType="weekend" categories={categories} />
        </>
      )}

      <ClaudeCodeSettings />

      {settings && (
        <div className="card card-pad settings-section">
          <div className="section-title">Notifications &amp; startup</div>
          <div className="settings-field-row">
            <span>Notify this many minutes before a block starts</span>
            <input
              type="number"
              min={0}
              max={60}
              value={settings.notificationLeadMinutes}
              onChange={(e) => updateSetting('notificationLeadMinutes', Number(e.target.value))}
              style={{
                width: 60,
                background: 'var(--bg-elevated)',
                border: '1px solid var(--border)',
                borderRadius: 8,
                padding: '6px 8px'
              }}
            />
          </div>
          <div className="settings-field-row">
            <span>Launch Personal Tracker at login</span>
            <button
              className={`toggle${settings.autoLaunch ? ' on' : ''}`}
              onClick={() => updateSetting('autoLaunch', !settings.autoLaunch)}
            >
              <span className="toggle-knob" />
            </button>
          </div>
        </div>
      )}
    </>
  )
}
