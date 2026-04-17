import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { submitInputTax } from '../lib/api/carmen'

function toNum(v) {
  return parseFloat(String(v ?? '').replace(/,/g, '')) || 0
}

const fmt = n => n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export default function InputTaxReconciliation({ details, headerData, onBack, onFinish, showToast }) {
  const [config, setConfig] = useState(null)
  const [showConfirm, setShowConfirm] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState(null)

  useEffect(() => {
    try {
      const raw = localStorage.getItem('accountingConfig')
      if (raw) setConfig(JSON.parse(raw))
    } catch (e) {}
  }, [])

  const company = config?.company || {}

  const netAmount = details.reduce((s, d) => s + toNum(d.CommisAmt ?? d.commis_amt), 0)
  const taxAmount = details.reduce((s, d) => s + toNum(d.TaxAmt   ?? d.tax_amt), 0)
  const total     = netAmount + taxAmount
  const taxRate   = netAmount > 0 ? parseFloat(((taxAmount / netAmount) * 100).toFixed(2)) : 7.00
  const taxProfile = `VAT0${Math.round(taxRate)} : VAT ${Math.round(taxRate)}%`

  // Tax period: DD/MM/YYYY → MM/YYYY
  const taxPeriod = (() => {
    if (!headerData.DocDate) return ''
    const parts = headerData.DocDate.split('/')
    return parts.length === 3 ? `${parts[1]}/${parts[2]}` : ''
  })()

  const description = config?.description
    ? `${config.description}${headerData.DocDate ? ` - ${headerData.DocDate}` : ''}`
    : ''

  const hasData = netAmount > 0 || taxAmount > 0

  async function handleAddInputTax() {
    setSubmitting(true)
    setSubmitError(null)

    // taxPeriod: "MM/YYYY" → derive prefix, FrDate, ToDate
    const [mm, yyyy] = (taxPeriod || '/').split('/')
    const prefix   = `vat${yyyy}${mm}`
    const frDate   = `${yyyy}-${mm}-01`
    const lastDay  = new Date(Number(yyyy), Number(mm), 0).getDate()
    const toDate   = `${yyyy}-${mm}-${String(lastDay).padStart(2, '0')}`

    // DocDate: "DD/MM/YYYY" → "YYYY-MM-DDT00:00:00.000Z"
    let invhTInvDt = ''
    if (headerData.DocDate) {
      const [dd, mo, yy] = headerData.DocDate.split('/')
      invhTInvDt = `${yy}-${mo}-${dd}T00:00:00.000Z`
    }

    const rateInt = Math.round(taxRate)

    const payload = {
      Prefix:         prefix,
      Source:         'OCC',
      FrDate:         frDate,
      ToDate:         toDate,
      InvhTInvNo:     headerData.DocNo || '',
      InvhTInvDt:     invhTInvDt,
      InvhDesc:       description || '',
      VnName:         company.name || '',
      TaxProfileCode: `VAT0${rateInt}`,
      BfTaxAmt:       String(netAmount),
      TaxRate:        taxRate,
      TaxAmt:         taxAmount,
      TotalAmt:       String(total),
      TaxId:          company.taxId || '',
      BranchNo:       company.branch || '',
      Address:        company.address || '',
      UserModified:   'admin',
      TaxProfileDesc: `VAT ${rateInt}%`,
      VnCode:         '',
    }

    try {
      await submitInputTax(payload)
      setShowConfirm(false)
      showToast?.('เพิ่ม Input Tax Reconciliation เข้าระบบสำเร็จ', 'success')
      onFinish()
    } catch (err) {
      const msg = err.message || 'เกิดข้อผิดพลาด'
      setSubmitError(msg)
      showToast?.(`เพิ่ม Input Tax ล้มเหลว: ${msg}`, 'error')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div>
      <div className="section-header">
        <span><i className="fas fa-file-invoice" /> Step 6: Input Tax Reconciliation</span>
      </div>

      <div className="data-card">
        <div className="card-title">
          <div className="card-title-left">
            <i className="fas fa-balance-scale" /> Input Tax Reconciliation
          </div>
          <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center', marginRight: '0.5rem' }}>
            <span style={{
              background: 'var(--blue-light)', color: 'var(--blue)',
              border: '1px solid var(--blue-mid)', borderRadius: '4px',
              padding: '0.2rem 0.65rem', fontSize: '0.8rem', fontWeight: 600,
            }}>
              Source: OCC
            </span>
            {taxPeriod && (
              <span style={{
                background: 'var(--gray-100)', color: 'var(--text-2)',
                border: '1px solid var(--border)', borderRadius: '4px',
                padding: '0.2rem 0.65rem', fontSize: '0.8rem', fontWeight: 500,
              }}>
                <i className="fas fa-calendar-alt" style={{ marginRight: '0.35rem', color: 'var(--text-3)' }} />
                Tax Period: {taxPeriod}
              </span>
            )}
          </div>
        </div>

        <div className="card-body-flush">
          <div className="table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Source</th>
                  <th>Tax Invoice No.</th>
                  <th>Tax Invoice Date</th>
                  <th>Vendor Name</th>
                  <th>TAX ID.</th>
                  <th>Branch No.</th>
                  <th>Description</th>
                  <th>Tax Profile</th>
                  <th className="text-right">Tax Rate %</th>
                  <th className="text-right">Net Amount</th>
                  <th className="text-right">Tax</th>
                  <th className="text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {!hasData ? (
                  <tr>
                    <td colSpan={12} style={{ textAlign: 'center', padding: '2rem', color: 'var(--gray-500)' }}>
                      ไม่มีข้อมูล Commission / Tax ในรายการ
                    </td>
                  </tr>
                ) : (
                  <tr>
                    <td>
                      <span style={{
                        background: 'var(--teal-light)', color: 'var(--teal)',
                        border: '1px solid #99f6e4', borderRadius: '4px',
                        padding: '0.15rem 0.5rem', fontSize: '0.78rem', fontWeight: 700,
                      }}>
                        OCC
                      </span>
                    </td>
                    <td style={{ fontFamily: "'DM Mono', monospace", fontSize: '0.83rem' }}>
                      {headerData.DocNo || '—'}
                    </td>
                    <td>{headerData.DocDate || '—'}</td>
                    <td style={{ maxWidth: '160px', whiteSpace: 'normal' }}>{company.name || '—'}</td>
                    <td style={{ fontFamily: "'DM Mono', monospace", fontSize: '0.83rem' }}>
                      {company.taxId || '—'}
                    </td>
                    <td>{company.branch || '—'}</td>
                    <td style={{ maxWidth: '180px', whiteSpace: 'normal', color: 'var(--text-2)', fontSize: '0.83rem' }}>
                      {description || '—'}
                    </td>
                    <td>
                      <span style={{
                        background: 'var(--blue-light)', color: 'var(--blue)',
                        border: '1px solid var(--blue-mid)', borderRadius: '4px',
                        padding: '0.15rem 0.5rem', fontSize: '0.78rem', fontWeight: 600,
                        whiteSpace: 'nowrap',
                      }}>
                        {taxProfile}
                      </span>
                    </td>
                    <td className="text-right" style={{ fontFamily: "'DM Mono', monospace" }}>
                      {fmt(taxRate)}
                    </td>
                    <td className="text-right" style={{ fontFamily: "'DM Mono', monospace", fontWeight: 600 }}>
                      {fmt(netAmount)}
                    </td>
                    <td className="text-right" style={{ fontFamily: "'DM Mono', monospace", fontWeight: 600 }}>
                      {fmt(taxAmount)}
                    </td>
                    <td className="text-right" style={{ fontFamily: "'DM Mono', monospace", fontWeight: 700, color: 'var(--teal)' }}>
                      {fmt(total)}
                    </td>
                  </tr>
                )}
              </tbody>
              {hasData && (
                <tfoot>
                  <tr className="jv-total-row">
                    <td colSpan={9} style={{ textAlign: 'right', fontWeight: 700 }}>ยอดรวม (TOTAL):</td>
                    <td className="text-right" style={{ fontWeight: 700, fontFamily: "'DM Mono', monospace" }}>{fmt(netAmount)}</td>
                    <td className="text-right" style={{ fontWeight: 700, fontFamily: "'DM Mono', monospace" }}>{fmt(taxAmount)}</td>
                    <td className="text-right" style={{ fontWeight: 700, fontFamily: "'DM Mono', monospace" }}>{fmt(total)}</td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>

        <div className="form-actions">
          <button className="btn-cancel" onClick={onBack} style={{ marginRight: 'auto' }}>
            <i className="fas fa-arrow-left" /> ย้อนกลับ
          </button>
          <button className="btn-cancel" onClick={() => window.print()}>
            <i className="fas fa-print" /> พิมพ์
          </button>
          <button className="btn-cancel" onClick={() => {
            showToast?.('จบกระบวนการโดยไม่เพิ่ม Input Tax', 'info')
            onFinish()
          }}>
            <i className="fas fa-times" /> Discard
          </button>
          <button className="btn-submit" onClick={() => { setSubmitError(null); setShowConfirm(true) }} disabled={!hasData}>
            <i className="fas fa-plus-circle" /> Add Input Tax
          </button>
        </div>
      </div>

      {showConfirm && createPortal(
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999,
        }}>
          <div style={{
            background: '#fff', borderRadius: '12px', padding: '2rem 2.25rem',
            maxWidth: '440px', width: '90%', boxShadow: '0 12px 40px rgba(0,0,0,0.22)',
            textAlign: 'center',
          }}>
            <div style={{ fontSize: '2.2rem', marginBottom: '0.75rem', color: 'var(--teal)' }}>
              <i className="fas fa-file-invoice" />
            </div>
            <div style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '0.65rem' }}>
              เพิ่ม Input Tax Reconciliation
            </div>
            <p style={{ color: 'var(--text-2)', fontSize: '0.92rem', marginBottom: '1.5rem', lineHeight: 1.7 }}>
              รายการนี้จะถูกเพิ่มเข้าสู่ระบบ<br />
              <strong>Input Tax Reconciliation</strong> โดยอัตโนมัติ<br />
              ต้องการดำเนินการต่อใช่ไหม?
            </p>
            {submitError && (
              <div style={{
                background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: '6px',
                padding: '0.6rem 0.85rem', marginBottom: '1.25rem',
                color: '#b91c1c', fontSize: '0.85rem', textAlign: 'left',
              }}>
                <i className="fas fa-exclamation-circle" style={{ marginRight: '0.4rem' }} />
                {submitError}
              </div>
            )}
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
              <button
                className="btn-cancel"
                onClick={() => setShowConfirm(false)}
                disabled={submitting}
              >
                ยกเลิก
              </button>
              <button
                className="btn-submit"
                onClick={handleAddInputTax}
                disabled={submitting}
              >
                {submitting
                  ? <><i className="fas fa-spinner fa-spin" /> กำลังส่ง...</>
                  : <><i className="fas fa-check" /> ยืนยัน</>
                }
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}
