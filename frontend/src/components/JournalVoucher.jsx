import { useState, useEffect } from 'react'
import { fetchAccountCodes } from '../lib/api/carmen'

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
      {/* Header Row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold', margin: 0, color: '#1e293b' }}>Journal Voucher</h2>
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
            <span style={{ background: 'var(--gray-200)', color: 'var(--text-3)', padding: '0.35rem 1rem', borderRadius: '20px', fontSize: '0.8rem', fontWeight: 600 }}>OCC</span>
            <span style={{ background: '#3b82f6', color: 'white', padding: '0.35rem 1rem', borderRadius: '20px', fontSize: '0.8rem', fontWeight: 600 }}>Normal</span>
        </div>
      </div>

      {/* Inputs block */}
      <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem' }}>
        <div style={{ flex: '0 0 100px', border: '1px solid var(--border-hi)', borderRadius: '4px', position: 'relative', padding: '0.5rem 0.75rem', background: '#fff' }}>
            <span style={{ position: 'absolute', top: '-8px', left: '8px', background: '#fff', padding: '0 4px', fontSize: '0.7rem', color: 'var(--text-4)' }}>Prefix</span>
            <div style={{ fontSize: '0.9rem', color: 'var(--text-2)' }}>{filePrefix || 'IC'}</div>
        </div>
        <div style={{ flex: '0 0 200px', border: '1px solid var(--border)', borderRadius: '4px', position: 'relative', padding: '0.5rem 0.75rem', background: '#fff' }}>
            <span style={{ position: 'absolute', top: '-8px', left: '8px', background: '#fff', padding: '0 4px', fontSize: '0.7rem', color: 'var(--text-4)' }}>Voucher No.</span>
            <div style={{ fontSize: '0.9rem', color: 'var(--text-2)' }}>{carmenJvId || '26030007'}</div>
        </div>
        <div style={{ flex: '0 0 200px', border: '1px solid var(--border)', borderRadius: '4px', position: 'relative', padding: '0.5rem 0.75rem', background: '#fff' }}>
            <span style={{ position: 'absolute', top: '-8px', left: '8px', background: '#fff', padding: '0 4px', fontSize: '0.7rem', color: 'var(--text-4)' }}>Date</span>
            <div style={{ fontSize: '0.9rem', color: 'var(--text-2)' }}>{headerData.DocDate || '30/03/2026'}</div>
        </div>
        <div style={{ flex: 1, border: '1px solid var(--border)', borderRadius: '4px', position: 'relative', padding: '0.5rem 0.75rem', background: '#fff' }}>
            <span style={{ position: 'absolute', top: '-8px', left: '8px', background: '#fff', padding: '0 4px', fontSize: '0.7rem', color: 'var(--text-4)' }}>Description</span>
            <div style={{ fontSize: '0.9rem', color: 'var(--text-2)' }}>{description || 'BBLTEST - 30/03/2026'}</div>
        </div>
      </div>

      {/* Table block */}
      <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: '4px', overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'center', fontSize: '0.8rem' }}>
                <thead>
                    <tr style={{ backgroundColor: '#2b4d81', color: '#fff' }}>
                        <th style={{ padding: '0.75rem 0.5rem', fontWeight: 'bold' }}>Dept.</th>
                        <th style={{ padding: '0.75rem 0.5rem', fontWeight: 'bold', whiteSpace: 'nowrap' }}>Account<br/>#</th>
                        <th style={{ padding: '0.75rem 0.5rem', fontWeight: 'bold', textAlign: 'left', whiteSpace: 'nowrap' }}>Account Name</th>
                        <th style={{ padding: '0.75rem 0.5rem', fontWeight: 'bold', textAlign: 'left' }}>Comment</th>
                        <th style={{ padding: '0.75rem 0.5rem', fontWeight: 'bold' }}>Currency</th>
                        <th style={{ padding: '0.75rem 0.5rem', fontWeight: 'bold', textAlign: 'right' }}>Rate</th>
                        <th style={{ padding: '0.75rem 0.5rem', fontWeight: 'bold', textAlign: 'right', whiteSpace: 'nowrap' }}>Dr.<br/>Amount</th>
                        <th style={{ padding: '0.75rem 0.5rem', fontWeight: 'bold', textAlign: 'right', whiteSpace: 'nowrap' }}>Cr.<br/>Amount</th>
                        <th style={{ padding: '0.75rem 0.5rem', fontWeight: 'bold', textAlign: 'right', whiteSpace: 'nowrap' }}>Dr. Base</th>
                        <th style={{ padding: '0.75rem 0.5rem', fontWeight: 'bold', textAlign: 'right', whiteSpace: 'nowrap' }}>Cr. Base</th>
                    </tr>
                </thead>
                <tbody>
                    {jvRows.map((r, i) => (
                        <tr key={i} style={{ borderBottom: i === jvRows.length - 1 ? 'none' : '1px solid var(--gray-100)', backgroundColor: i % 2 === 1 ? '#f9fafb' : '#fff' }}>
                            <td style={{ padding: '0.6rem 0.5rem', color: '#444' }}>{r.dept}</td>
                            <td style={{ padding: '0.6rem 0.5rem', color: '#444' }}>{r.acc}</td>
                            <td style={{ padding: '0.6rem 0.5rem', color: '#444', textAlign: 'left' }}>{getAccName(r.acc)}</td>
                            <td style={{ padding: '0.6rem 0.5rem', color: '#444', textAlign: 'left' }}>{r.desc}</td>
                            <td style={{ padding: '0.6rem 0.5rem', color: '#444' }}>THB</td>
                            <td style={{ padding: '0.6rem 0.5rem', color: '#444', textAlign: 'right' }}>1.00000000</td>
                            <td style={{ padding: '0.6rem 0.5rem', color: '#444', textAlign: 'right' }}>{fmt(r.debit)}</td>
                            <td style={{ padding: '0.6rem 0.5rem', color: '#444', textAlign: 'right' }}>{fmt(r.credit)}</td>
                            <td style={{ padding: '0.6rem 0.5rem', color: '#444', textAlign: 'right' }}>{fmt(r.debit)}</td>
                            <td style={{ padding: '0.6rem 0.5rem', color: '#444', textAlign: 'right' }}>{fmt(r.credit)}</td>
                        </tr>
                    ))}
                </tbody>
                <tfoot>
                    <tr style={{ borderTop: '1px solid var(--border)' }}>
                        <td colSpan={6}></td>
                        <td style={{ padding: '0.8rem 0.5rem', fontWeight: 'bold', color: '#2b4d81', textAlign: 'right' }}>{fmt(totalDr)}</td>
                        <td style={{ padding: '0.8rem 0.5rem', fontWeight: 'bold', color: '#2b4d81', textAlign: 'right' }}>{fmt(totalCr)}</td>
                        <td style={{ padding: '0.8rem 0.5rem', fontWeight: 'bold', color: '#2b4d81', textAlign: 'right' }}>{fmt(totalDr)}</td>
                        <td style={{ padding: '0.8rem 0.5rem', fontWeight: 'bold', color: '#2b4d81', textAlign: 'right' }}>{fmt(totalCr)}</td>
                    </tr>
                </tfoot>
            </table>
        </div>
      </div>

      <div className="form-actions" style={{ marginTop: '1.5rem', backgroundColor: 'transparent', borderTop: 'none', padding: '0' }}>
        {onBack && (
          <button className="btn-cancel" onClick={onBack} style={{ marginRight: 'auto' }}>
            <i className="fas fa-arrow-left" /> ย้อนกลับ
          </button>
        )}
        <button
          className="btn-cancel"
          onClick={() => {
            if (carmenJvId) {
                window.open(`https://dev.carmen4.com/#/glJv/${carmenJvId}/show`, '_blank');
            } else {
                alert('ไม่สามารถเปิดได้: ไม่พบ Voucher ID (InternalMessage) จาก Carmen');
            }
          }}
          style={{
            background: carmenJvId ? 'var(--blue-light)' : 'var(--gray-100)',
            color: carmenJvId ? 'var(--blue)' : 'var(--text-4)',
            border: `1px solid ${carmenJvId ? 'var(--blue)' : 'var(--border)'}`,
            padding: '0.5rem 1rem',
            borderRadius: '4px',
            cursor: carmenJvId ? 'pointer' : 'not-allowed'
          }}
          title={carmenJvId ? `เปิดดู JV #${carmenJvId}` : 'รอการสร้าง JV ID'}
        >
          <i className="fas fa-external-link-alt" /> เปิดดูหน้า JV
        </button>
        <div className="form-actions-sep" />
        <button className="btn-submit" onClick={onFinish} style={{ background: '#3b82f6', color: 'white', border: 'none', padding: '0.5rem 1rem', borderRadius: '4px', cursor: 'pointer' }}>
          <i className="fas fa-arrow-right" /> ต่อไป (Next)
        </button>
      </div>
    </>
  )
}
