// cc// FormActions — เพิ่มปุ่มย้อนกลับ (Back)
export default function FormActions({ onCancel, onBack, onSubmit, submitLabel, showBack }) {
  return (
    <div className="form-actions" style={{ marginTop: '1.5rem', justifyContent: 'flex-end' }}>
      {showBack && (
        <button className="btn btn-outline" onClick={onBack} style={{ marginRight: 'auto' }}>
          <i className="fas fa-arrow-left" /> ย้อนกลับ
        </button>
      )}
      <button className="btn btn-secondary" onClick={onCancel}>
        <i className="fas fa-times" /> ยกเลิก
      </button>
      <button className="btn btn-primary" onClick={onSubmit}>
        <i className="fas fa-arrow-right" /> {submitLabel || 'Submit Data'}
      </button>
    </div>
  )
}
