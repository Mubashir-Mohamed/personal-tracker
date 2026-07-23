import { useEffect, useState } from 'react'
import { api } from '../api'
import type { AppSettings, Category, DayType, ScheduleRule } from '../api'

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
        Object.fromEntries(r.map((rule) => [rule.id, { startTime: rule.startTime, endTime: rule.endTime }]))
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
          <div className="page-subtitle">Adjust your recurring schedule and notification behavior</div>
        </div>
      </div>

      {categories.length > 0 && (
        <>
          <RuleEditor dayType="weekday" categories={categories} />
          <RuleEditor dayType="weekend" categories={categories} />
        </>
      )}

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
