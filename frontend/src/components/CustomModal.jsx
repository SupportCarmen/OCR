import React from 'react'

/**
 * CustomModal - A premium replacement for browser alert() and confirm()
 * @param {object} props
 * @param {boolean} props.show - Whether to show the modal
 * @param {string} props.title - Modal title
 * @param {string} props.message - Modal message/body text
 * @param {'success'|'warning'|'error'|'info'} props.type - Styling and icon type
 * @param {Function} props.onConfirm - Callback when user clicks primary button
 * @param {Function} [props.onCancel] - Optional callback for secondary button (makes it a confirm modal)
 * @param {string} [props.confirmText] - Label for primary button
 * @param {string} [props.cancelText] - Label for secondary button
 */
export default function CustomModal({
  show,
  title,
  message,
  type = 'info',
  onConfirm,
  onCancel,
  confirmText = 'ตกลง',
  cancelText = 'ยกเลิก',
}) {
  if (!show) return null

  const getIcon = () => {
    switch (type) {
      case 'success': return <i className="fas fa-check-circle" />
      case 'warning': return <i className="fas fa-exclamation-triangle" />
      case 'error': return <i className="fas fa-times-circle" />
      default: return <i className="fas fa-info-circle" />
    }
  }

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <div className="modal-header">
          <div className={`modal-icon-wrapper ${type}`}>
            {getIcon()}
          </div>
          <h3 className="modal-title">{title}</h3>
        </div>
        <div className="modal-body">
          {message}
        </div>
        <div className="modal-footer">
          {onCancel && (
            <button className="btn-cancel" onClick={onCancel}>
              {cancelText}
            </button>
          )}
          <button className={`btn-submit ${type === 'error' ? 'danger' : ''}`} style={type === 'error' ? { background: '#ef4444' } : {}} onClick={onConfirm}>
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  )
}
