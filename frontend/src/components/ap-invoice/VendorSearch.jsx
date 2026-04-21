import Badge from '../common/Badge'

export default function VendorSearch({ t, systemVendor, setSystemVendor, vendorSearch, setVendorSearch, showVendorDrop, setShowVendorDrop, filteredVendors }) {
  return (
    <div className="vendor-search-wrap">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.6rem' }}>
        <div className="field-label" style={{ marginBottom: 0 }}>
          <i className="fas fa-user-tie" /> {t.systemVendor}
        </div>
        <Badge variant={systemVendor.code ? 'success' : 'warning'}>
          <i className={`fas fa-${systemVendor.code ? 'circle-check' : 'triangle-exclamation'}`} />
          {systemVendor.code ? 'Mapped' : 'Unmapped'}
        </Badge>
      </div>

      <div className="vendor-search-input-wrap">
        <i className="fas fa-magnifying-glass" />
        <input
          type="text"
          className={`vendor-search-input ${systemVendor.code ? 'matched' : ''}`}
          placeholder={t.searchVendor}
          value={vendorSearch}
          onChange={e => {
            setVendorSearch(e.target.value)
            setShowVendorDrop(true)
            if (!e.target.value) setSystemVendor({ code: '', name: '' })
          }}
          onFocus={() => setShowVendorDrop(true)}
          onBlur={() => setTimeout(() => setShowVendorDrop(false), 180)}
        />
      </div>

      {showVendorDrop && (
        <div className="vendor-dropdown">
          {filteredVendors.length > 0
            ? filteredVendors.map(v => (
                <div
                  key={v.taxId}
                  className="vendor-dropdown-item"
                  onMouseDown={() => {
                    setSystemVendor({ code: v.code, name: v.name })
                    setVendorSearch(`${v.code} — ${v.name}`)
                    setShowVendorDrop(false)
                  }}
                >
                  <div className="vd-name">{v.code} — {v.name}</div>
                  <div className="vd-tax">Tax ID: {v.taxId}</div>
                </div>
              ))
            : (
                <div style={{ padding: '0.75rem 1rem', fontSize: '0.83rem', color: 'var(--text-4)', textAlign: 'center' }}>
                  ไม่พบข้อมูลผู้ขาย
                </div>
              )
          }
        </div>
      )}
    </div>
  )
}
