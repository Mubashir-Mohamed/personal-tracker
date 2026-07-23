import { useEffect, useState } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import { format, parseISO } from 'date-fns'
import { api } from '../api'
import type { Category, WeekStats } from '../api'

export default function Stats(): React.JSX.Element {
  const [weekStats, setWeekStats] = useState<WeekStats | null>(null)
  const [categories, setCategories] = useState<Category[]>([])

  useEffect(() => {
    api.getWeekStats().then(setWeekStats)
    api.getCategories().then(setCategories)
  }, [])

  if (!weekStats) return <div className="empty-state">Loading stats…</div>

  const chartData = weekStats.days.map((day) => {
    const row: Record<string, number | string> = { day: format(parseISO(day.date), 'EEE') }
    for (const cat of categories) {
      const stat = day.categories.find((c) => c.categoryId === cat.id)
      row[cat.name] = stat ? Math.round((stat.doneMinutes / 60) * 10) / 10 : 0
    }
    return row
  })

  const totals = categories
    .map((cat) => {
      const planned = weekStats.days.reduce((sum, day) => {
        const stat = day.categories.find((c) => c.categoryId === cat.id)
        return sum + (stat?.plannedMinutes ?? 0)
      }, 0)
      const done = weekStats.days.reduce((sum, day) => {
        const stat = day.categories.find((c) => c.categoryId === cat.id)
        return sum + (stat?.doneMinutes ?? 0)
      }, 0)
      return { category: cat, plannedHours: planned / 60, doneHours: done / 60 }
    })
    .filter((t) => t.plannedHours > 0)

  const avgAdherence =
    weekStats.days.length > 0
      ? Math.round(weekStats.days.reduce((s, d) => s + d.adherencePct, 0) / weekStats.days.length)
      : 0

  return (
    <>
      <div className="page-header">
        <div>
          <div className="page-title">This Week</div>
          <div className="page-subtitle">Monday through today, updated live as blocks complete</div>
        </div>
      </div>

      <div className="stat-grid">
        <div className="card stat-tile">
          <div className="stat-tile-label">Job hunt streak</div>
          <div className="stat-tile-value accent-accent">{weekStats.jobHuntStreak}d</div>
        </div>
        <div className="card stat-tile">
          <div className="stat-tile-label">Family time streak</div>
          <div className="stat-tile-value accent-success">{weekStats.familyStreak}d</div>
        </div>
        <div className="card stat-tile">
          <div className="stat-tile-label">Applications this week</div>
          <div className="stat-tile-value">{weekStats.totalApplications}</div>
        </div>
        <div className="card stat-tile">
          <div className="stat-tile-label">Avg. adherence</div>
          <div className="stat-tile-value">{avgAdherence}%</div>
        </div>
      </div>

      <div className="card card-pad" style={{ marginBottom: 20 }}>
        <div className="section-title">Hours completed by category</div>
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border-soft)" vertical={false} />
            <XAxis
              dataKey="day"
              stroke="var(--text-tertiary)"
              fontSize={12}
              tickLine={false}
              axisLine={false}
            />
            <YAxis stroke="var(--text-tertiary)" fontSize={12} tickLine={false} axisLine={false} width={28} />
            <Tooltip
              contentStyle={{
                background: 'var(--bg-elevated)',
                border: '1px solid var(--border)',
                borderRadius: 10,
                fontSize: 12
              }}
            />
            {categories.map((cat) => (
              <Bar key={cat.id} dataKey={cat.name} stackId="hours" fill={cat.color} radius={[2, 2, 2, 2]} />
            ))}
          </BarChart>
        </ResponsiveContainer>
        <div className="legend-row">
          {categories.map((cat) => (
            <div key={cat.id} className="legend-item">
              <span className="legend-swatch" style={{ background: cat.color }} />
              {cat.name}
            </div>
          ))}
        </div>
      </div>

      <div className="card card-pad">
        <div className="section-title">Weekly totals</div>
        <table className="week-table">
          <thead>
            <tr>
              <th>Category</th>
              <th>Planned</th>
              <th>Done</th>
              <th>Adherence</th>
            </tr>
          </thead>
          <tbody>
            {totals.map((t) => (
              <tr key={t.category.id}>
                <td>
                  <span
                    className="legend-swatch"
                    style={{ background: t.category.color, marginRight: 8 }}
                  />
                  {t.category.name}
                </td>
                <td className="num">{t.plannedHours.toFixed(1)}h</td>
                <td className="num">{t.doneHours.toFixed(1)}h</td>
                <td className="num">
                  {t.plannedHours > 0 ? Math.round((t.doneHours / t.plannedHours) * 100) : 0}%
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}
