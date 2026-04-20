export default function ActionBar({ loading, status, onProcess }) {
  return (
    <div className="action-bar">
      <button id="btnProcess" onClick={onProcess} disabled={loading}>
        <i className="fas fa-robot" /> อ่านข้อมูล (AI OCR)
      </button>
      {loading && <div className="loader" />}
      {status && <span className="status-text">{status}</span>}
    </div>
  )
}
