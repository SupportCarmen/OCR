import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
import './Mapping.css';

const MASTER_DEPARTMENTS = [];
const MASTER_ACCOUNTS = [];
const MASTER_FILE_PREFIXES = [
  { code: 'PFX-01', name: 'Invoice' },
  { code: 'PFX-02', name: 'Receipt' },
  { code: 'PFX-03', name: 'Daily Report' }
];

const PAYMENT_TYPES = [
  'VSA-DCC-P', 'VSA-INT-P', 'VSA-P', 'VSA-AFF-P', 'VSC', 'TPN',
  'THSTD-P', 'QR-JCB', 'QR-UPI', 'VSA-SCB-P', 'MCA-SCB-P'
];

export default function Mapping() {
  const [bank, setBank] = useState('');
  const [filePrefix, setFilePrefix] = useState('');
  const [fileSource, setFileSource] = useState('');

  const [company, setCompany] = useState({ name: '', taxId: '', branch: '', address: '' });
  
  const [mappings, setMappings] = useState({
    commission: { dept: '', acc: '' },
    tax: { dept: '', acc: '' },
    net: { dept: '', acc: '' },
    wht: { dept: '', acc: '' }
  });

  const [paymentAmount, setPaymentAmount] = useState(() => {
    const initialState = {};
    PAYMENT_TYPES.forEach(type => {
      initialState[type] = { dept: '', acc: '' };
    });
    return initialState;
  });

  const [isAmountModalOpen, setIsAmountModalOpen] = useState(false);

  // Load from LocalStorage on mount
  useEffect(() => {
    const config = localStorage.getItem('accountingConfig');
    if (config) {
      try {
        const parsed = JSON.parse(config);
        setBank(parsed.bank || '');
        setFilePrefix(parsed.filePrefix || '');
        setFileSource(parsed.fileSource || '');
        if (parsed.company) {
          setCompany(prev => ({ ...prev, ...parsed.company }));
        }
        if (parsed.mappings) {
          setMappings(prev => ({ ...prev, ...parsed.mappings }));
        }
      } catch(e) {}
    }

    const amountState = localStorage.getItem('accountMappingAmount');
    if (amountState) {
      try {
        setPaymentAmount(JSON.parse(amountState));
      } catch(e) {}
    }
  }, []);

  const saveAllSettings = () => {
    const config = {
      bank,
      filePrefix,
      fileSource,
      company,
      mappings,
      paymentAmount
    };

    localStorage.setItem('accountingConfig', JSON.stringify(config));
    alert('บันทึกการตั้งค่าเรียบร้อยแล้ว! ข้อมูลจะถูกนำไปใช้ในหน้าหลักทันทีครับ');
  };

  const saveAmountSelection = () => {
    localStorage.setItem('accountMappingAmount', JSON.stringify(paymentAmount));
    setIsAmountModalOpen(false);
  };

  // Helper for input binding
  const handleCompanyChange = (e, field) => {
    setCompany({ ...company, [field]: e.target.value });
  };

  const handleMappingChange = (type, field, value) => {
    setMappings(prev => ({
      ...prev,
      [type]: {
        ...prev[type],
        [field]: value
      }
    }));
  };

  const handlePaymentMappingChange = (type, field, value) => {
    setPaymentAmount(prev => ({
      ...prev,
      [type]: {
        ...prev[type],
        [field]: value
      }
    }));
  };

  const amountMappedCount = Object.values(paymentAmount).filter(m => m.dept && m.acc).length;

  return (
    <>
    <div className="container" style={{ margin: '2rem auto', maxWidth: '800px' }}>
      <h1><i className="fas fa-project-diagram"></i> Account Mapping Configuration</h1>

      <div style={{ marginBottom: '1rem' }}>
         <button onClick={() => window.location.hash = ''} className="btn-cancel" style={{ textDecoration: 'none', padding: '0.5rem 1rem' }}>
           <i className="fas fa-arrow-left"></i> กลับสู่หน้าหลัก
         </button>
      </div>

      {/* Bank Selection */}
      <div className="section">
        <div className="form-grid">
          <label>Bank</label>
          <select value={bank} onChange={(e) => setBank(e.target.value)} className="search-select-trigger" style={{ width: '100%' }}>
            <option value="">เลือกธนาคาร...</option>
            <option value="Bangkok Bank (BBL)">Bangkok Bank (BBL)</option>
            <option value="Kasikornbank (KBANK)">Kasikornbank (KBANK)</option>
            <option value="Siam Commercial Bank (SCB)">Siam Commercial Bank (SCB)</option>
          </select>

          <label>File Prefix</label>
          <select value={filePrefix} onChange={(e) => setFilePrefix(e.target.value)} className="search-select-trigger" style={{ width: '100%' }}>
            <option value="">เลือกคำนำหน้าไฟล์...</option>
            {MASTER_FILE_PREFIXES.map(p => (
              <option key={p.code} value={`${p.code} - ${p.name}`}>{p.code} - {p.name}</option>
            ))}
          </select>

          <label>File Source</label>
          <input type="text" placeholder="ระบุแหล่งที่มาไฟล์ (เช่น Email, Drive)" value={fileSource} onChange={(e) => setFileSource(e.target.value)} />
        </div>
      </div>

      {/* Company Information */}
      <div className="section">
        <div className="section-title">COMPANY INFORMATION</div>
        <div className="form-grid">
          <label>Company Name</label>
          <input type="text" placeholder="ระบุชื่อบริษัท" value={company.name} onChange={(e) => handleCompanyChange(e, 'name')} />
          <label>Tax ID</label>
          <input type="text" placeholder="ระบุเลขประจำตัวผู้เสียภาษี" value={company.taxId} onChange={(e) => handleCompanyChange(e, 'taxId')} />
          <label>Branch No</label>
          <input type="text" placeholder="ระบุรหัสสาขา" value={company.branch} onChange={(e) => handleCompanyChange(e, 'branch')} />
          <label>Address</label>
          <input type="text" placeholder="ระบุที่อยู่" value={company.address} onChange={(e) => handleCompanyChange(e, 'address')} />
        </div>
      </div>

      {/* Account Code Mapping */}
      <div className="section">
        <div className="section-title">ACCOUNT CODE MAPPING</div>
        <div className="mapping-container" style={{ display: 'grid', gridTemplateColumns: '80px 150px 1fr 1fr', gap: '1rem', alignItems: 'center' }}>
          <div></div>
          <div></div>
          <div className="mapping-header" style={{ fontWeight: 600 }}>Department Code</div>
          <div className="mapping-header" style={{ fontWeight: 600 }}>Account Code</div>

          {/* Amount */}
          <div className="mapping-type type-debit" style={{ color: 'var(--blue)', background: 'var(--blue-light)', padding: '0.2rem 0.5rem', borderRadius: '4px', textAlign: 'center', fontWeight: 'bold' }}>Debit</div>
          <div className="mapping-label clickable" style={{ cursor: 'pointer', color: 'var(--blue)', textDecoration: 'underline' }} onClick={() => setIsAmountModalOpen(true)}>Amount (Click to Map)</div>
          <div style={{ gridColumn: 'span 2' }}>
            <div id="amountMappingStatus" style={{ fontSize: '0.85rem', padding: '0.7rem 1rem', borderRadius: '4px', border: '1px dashed var(--gray-300)', color: amountMappedCount > 0 ? 'var(--teal)' : 'var(--gray-500)', background: amountMappedCount > 0 ? 'var(--teal-light)' : 'var(--gray-50)', borderColor: amountMappedCount > 0 ? 'var(--teal)' : 'var(--gray-300)' }}>
               {amountMappedCount > 0 
                  ? <><i className="fas fa-check-circle"></i> ตั้งค่าแล้ว {amountMappedCount}/{PAYMENT_TYPES.length} รายการ</>
                  : <><i className="fas fa-info-circle"></i> กดที่ชื่อ Amount เพื่อตั้งค่าแยกตาม Payment Type</>
               }
            </div>
          </div>

          {/* Other mappings loop */}
          {['commission', 'tax', 'net', 'wht'].map((key) => {
            const labelMap = { commission: 'Commission', tax: 'Tax Amount', net: 'Net Amount', wht: 'WHT Amount' };
            return (
              <React.Fragment key={key}>
                <div className="mapping-type type-credit" style={{ color: '#d97706', background: '#fef3c7', padding: '0.2rem 0.5rem', borderRadius: '4px', textAlign: 'center', fontWeight: 'bold' }}>Credit</div>
                <div className="mapping-label">{labelMap[key]}</div>
                <div>
                  <input type="text" placeholder="พิมพ์ Dept. Code..." style={{ width: '100%', padding: '0.5rem', border: '1px solid var(--border)' }} value={mappings[key].dept} onChange={(e) => handleMappingChange(key, 'dept', e.target.value)} />
                </div>
                <div>
                  <input type="text" placeholder="พิมพ์ Account Code..." style={{ width: '100%', padding: '0.5rem', border: '1px solid var(--border)' }} value={mappings[key].acc} onChange={(e) => handleMappingChange(key, 'acc', e.target.value)} />
                </div>
              </React.Fragment>
            );
          })}
        </div>
      </div>

      <button className="btn-save" onClick={saveAllSettings} style={{ marginTop: '2rem', width: '100%', padding: '1rem', background: 'var(--blue)', color: '#fff', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>
        บันทึกการตั้งค่า
      </button>

    </div>

      {/* Amount Modal - rendered via Portal to escape container stacking context */}
      {isAmountModalOpen && ReactDOM.createPortal(
        <div className="mapping-modal" style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => setIsAmountModalOpen(false)}>
          <div className="mapping-modal-overlay" style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(0, 0, 0, 0.5)' }}></div>
          <div className="mapping-modal-content" style={{ position: 'relative', zIndex: 1, backgroundColor: '#fff', width: '90%', maxWidth: '800px', borderRadius: '8px', display: 'flex', flexDirection: 'column', maxHeight: '90vh' }} onClick={(e) => e.stopPropagation()}>
            <div className="mapping-modal-header" style={{ padding: '1rem', borderBottom: '1px solid var(--border)', fontWeight: 'bold' }}>
              เลือก Payment Types สำหรับ Amount
            </div>
            <div className="mapping-modal-body" style={{ padding: '1rem', overflowY: 'auto' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'minmax(120px, 1fr) 1fr 1fr', gap: '1rem', fontWeight: 'bold', marginBottom: '1rem', paddingRight: '0.5rem' }}>
                <div>Payment Type</div>
                <div>Department Code</div>
                <div>Account Code</div>
              </div>
              {PAYMENT_TYPES.map(type => (
                <div key={type} style={{ display: 'grid', gridTemplateColumns: 'minmax(120px, 1fr) 1fr 1fr', gap: '1rem', marginBottom: '0.5rem', alignItems: 'center' }}>
                  <div style={{ background: 'var(--blue-light)', color: 'var(--blue)', padding: '0.4rem 0.5rem', borderRadius: '4px', border: '1px solid var(--blue-mid)', fontSize: '0.85rem', fontWeight: 600, textAlign: 'center' }}>
                    {type}
                  </div>
                  <input type="text" placeholder="Dept..." value={paymentAmount[type].dept} onChange={(e) => handlePaymentMappingChange(type, 'dept', e.target.value)} style={{ width: '100%', padding: '0.4rem', border: '1px solid var(--border)', borderRadius: '4px' }}/>
                  <input type="text" placeholder="Acc..." value={paymentAmount[type].acc} onChange={(e) => handlePaymentMappingChange(type, 'acc', e.target.value)} style={{ width: '100%', padding: '0.4rem', border: '1px solid var(--border)', borderRadius: '4px' }}/>
                </div>
              ))}
            </div>
            <div className="mapping-modal-footer" style={{ padding: '1rem', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
              <button className="btn-cancel" onClick={() => setIsAmountModalOpen(false)} style={{ padding: '0.5rem 1rem', background: 'var(--gray-300)', borderRadius: '4px', cursor: 'pointer', border: 'none' }}>ยกเลิก</button>
              <button className="btn-confirm" onClick={saveAmountSelection} style={{ padding: '0.5rem 1rem', background: 'var(--blue)', color: '#fff', borderRadius: '4px', cursor: 'pointer', border: 'none' }}>ตกลง</button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
