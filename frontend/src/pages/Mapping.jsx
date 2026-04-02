import React, { useState, useEffect, useRef } from 'react';
import ReactDOM from 'react-dom';
import { fetchAccountCodes, fetchDepartments } from '../lib/carmenApi';
import './Mapping.css';

// ─── CUSTOM SEARCH SELECT ───
function CustomSearchSelect({ value, onChange, options, placeholder }) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const wrapperRef = useRef(null);

  useEffect(() => {
    setSearchTerm(value || '');
  }, [value]);

  useEffect(() => {
    function handleClickOutside(event) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        setIsOpen(false);
        setSearchTerm(value || '');
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("touchstart", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
    };
  }, [value]);

  const filtered = options.filter(o => 
    (o.code && o.code.toLowerCase().includes(searchTerm.toLowerCase())) || 
    (o.name && o.name.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (o.name2 && o.name2.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div ref={wrapperRef} style={{ position: 'relative', width: '100%' }}>
      <input 
        type="text" 
        placeholder={placeholder}
        value={isOpen ? searchTerm : value || ''}
        onFocus={() => { setIsOpen(true); setSearchTerm(''); }}
        onChange={(e) => setSearchTerm(e.target.value)}
        style={{ width: '100%', padding: '0.5rem 0.65rem', border: '1px solid var(--border)', borderBottomColor: isOpen ? 'var(--blue)' : 'var(--border)', borderRadius: '6px', fontSize: '0.85rem', outline: 'none', transition: 'all 0.2s', fontFamily: "'DM Mono', monospace" }}
      />
      {isOpen && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, right: 0, 
          maxHeight: '280px', overflowY: 'auto', background: 'white', 
          border: '1px solid var(--border)', borderRadius: '6px', 
          boxShadow: '0 10px 25px rgba(0,0,0,0.1)', zIndex: 9999, marginTop: '4px'
        }}>
          {filtered.map((opt, i) => (
            <div 
              key={i}
              style={{ padding: '0.6rem 0.8rem', borderBottom: '1px solid var(--gray-100)', cursor: 'pointer', transition: 'background 0.1s' }}
              onMouseDown={(e) => {
                e.preventDefault();
                onChange(opt.code);
                setIsOpen(false);
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = 'var(--blue-light)'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
            >
              <div style={{ fontWeight: 600, color: 'var(--blue)', fontSize: '0.85rem', fontFamily: "'DM Mono', monospace" }}>{opt.code} <span style={{color: 'var(--text-3)', fontWeight: 500, fontFamily: "'Sarabun', sans-serif"}}> - {opt.name}</span></div>
              {opt.name2 && <div style={{ fontSize: '0.75rem', color: 'var(--text-4)', marginTop: '3px', fontFamily: "'Sarabun', sans-serif" }}>{opt.name2}</div>}
            </div>
          ))}
          {filtered.length === 0 && <div style={{ padding: '0.8rem', color: 'var(--text-4)', fontSize: '0.8rem', textAlign: 'center' }}>ไม่พบข้อมูล</div>}
        </div>
      )}
    </div>
  )
}


const MASTER_FILE_PREFIXES = [
  { code: 'PFX-01', name: 'Invoice' },
  { code: 'PFX-02', name: 'Receipt' },
  { code: 'PFX-03', name: 'Daily Report' }
];

const PAYMENT_TYPES = [
  'VSA-DCC-P', 'VSA-INT-P', 'VSA-P', 'VSA-AFF-P', 'VSA-DCC', 'VSA-INT', 'VSA', 'VSA-AFF',
  'MCA-DCC-P', 'MCA-INT-P', 'MCA-P', 'MCA-AFF-P', 'MCA-DCC', 'MCA-INT', 'MCA', 'MCA-AFF',
  'UP', 'JCB-P', 'JCB-AFF-P', 'JCB', 'JCB-AFF', 'MCE', 'LCS-VSA-P', 'LCS-VSA', 'QR-VSA',
  'AMEX', 'LCS-MCA', 'QR-MCA', 'VSPPCO', 'VSCCCO', 'TPN', 'THSTD-P', 'QR-JCB', 'QR-UPI',
  'VSA-SCB-P', 'MCA-SCB-P'
];

export default function Mapping() {
  const [masterAccounts, setMasterAccounts] = useState([]);
  const [masterDepartments, setMasterDepartments] = useState([]);
  const [loadingOpts, setLoadingOpts] = useState(true);

  const [bank, setBank] = useState('');
  const [filePrefix, setFilePrefix] = useState('');
  const [fileSource, setFileSource] = useState('');

  const [company, setCompany] = useState({ name: '', taxId: '', branch: '', address: '' });

  
  const [mappings, setMappings] = useState({
    commission: { dept: '', acc: '' },
    tax: { dept: '', acc: '' },
    net: { dept: '', acc: '' }
  });

  const [paymentAmount, setPaymentAmount] = useState(() => {
    const initialState = {};
    PAYMENT_TYPES.forEach(type => {
      initialState[type] = { dept: '', acc: '' };
    });
    return initialState;
  });

  const [isAmountModalOpen, setIsAmountModalOpen] = useState(false);

  const loadInitialData = async () => {
    setLoadingOpts(true);
    try {
      const [accResult, deptResult] = await Promise.all([
        fetchAccountCodes(),
        fetchDepartments()
      ]);
      
      const mappedAcc = accResult
        .filter(a => a.AccCode && a.AccCode !== 'AccCode')
        .map(a => ({ code: a.AccCode, name: a.Description, name2: a.Description2, nature: a.Nature }));
      
      const mappedDept = deptResult
        .filter(d => d.DeptCode && d.DeptCode !== 'CodeDep')
        .map(d => ({ code: d.DeptCode, name: d.Description, name2: d.Description2 }));
      
      setMasterAccounts(mappedAcc);
      setMasterDepartments(mappedDept);
    } catch (err) {
      console.error("Failed to load carmen dictionary:", err);
    } finally {
      setLoadingOpts(false);
    }
  };

  // Load from LocalStorage and APIs on mount
  useEffect(() => {
    loadInitialData();

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
        const parsedAmount = JSON.parse(amountState);
        setPaymentAmount(prev => {
          const newState = { ...prev };
          Object.keys(parsedAmount).forEach(k => {
            newState[k] = parsedAmount[k];
          });
          PAYMENT_TYPES.forEach(type => {
            if (!newState[type]) newState[type] = { dept: '', acc: '' };
          });
          return newState;
        });
      } catch(e) {}
    }
  }, []);

  const saveAllSettings = (shouldClose = false) => {
    const config = {
      bank,
      filePrefix,
      fileSource,
      company,
      mappings,
      paymentAmount
    };

    localStorage.setItem('accountingConfig', JSON.stringify(config));
    
    if (shouldClose && window.opener) {
      window.close();
    } else {
      // cc// ถ้าไม่ใช่หน้าต่างแยก ให้กกลับไปหน้าหลัก (ตัว App จะโหลด Step ล่าสุดมาเอง)
      window.location.hash = '';
      if (!shouldClose) {
        alert('บันทึกการตั้งค่าเรียบร้อยแล้ว!');
      }
    }
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
    let newNature = mappings[type]?.nature || '';
    if (field === 'acc') {
      const found = masterAccounts.find(a => a.code === value);
      if (found) newNature = found.nature;
    }

    setMappings(prev => ({
      ...prev,
      [type]: {
        ...prev[type],
        [field]: value,
        nature: field === 'acc' ? newNature : prev[type]?.nature
      }
    }));
  };

  const handlePaymentMappingChange = (type, field, value) => {
    let newNature = paymentAmount[type]?.nature || '';
    if (field === 'acc') {
      const found = masterAccounts.find(a => a.code === value);
      if (found) newNature = found.nature;
    }

    setPaymentAmount(prev => ({
      ...prev,
      [type]: {
        ...prev[type],
        [field]: value,
        nature: field === 'acc' ? newNature : prev[type]?.nature
      }
    }));
  };

  const amountMappedCount = Object.values(paymentAmount).filter(m => m.dept && m.acc).length;

  return (
    <>
    <div className="container" style={{ margin: '2rem auto', maxWidth: '800px' }}>
      <h1><i className="fas fa-project-diagram"></i> Account Mapping Configuration</h1>

      <div style={{ marginBottom: '1.5rem' }}>
         <button onClick={() => window.location.hash = ''} className="btn-cancel" style={{ textDecoration: 'none', padding: '0.6rem 1.2rem', display: 'inline-flex', alignItems: 'center', gap: '0.5rem', borderRadius: '8px', background: 'white', border: '1px solid var(--border)', cursor: 'pointer' }}>
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
        <div className="section-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>ACCOUNT CODE MAPPING {loadingOpts && <span style={{marginLeft: '10px', fontSize: '0.8rem', color: 'var(--blue)'}}><i className="fas fa-spinner fa-spin"></i> กำลังโหลดรหัสบัญชี...</span>}</div>
          <button onClick={loadInitialData} disabled={loadingOpts} style={{ padding: '0.4rem 0.8rem', background: 'white', border: '1px solid var(--border)', borderRadius: '6px', fontSize: '0.8rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--text-2)' }}>
            <i className={`fas fa-sync-alt ${loadingOpts ? 'fa-spin' : ''}`}></i> Refresh
          </button>
        </div>

        <div className="mapping-container" style={{ display: 'grid', gridTemplateColumns: '95px 150px 1fr 1fr', gap: '1rem', alignItems: 'center' }}>
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
          {['commission', 'tax', 'net'].map((key) => {
            const labelMap = { commission: 'Commission', tax: 'Tax Amount', net: 'Net Amount' };
            const nature = mappings[key].nature;
            let natureLabel = "Credit";
            let natureClass = "type-credit";
            let natureStyle = { color: '#d97706', background: '#fef3c7', padding: '0.2rem 0.5rem', borderRadius: '4px', textAlign: 'center', fontWeight: 'bold' };

            if (!nature) {
              natureLabel = "No Acc";
              natureClass = "type-empty";
              natureStyle = { color: 'var(--gray-500)', background: 'var(--gray-200)', ...natureStyle };
            } else if (nature.toLowerCase() === 'debit') {
              natureLabel = "Debit";
              natureClass = "type-debit";
              natureStyle = { color: 'var(--blue)', background: 'var(--blue-light)', ...natureStyle };
            }

            return (
              <React.Fragment key={key}>
                <div className={`mapping-type ${natureClass}`} style={natureStyle}>{natureLabel}</div>
                <div className="mapping-label">{labelMap[key]}</div>
                <div>
                  <CustomSearchSelect 
                    value={mappings[key].dept} 
                    onChange={(val) => handleMappingChange(key, 'dept', val)} 
                    options={masterDepartments} 
                    placeholder="พิมพ์ Dept. Code..." 
                  />
                </div>
                <div>
                  <CustomSearchSelect 
                    value={mappings[key].acc} 
                    onChange={(val) => handleMappingChange(key, 'acc', val)} 
                    options={masterAccounts} 
                    placeholder="พิมพ์ Account Code..." 
                  />
                </div>
              </React.Fragment>
            );
          })}
        </div>
      </div>

      <div style={{ marginTop: '2.5rem' }}>
        <button 
          className="btn-save" 
          onClick={() => saveAllSettings(true)} 
          style={{ 
            width: '100%', 
            padding: '1.2rem', 
            background: 'var(--teal)', 
            color: '#fff', 
            borderRadius: '12px', 
            cursor: 'pointer', 
            fontWeight: 'bold', 
            fontSize: '1.1rem',
            border: 'none',
            boxShadow: '0 4px 15px rgba(13,148,136,0.3)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.75rem'
          }}
        >
          <i className="fas fa-check-circle" style={{ fontSize: '1.2rem' }}></i> บันทึกและปิดหน้าต่าง
        </button>
      </div>

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
              {PAYMENT_TYPES.map(type => {
                const pAmt = paymentAmount[type] || { dept: '', acc: '' };
                const nature = pAmt.nature;
                let natColor = nature?.toLowerCase() === 'debit' ? 'var(--blue)' : (nature?.toLowerCase() === 'credit' ? '#d97706' : 'var(--gray-500)');
                return (
                <div key={type} style={{ display: 'grid', gridTemplateColumns: 'minmax(120px, 1fr) 1fr 1fr', gap: '1rem', marginBottom: '0.5rem', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <div style={{ background: 'var(--blue-light)', color: 'var(--blue)', padding: '0.4rem 0.5rem', borderRadius: '4px', border: '1px solid var(--blue-mid)', fontSize: '0.85rem', fontWeight: 600, textAlign: 'center', flex: 1 }}>
                      {type}
                    </div>
                    {nature && <span style={{fontSize: '0.7rem', color: natColor, fontWeight: 'bold'}}>{nature}</span>}
                  </div>
                  <CustomSearchSelect 
                    value={pAmt.dept} 
                    onChange={(val) => handlePaymentMappingChange(type, 'dept', val)} 
                    options={masterDepartments} 
                    placeholder="Dept..." 
                  />
                  <CustomSearchSelect 
                    value={pAmt.acc} 
                    onChange={(val) => handlePaymentMappingChange(type, 'acc', val)} 
                    options={masterAccounts} 
                    placeholder="Acc..." 
                  />
                </div>
              )})}
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
