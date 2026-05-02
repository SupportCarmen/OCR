import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'

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
  const confirmRef = useRef(null)
  const cancelRef  = useRef(null)

  useEffect(() => {
    if (!show) return
    const timer = setTimeout(() => confirmRef.current?.focus(), 50)
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') { onCancel ? onCancel() : onConfirm?.(); return }
      if (e.key !== 'Tab') return
      const focusable = [cancelRef.current, confirmRef.current].filter(Boolean)
      if (!focusable.length) return
      if (e.shiftKey) {
        if (document.activeElement === focusable[0]) { e.preventDefault(); focusable[focusable.length - 1].focus() }
      } else {
        if (document.activeElement === focusable[focusable.length - 1]) { e.preventDefault(); focusable[0].focus() }
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => { clearTimeout(timer); document.removeEventListener('keydown', handleKeyDown) }
  }, [show, onCancel, onConfirm])

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
    <div
      className="modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
      aria-describedby="modal-desc"
    >
      <div className="modal-box">
        <div className={`modal-icon ${type}`}>{getIcon()}</div>
        <h3 className="modal-title" id="modal-title">{title}</h3>
        <p className="modal-msg" id="modal-desc">{message}</p>
        <div className="modal-actions">
          {onCancel && (
            <button ref={cancelRef} className="btn btn-outline" style={cancelStyle} onClick={onCancel}>
              {cancelText}
            </button>
          )}
          <button
            ref={confirmRef}
            className={`btn ${type === 'error' ? 'btn-danger' : 'btn-primary'}`}
            style={
              type === 'error'   ? { background: 'var(--rose)',  color: 'white' } :
              type === 'warning' ? { background: 'var(--amber)', color: 'white' } : {}
            }
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
