import React from 'react'
import { createPortal } from 'react-dom'

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
  cancelStyle,
}) {
  if (!show) return null

  const getIcon = () => {
    switch (type) {
      case 'success': return <i className="fas fa-circle-check" />
      case 'warning': return <i className="fas fa-triangle-exclamation" />
      case 'error':   return <i className="fas fa-circle-xmark" />
      default:        return <i className="fas fa-circle-info" />
    }
  }

  if (type === 'loading') {
    return createPortal(
      <div className="ocr-loading-overlay">
        <div className="ocr-loading-box">
          <div className="ocr-loading-spinner" />
          <div className="ocr-loading-title">{title}</div>
          {message && <div className="ocr-loading-status">{message}</div>}
        </div>
      </div>,
      document.body
    )
  }

  return createPortal(
    <div className="modal-overlay">
      <div className="modal-box">
        <div className={`modal-icon ${type}`}>
          {getIcon()}
        </div>
        <h3 className="modal-title">{title}</h3>
        <p className="modal-msg">{message}</p>

        <div className="modal-actions">
          {onCancel && (
            <button className="btn btn-outline" style={cancelStyle} onClick={onCancel}>
              {cancelText}
            </button>
          )}
          <button
            className={`btn ${type === 'error' ? 'btn-danger' : type === 'warning' ? 'btn-primary' : 'btn-primary'}`}
            style={type === 'error' ? { background: 'var(--rose)', color: 'white' } : type === 'warning' ? { background: 'var(--amber)', color: 'white' } : {}}
            onClick={onConfirm}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}
