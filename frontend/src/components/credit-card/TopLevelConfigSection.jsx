import React from 'react';
import CustomSearchSelect from '../common/CustomSearchSelect';

export default function TopLevelConfigSection({
  bank, handleBankChange,
  filePrefix, setFilePrefix, masterGLPrefixes, loadingOpts,
  fileSource, setFileSource,
  description, setDescription
}) {
  return (
    <div className="section">
      <div className="form-grid">
        <label style={!bank ? { color: '#dc2626', fontWeight: 600 } : {}}>
          Bank {!bank && <span style={{ color: '#dc2626' }}>*</span>}
        </label>
        <select value={bank} onChange={(e) => handleBankChange(e.target.value)} className="search-select-trigger" style={{ width: '100%', ...(!bank ? { borderColor: '#dc2626', background: '#fff1f2' } : {}) }}>
          <option value="">เลือกธนาคาร...</option>
          <option value="Bangkok Bank (BBL)">Bangkok Bank (BBL)</option>
          <option value="Kasikornbank (KBANK)">Kasikornbank (KBANK)</option>
          <option value="Siam Commercial Bank (SCB)">Siam Commercial Bank (SCB)</option>
        </select>

        <label style={!filePrefix ? { color: '#dc2626', fontWeight: 600 } : {}}>
          File Prefix {!filePrefix && <span style={{ color: '#dc2626' }}>*</span>}
        </label>
        <CustomSearchSelect
          value={filePrefix}
          onChange={(code) => setFilePrefix(code)}
          options={masterGLPrefixes}
          placeholder={loadingOpts ? 'กำลังโหลด...' : 'เลือกคำนำหน้าไฟล์...'}
          hasError={!filePrefix}
        />

        <label style={!fileSource ? { color: '#dc2626', fontWeight: 600 } : {}}>
          File Source {!fileSource && <span style={{ color: '#dc2626' }}>*</span>}
        </label>
        <input type="text" placeholder="ระบุแหล่งที่มาไฟล์ (เช่น Email, Drive)" value={fileSource} onChange={(e) => setFileSource(e.target.value)}
          style={!fileSource ? { borderColor: '#dc2626', background: '#fff1f2' } : {}} />

        <label>Description</label>
        <input type="text" placeholder="รายละเอียดเพิ่มเติม" value={description} onChange={(e) => setDescription(e.target.value)} />
      </div>
    </div>
  );
}
