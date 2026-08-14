import { useEffect, useState } from 'react'
import { api } from '../api'
import type {
  AppSettings,
  Category,
  CategoryKind,
  ClaudeBinaryStatus,
  DayType,
  ScheduleRule
} from '../api'

const CATEGORY_KINDS: CategoryKind[] = ['work', 'job_hunt', 'family', 'break', 'leisure', 'other']

const inputStyle: React.CSSProperties = {
  background: 'var(--bg-elevated)',
  border: '1px solid var(--border)',
  borderRadius: 8,
  padding: '6px 8px',
  fontSize: 12.5,
  color: 'var(--text-primary)',
  fontFamily: 'inherit'
}

function RuleEditor({
  dayType,
  categories
}: {
  dayType: DayType
  categories: Category[]
}): React.JSX.Element {
  const [rules, setRules] = useState<ScheduleRule[]>([])
  const [edits, setEdits] = useState<
    Record<number, { startTime: string; endTime: string; label: string; categoryId: number }>
  >({})
  const [saving, setSaving] = useState(false)
  const [newBlock, setNewBlock] = useState({
    label: '',
    categoryId: 0,
    startTime: '09:00',
    endTime: '10:00'
  })

  const applyRules = (r: ScheduleRule[]): void => {
    setRules(r)
    setEdits(
      Object.fromEntries(
        r.map((rule) => [
          rule.id,
          {
            startTime: rule.startTime,
            endTime: rule.endTime,
            label: rule.label,
            categoryId: rule.categoryId
          }
        ])
      )
    )
  }

  const load = async (): Promise<void> => {
    applyRules(await api.getRules(dayType))
  }

  useEffect(() => {
    api.getRules(dayType).then(applyRules)
  }, [dayType])

  const categoryFor = (id: number): Category | undefined => categories.find((c) => c.id === id)
  // Falls back to the first category once any exist, without needing an effect to sync it.
  const newBlockCategoryId = newBlock.categoryId || categories[0]?.id || 0

  const updateField = (
    ruleId: number,
    field: 'startTime' | 'endTime' | 'label' | 'categoryId',
    value: string | number
  ): void => {
    setEdits((prev) => ({ ...prev, [ruleId]: { ...prev[ruleId], [field]: value } }))
  }

  const save = async (): Promise<void> => {
    setSaving(true)
    for (const rule of rules) {
      const edit = edits[rule.id]
      if (!edit) continue
      const changed =
        edit.startTime !== rule.startTime ||
        edit.endTime !== rule.endTime ||
        edit.label !== rule.label ||
        edit.categoryId !== rule.categoryId
      if (changed) await api.updateRule(rule.id, edit)
    }
    await load()
    setSaving(false)
  }

  const addBlock = async (): Promise<void> => {
    const label = newBlock.label.trim()
    if (!label || !newBlockCategoryId) return
    await api.addRule({ dayType, ...newBlock, categoryId: newBlockCategoryId, label })
    setNewBlock((prev) => ({ ...prev, label: '' }))
    await load()
  }

  const removeBlock = async (ruleId: number): Promise<void> => {
    await api.deleteRule(ruleId, dayType)
    await load()
  }

  return (
    <div className="card card-pad settings-section">
      <div className="section-title">
        {dayType === 'weekday' ? 'Weekday schedule (Mon–Fri)' : 'Weekend schedule (Sat–Sun)'}
      </div>
      {rules.length === 0 && (
        <div className="empty-state">No blocks yet — add your first one below.</div>
      )}
      {rules.map((rule) => {
        const edit = edits[rule.id] ?? {
          startTime: rule.startTime,
          endTime: rule.endTime,
          label: rule.label,
          categoryId: rule.categoryId
        }
        const category = categoryFor(edit.categoryId)
        return (
          <div className="rule-row" key={rule.id}>
            <span className="rule-color" style={{ background: category?.color }} />
            <select
              className="rule-category-select"
              style={inputStyle}
              value={edit.categoryId}
              onChange={(e) => updateField(rule.id, 'categoryId', Number(e.target.value))}
            >
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <input
              type="text"
              className="rule-label-input"
              style={{ ...inputStyle, flex: 1, minWidth: 100 }}
              value={edit.label}
              onChange={(e) => updateField(rule.id, 'label', e.target.value)}
            />
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
            <button className="icon-btn" onClick={() => removeBlock(rule.id)} title="Remove block">
              ×
            </button>
          </div>
        )
      })}
      <div className="save-row">
        <button className="btn btn-primary" onClick={save} disabled={saving || rules.length === 0}>
          {saving ? 'Saving…' : 'Save changes'}
        </button>
      </div>
      <div className="add-row">
        <select
          style={{ ...inputStyle, flex: '0 0 auto' }}
          value={newBlockCategoryId}
          onChange={(e) => setNewBlock((prev) => ({ ...prev, categoryId: Number(e.target.value) }))}
        >
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <input
          type="text"
          placeholder="New block label"
          value={newBlock.label}
          onChange={(e) => setNewBlock((prev) => ({ ...prev, label: e.target.value }))}
          onKeyDown={(e) => {
            if (e.key === 'Enter') addBlock()
          }}
        />
        <input
          type="time"
          value={newBlock.startTime}
          onChange={(e) => setNewBlock((prev) => ({ ...prev, startTime: e.target.value }))}
        />
        <input
          type="time"
          value={newBlock.endTime}
          onChange={(e) => setNewBlock((prev) => ({ ...prev, endTime: e.target.value }))}
        />
        <button className="add-btn" onClick={addBlock}>
          + Add block
        </button>
      </div>
    </div>
  )
}

function CategoryManager({
  categories,
  onChanged
}: {
  categories: Category[]
  onChanged: () => void
}): React.JSX.Element {
  // `edits` only holds rows currently being typed into — anything not present here just
  // falls back to the live `categories` prop (see editFor), so there's no props->state sync
  // effect to keep in step and no risk of it clobbering in-progress edits on other rows.
  const [edits, setEdits] = useState<
    Record<number, { name: string; color: string; kind: CategoryKind }>
  >({})
  const [newCategory, setNewCategory] = useState({
    name: '',
    color: '#5b8def',
    kind: 'other' as CategoryKind
  })
  const [error, setError] = useState<string | null>(null)

  const editFor = (c: Category): { name: string; color: string; kind: CategoryKind } =>
    edits[c.id] ?? { name: c.name, color: c.color, kind: c.kind }

  const stage = (
    id: number,
    patch: Partial<{ name: string; color: string; kind: CategoryKind }>
  ): void => {
    setEdits((prev) => ({
      ...prev,
      [id]: { ...editFor(categories.find((c) => c.id === id)!), ...prev[id], ...patch }
    }))
  }

  const commit = async (id: number): Promise<void> => {
    const edit = edits[id]
    if (!edit) return
    await api.updateCategory(id, edit)
    onChanged()
  }

  const remove = async (id: number): Promise<void> => {
    const result = await api.deleteCategory(id)
    if (!result.ok) {
      setError(result.error ?? "Couldn't delete this category.")
      setTimeout(() => setError(null), 4000)
      return
    }
    onChanged()
  }

  const add = async (): Promise<void> => {
    const name = newCategory.name.trim()
    if (!name) return
    await api.addCategory({ name, color: newCategory.color, kind: newCategory.kind })
    setNewCategory({ name: '', color: '#5b8def', kind: 'other' })
    onChanged()
  }

  return (
    <div className="card card-pad settings-section">
      <div className="section-title">Categories</div>
      <div className="block-meta" style={{ marginBottom: 10 }}>
        Color-codes your schedule blocks and drives the notification sound, streaks, and icon per
        block (assign a category&apos;s <em>type</em> to make it count toward the matching stats
        streak).
      </div>
      {error && (
        <div className="report-banner" style={{ color: 'var(--danger)' }}>
          {error}
        </div>
      )}
      {categories.map((c) => {
        const edit = editFor(c)
        return (
          <div className="rule-row" key={c.id}>
            <input
              type="color"
              value={edit.color}
              onChange={(e) => stage(c.id, { color: e.target.value })}
              onBlur={() => commit(c.id)}
              className="category-color-input"
            />
            <input
              type="text"
              className="rule-label-input"
              style={{ ...inputStyle, flex: 1, minWidth: 100 }}
              value={edit.name}
              onChange={(e) => stage(c.id, { name: e.target.value })}
              onBlur={() => commit(c.id)}
            />
            <select
              style={inputStyle}
              value={edit.kind}
              onChange={(e) => {
                stage(c.id, { kind: e.target.value as CategoryKind })
                commit(c.id)
              }}
            >
              {CATEGORY_KINDS.map((k) => (
                <option key={k} value={k}>
                  {k.replace('_', ' ')}
                </option>
              ))}
            </select>
            <button className="icon-btn" onClick={() => remove(c.id)} title="Delete category">
              ×
            </button>
          </div>
        )
      })}
      <div className="add-row">
        <input
          type="color"
          value={newCategory.color}
          onChange={(e) => setNewCategory((prev) => ({ ...prev, color: e.target.value }))}
          className="category-color-input"
        />
        <input
          type="text"
          placeholder="New category name"
          value={newCategory.name}
          onChange={(e) => setNewCategory((prev) => ({ ...prev, name: e.target.value }))}
          onKeyDown={(e) => {
            if (e.key === 'Enter') add()
          }}
        />
        <select
          style={{ ...inputStyle, flex: '0 0 auto' }}
          value={newCategory.kind}
          onChange={(e) =>
            setNewCategory((prev) => ({ ...prev, kind: e.target.value as CategoryKind }))
          }
        >
          {CATEGORY_KINDS.map((k) => (
            <option key={k} value={k}>
              {k.replace('_', ' ')}
            </option>
          ))}
        </select>
        <button className="add-btn" onClick={add}>
          + Add category
        </button>
      </div>
    </div>
  )
}

function ProfileAndWeatherSettings({
  settings,
  updateSetting
}: {
  settings: AppSettings
  updateSetting: <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => void
}): React.JSX.Element {
  return (
    <div className="card card-pad settings-section">
      <div className="section-title">Profile &amp; weather</div>
      <div className="settings-field-row">
        <span>Your name (used in the Home dashboard greeting)</span>
        <input
          type="text"
          placeholder="optional"
          value={settings.displayName}
          onChange={(e) => updateSetting('displayName', e.target.value)}
          style={{ ...inputStyle, width: 160 }}
        />
      </div>
      <div className="settings-field-row">
        <span>Weather location label</span>
        <input
          type="text"
          value={settings.weatherLocationLabel}
          onChange={(e) => updateSetting('weatherLocationLabel', e.target.value)}
          style={{ ...inputStyle, width: 160 }}
        />
      </div>
      <div className="settings-field-row">
        <span>Latitude / longitude</span>
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            type="number"
            step="0.0001"
            value={settings.weatherLat}
            onChange={(e) => updateSetting('weatherLat', Number(e.target.value))}
            style={{ ...inputStyle, width: 90 }}
          />
          <input
            type="number"
            step="0.0001"
            value={settings.weatherLon}
            onChange={(e) => updateSetting('weatherLon', Number(e.target.value))}
            style={{ ...inputStyle, width: 90 }}
          />
        </div>
      </div>
      <div className="block-meta" style={{ marginTop: 6 }}>
        Look up your city&apos;s coordinates on{' '}
        <a
          href="#"
          onClick={(e) => {
            e.preventDefault()
            api.openExternal('https://www.latlong.net')
          }}
        >
          latlong.net
        </a>{' '}
        — the weather chip refetches within 5 minutes of a change.
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

  const refreshCategories = (): void => {
    api.getCategories().then(setCategories)
  }

  useEffect(() => {
    refreshCategories()
    api.getSettings().then(setSettings)
  }, [])

  const updateSetting = <K extends keyof AppSettings>(key: K, value: AppSettings[K]): void => {
    setSettings((prev) => (prev ? { ...prev, [key]: value } : prev))
    api.setSetting(key, value as string | number | boolean | null)
  }

  return (
    <>
      <div className="page-header">
        <div>
          <div className="page-title">Settings</div>
          <div className="page-subtitle">
            Adjust your recurring schedule, categories, and notification behavior
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

      <CategoryManager categories={categories} onChanged={refreshCategories} />

      {settings && <ProfileAndWeatherSettings settings={settings} updateSetting={updateSetting} />}

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
