import { useState, useEffect } from 'react'

function toNum(v) {
  return parseFloat(String(v ?? '').replace(/,/g, '')) || 0
}

function buildRows(details, config) {
  const { mappings = {}, paymentAmount = {} } = config
  const rows = []

  const addRow = (cfg, amount, desc, defaultIsDebit) => {
    if (!amount) return
    const isDebit = defaultIsDebit
    if (isDebit) {
      rows.push({ dept: cfg.dept, acc: cfg.acc, desc, debit: amount, credit: 0 })
    } else {
      rows.push({ dept: cfg.dept, acc: cfg.acc, desc, debit: 0, credit: amount })
    }
  }

  details.forEach(detail => {
    const payType = detail.Transaction || 'UNKNOWN'
    const amtCfg  = paymentAmount[payType] || { dept: '', acc: '' }
    const commCfg = mappings.commission  || { dept: '', acc: '' }
    const taxCfg  = mappings.tax         || { dept: '', acc: '' }
    const netCfg  = mappings.net         || { dept: '', acc: '' }

    const payAmt    = toNum(detail.PayAmt)
    const commisAmt = toNum(detail.CommisAmt)
    const taxAmt    = toNum(detail.TaxAmt)
    const total     = toNum(detail.Total)

    addRow(amtCfg, payAmt, payType, true)
    addRow(commCfg, commisAmt, 'Commission', false)
    addRow(taxCfg, taxAmt, 'Tax Amount', false)
    addRow(netCfg, total, 'Net Payment', false)
  })
  return rows
}

const fmt = n => n ? n.toLocaleString(undefined, { minimumFractionDigits: 2 }) : ''

export default function AccountingReview({ details, onBack, onSubmit, onGoMapping }) {
  const [config, setConfig] = useState(null)

  const loadConfig = () => {
    try {
      const raw = localStorage.getItem('accountingConfig')
      let parsedConfig = raw ? JSON.parse(raw) : null;
      
      const rawAmt = localStorage.getItem('accountMappingAmount');
      if (rawAmt) {
        const parsedAmt = JSON.parse(rawAmt);
        if (!parsedConfig) parsedConfig = { paymentAmount: parsedAmt };
        else parsedConfig.paymentAmount = { ...parsedConfig.paymentAmount, ...parsedAmt };
      }
      
      if (parsedConfig) setConfig(parsedConfig);
    } catch (e) {}
  };

  useEffect(() => {
    loadConfig()

    // cc// ฟังเหตุการณ์การเปลี่ยนแปลง localStorage จาก tab อื่น (Auto-Sync)
    const handleStorageChange = (e) => {
      if (e.key === 'accountingConfig' || e.key === 'accountMappingAmount') {
        loadConfig()
      }
    }

    window.addEventListener('storage', handleStorageChange)
    return () => window.removeEventListener('storage', handleStorageChange)
  }, [])

  const rows = config ? buildRows(details, config) : []
  const hasMissing = rows.some(r => !r.dept || !r.acc)
  const totalDr = rows.reduce((s, r) => s + r.debit,  0)
  const totalCr = rows.reduce((s, r) => s + r.credit, 0)

  return (
    <div>
      <div className="section-header">
        <span><i className="fas fa-check-double" /> Step 4: ตรวจสอบการบันทึกบัญชี (Journal Concept)</span>
      </div>

      {hasMissing && (
        <div className="mapping-alert">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <i className="fas fa-exclamation-triangle" />
            <span>พบรายการที่ยังไม่ตั้งรหัสบัญชี กรุณาตรวจสอบแผนกและรหัสบัญชีให้ครบถ้วน</span>
          </div>
          <button className="btn-cancel" style={{ padding: '0.4rem 0.8rem', background: 'var(--danger)', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.85rem' }} onClick={onGoMapping}>
            แก้ไข Mapping
          </button>
        </div>
      )}

      {!config && (
        <div className="mapping-alert">
          <i className="fas fa-info-circle" />
          <span>ยังไม่มีการตั้งค่า Account Mapping</span>
          <button className="btn-cancel" style={{ padding: '0.4rem 0.8rem', background: 'var(--primary)', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.85rem' }} onClick={onGoMapping}>
            ไปตั้งค่า Mapping
          </button>
        </div>
      )}

      <div className="data-card">
        <div className="card-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div className="card-title-left">
            <i className="fas fa-file-invoice" /> รายละเอียดรายการรายวัน (Journal Details)
          </div>
          <div style={{ display: 'flex', gap: '0.75rem', fontSize: '0.8rem', marginRight: '2rem' }}>
            <span style={{ background: 'var(--blue-light)', color: 'var(--blue)', padding: '0.2rem 0.6rem', borderRadius: '4px', border: '1px solid var(--blue-mid)', fontWeight: 600 }}>
              Prefix: {config?.filePrefix || '-'}
            </span>
            <span style={{ background: 'var(--gray-100)', color: 'var(--text-2)', padding: '0.2rem 0.6rem', borderRadius: '4px', border: '1px solid var(--border)', fontWeight: 500 }}>
              Source: {config?.fileSource || '-'}
            </span>
          </div>
        </div>
        <div className="card-body-flush table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th width="150">Dept. Code</th>
                <th width="150">Acc Code</th>
                <th>Description</th>
                <th width="150" className="text-right">Debit</th>
                <th width="150" className="text-right">Credit</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr>
                  <td colSpan={5} style={{ textAlign: 'center', padding: '2rem', color: 'var(--gray-500)' }}>
                    ไม่มีข้อมูล — กรุณาตั้งค่า Account Mapping ก่อน
                  </td>
                </tr>
              )}
              {rows.map((r, i) => (
                <tr key={i}>
                  <td className={!r.dept ? 'missing-cell animate-pulse' : ''}>{r.dept || <span><i className="fas fa-exclamation-circle" /> MISSING</span>}</td>
                  <td className={!r.acc  ? 'missing-cell animate-pulse' : ''}>{r.acc  || <span><i className="fas fa-exclamation-circle" /> MISSING</span>}</td>
                  <td>{r.desc}</td>
                  <td className="text-right">{fmt(r.debit)}</td>
                  <td className="text-right">{fmt(r.credit)}</td>
                </tr>
              ))}
            </tbody>
            {rows.length > 0 && (
              <tfoot>
                <tr className="jv-total-row">
                  <td colSpan={3} style={{ textAlign: 'right', fontWeight: 700 }}>ยอดรวม (TOTAL):</td>
                  <td className="text-right" style={{ fontWeight: 700 }}>{fmt(totalDr)}</td>
                  <td className="text-right" style={{ fontWeight: 700 }}>{fmt(totalCr)}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>

        <div className="form-actions">
          <button className="btn-cancel" onClick={onBack}>
            <i className="fas fa-arrow-left" /> ย้อนกลับ
          </button>
          <button className="btn-cancel" style={{ marginRight: 'auto' }} onClick={onGoMapping}>
            <i className="fas fa-cog" /> ตั้งค่า Mapping
          </button>
          <button className="btn-cancel" onClick={loadConfig}>
            <i className="fas fa-sync-alt" /> Refresh
          </button>
          <button className="btn-submit" disabled={hasMissing || rows.length === 0} onClick={() => onSubmit(rows)}>
            <i className="fas fa-cloud-upload-alt" /> ยืนยันและส่งข้อมูล
          </button>
        </div>
      </div>
    </div>
  )
}
