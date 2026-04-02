const fmt = n => n ? n.toLocaleString(undefined, { minimumFractionDigits: 2 }) : '0.00'

export default function JournalVoucher({ jvRows, headerData, onFinish }) {
  const totalDr = jvRows.reduce((s, r) => s + r.debit,  0)
  const totalCr = jvRows.reduce((s, r) => s + r.credit, 0)

  return (
    <div>
      <div className="section-header">
        <span className="status-badge-success">
          <i className="fas fa-check-circle" /> Step 5: Created Successfully
        </span>
      </div>

      <div className="data-card">
        <div className="card-title">
          <div className="card-title-left"><i className="fas fa-receipt" /> Journal Voucher</div>
          <div className="btn-group">
            <span className="status-badge info">Normal</span>
          </div>
        </div>
        <div className="card-body">
          <div className="jv-meta-grid">
            <div className="jv-meta-item">
              <div className="jv-meta-label">Prefix</div>
              <div className="jv-meta-value">TX</div>
            </div>
            <div className="jv-meta-item">
              <div className="jv-meta-label">Voucher No.</div>
              <div className="jv-meta-value" style={{ fontFamily: 'monospace' }}>{headerData.DocNo || '—'}</div>
            </div>
            <div className="jv-meta-item">
              <div className="jv-meta-label">Date</div>
              <div className="jv-meta-value">{headerData.DocDate || '—'}</div>
            </div>
            <div className="jv-meta-item">
              <div className="jv-meta-label">Source</div>
              <div className="jv-meta-value" style={{ color: 'var(--success)' }}>TaxR</div>
            </div>
            <div className="jv-meta-item" style={{ gridColumn: 'span 4' }}>
              <div className="jv-meta-label">Description</div>
              <div className="jv-meta-value">Post from OCR: {headerData.DocName || 'Credit Card Report'}</div>
            </div>
          </div>

          <div className="table-wrapper" style={{ marginTop: '1.5rem', border: '1px solid var(--gray-200)', borderRadius: 'var(--radius-sm)' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th width="48">#</th>
                  <th width="130">Dept.</th>
                  <th width="130">Acc Code</th>
                  <th>Description</th>
                  <th width="150" className="text-right">Debit</th>
                  <th width="150" className="text-right">Credit</th>
                </tr>
              </thead>
              <tbody>
                {jvRows.map((r, i) => (
                  <tr key={i}>
                    <td style={{ textAlign: 'center' }}>{i + 1}</td>
                    <td>{r.dept}</td>
                    <td>{r.acc}</td>
                    <td>{r.desc}</td>
                    <td className="text-right" style={{ fontFamily: 'monospace' }}>{r.debit ? fmt(r.debit) : ''}</td>
                    <td className="text-right" style={{ fontFamily: 'monospace' }}>{r.credit ? fmt(r.credit) : ''}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="jv-total-row">
                  <td colSpan={4} style={{ textAlign: 'right', fontWeight: 700 }}>ยอดรวม (TOTAL):</td>
                  <td className="text-right" style={{ fontWeight: 700, fontFamily: 'monospace' }}>{fmt(totalDr)}</td>
                  <td className="text-right" style={{ fontWeight: 700, fontFamily: 'monospace' }}>{fmt(totalCr)}</td>
                </tr>
              </tfoot>
            </table>
          </div>

          <div className="form-actions">
            <button className="btn-cancel" onClick={() => window.print()}>
              <i className="fas fa-print" /> พิมพ์ Voucher
            </button>
            <button className="btn-submit" onClick={onFinish}>
              <i className="fas fa-check" /> เสร็จสิ้น (Finish)
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
