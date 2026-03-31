export default function DocumentPreview({ previewUrl, previewType }) {
  return (
    <div className="preview-column">
      <h2 className="section-title">
        <i className="fas fa-image" /> Preview
      </h2>
      <div className="preview-frame">
        {previewType === 'image' && (
          <img src={previewUrl} className="preview-image" alt="Document Preview" />
        )}
        {previewType === 'pdf' && (
          <iframe
            src={previewUrl}
            title="PDF Preview"
            style={{ width: '100%', height: '800px', border: 'none' }}
          />
        )}
        {!previewType && (
          <div className="placeholder-text">
            <i className="fas fa-file-image placeholder-icon" />
            <p>ยังไม่มีไฟล์ Preview</p>
          </div>
        )}
        {previewType && previewType !== 'image' && previewType !== 'pdf' && (
          <div className="placeholder-text">
            <i className="fas fa-file-alt placeholder-icon" />
            <p>
              {previewType} File Selected<br />
              <span style={{ fontSize: '0.8em', color: 'gray' }}>
                (Preview not available for this type)
              </span>
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
