import { HEADER_LABELS } from '../constants'

export default function HeaderCard({ headerData, onUpdate, readOnly }) {
  return (
    <div className="data-card">
      <h3 className="card-title">
        <i className="fas fa-info-circle" /> ข้อมูลส่วน Header
      </h3>
      <div className="header-form">
        {Object.entries(headerData).map(([key, value]) => {
          const labelHtml = HEADER_LABELS[key] || key
          return (
            <div key={key} className="form-field">
              <label dangerouslySetInnerHTML={{ __html: labelHtml }} />
              <input
                type="text"
                value={value}
                readOnly={readOnly}
                onChange={e => !readOnly && onUpdate?.(key, e.target.value)}
              />
            </div>
          )
        })}
      </div>
    </div>
  )
}
