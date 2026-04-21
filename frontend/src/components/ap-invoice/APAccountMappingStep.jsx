export default function APAccountMappingStep({ t, lineItems, updateItem, onBack, onGenerate, onAISuggest }) {
  return (
    <div style={{ maxWidth: 1080, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

      {/* Fixed GL accounts */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>
        <GLAccountCard
          title={t.debitTax}
          iconColor="blue"
          rows={[
            { label: t.taxProfile, value: 'VAT 7%', colSpan: true },
            { label: t.deptCode,   value: '000 — Head Office' },
            { label: t.accountCode, value: '1154-00 — Input VAT', highlight: 'var(--primary)' },
          ]}
        />
        <GLAccountCard
          title={t.creditAp}
          iconColor="green"
          rows={[
            { label: t.vendorGroup, value: 'Trade Payable', colSpan: true },
            { label: t.deptCode,    value: '000 — Head Office' },
            { label: t.accountCode, value: '2111-00 — A/P Trade', highlight: 'var(--emerald)' },
          ]}
        />
      </div>

      {/* Expense line mapping */}
      <div className="data-card">
        <div className="card-title">
          <div className="card-title-left">
            <i className="fas fa-database" style={{ color: '#7c3aed' }} />
            {t.debitExpense}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-3)' }}>{t.expenseDesc}</span>
            <button
              className="btn btn-sm btn-primary"
              style={{ background: 'linear-gradient(135deg, #7c3aed, #6d28d9)' }}
              onClick={onAISuggest}
            >
              <i className="fas fa-wand-magic-sparkles" /> {t.aiSuggest}
            </button>
          </div>
        </div>
        <div className="table-wrapper">
          <table className="ap-acct-table">
            <thead>
              <tr>
                <th style={{ width: '20%' }}>{t.category}</th>
                <th style={{ width: '30%' }}>{t.description}</th>
                <th style={{ width: '25%' }}>{t.deptCode}</th>
                <th style={{ width: '25%' }}>{t.accountCode}</th>
              </tr>
            </thead>
            <tbody>
              {lineItems.map((item, ri) => (
                <tr key={ri}>
                  <td><span className="ap-acct-table cat-badge">{item.category || '—'}</span></td>
                  <td style={{ fontSize: '0.83rem', color: 'var(--text-2)' }}>{item.description || '—'}</td>
                  <td>
                    <div className="ap-search-input-wrap">
                      <i className="fas fa-magnifying-glass" />
                      <input
                        placeholder={t.searchDept}
                        value={item.deptCode || ''}
                        onChange={e => updateItem(ri, 'deptCode', e.target.value)}
                      />
                    </div>
                  </td>
                  <td>
                    <div className="ap-search-input-wrap">
                      <i className="fas fa-magnifying-glass" />
                      <input
                        placeholder={t.searchAcc}
                        value={item.accountCode || ''}
                        onChange={e => updateItem(ri, 'accountCode', e.target.value)}
                      />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="ap-step-nav">
        <button className="btn btn-outline" onClick={onBack}>
          <i className="fas fa-arrow-left" /> {t.backReview}
        </button>
        <button className="btn btn-success" onClick={onGenerate}>
          <i className="fas fa-floppy-disk" /> {t.generateInv}
        </button>
      </div>
    </div>
  )
}

function GLAccountCard({ title, iconColor, rows }) {
  const [firstRow, ...pairRows] = rows
  return (
    <div className="ap-account-card">
      <div className="ap-account-card-header">
        <div className={`ap-account-icon ${iconColor}`}><i className="fas fa-database" /></div>
        <div style={{ fontWeight: 700, fontSize: '0.87rem', color: 'var(--text)' }}>{title}</div>
      </div>
      <div className="ap-account-body">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '0.6rem' }}>
          {firstRow && (
            <div>
              <div className="field-label" style={{ marginBottom: '0.3rem' }}>{firstRow.label}</div>
              <div className="ap-static-field">{firstRow.value}</div>
            </div>
          )}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem' }}>
            {pairRows.map(({ label, value, highlight }) => (
              <div key={label}>
                <div className="field-label" style={{ marginBottom: '0.3rem' }}>{label}</div>
                <div className="ap-static-field" style={highlight ? { color: highlight, fontWeight: 700 } : undefined}>
                  {value}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
