import { useState, useEffect } from 'react'
import { fetchAccountCodes } from '../../lib/api/carmen'

const fmt = n => n ? n.toLocaleString(undefined, { minimumFractionDigits: 2 }) : '0.00'

let _accCache = null

export default function JournalVoucher({ jvRows, headerData, filePrefix, fileSource, description, carmenJvId, onFinish, onBack }) {
  const totalDr = jvRows.reduce((s, r) => s + r.debit,  0)
  const totalCr = jvRows.reduce((s, r) => s + r.credit, 0)

  const [accNameMap, setAccNameMap] = useState(_accCache || {})

  useEffect(() => {
    if (_accCache) return
    fetchAccountCodes()
      .then(list => {
        const map = {}
        list.forEach(a => { if (a.AccCode) map[a.AccCode] = a.Description || '' })
        _accCache = map
        setAccNameMap(map)
      })
      .catch(() => {})
  }, [])

  const getAccName = (acc) => accNameMap[acc] || ''

  return (
    <>
      <div className="section-header">
        <span><i className="fas fa-file-alt" /> Step 5: Journal Voucher</span>
      </div>

      <div className="data-card">
        <div className="card-title">
          <div className="card-title-left">
            <i className="fas fa-receipt" /> Journal Voucher
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <span style={{ background: 'var(--gray-200)', color: 'var(--text-3)', padding: '0.2rem 0.75rem', borderRadius: '20px', fontSize: '0.78rem', fontWeight: 600 }}>OCC</span>
            <span style={{ background: '#3b82f6', color: 'white', padding: '0.2rem 0.75rem', borderRadius: '20px', fontSize: '0.78rem', fontWeight: 600 }}>Normal</span>
          </div>
        </div>

        {/* Inputs: Prefix / Voucher No. / Date / Description */}
        <div className="card-body" style={{ borderBottom: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            {[
              { label: 'Prefix',      value: filePrefix || 'IC',                  flex: '0 0 100px' },
              { label: 'Voucher No.', value: carmenJvId || '—',                   flex: '0 0 180px' },
              { label: 'Date',        value: headerData.DocDate || '—',           flex: '0 0 160px' },
              { label: 'Description', value: description || '—',                  flex: '1' },
            ].map(({ label, value, flex }) => (
              <div key={label} style={{ flex, position: 'relative', border: '1px solid var(--border)', borderRadius: '4px', padding: '0.45rem 0.75rem', background: '#fff' }}>
                <span style={{ position: 'absolute', top: '-8px', left: '8px', background: '#fff', padding: '0 4px', fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.04em', color: 'var(--text-4)', textTransform: 'uppercase' }}>{label}</span>
                <div style={{ fontSize: '0.88rem', color: 'var(--text-2)' }}>{value}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Table */}
        <div className="card-body-flush">
          <div className="table-wrapper">
            <table className="data-table">
              <thead>
                <tr style={{ backgroundColor: '#2b4d81', color: '#fff' }}>
                  {['Dept.', 'Account #', 'Account Name', 'Comment', 'Currency', 'Rate', 'Dr. Amount', 'Cr. Amount', 'Dr. Base', 'Cr. Base'].map((h, i) => (
                    <th key={h} style={{ color: '#fff', background: '#2b4d81', textAlign: i >= 6 ? 'right' : i === 2 || i === 3 ? 'left' : 'center', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {jvRows.map((r, i) => (
                  <tr key={i}>
                    <td style={{ textAlign: 'center' }}>{r.dept}</td>
                    <td style={{ textAlign: 'center', fontFamily: "'DM Mono', monospace", fontSize: '0.83rem' }}>{r.acc}</td>
                    <td>{getAccName(r.acc)}</td>
                    <td>{r.desc}</td>
                    <td style={{ textAlign: 'center' }}>THB</td>
                    <td className="text-right text-mono">1.00000000</td>
                    <td className="text-right text-mono">{fmt(r.debit)}</td>
                    <td className="text-right text-mono">{fmt(r.credit)}</td>
                    <td className="text-right text-mono">{fmt(r.debit)}</td>
                    <td className="text-right text-mono">{fmt(r.credit)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="jv-total-row">
                  <td colSpan={6} style={{ textAlign: 'right', fontWeight: 700 }}>ยอดรวม (TOTAL):</td>
                  <td className="text-right">{fmt(totalDr)}</td>
                  <td className="text-right">{fmt(totalCr)}</td>
                  <td className="text-right">{fmt(totalDr)}</td>
                  <td className="text-right">{fmt(totalCr)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        <div className="form-actions">
          {onBack && (
            <button className="btn-cancel" onClick={onBack} style={{ marginRight: 'auto' }}>
              <i className="fas fa-arrow-left" /> ย้อนกลับ
            </button>
          )}
          <button
            className="btn-cancel"
            onClick={() => {
              if (carmenJvId) {
                window.open(`https://dev.carmen4.com/#/glJv/${carmenJvId}/show`, '_blank')
              } else {
                alert('ไม่สามารถเปิดได้: ไม่พบ Voucher ID (InternalMessage) จาก Carmen')
              }
            }}
            style={{
              background: carmenJvId ? 'var(--primary-light)' : 'var(--gray-100)',
              color:      carmenJvId ? 'var(--primary)'       : 'var(--text-4)',
              border:     `1px solid ${carmenJvId ? 'var(--primary)' : 'var(--border)'}`,
              cursor:     carmenJvId ? 'pointer'           : 'not-allowed',
            }}
            title={carmenJvId ? `เปิดดู JV #${carmenJvId}` : 'รอการสร้าง JV ID'}
          >
            <i className="fas fa-external-link-alt" /> เปิดดูหน้า JV
          </button>
          <div className="form-actions-sep" />
          <button className="btn-submit" onClick={onFinish}>
            <i className="fas fa-arrow-right" /> ต่อไป (Next)
          </button>
        </div>
      </div>
    </>
  )
}
