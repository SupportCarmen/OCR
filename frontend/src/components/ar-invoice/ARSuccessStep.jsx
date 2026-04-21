import { fmt } from '../../constants/arInvoice'

export default function ARSuccessStep({ t, headerData, lineItems, onReset }) {
  const SUMMARY_ROWS = [
    { label: t.subTotal, val: fmt(headerData.subTotal) },
    { label: t.discount, val: fmt(headerData.totalDiscount), color: 'var(--rose)' },
    { label: t.tax,      val: fmt(headerData.taxAmount) },
  ]

  return (
    <div style={{ padding: '2rem 0' }}>
      <div className="ar-success-wrap">
        <div className="ar-success-icon">
          <i className="fas fa-circle-check" />
        </div>
        <h2 style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text)', marginBottom: '0.75rem' }}>
          {t.successTitle}
        </h2>
        <p style={{ color: 'var(--text-3)', marginBottom: '1.5rem', lineHeight: 1.6 }}>
          {t.successDesc} <span className="ar-success-doc-no">{headerData.documentNumber}</span> {t.successDesc2}
        </p>

        <div className="ar-success-grid">
          <div>
            <div className="ar-success-field-label">{t.vendorName}</div>
            <div className="ar-success-field-val">{headerData.vendorName || '—'}</div>
          </div>
          <div>
            <div className="ar-success-field-label">{t.docDate}</div>
            <div className="ar-success-field-val">{headerData.documentDate || '—'}</div>
          </div>
          <div>
            <div className="ar-success-field-label">{t.itemCount}</div>
            <div className="ar-success-field-val" style={{ color: 'var(--primary)', fontWeight: 700 }}>
              {lineItems.length} {t.items}
            </div>
          </div>
          <div style={{ gridRow: 'span 2', background: 'white', border: '1px solid var(--border)', borderRadius: 8, padding: '1rem' }}>
            {SUMMARY_ROWS.map(({ label, val, color }) => (
              <div key={label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.83rem', marginBottom: '0.4rem' }}>
                <span style={{ color: 'var(--text-3)' }}>{label}:</span>
                <span style={{ fontFamily: 'IBM Plex Mono', fontWeight: 600, color: color || 'var(--text)' }}>{val}</span>
              </div>
            ))}
            <div style={{ height: 1, background: 'var(--border)', margin: '0.6rem 0' }} />
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontWeight: 800 }}>{t.grandTotal}</span>
              <span style={{ fontFamily: 'IBM Plex Mono', fontWeight: 800, color: 'var(--emerald)', fontSize: '1.05rem' }}>
                {fmt(headerData.grandTotal)}
              </span>
            </div>
          </div>
        </div>

        <button className="btn btn-primary" style={{ margin: '0 auto' }} onClick={onReset}>
          <i className="fas fa-rotate-right" /> {t.uploadNew}
        </button>
      </div>
    </div>
  )
}
