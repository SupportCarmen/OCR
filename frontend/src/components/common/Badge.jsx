/**
 * Badge / pill component.
 * variant: 'info' | 'success' | 'gray' | 'blue' | 'warning'
 * pill: true (rounded, default) | false (tag — 4px radius)
 */
export default function Badge({ children, variant = 'info', pill = true, className = '' }) {
  return (
    <span className={`status-badge ${variant}${!pill ? ' tag' : ''} ${className}`.trim()}>
      {children}
    </span>
  )
}
