export default function FormActions({ onCancel, onSubmit, submitLabel }) {
  return (
    <div className="form-actions" style={{ marginTop: '1.5rem', justifyContent: 'flex-end' }}>
      <button className="btn btn-secondary" onClick={onCancel}>
        <i className="fas fa-times" /> ยกเลิก
      </button>
      <button className="btn btn-primary" onClick={onSubmit}>
        <i className="fas fa-arrow-right" /> {submitLabel || 'Submit Data'}
      </button>
    </div>
  )
}
