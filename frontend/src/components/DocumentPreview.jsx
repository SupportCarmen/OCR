import { useState, useRef, useEffect, useCallback } from 'react'

export default function DocumentPreview({ previewUrl, previewType, fileName }) {
  const [zoom, setZoom] = useState(1)
  const [rotate, setRotate] = useState(0)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
  const frameRef = useRef(null)

  // Reset on new file
  useEffect(() => {
    setZoom(1)
    setRotate(0)
    setPan({ x: 0, y: 0 })
  }, [previewUrl])

  // Scroll-to-zoom (image only)
  const handleWheel = useCallback((e) => {
    e.preventDefault()
    const delta = e.deltaY > 0 ? -0.15 : 0.15
    setZoom(prev => Math.min(Math.max(prev + delta, 0.25), 5))
  }, [])

  useEffect(() => {
    const el = frameRef.current
    if (!el || previewType !== 'image') return
    el.addEventListener('wheel', handleWheel, { passive: false })
    return () => el.removeEventListener('wheel', handleWheel)
  }, [handleWheel, previewType])

  // Drag-to-pan (image only)
  const onMouseDown = (e) => {
    if (zoom <= 1) return
    e.preventDefault()
    setIsDragging(true)
    setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y })
  }
  const onMouseMove = (e) => {
    if (!isDragging) return
    setPan({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y })
  }
  const onMouseUp = () => setIsDragging(false)

  const zoomIn    = () => setZoom(p => Math.min(p + 0.25, 5))
  const zoomOut   = () => setZoom(p => Math.max(p - 0.25, 0.25))
  const resetView = () => { setZoom(1); setPan({ x: 0, y: 0 }) }
  const rotateCW  = () => setRotate(r => (r + 90) % 360)

  const openNewTab = () => {
    if (!previewUrl) return
    window.open(previewType === 'pdf' ? previewUrl.split('#')[0] : previewUrl, '_blank')
  }

  const isImage = previewType === 'image'
  const isPdf   = previewType === 'pdf'
  const hasToolbar = isImage || isPdf
  const cursor  = isImage ? (isDragging ? 'grabbing' : zoom > 1 ? 'grab' : 'zoom-in') : 'default'

  return (
    <div className="preview-column">
      <h2 className="section-title">
        <i className="fas fa-eye" /> Document Preview
      </h2>

      {/* Toolbar */}
      {hasToolbar && (
        <div className="preview-toolbar">
          {isImage && (
            <>
              <div className="prev-tool-group">
                <button className="prev-tool-btn" onClick={zoomOut} disabled={zoom <= 0.25} title="ย่อ (scroll ลง)">
                  <i className="fas fa-search-minus" />
                </button>
                <span className="prev-zoom-pct">{Math.round(zoom * 100)}%</span>
                <button className="prev-tool-btn" onClick={zoomIn} disabled={zoom >= 5} title="ขยาย (scroll ขึ้น)">
                  <i className="fas fa-search-plus" />
                </button>
              </div>
              <div className="prev-tool-sep" />
              <button className="prev-tool-btn" onClick={resetView} title="Reset มุมมอง">
                <i className="fas fa-compress-arrows-alt" />
              </button>
              <button className="prev-tool-btn" onClick={rotateCW} title="หมุน 90°">
                <i className="fas fa-redo" />
              </button>
              <div className="prev-tool-sep" />
            </>
          )}

          {isPdf && (
            <>
              <span className="prev-pdf-badge"><i className="fas fa-file-pdf" /> PDF</span>
              <span className="prev-tool-hint">เลื่อนดูและซูมได้ในเอกสาร</span>
              <div className="prev-tool-sep" />
            </>
          )}

          <button
            className="prev-tool-btn"
            onClick={openNewTab}
            title="เปิดในแท็บใหม่"
          >
            <i className="fas fa-external-link-alt" />
          </button>
        </div>
      )}

      {/* Preview frame */}
      <div
        ref={frameRef}
        className={`preview-frame${hasToolbar ? ' preview-frame--docked' : ''}`}
        onMouseDown={isImage ? onMouseDown : undefined}
        onMouseMove={isImage ? onMouseMove : undefined}
        onMouseUp={isImage ? onMouseUp : undefined}
        onMouseLeave={isImage ? onMouseUp : undefined}
        style={{ cursor }}
      >
        {isImage && (
          <div className="prev-img-wrap">
            <img
              src={previewUrl}
              alt="Document Preview"
              className="prev-img"
              draggable={false}
              style={{
                transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom}) rotate(${rotate}deg)`,
                transition: isDragging ? 'none' : 'transform 0.15s ease',
              }}
            />
          </div>
        )}

        {isPdf && (
          <iframe
            src={previewUrl}
            title="PDF Preview"
            style={{ width: '100%', height: '500px', border: 'none', display: 'block', flexShrink: 0 }}
          />
        )}

        {!previewType && (
          <div className="placeholder-text">
            <div className="placeholder-icon-wrap"><i className="fas fa-file-image" /></div>
            <p>ยังไม่มีไฟล์ Preview<br /><span style={{ fontSize: '.75rem', opacity: .5 }}>Preview จะแสดงที่นี่</span></p>
          </div>
        )}

        {previewType && !isImage && !isPdf && (
          <div className="placeholder-text">
            <div className="placeholder-icon-wrap"><i className="fas fa-file-alt" /></div>
            <p>{previewType} File<br /><span style={{ fontSize: '.75rem', opacity: .5 }}>Preview ไม่รองรับประเภทนี้</span></p>
          </div>
        )}
      </div>

      {/* File strip */}
      {fileName && (
        <div className="file-info-strip" style={{ display: 'flex' }}>
          <i className={`fas fa-file${isPdf ? '-pdf' : ''}`} />
          <span className="file-name">{fileName}</span>
          {hasToolbar && (
            <button className="btn-zoom-action" onClick={openNewTab} title="เปิดในแท็บใหม่">
              <i className="fas fa-external-link-alt" /> เปิดในแท็บใหม่
            </button>
          )}
        </div>
      )}

    </div>
  )
}
