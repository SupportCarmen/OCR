export default function FormActions({ onCancel, onSubmit }) {
  return (
    <div className="form-actions">
      <button className="btn-cancel" onClick={onCancel}>
        <i className="fas fa-times" /> Cancel
      </button>
      <button className="btn-submit" onClick={onSubmit}>
        <i className="fas fa-paper-plane" /> Submit Data
      </button>
    </div>
  )
}
