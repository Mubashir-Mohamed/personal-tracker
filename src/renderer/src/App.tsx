import { useEffect, useState } from 'react'
import Dashboard from './views/Dashboard'
import Timeline from './views/Timeline'
import Stats from './views/Stats'
import Settings from './views/Settings'
import Routines from './views/Routines'
import ClaudeSessions from './views/ClaudeSessions'
import ClaudeTerminal from './views/ClaudeTerminal'

type View =
  | 'dashboard'
  | 'timeline'
  | 'stats'
  | 'settings'
  | 'routines'
  | 'claude-sessions'
  | 'claude-terminal'

interface NavItem {
  id: View
  label: string
  icon: React.JSX.Element
}

interface NavGroup {
  id: string
  label: string
  icon: React.JSX.Element
  items: NavItem[]
}

function ChevronIcon(): React.JSX.Element {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      className="nav-group-chevron-icon"
    >
      <path d="M9 6l6 6-6 6" />
    </svg>
  )
}

function CollapseIcon({ collapsed }: { collapsed: boolean }): React.JSX.Element {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d={collapsed ? 'M9 5l7 7-7 7' : 'M15 5l-7 7 7 7'} />
      <path d={collapsed ? 'M4 5v14' : 'M20 5v14'} />
    </svg>
  )
}

const SIDEBAR_COLLAPSED_KEY = 'sidebarCollapsed'

const NAV_STANDALONE: NavItem[] = [
  {
    id: 'dashboard',
    label: 'Home',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M4 11.5 12 4l8 7.5" />
        <path d="M6 10v9a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1v-9" />
      </svg>
    )
  }
]

const NAV_GROUPS: NavGroup[] = [
  {
    id: 'time-management',
    label: 'Time Management',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 2" />
      </svg>
    ),
    items: [
      {
        id: 'timeline',
        label: 'Today',
        icon: (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <circle cx="12" cy="12" r="9" />
            <path d="M12 7v5l3 2" />
          </svg>
        )
      },
      {
        id: 'stats',
        label: 'Stats',
        icon: (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M4 20V10M12 20V4M20 20v-7" />
          </svg>
        )
      },
      {
        id: 'settings',
        label: 'Settings',
        icon: (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.87-.34 1.7 1.7 0 0 0-1.03 1.56V21a2 2 0 1 1-4 0v-.09A1.7 1.7 0 0 0 9 19.4a1.7 1.7 0 0 0-1.87.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-1.56-1.03H3a2 2 0 1 1 0-4h.09A1.7 1.7 0 0 0 4.6 9a1.7 1.7 0 0 0-.34-1.87l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1.03-1.56V3a2 2 0 1 1 4 0v.09A1.7 1.7 0 0 0 15 4.6a1.7 1.7 0 0 0 1.87-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.7 1.7 0 0 0 19.4 9a1.7 1.7 0 0 0 1.56 1.03H21a2 2 0 1 1 0 4h-.09A1.7 1.7 0 0 0 19.4 15z" />
          </svg>
        )
      }
    ]
  },
  {
    id: 'claude-runners',
    label: 'Claude Runners',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M4 4v5h5M20 20v-5h-5" />
        <path d="M4.5 15a8 8 0 0 0 14.5 3.4M19.5 9A8 8 0 0 0 5 5.6" />
      </svg>
    ),
    items: [
      {
        id: 'routines',
        label: 'Routines',
        icon: (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <rect x="3.5" y="4" width="17" height="16" rx="2" />
            <path d="M7 9h10M7 13h10M7 17h6" />
          </svg>
        )
      }
    ]
  },
  {
    id: 'claude-code',
    label: 'Claude Code',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M8 9l-4 3 4 3M16 9l4 3-4 3M13 6l-2 12" />
      </svg>
    ),
    items: [
      {
        id: 'claude-sessions',
        label: 'History',
        icon: (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <circle cx="12" cy="12" r="9" />
            <path d="M12 7.5v5l3.5 2" />
          </svg>
        )
      },
      {
        id: 'claude-terminal',
        label: 'Terminal',
        icon: (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <rect x="3.5" y="4" width="17" height="16" rx="2" />
            <path d="M7 9l3 3-3 3M13 15h4" />
          </svg>
        )
      }
    ]
  }
]

function groupForView(view: View): string {
  return NAV_GROUPS.find((g) => g.items.some((i) => i.id === view))?.id ?? ''
}

function App(): React.JSX.Element {
  const [view, setView] = useState<View>('dashboard')
  const [expandedGroup, setExpandedGroup] = useState<string>(groupForView('dashboard'))
  const [collapsed, setCollapsed] = useState<boolean>(
    () => localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === 'true'
  )
  // Lifted so History's Resume button can hand off to Terminal without a race: Terminal only
  // calls startClaudeSession once its own xterm instance has mounted and reported its size.
  const [pendingClaudeAction, setPendingClaudeAction] = useState<{
    mode: 'resume'
    cwd: string
    sessionId: string
  } | null>(null)

  useEffect(() => {
    document.title = 'Personal Tracker'
  }, [])

  const selectView = (groupId: string, viewId: View): void => {
    setExpandedGroup(groupId)
    setView(viewId)
  }

  const selectStandalone = (viewId: View): void => {
    setExpandedGroup('')
    setView(viewId)
  }

  const resumeClaudeSession = (cwd: string, sessionId: string): void => {
    setPendingClaudeAction({ mode: 'resume', cwd, sessionId })
    selectView('claude-code', 'claude-terminal')
  }

  const toggleGroup = (groupId: string): void => {
    setExpandedGroup((prev) => (prev === groupId ? '' : groupId))
  }

  const toggleCollapsed = (): void => {
    setCollapsed((prev) => {
      const next = !prev
      localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(next))
      return next
    })
  }

  return (
    <div className="app-shell">
      <aside className={`sidebar${collapsed ? ' collapsed' : ''}`}>
        <div className="sidebar-brand">
          <span className="sidebar-brand-dot" />
          <span className="nav-label sidebar-brand-name">Personal Tracker</span>
        </div>
        <nav className="sidebar-nav">
          {NAV_STANDALONE.map((item) => (
            <button
              key={item.id}
              className={`sidebar-nav-item${view === item.id ? ' active' : ''}`}
              onClick={() => selectStandalone(item.id)}
              title={collapsed ? item.label : undefined}
            >
              <span className="sidebar-nav-icon">{item.icon}</span>
              <span className="nav-label">{item.label}</span>
            </button>
          ))}
          {NAV_GROUPS.map((group) => {
            const expanded = expandedGroup === group.id
            return (
              <div className="nav-group" key={group.id}>
                <button
                  className={`nav-group-header${expanded ? ' expanded' : ''}`}
                  onClick={() => toggleGroup(group.id)}
                  title={collapsed ? group.label : undefined}
                >
                  <span className="sidebar-nav-icon">{group.icon}</span>
                  <span className="nav-label nav-group-label">{group.label}</span>
                  <ChevronIcon />
                </button>
                {expanded && (
                  <div className="nav-group-items">
                    {group.items.map((item) => (
                      <button
                        key={item.id}
                        className={`sidebar-nav-item nested${view === item.id ? ' active' : ''}`}
                        onClick={() => selectView(group.id, item.id)}
                        title={collapsed ? item.label : undefined}
                      >
                        <span className="sidebar-nav-icon">{item.icon}</span>
                        <span className="nav-label">{item.label}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </nav>
        <div className="sidebar-footer">
          <span className="nav-label">Personal Tracker — v1</span>
          <button
            className="sidebar-collapse-btn"
            onClick={toggleCollapsed}
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            <CollapseIcon collapsed={collapsed} />
          </button>
        </div>
      </aside>
      <main className="content">
        {view === 'dashboard' && <Dashboard />}
        {view === 'timeline' && <Timeline />}
        {view === 'stats' && <Stats />}
        {view === 'settings' && <Settings />}
        {view === 'routines' && <Routines />}
        {view === 'claude-sessions' && <ClaudeSessions onResume={resumeClaudeSession} />}
        {view === 'claude-terminal' && (
          <ClaudeTerminal
            pendingAction={pendingClaudeAction}
            onPendingActionHandled={() => setPendingClaudeAction(null)}
            onOpenSettings={() => selectView('time-management', 'settings')}
          />
        )}
      </main>
    </div>
  )
}

export default App
