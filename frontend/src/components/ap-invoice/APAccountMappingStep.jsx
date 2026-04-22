import CustomSearchSelect from '../common/CustomSearchSelect'

function fmt(code, desc) {
  if (code && desc) return `${code} — ${desc}`
  return code || desc || '—'
}

export default function APAccountMappingStep({
  t, lineItems, updateItem,
  systemVendor = {},
  masterAccounts = [], masterDepts = [],
  onBack, onGenerate, onAISuggest, suggestLoading = false,
}) {
  const taxProfile  = fmt(systemVendor.taxProfileCode1, systemVendor.taxProfileDesc1)
  const debitDept   = fmt(systemVendor.vat1DrDeptCode,  systemVendor.vat1DrDeptDesc)
  const debitAcc    = fmt(systemVendor.vat1DrAccCode,   systemVendor.vat1DrAccDesc)
  const vendorGroup = fmt(systemVendor.catCode,         systemVendor.catDesc)
  const creditDept  = fmt(systemVendor.crDeptCode,      systemVendor.crDeptDesc)
  const creditAcc   = fmt(systemVendor.vatCrAccCode,    systemVendor.vatCrAccDesc)

  return (
    <div style={{ maxWidth: 1080, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

      {/* Fixed GL accounts */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>
        <GLAccountCard
          title={t.debitTax}
          iconColor="blue"
          rows={[
            { label: t.taxProfile,  value: taxProfile, colSpan: true },
            { label: t.deptCode,    value: debitDept },
            { label: t.accountCode, value: debitAcc, highlight: 'var(--primary)' },
          ]}
        />
        <GLAccountCard
          title={t.creditAp}
          iconColor="green"
          rows={[
            { label: t.vendorGroup, value: vendorGroup, colSpan: true },
            { label: t.deptCode,    value: creditDept },
            { label: t.accountCode, value: creditAcc, highlight: 'var(--emerald)' },
          ]}
        />
      </div>

      {/* Expense line mapping */}
      <div className="data-card card-acct">
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
              disabled={suggestLoading}
            >
              <i className={suggestLoading ? 'fas fa-spinner fa-spin' : 'fas fa-wand-magic-sparkles'} />
              {suggestLoading ? ' กำลังแนะนำ...' : ` ${t.aiSuggest}`}
            </button>
          </div>
        </div>
        <div className="table-wrapper">
          <table className="ap-acct-table">
            <thead>
              <tr>
                <th style={{ width: '18%' }}>{t.category}</th>
                <th style={{ width: '28%' }}>{t.description}</th>
                <th style={{ width: '27%' }}>{t.deptCode}</th>
                <th style={{ width: '27%' }}>{t.accountCode}</th>
              </tr>
            </thead>
            <tbody>
              {lineItems.map((item, ri) => {
                const deptChoice = item._suggestDept
                  ? { code: item._suggestDept, name: masterDepts.find(d => d.code === item._suggestDept)?.name || '', source: 'ai' }
                  : null
                const accChoice = item._suggestAcc
                  ? { code: item._suggestAcc, name: masterAccounts.find(a => a.code === item._suggestAcc)?.name || '', source: 'ai' }
                  : null
                return (
                  <tr key={ri}>
                    <td><span className="ap-acct-table cat-badge">{item.category || '—'}</span></td>
                    <td style={{ fontSize: '0.83rem', color: 'var(--text-2)' }}>{item.description || '—'}</td>
                    <td style={{ padding: '0.35rem 0.5rem' }}>
                      <CustomSearchSelect
                        value={item.deptCode || ''}
                        options={masterDepts}
                        placeholder={t.searchDept}
                        topChoice={deptChoice}
                        onChange={val => updateItem(ri, 'deptCode', val)}
                      />
                    </td>
                    <td style={{ padding: '0.35rem 0.5rem' }}>
                      <CustomSearchSelect
                        value={item.accountCode || ''}
                        options={masterAccounts}
                        placeholder={t.searchAcc}
                        topChoice={accChoice}
                        onChange={val => updateItem(ri, 'accountCode', val)}
                      />
                    </td>
                  </tr>
                )
              })}
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
