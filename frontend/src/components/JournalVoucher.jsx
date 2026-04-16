const fmt = n => n ? n.toLocaleString(undefined, { minimumFractionDigits: 2 }) : '0.00'

export default function JournalVoucher({ jvRows, headerData, filePrefix, fileSource, description, onFinish, onBack }) {
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
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: '0',
            background: 'var(--gray-50)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-md)',
            overflow: 'hidden',
            marginBottom: '0',
          }}>
            {/* Row 1: 4 cols */}
            {[
              { icon: 'fa-tag',        label: 'Prefix',      value: filePrefix,        mono: false, accent: true  },
              { icon: 'fa-hashtag',    label: 'Voucher No.', value: headerData.DocNo,  mono: true,  accent: false },
              { icon: 'fa-calendar',   label: 'Date',        value: headerData.DocDate,mono: false, accent: false },
              { icon: 'fa-database',   label: 'Source',      value: fileSource,        mono: false, accent: false, green: true },
            ].map(({ icon, label, value, mono, accent, green }, i) => (
              <div key={i} style={{
                padding: '1rem 1.25rem',
                borderRight: i < 3 ? '1px solid var(--border)' : 'none',
                borderBottom: '1px solid var(--border)',
                background: accent ? 'var(--blue-light)' : 'white',
              }}>
                <div style={{
                  display: 'flex', alignItems: 'center', gap: '0.4rem',
                  fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.06em',
                  textTransform: 'uppercase', color: accent ? 'var(--blue)' : 'var(--text-3)',
                  marginBottom: '0.35rem',
                }}>
                  <i className={`fas ${icon}`} style={{ fontSize: '0.65rem' }} />
                  {label}
                </div>
                <div style={{
                  fontSize: '0.95rem', fontWeight: 600,
                  fontFamily: mono ? "'DM Mono', monospace" : 'inherit',
                  color: accent ? 'var(--blue)' : green ? 'var(--teal)' : 'var(--text)',
                  letterSpacing: mono ? '-0.01em' : 'inherit',
                }}>
                  {value || '—'}
                </div>
              </div>
            ))}

            {/* Row 2: description full width */}
            <div style={{
              gridColumn: 'span 4',
              padding: '0.85rem 1.25rem',
              background: 'white',
              display: 'flex', alignItems: 'center', gap: '0.6rem',
            }}>
              <div style={{
                fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.06em',
                textTransform: 'uppercase', color: 'var(--text-3)',
                display: 'flex', alignItems: 'center', gap: '0.4rem',
                whiteSpace: 'nowrap',
              }}>
                <i className="fas fa-align-left" style={{ fontSize: '0.65rem' }} />
                Description
              </div>
              <div style={{ width: '1px', height: '1rem', background: 'var(--border)', flexShrink: 0 }} />
              <div style={{ fontSize: '0.9rem', color: 'var(--text-2)' }}>
                {description || '—'}
              </div>
            </div>
          </div>

          <div className="table-wrapper" style={{ marginTop: '1rem', border: '1px solid var(--gray-200)', borderRadius: 'var(--radius-sm)' }}>
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
            {onBack && (
              <button className="btn btn-outline" onClick={onBack} style={{ marginRight: 'auto' }}>
                <i className="fas fa-arrow-left" /> ย้อนกลับ
              </button>
            )}
            <button className="btn-cancel" onClick={() => window.print()}>
              <i className="fas fa-print" /> พิมพ์ Voucher
            </button>
            <button className="btn-submit" onClick={onFinish}>
              <i className="fas fa-arrow-right" /> ต่อไป (Next)
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
