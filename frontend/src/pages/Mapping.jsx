import React, { useState, useEffect, useRef } from 'react';
import ReactDOM from 'react-dom';
import { fetchAccountCodes, fetchDepartments, suggestMapping, fetchMappingHistory, saveMappingHistory, suggestPaymentTypes } from '../lib/carmenApi';
import CustomModal from '../components/CustomModal';
import './Mapping.css';

// ─── CUSTOM SEARCH SELECT ───
// topChoice: { code, name, name2?, source: 'ai'|'history' } | null
function CustomSearchSelect({ value, onChange, options, placeholder, topChoice }) {
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

  const q = searchTerm.toLowerCase();
  const filtered = options.filter(o =>
    (o.code && o.code.toLowerCase().includes(q)) ||
    (o.name && o.name.toLowerCase().includes(q)) ||
    (o.name2 && o.name2.toLowerCase().includes(q))
  );

  // Show top choice when: exists, not already selected, and matches search (or search is empty)
  const showTopChoice = topChoice &&
    topChoice.code !== value &&
    (!q ||
      topChoice.code.toLowerCase().includes(q) ||
      (topChoice.name && topChoice.name.toLowerCase().includes(q)));

  const filteredWithoutTop = showTopChoice
    ? filtered.filter(o => o.code !== topChoice.code)
    : filtered;

  const topBadge = topChoice?.source === 'history'
    ? { label: 'History', bg: '#f0fdf4', color: '#16a34a', border: '#86efac', icon: 'fa-history' }
    : { label: 'AI แนะนำ', bg: '#f5f3ff', color: '#7c3aed', border: '#c4b5fd', icon: 'fa-magic' };

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
          {/* ── Top Choice ── */}
          {showTopChoice && (
            <>
              <div
                onMouseDown={(e) => { e.preventDefault(); onChange(topChoice.code); setIsOpen(false); }}
                onMouseEnter={(e) => e.currentTarget.style.background = topChoice.source === 'history' ? '#dcfce7' : '#ede9fe'}
                onMouseLeave={(e) => e.currentTarget.style.background = topBadge.bg}
                style={{ padding: '0.6rem 0.8rem', background: topBadge.bg, borderBottom: `1px solid ${topBadge.border}`, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem', transition: 'background 0.1s' }}
              >
                <div>
                  <div style={{ fontWeight: 700, color: topBadge.color, fontSize: '0.85rem', fontFamily: "'DM Mono', monospace" }}>
                    {topChoice.code} <span style={{ fontWeight: 500, fontFamily: "'Sarabun', sans-serif" }}>- {topChoice.name}</span>
                  </div>
                  {topChoice.name2 && <div style={{ fontSize: '0.72rem', color: topBadge.color, opacity: 0.75, marginTop: '2px', fontFamily: "'Sarabun', sans-serif" }}>{topChoice.name2}</div>}
                </div>
              </div>
              {filteredWithoutTop.length > 0 && (
                <div style={{ padding: '0.2rem 0.8rem', fontSize: '0.7rem', color: 'var(--text-4)', background: 'var(--gray-50)', borderBottom: '1px solid var(--gray-100)' }}>
                  ตัวเลือกทั้งหมด
                </div>
              )}
            </>
          )}

          {/* ── Normal list ── */}
          {filteredWithoutTop.map((opt, i) => (
            <div
              key={i}
              style={{ padding: '0.6rem 0.8rem', borderBottom: '1px solid var(--gray-100)', cursor: 'pointer', transition: 'background 0.1s' }}
              onMouseDown={(e) => { e.preventDefault(); onChange(opt.code); setIsOpen(false); }}
              onMouseEnter={(e) => e.currentTarget.style.background = 'var(--blue-light)'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
            >
              <div style={{ fontWeight: 600, color: 'var(--blue)', fontSize: '0.85rem', fontFamily: "'DM Mono', monospace" }}>{opt.code} <span style={{ color: 'var(--text-3)', fontWeight: 500, fontFamily: "'Sarabun', sans-serif" }}> - {opt.name}</span></div>
              {opt.name2 && <div style={{ fontSize: '0.75rem', color: 'var(--text-4)', marginTop: '3px', fontFamily: "'Sarabun', sans-serif" }}>{opt.name2}</div>}
            </div>
          ))}
          {!showTopChoice && filtered.length === 0 && <div style={{ padding: '0.8rem', color: 'var(--text-4)', fontSize: '0.8rem', textAlign: 'center' }}>ไม่พบข้อมูล</div>}
        </div>
      )}
    </div>
  );
}


const BANK_INFO = {
  'Bangkok Bank (BBL)': {
    name: 'ธนาคารกรุงเทพ จำกัด (มหาชน)',
    taxId: '0107536000374',
    address: '333 ถนนสีลม เขตบางรัก กรุงเทพฯ 10500',
  },
  'Kasikornbank (KBANK)': {
    name: 'บมจ. ธนาคารกสิกรไทย',
    taxId: '0107536000315',
    address: '400/22 ถนนพหลโยธิน แขวงสามเสนใน เขตพญาไท กรุงเทพมหานคร 10400',
  },
  'Siam Commercial Bank (SCB)': {
    name: 'ธนาคารไทยพาณิชย์ จํากัด (มหาชน)',
    taxId: '0107536000102',
    address: '9 ถนนรัชดาภิเษก เขตจตุจักร กรุงเทพฯ 10900',
  },
};

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

const OCR_BANK_MAP = {
  BBL: 'Bangkok Bank (BBL)',
  KBANK: 'Kasikornbank (KBANK)',
  SCB: 'Siam Commercial Bank (SCB)',
};

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

  const [customPaymentTypes, setCustomPaymentTypes] = useState([]);
  const [newCustomType, setNewCustomType] = useState('');

  const [isAmountModalOpen, setIsAmountModalOpen] = useState(false);
  const [modalConfig, setModalConfig] = useState({ show: false, title: '', message: '', type: 'info' });

  // AI / History suggestion state
  const [suggestionMeta, setSuggestionMeta] = useState({ commission: null, tax: null, net: null }); // null | 'history' | 'ai'
  const [mainSuggestions, setMainSuggestions] = useState({ commission: null, tax: null, net: null }); // { dept, acc, source }
  const [suggestLoading, setSuggestLoading] = useState(false);
  // { [paymentType]: { dept: string|null, acc: string|null, source: 'history'|'ai' } }
  const [paymentSuggestions, setPaymentSuggestions] = useState({});
  const [paymentSuggestLoading, setPaymentSuggestLoading] = useState(false);

  // Auto-suggest: history first, then AI — only when fields are empty
  const autoSuggest = async (bankName, accounts, departments, force = false) => {
    if (!bankName || !accounts.length) return;

    // Always fetch for all fields so suggestions are ready in Top Choice
    const fieldsToFetch = ['commission', 'tax', 'net'];
    console.log(`[Mapping] Auto-suggesting for bank: ${bankName}...`);
    setSuggestLoading(true);
    let hist = {};

    try {
      const histData = await fetchMappingHistory(bankName);
      hist = histData.history || {};
      console.log('[Mapping] History loaded:', hist);
    } catch (_) { }

    // --- Temp: History disabled to test AI ---
    const fromHistory = {};
    // fieldsToFetch.forEach(f => {
    //   if (hist[f]?.dept || hist[f]?.acc) {
    //     fromHistory[f] = { dept: hist[f].dept || '', acc: hist[f].acc || '' };
    //   }
    // });

    // if (Object.keys(fromHistory).length > 0) {
    //   setMainSuggestions(prev => {
    //     const next = { ...prev };
    //     Object.entries(fromHistory).forEach(([k, v]) => {
    //       next[k] = { ...v, source: 'history' };
    //     });
    //     return next;
    //   });
    //   setSuggestionMeta(prev => {
    //     const next = { ...prev };
    //     Object.keys(fromHistory).forEach(k => { next[k] = 'history'; });
    //     return next;
    //   });
    // }

    const stillNeedsAI = fieldsToFetch;
    console.log('[Mapping] Testing AI: Bypassing history.');

    try {
      console.log(`[Mapping] Fetching AI suggestions for: ${stillNeedsAI.join(', ')}`);
      const aiResult = await suggestMapping({
        bank_name: bankName,
        accounts: accounts.map(a => ({ code: a.code, name: a.name })),
        departments: departments.map(d => ({ code: d.code, name: d.name })),
      });

      console.log('[Mapping] AI suggestion results:', aiResult);
      const suggestKeyMap = { commission: 'Commission', tax: 'Tax Amount', net: 'Net Amount' };
      const fromAI = {};
      stillNeedsAI.forEach(f => {
        const s = (aiResult.suggestions || {})[suggestKeyMap[f]] || {};
        if (s.dept || s.acc) {
          fromAI[f] = { dept: s.dept || '', acc: s.acc || '' };
        }
      });
      if (Object.keys(fromAI).length > 0) {
        // Store only the new AI suggestions in mainSuggestions
        setMainSuggestions(prev => {
          const next = { ...prev };
          Object.entries(fromAI).forEach(([k, v]) => {
            // Only overwrite if this part was missing from history or if forced
            const existing = next[k] || {};
            next[k] = {
              dept: v.dept || existing.dept || '',
              acc: v.acc || existing.acc || '',
              source: existing.source === 'history' ? 'history' : 'ai'
            };
          });
          return next;
        });
        setSuggestionMeta(prev => {
          const next = { ...prev };
          Object.keys(fromAI).forEach(k => {
            if (!fromHistory[k]) next[k] = 'ai';
          });
          return next;
        });
      }
    } catch (err) {
      console.error('[Mapping] AI suggest failed:', err);
    } finally {
      setSuggestLoading(false);
    }
  };

  const autoSuggestPaymentTypes = async (bankName, accounts, departments, specificTypes = null) => {
    if (!bankName || !accounts.length) return;
    setPaymentSuggestLoading(true);

    const allTypes = specificTypes || [...PAYMENT_TYPES, ...customPaymentTypes];
    const newSuggestions = {};

    // --- Temp: History disabled to test AI ---
    const needsAI = allTypes;
    if (needsAI.length > 0) {
      try {
        const result = await suggestPaymentTypes({
          bank_name: bankName,
          payment_types: needsAI,
          accounts: accounts.map(a => ({ code: a.code, name: a.name })),
          departments: departments.map(d => ({ code: d.code, name: d.name })),
        });
        Object.entries(result.suggestions || {}).forEach(([t, val]) => {
          if (val.dept || val.acc) {
            newSuggestions[t] = { dept: val.dept || null, acc: val.acc || null, source: 'ai' };
          }
        });
      } catch (err) {
        console.error('AI payment type suggest failed:', err);
      }
    }

    setPaymentSuggestions(prev => ({ ...prev, ...newSuggestions }));
    setPaymentSuggestLoading(false);
  };

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

  // Trigger autoSuggest on bank change
  useEffect(() => {
    if (bank && masterAccounts.length && masterDepartments.length) {
      autoSuggest(bank, masterAccounts, masterDepartments);
    }
  }, [bank, masterAccounts.length, masterDepartments.length]);

  // Load from LocalStorage and APIs on mount
  useEffect(() => {
    loadInitialData();

    // OCR state — bank detected during scan + company info extracted from document
    let ocrBank = '';
    let ocrCompany = {};
    try {
      const ocrState = JSON.parse(localStorage.getItem('ocr_wizard_state') || '{}');
      ocrBank = OCR_BANK_MAP[ocrState.bank] || '';

      // Company info written by App.jsx applyExtractedData (bank_companyname, bank_tax_id, bank_address, branch_no)
      const ocrConfig = JSON.parse(localStorage.getItem('accountingConfig') || '{}');
      ocrCompany = ocrConfig.company || {};
    } catch (e) { }

    // Detect bank from company name as last resort
    const detectBankFromCompanyName = (name) => {
      if (!name) return '';
      if (name.includes('กรุงเทพ')) return 'Bangkok Bank (BBL)';
      if (name.includes('กสิกร')) return 'Kasikornbank (KBANK)';
      if (name.includes('ไทยพาณิชย์')) return 'Siam Commercial Bank (SCB)';
      return '';
    };

    const config = localStorage.getItem('accountingConfig');
    if (config) {
      try {
        const parsed = JSON.parse(config);
        const detectedBank = detectBankFromCompanyName(parsed.company?.name || ocrCompany?.name);
        const finalBank = parsed.bank || ocrBank || detectedBank;
        setBank(finalBank);
        setFilePrefix(parsed.filePrefix || '');
        setFileSource(parsed.fileSource || '');
        
        let companyData = { name: '', taxId: '', branch: '', address: '' };
        if (parsed.company) {
          companyData = { ...companyData, ...parsed.company };
        } else if (Object.keys(ocrCompany).length) {
          companyData = { ...companyData, ...ocrCompany };
        }

        // Always use BANK_INFO values when a bank is selected — bank determines company name/taxId/address
        if (finalBank && BANK_INFO[finalBank]) {
          const info = BANK_INFO[finalBank];
          companyData.name = info.name;
          companyData.taxId = info.taxId;
          companyData.address = info.address;
        }
        setCompany(companyData);
        
        if (parsed.mappings) {
          setMappings(prev => ({ ...prev, ...parsed.mappings }));
        }
      } catch (e) { }
    } else if (ocrBank) {
      setBank(ocrBank);
      let companyData = { name: '', taxId: '', branch: '', address: '' };
      if (Object.keys(ocrCompany).length) {
        companyData = { ...companyData, ...ocrCompany };
      }
      if (BANK_INFO[ocrBank]) {
        const info = BANK_INFO[ocrBank];
        companyData.name = info.name;
        companyData.taxId = info.taxId;
        companyData.address = info.address;
      }
      setCompany(companyData);
    }

    const amountState = localStorage.getItem('accountMappingAmount');
    if (amountState) {
      try {
        const parsedAmount = JSON.parse(amountState);
        const savedCustomTypes = parsedAmount.__customTypes || [];
        setCustomPaymentTypes(savedCustomTypes);
        setPaymentAmount(prev => {
          const newState = { ...prev };
          Object.keys(parsedAmount).forEach(k => {
            if (k !== '__customTypes') newState[k] = parsedAmount[k];
          });
          PAYMENT_TYPES.forEach(type => {
            if (!newState[type]) newState[type] = { dept: '', acc: '' };
          });
          savedCustomTypes.forEach(type => {
            if (!newState[type]) newState[type] = { dept: '', acc: '' };
          });
          return newState;
        });
      } catch (e) { }
    }
  }, []);

  const saveAllSettings = async (shouldClose = false) => {
    const config = { bank, filePrefix, fileSource, company, mappings, paymentAmount };
    localStorage.setItem('accountingConfig', JSON.stringify(config));

    // Save all non-empty mappings to history
    if (bank) {
      const allMappings = { ...mappings };
      Object.entries(paymentAmount).forEach(([type, val]) => {
        if (val.dept || val.acc) allMappings[type] = val;
      });
      try {
        await saveMappingHistory({ bank_name: bank, mappings: allMappings });
      } catch (_) { }
    }

    if (shouldClose && window.opener) {
      window.close();
    } else {
      // cc// ถ้าไม่ใช่หน้าต่างแยก ให้กกลับไปหน้าหลัก (ตัว App จะโหลด Step ล่าสุดมาเอง)
      window.location.hash = '';
      if (!shouldClose) {
        setModalConfig({
          show: true,
          title: 'บันทึกสำเร็จ',
          message: 'บันทึกการตั้งค่า Account Mapping เรียบร้อยแล้ว',
          type: 'success'
        });
      }
    }
  };

  const saveAmountSelection = () => {
    localStorage.setItem('accountMappingAmount', JSON.stringify({ ...paymentAmount, __customTypes: customPaymentTypes }));
    setIsAmountModalOpen(false);
  };

  const handleAddCustomType = () => {
    const trimmed = newCustomType.trim().toUpperCase();
    if (!trimmed || PAYMENT_TYPES.includes(trimmed) || customPaymentTypes.includes(trimmed)) return;
    setCustomPaymentTypes(prev => [...prev, trimmed]);
    setPaymentAmount(prev => ({ ...prev, [trimmed]: { dept: '', acc: '' } }));
    setNewCustomType('');

    // Trigger suggestion for the newly added custom type
    if (bank && masterAccounts.length && masterDepartments.length) {
      autoSuggestPaymentTypes(bank, masterAccounts, masterDepartments, [trimmed]);
    }
  };

  const handleRemoveCustomType = (type) => {
    setCustomPaymentTypes(prev => prev.filter(t => t !== type));
    setPaymentAmount(prev => {
      const next = { ...prev };
      delete next[type];
      return next;
    });
  };

  // Helper for input binding
  const handleCompanyChange = (e, field) => {
    setCompany({ ...company, [field]: e.target.value });
  };

  const handleMappingChange = (type, field, value) => {
    setMappings(prev => ({
      ...prev,
      [type]: { ...prev[type], [field]: value }
    }));
    // Clear suggestion badge when user manually edits
    setSuggestionMeta(prev => ({ ...prev, [type]: null }));
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

  const allPaymentTypes = [...PAYMENT_TYPES, ...customPaymentTypes];
  const amountMappedCount = allPaymentTypes.filter(t => paymentAmount[t]?.dept && paymentAmount[t]?.acc).length;

  return (
    <>
      <CustomModal
        show={modalConfig.show}
        title={modalConfig.title}
        message={modalConfig.message}
        type={modalConfig.type}
        onConfirm={() => setModalConfig({ ...modalConfig, show: false })}
      />
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
            <select value={bank} onChange={(e) => {
              const selected = e.target.value;
              setBank(selected);
              if (BANK_INFO[selected]) {
                const info = BANK_INFO[selected];
                setCompany(prev => ({ ...prev, name: info.name, taxId: info.taxId, address: info.address }));
              }
            }} className="search-select-trigger" style={{ width: '100%' }}>
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
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <span>ACCOUNT CODE MAPPING {loadingOpts && <span style={{ marginLeft: '10px', fontSize: '0.8rem', color: 'var(--blue)' }}><i className="fas fa-spinner fa-spin"></i> กำลังโหลดรหัสบัญชี...</span>}{!loadingOpts && suggestLoading && <span style={{ marginLeft: '10px', fontSize: '0.8rem', color: '#7c3aed' }}><i className="fas fa-magic fa-spin"></i> AI กำลังแนะนำ...</span>}</span>
            </div>
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
            <div className="mapping-label clickable" style={{ cursor: 'pointer', color: 'var(--blue)', textDecoration: 'underline' }} onClick={() => { setIsAmountModalOpen(true); autoSuggestPaymentTypes(bank, masterAccounts, masterDepartments); }}>Amount (Click to Map)</div>
            <div style={{ gridColumn: 'span 2' }}>
              <div id="amountMappingStatus" style={{ fontSize: '0.85rem', padding: '0.7rem 1rem', borderRadius: '4px', border: '1px dashed var(--gray-300)', color: amountMappedCount > 0 ? 'var(--teal)' : 'var(--gray-500)', background: amountMappedCount > 0 ? 'var(--teal-light)' : 'var(--gray-50)', borderColor: amountMappedCount > 0 ? 'var(--teal)' : 'var(--gray-300)' }}>
                {amountMappedCount > 0
                  ? <><i className="fas fa-check-circle"></i> ตั้งค่าแล้ว {amountMappedCount}/{allPaymentTypes.length} รายการ</>
                  : <><i className="fas fa-info-circle"></i> กดที่ชื่อ Amount เพื่อตั้งค่าแยกตาม Payment Type</>
                }
              </div>
            </div>

            {/* Other mappings loop */}
            {['commission', 'tax', 'net'].map((key) => {
              const labelMap = { commission: 'Commission', tax: 'Tax Amount', net: 'Net Amount' };
              const natureStyle = { color: '#d97706', background: '#fef3c7', padding: '0.2rem 0.5rem', borderRadius: '4px', textAlign: 'center', fontWeight: 'bold' };
              const meta = suggestionMeta[key];
              const badge = meta === 'history'
                ? { label: 'History', bg: '#f0fdf4', color: '#16a34a', border: '#86efac', icon: 'fa-history' }
                : meta === 'ai'
                  ? { label: 'AI แนะนำ', bg: '#f5f3ff', color: '#7c3aed', border: '#c4b5fd', icon: 'fa-magic' }
                  : null;

              const suggestion = mainSuggestions[key] || null;
              const detFromMaster = suggestion?.dept ? masterDepartments.find(d => d.code === suggestion.dept) : null;
              const deptTopChoice = suggestion?.dept
                ? {
                  code: suggestion.dept,
                  name: detFromMaster?.name || '(รหัสจาก AI/ประวัติ)',
                  name2: detFromMaster?.name2,
                  source: suggestion.source
                }
                : null;

              const accFromMaster = suggestion?.acc ? masterAccounts.find(a => a.code === suggestion.acc) : null;
              const accTopChoice = suggestion?.acc
                ? {
                  code: suggestion.acc,
                  name: accFromMaster?.name || '(รหัสจาก AI/ประวัติ)',
                  name2: accFromMaster?.name2,
                  source: suggestion.source
                }
                : null;

              return (
                <React.Fragment key={key}>
                  <div className="mapping-type type-credit" style={natureStyle}>Credit</div>
                  <div className="mapping-label" style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                    <span>{labelMap[key]}</span>
                  </div>
                  <div>
                    <CustomSearchSelect
                      value={mappings[key].dept}
                      onChange={(val) => handleMappingChange(key, 'dept', val)}
                      options={masterDepartments}
                      placeholder="พิมพ์ Dept. Code..."
                      topChoice={deptTopChoice?.code ? deptTopChoice : null}
                    />
                  </div>
                  <div>
                    <CustomSearchSelect
                      value={mappings[key].acc}
                      onChange={(val) => handleMappingChange(key, 'acc', val)}
                      options={masterAccounts}
                      placeholder="พิมพ์ Account Code..."
                      topChoice={accTopChoice?.code ? accTopChoice : null}
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
            <div className="mapping-modal-header" style={{ padding: '1rem', borderBottom: '1px solid var(--border)', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span>เลือก Payment Types สำหรับ Amount</span>
              {paymentSuggestLoading && (
                <span style={{ fontSize: '0.8rem', color: 'var(--blue)', fontWeight: 400, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <i className="fas fa-spinner fa-spin"></i> AI กำลังแนะนำ...
                </span>
              )}
            </div>
            <div className="mapping-modal-body" style={{ padding: '1rem', overflowY: 'auto' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'minmax(120px, 1fr) 1fr 1fr', gap: '1rem', fontWeight: 'bold', marginBottom: '1rem', paddingRight: '0.5rem' }}>
                <div>Payment Type</div>
                <div>Department Code</div>
                <div>Account Code</div>
              </div>
              {allPaymentTypes.map(type => {
                const pAmt = paymentAmount[type] || { dept: '', acc: '' };
                const isCustom = !PAYMENT_TYPES.includes(type);
                const suggestion = paymentSuggestions[type] || null;

                // Resolve robust option objects for topChoice (even if not in master)
                const deptFromMaster = suggestion?.dept ? masterDepartments.find(d => d.code === suggestion.dept) : null;
                const deptTopChoice = suggestion?.dept
                  ? {
                    code: suggestion.dept,
                    name: deptFromMaster?.name || '(รหัสจาก AI/ประวัติ)',
                    name2: deptFromMaster?.name2,
                    source: suggestion.source
                  }
                  : null;

                const accFromMaster = suggestion?.acc ? masterAccounts.find(a => a.code === suggestion.acc) : null;
                const accTopChoice = suggestion?.acc
                  ? {
                    code: suggestion.acc,
                    name: accFromMaster?.name || '(รหัสจาก AI/ประวัติ)',
                    name2: accFromMaster?.name2,
                    source: suggestion.source
                  }
                  : null;

                return (
                  <div key={type} style={{ display: 'grid', gridTemplateColumns: 'minmax(120px, 1fr) 1fr 1fr', gap: '1rem', marginBottom: '0.5rem', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <div style={{ background: isCustom ? '#f0fdf4' : 'var(--blue-light)', color: isCustom ? '#16a34a' : 'var(--blue)', padding: '0.4rem 0.5rem', borderRadius: '4px', border: `1px solid ${isCustom ? '#86efac' : 'var(--blue-mid)'}`, fontSize: '0.85rem', fontWeight: 600, textAlign: 'center', flex: 1 }}>
                        {type}
                      </div>
                      {isCustom && (
                        <button onClick={() => handleRemoveCustomType(type)} title="ลบ" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', fontSize: '0.9rem', padding: '0.2rem', lineHeight: 1 }}>
                          <i className="fas fa-times-circle"></i>
                        </button>
                      )}
                    </div>
                    <CustomSearchSelect
                      value={pAmt.dept}
                      onChange={(val) => handlePaymentMappingChange(type, 'dept', val)}
                      options={masterDepartments}
                      placeholder="Dept..."
                      topChoice={deptTopChoice?.code ? deptTopChoice : null}
                    />
                    <CustomSearchSelect
                      value={pAmt.acc}
                      onChange={(val) => handlePaymentMappingChange(type, 'acc', val)}
                      options={masterAccounts}
                      placeholder="Acc..."
                      topChoice={accTopChoice?.code ? accTopChoice : null}
                    />
                  </div>
                );
              })}
              {/* Add custom type row */}
              <div style={{ display: 'grid', gridTemplateColumns: 'minmax(120px, 1fr) 1fr 1fr', gap: '1rem', marginTop: '1rem', paddingTop: '1rem', borderTop: '1px dashed var(--border)', alignItems: 'center' }}>
                <div style={{ display: 'flex', gap: '0.4rem' }}>
                  <input
                    type="text"
                    value={newCustomType}
                    onChange={(e) => setNewCustomType(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAddCustomType()}
                    placeholder="Custom type..."
                    style={{ flex: 1, padding: '0.4rem 0.5rem', border: '1px solid var(--border)', borderRadius: '4px', fontSize: '0.85rem', fontFamily: "'DM Mono', monospace", textTransform: 'uppercase', outline: 'none' }}
                  />
                  <button onClick={handleAddCustomType} title="เพิ่ม" style={{ background: 'var(--blue)', color: '#fff', border: 'none', borderRadius: '4px', padding: '0.4rem 0.7rem', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600, whiteSpace: 'nowrap' }}>
                    <i className="fas fa-plus"></i> Add
                  </button>
                </div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-4)', gridColumn: 'span 2' }}>เพิ่ม Payment Type ที่กำหนดเอง</div>
              </div>
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
