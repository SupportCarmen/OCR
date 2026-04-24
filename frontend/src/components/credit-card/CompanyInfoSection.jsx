import React from 'react';

export default function CompanyInfoSection({
  company, handleCompanyChange, companyRequiredFields, missingCompanyFields
}) {
  return (
    <div className="section">
      <div className="section-title" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
        COMPANY INFORMATION
        {missingCompanyFields.length > 0 && (
          <span style={{ fontSize: '0.75rem', background: '#dc2626', color: 'white', padding: '2px 8px', borderRadius: '10px', fontWeight: 'bold' }}>
            <i className="fas fa-exclamation-circle"></i> ข้อมูลไม่ครบ {missingCompanyFields.length} รายการ
          </span>
        )}
      </div>
      <div className="form-grid">
        {companyRequiredFields.map(({ key, label }) => {
          const missing = !company[key]?.trim();
          const placeholderMap = { name: 'ระบุชื่อบริษัท', taxId: 'ระบุเลขประจำตัวผู้เสียภาษี', branch: 'ระบุรหัสสาขา', address: 'ระบุที่อยู่' };
          return (
            <React.Fragment key={`frag-${key}`}>
              <label key={`lbl-${key}`} style={missing ? { color: '#dc2626', fontWeight: 600 } : {}}>
                {label} {missing && <span style={{ color: '#dc2626' }}>*</span>}
              </label>
              <input
                key={`inp-${key}`}
                type="text"
                placeholder={placeholderMap[key]}
                value={company[key]}
                onChange={(e) => handleCompanyChange(e, key)}
                style={missing ? { borderColor: '#dc2626', background: '#fff1f2' } : {}}
              />
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
}
