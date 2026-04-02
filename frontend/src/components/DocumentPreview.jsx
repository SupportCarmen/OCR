export default function DocumentPreview({ previewUrl, previewType, fileName }) {
  const toggleFullScreenPreview = () => {
    if (previewUrl) {
      let url = previewUrl
      if (previewType === 'pdf') {
        url = url.split('#')[0]
      }
      window.open(url, '_blank')
    }
  }

  return (
    <div className="preview-column">
      <h2 className="section-title">
        <i className="fas fa-eye" /> Document Preview
      </h2>
      <div className="preview-frame">
        {previewType === 'image' && (
          <img src={previewUrl} className="preview-image" alt="Document Preview" style={{ display: 'block' }} />
        )}
        {previewType === 'pdf' && (
          <iframe
            src={previewUrl}
            title="PDF Preview"
            style={{ width: '100%', height: '600px', border: 'none', display: 'block' }}
          />
        )}
        {!previewType && (
          <div className="placeholder-text">
            <div className="placeholder-icon-wrap">
              <i className="fas fa-file-image" />
            </div>
            <p>
              ยังไม่มีไฟล์ Preview<br />
              <span style={{ fontSize: '.75rem', opacity: .5 }}>Preview จะแสดงที่นี่</span>
            </p>
          </div>
        )}
        {previewType && previewType !== 'image' && previewType !== 'pdf' && (
          <div className="placeholder-text">
            <div className="placeholder-icon-wrap">
              <i className="fas fa-file-alt" />
            </div>
            <p>
              {previewType} File Selected<br />
              <span style={{ fontSize: '.75rem', opacity: .5 }}>Preview ไม่รองรับประเภทนี้</span>
            </p>
          </div>
        )}
      </div>

      {fileName && (
        <div className="file-info-strip" style={{ display: 'flex' }}>
          <i className="fas fa-file" />
          <span className="file-name">{fileName}</span>
          {(previewType === 'image' || previewType === 'pdf') && (
            <button className="btn-zoom-action" onClick={toggleFullScreenPreview} title="เปิดในแท็บใหม่">
              <i className="fas fa-external-link-alt" /> เปิดรูปขยาย (New Tab)
            </button>
          )}
        </div>
      )}
    </div>
  )
}
