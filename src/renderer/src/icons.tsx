import type { CategoryKind } from './api'

const stroke = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const }

export function CategoryIcon({ kind, size = 15 }: { kind: CategoryKind; size?: number }): React.JSX.Element {
  const common = { viewBox: '0 0 24 24', width: size, height: size, ...stroke }
  switch (kind) {
    case 'work':
      return (
        <svg {...common}>
          <rect x="3" y="7" width="18" height="13" rx="2" />
          <path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
          <path d="M3 13h18" />
        </svg>
      )
    case 'break':
      return (
        <svg {...common}>
          <path d="M18 8h1a3 3 0 0 1 0 6h-1" />
          <path d="M2 8h16v6a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z" />
          <path d="M6 2v2M10 2v2M14 2v2" />
        </svg>
      )
    case 'job_hunt':
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="8.5" />
          <circle cx="12" cy="12" r="4.5" />
          <circle cx="12" cy="12" r="0.9" fill="currentColor" stroke="none" />
        </svg>
      )
    case 'family':
      return (
        <svg {...common}>
          <path d="M20.6 5a5 5 0 0 0-7.6.6L12 6.7l-1-1.1A5 5 0 1 0 3.4 12l1 1L12 20.5 19.6 13l1-1A5 5 0 0 0 20.6 5z" />
        </svg>
      )
    case 'leisure':
      return (
        <svg {...common}>
          <rect x="2.5" y="7.5" width="19" height="13" rx="2" />
          <path d="M2.5 7.5 5 3.5h3.5L6 7.5M10.5 7.5 13 3.5h3.5L14 7.5M18.5 7.5 20 5" />
        </svg>
      )
    default:
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="8.5" />
          <path d="M12 7.5v5l3 2" />
        </svg>
      )
  }
}

export function FlameIcon({ size = 20 }: { size?: number }): React.JSX.Element {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} {...stroke}>
      <path d="M12 2.5c1.2 3-2.8 4.3-2.8 8.3a2.8 2.8 0 0 0 5.6 0c0-.9-.4-1.7-.9-2 .9 2.7 1.9 3.7 1.9 5.7a4.8 4.8 0 0 1-9.6 0c0-4.6 3.5-6.7 4.8-12z" />
    </svg>
  )
}

export function SendIcon({ size = 20 }: { size?: number }): React.JSX.Element {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} {...stroke}>
      <path d="M21.5 2.5 10.8 13.2M21.5 2.5 14.9 21.5l-4.1-8.3-8.3-4.1z" />
    </svg>
  )
}

export function CheckRingIcon({ size = 20 }: { size?: number }): React.JSX.Element {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} {...stroke}>
      <circle cx="12" cy="12" r="9" />
      <path d="M8 12.2l2.7 2.7L16.5 9" />
    </svg>
  )
}
