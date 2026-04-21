/**
 * Card — wraps the data-card + card-title pattern.
 * icon:  FontAwesome class string e.g. "fas fa-receipt"
 * title: string or ReactNode
 * right: ReactNode rendered on the right of the title bar
 * Children are rendered as-is inside the card (use card-body / card-body-flush as needed).
 */
export default function Card({ icon, title, right, children, className = '' }) {
  return (
    <div className={`data-card ${className}`}>
      {(icon || title || right) && (
        <div className="card-title">
          <div className="card-title-left">
            {icon && <i className={icon} />}
            {title}
          </div>
          {right && <div>{right}</div>}
        </div>
      )}
      {children}
    </div>
  )
}
