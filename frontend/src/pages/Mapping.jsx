import React, { useState, useEffect, useRef } from 'react';
import ReactDOM from 'react-dom';
import { fetchAccountCodes, fetchDepartments, fetchGLPrefixes } from '../lib/api/carmen';
import { suggestMapping, suggestPaymentTypes, saveMappingHistory } from '../lib/api/mapping';
import CustomModal from '../components/CustomModal';
import './Mapping.css';

// ─── CUSTOM SEARCH SELECT ───
// topChoice: { code, name, name2?, source: 'ai'|'history' } | null
function CustomSearchSelect({ value, onChange, options, placeholder, topChoice, suggestedValue }) {
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

  const selectedOption = value ? options.find(o => o.code === value) : null;
  const selectedDesc = selectedOption
    ? [selectedOption.name, selectedOption.name2].filter(Boolean).join(' · ')
    : null;

  const isAISuggested = !isOpen && !!suggestedValue;
  const displayValue = isOpen ? searchTerm : (isAISuggested ? suggestedValue : value || '');

  return (
    <div ref={wrapperRef} style={{ position: 'relative', width: '100%' }}>
      <input
        type="text"
        placeholder={placeholder}
        value={displayValue}
        onFocus={() => { setIsOpen(true); setSearchTerm(''); }}
        onChange={(e) => setSearchTerm(e.target.value)}
        title={isAISuggested ? `AI แนะนำ: ${suggestedValue}` : value && selectedDesc ? `${value} — ${selectedDesc}` : ''}
        style={{ width: '100%', padding: '0.5rem 0.65rem', border: `1px solid ${isAISuggested ? '#c4b5fd' : 'var(--border)'}`, borderBottomColor: isOpen ? 'var(--blue)' : isAISuggested ? '#c4b5fd' : 'var(--border)', borderRadius: '6px', fontSize: '0.85rem', outline: 'none', transition: 'all 0.2s', fontFamily: "'DM Mono', monospace", background: isAISuggested ? '#f5f3ff' : 'white', color: isAISuggested ? '#6d28d9' : 'inherit' }}
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


const OCR_BANK_MAP = {
  BBL: 'Bangkok Bank (BBL)',
  KBANK: 'Kasikornbank (KBANK)',
  SCB: 'Siam Commercial Bank (SCB)',
};

export default function Mapping() {
  const [masterAccounts, setMasterAccounts] = useState([]);
  const [masterDepartments, setMasterDepartments] = useState([]);
  const [masterGLPrefixes, setMasterGLPrefixes] = useState([]);
  const [loadingOpts, setLoadingOpts] = useState(true);

  const [bank, setBank] = useState('');
  const [filePrefix, setFilePrefix] = useState('');
  const [fileSource, setFileSource] = useState('');
  const [description, setDescription] = useState('');

  const [company, setCompany] = useState({ name: '', taxId: '', branch: '', address: '' });


  const [mappings, setMappings] = useState({
    commission: { dept: '', acc: '' },
    tax: { dept: '', acc: '' },
    net: { dept: '', acc: '' }
  });

  const [paymentAmount, setPaymentAmount] = useState({});

  const [customPaymentTypes, setCustomPaymentTypes] = useState([]);
  const [newCustomType, setNewCustomType] = useState('');

  const [isAmountModalOpen, setIsAmountModalOpen] = useState(false);
  const [activeScan, setActiveScan] = useState({ paymentTypes: new Set(), commission: false, tax: false, net: false });
  const [modalConfig, setModalConfig] = useState({ show: false, title: '', message: '', type: 'info' });
  const [saving, setSaving] = useState(false);
  const [acceptAllModal, setAcceptAllModal] = useState(false);

  // AI / History suggestion state
  const [suggestionMeta, setSuggestionMeta] = useState({ commission: null, tax: null, net: null }); // null | 'history' | 'ai'
  const [mainSuggestions, setMainSuggestions] = useState({ commission: null, tax: null, net: null }); // { dept, acc, source }
  const [suggestLoading, setSuggestLoading] = useState(false);
  // { [paymentType]: { dept: string|null, acc: string|null, source: 'history'|'ai' } }
  const [paymentSuggestions, setPaymentSuggestions] = useState({});
  const [paymentSuggestLoading, setPaymentSuggestLoading] = useState(false);

  // Auto-suggest: history first, then AI — only when fields are empty
  const autoSuggest = async (accounts, departments) => {
    if (!accounts.length) return;

    // Only fetch for fields that don't have mappings yet
    const fieldsToFetch = ['commission', 'tax', 'net'].filter(f =>
      !mappings[f] || (!mappings[f].dept && !mappings[f].acc)
    );

    if (fieldsToFetch.length === 0) {
      setModalConfig({
        show: true,
        title: '✓ ทำการ Mapping หมดแล้ว',
        message: 'ทุกค่าได้รับการ Mapping เรียบร้อยแล้ว สามารถดำเนินการขั้นตอนถัดไปได้',
        type: 'success'
      });
      return;
    }

    setSuggestLoading(true);
    let fromAI = {};

    try {
      const aiResult = await suggestMapping({
        accounts: accounts.map(a => ({ code: a.code, name: a.name, type: a.type })),
        departments: departments.map(d => ({ code: d.code, name: d.name })),
      });

      const suggestKeyMap = { commission: 'Commission', tax: 'Tax Amount', net: 'Net Amount' };
      console.log('[Mapping] AI Result suggestions:', aiResult.suggestions);
      fieldsToFetch.forEach(f => {
        const s = (aiResult.suggestions || {})[suggestKeyMap[f]] || {};
        console.log(`[Mapping] Processing ${f} (key="${suggestKeyMap[f]}")`, s);
        if (s.dept || s.acc) {
          fromAI[f] = { dept: s.dept || '', acc: s.acc || '' };
        }
      });
      console.log('[Mapping] fromAI after processing:', fromAI);
      if (Object.keys(fromAI).length > 0) {
        // Store suggestions for pre-fill display only — values committed when user confirms
        setMainSuggestions(prev => {
          const next = { ...prev };
          Object.entries(fromAI).forEach(([k, v]) => {
            const existing = next[k] || {};
            next[k] = {
              dept: v.dept || existing.dept || '',
              acc: v.acc || existing.acc || '',
              source: 'ai'
            };
          });
          return next;
        });
        setSuggestionMeta(prev => {
          const next = { ...prev };
          Object.keys(fromAI).forEach(k => { next[k] = 'ai'; });
          return next;
        });
      }
    } catch (err) {
      console.error('[Mapping] AI suggest failed:', err);
    } finally {
      setSuggestLoading(false);
    }
  };

  const confirmMainSuggestion = (key) => {
    console.log(`[Mapping] User confirmed suggestion for ${key}`);
    const suggestion = mainSuggestions[key];
    if (suggestion) {
      setMappings(prev => ({
        ...prev,
        [key]: { dept: suggestion.dept || '', acc: suggestion.acc || '' }
      }));
    }
    setMainSuggestions(prev => ({ ...prev, [key]: null }));
    setSuggestionMeta(prev => ({ ...prev, [key]: null }));
  };

  const rejectMainSuggestion = (key) => {
    console.log(`[Mapping] User rejected suggestion for ${key}`);
    setMainSuggestions(prev => ({ ...prev, [key]: null }));
    setSuggestionMeta(prev => ({ ...prev, [key]: null }));
  };

  const confirmPaymentSuggestion = (type) => {
    console.log(`[Mapping] User confirmed suggestion for payment type: ${type}`);
    const suggestion = paymentSuggestions[type];
    if (suggestion) {
      setPaymentAmount(prev => ({
        ...prev,
        [type]: { dept: suggestion.dept || '', acc: suggestion.acc || '' }
      }));
    }
    setPaymentSuggestions(prev => ({ ...prev, [type]: null }));
  };

  const rejectPaymentSuggestion = (type) => {
    console.log(`[Mapping] User rejected suggestion for payment type: ${type}`);
    setPaymentSuggestions(prev => ({ ...prev, [type]: null }));
  };

  const handleAcceptAll = () => {
    // Accept all pending main suggestions (commission / tax / net)
    setMappings(prev => {
      const next = { ...prev };
      ['commission', 'tax', 'net'].forEach(key => {
        const s = mainSuggestions[key];
        if (s) next[key] = { dept: s.dept || '', acc: s.acc || '' };
      });
      return next;
    });
    setMainSuggestions({ commission: null, tax: null, net: null });
    setSuggestionMeta({ commission: null, tax: null, net: null });

    // Accept all pending payment type suggestions
    setPaymentAmount(prev => {
      const next = { ...prev };
      Object.entries(paymentSuggestions).forEach(([type, s]) => {
        if (s) next[type] = { dept: s.dept || '', acc: s.acc || '' };
      });
      return next;
    });
    setPaymentSuggestions({});

    setAcceptAllModal(false);
  };

  const autoSuggestPaymentTypes = async (accounts, departments, specificTypes = null) => {
    if (!accounts.length) return;
    setPaymentSuggestLoading(true);

    const allTypes = specificTypes || [...activeScan.paymentTypes, ...customPaymentTypes];

    // Only suggest for payment types that don't have mappings yet
    const needsAI = allTypes.filter(t =>
      !paymentAmount[t] || (!paymentAmount[t].dept && !paymentAmount[t].acc)
    );

    if (needsAI.length === 0) {
      console.log('[Mapping] All payment types already mapped');
      setPaymentSuggestLoading(false);
      setModalConfig({
        show: true,
        title: '✓ ทำการ Mapping หมดแล้ว',
        message: 'Payment Types ทั้งหมดได้รับการ Mapping เรียบร้อยแล้ว',
        type: 'success'
      });
      return;
    }

    const newSuggestions = {};

    try {
      const result = await suggestPaymentTypes({
        payment_types: needsAI,
        accounts: accounts.map(a => ({ code: a.code, name: a.name, type: a.type })),
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

    // Store suggestions for pre-fill display only — values committed when user confirms
    setPaymentSuggestions(prev => ({ ...prev, ...newSuggestions }));
    setPaymentSuggestLoading(false);
  };

  const loadInitialData = async () => {
    setLoadingOpts(true);
    try {
      const [accResult, deptResult] = await Promise.all([
        fetchAccountCodes(),
        fetchDepartments(),
      ]);

      const mappedAcc = accResult
        .filter(a => a.AccCode && a.AccCode !== 'AccCode')
        .map(a => ({ code: a.AccCode, name: a.Description, name2: a.Description2, nature: a.Nature, type: a.Type }));

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

    // GL prefixes are optional — load separately so failures don't block the main data
    try {
      const prefixResult = await fetchGLPrefixes();
      const mappedPrefixes = prefixResult
        .filter(p => p.PrefixName)
        .map(p => ({ code: p.PrefixName, name: p.Description }));
      setMasterGLPrefixes(mappedPrefixes);
    } catch (err) {
      console.warn("GL prefix load failed (non-critical):", err);
    }
  };

  // Load from LocalStorage and APIs on mount
  useEffect(() => {
    loadInitialData();

    // OCR state — bank detected during scan + company info extracted from document
    let ocrBank = '';
    let ocrCompany = {};
    try {
      const ocrState = JSON.parse(localStorage.getItem('ocr_wizard_state') || '{}');
      ocrBank = OCR_BANK_MAP[ocrState.bank] || '';

      // Update active scan info — Identify what's in the current document
      if (ocrState.details && Array.isArray(ocrState.details)) {
        const types = new Set();
        let comm = false, tx = false, n = false;
        const toNum = (v) => parseFloat(String(v ?? '').replace(/,/g, '')) || 0;
        
        ocrState.details.forEach(d => {
          if (d.Transaction) types.add(d.Transaction);
          if (toNum(d.CommisAmt) > 0) comm = true;
          if (toNum(d.TaxAmt) > 0) tx = true;
          if (toNum(d.Total) > 0) n = true;
        });
        setActiveScan({ paymentTypes: types, commission: comm, tax: tx, net: n });
      }

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
        setDescription(parsed.description || '');
        
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
          savedCustomTypes.forEach(type => {
            if (!newState[type]) newState[type] = { dept: '', acc: '' };
          });
          return newState;
        });
      } catch (e) { }
    }
  }, []);

  const saveAllSettings = async (shouldClose = false) => {
    if (saving) return
    if (missingCompanyFields.length > 0) {
      setModalConfig({
        show: true,
        title: 'กรุณากรอกข้อมูลให้ครบ',
        message: `กรุณากรอก ${missingCompanyFields.map(f => f.label).join(', ')} ก่อนบันทึก`,
        type: 'error'
      });
      return;
    }

    setSaving(true);
    try {
      const config = { bank, filePrefix, fileSource, description, company, mappings, paymentAmount };
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
    } finally {
      setSaving(false);
    }
  };

  const saveAmountSelection = () => {
    localStorage.setItem('accountMappingAmount', JSON.stringify({ ...paymentAmount, __customTypes: customPaymentTypes }));
    setIsAmountModalOpen(false);
  };

  const handleAddCustomType = () => {
    const trimmed = newCustomType.trim().toUpperCase();
    if (!trimmed || activeScan.paymentTypes.has(trimmed) || customPaymentTypes.includes(trimmed)) return;
    setCustomPaymentTypes(prev => [...prev, trimmed]);
    setPaymentAmount(prev => ({ ...prev, [trimmed]: { dept: '', acc: '' } }));
    setNewCustomType('');

    // Trigger suggestion for the newly added custom type
    if (masterAccounts.length && masterDepartments.length) {
      autoSuggestPaymentTypes(masterAccounts, masterDepartments, [trimmed]);
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

  const allPaymentTypes = [...activeScan.paymentTypes, ...customPaymentTypes.filter(t => !activeScan.paymentTypes.has(t))];
  const requiredMissingCount = [...activeScan.paymentTypes].filter(t => !paymentAmount[t]?.dept || !paymentAmount[t]?.acc).length;
  const amountMappedCount = allPaymentTypes.filter(t => paymentAmount[t]?.dept && paymentAmount[t]?.acc).length;

  const companyRequiredFields = [
    { key: 'name',    label: 'Company Name' },
    { key: 'taxId',   label: 'Tax ID' },
    { key: 'branch',  label: 'Branch No' },
    { key: 'address', label: 'Address' },
  ];
  const missingCompanyFields = companyRequiredFields.filter(f => !company[f.key]?.trim());

  return (
    <>
      <CustomModal
        show={modalConfig.show}
        title={modalConfig.title}
        message={modalConfig.message}
        type={modalConfig.type}
        onConfirm={() => setModalConfig({ ...modalConfig, show: false })}
      />
      <CustomModal
        show={acceptAllModal}
        title="ยืนยัน Accept All"
        message="AI อาจแนะนำรหัสบัญชีผิดพลาดได้ คุณได้ตรวจสอบรายการทั้งหมดแล้วใช่ไหม?"
        type="warning"
        confirmText="ยืนยัน ยอมรับทั้งหมด"
        cancelText="ยกเลิก"
        onConfirm={handleAcceptAll}
        onCancel={() => setAcceptAllModal(false)}
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
            <CustomSearchSelect
              value={filePrefix}
              onChange={(code) => setFilePrefix(code)}
              options={masterGLPrefixes}
              placeholder={loadingOpts ? 'กำลังโหลด...' : 'เลือกคำนำหน้าไฟล์...'}
            />

            <label>File Source</label>
            <input type="text" placeholder="ระบุแหล่งที่มาไฟล์ (เช่น Email, Drive)" value={fileSource} onChange={(e) => setFileSource(e.target.value)} />

            <label>Description</label>
            <input type="text" placeholder="รายละเอียดเพิ่มเติม" value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
        </div>

        {/* Company Information */}
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
                <>
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
                </>
              );
            })}
          </div>
        </div>

        {/* Account Code Mapping */}
        <div className="section">
          <div className="section-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <span>ACCOUNT CODE MAPPING {loadingOpts && <span style={{ marginLeft: '10px', fontSize: '0.8rem', color: 'var(--blue)' }}><i className="fas fa-spinner fa-spin"></i> กำลังโหลดรหัสบัญชี...</span>}</span>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
              {(Object.values(mainSuggestions).some(s => s) || Object.values(paymentSuggestions).some(s => s)) && (
                <button
                  onClick={() => setAcceptAllModal(true)}
                  style={{ padding: '0.4rem 0.8rem', background: '#d97706', border: 'none', borderRadius: '6px', fontSize: '0.8rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'white', fontWeight: 500 }}
                >
                  <i className="fas fa-check-double"></i> Accept All
                </button>
              )}
              <button
                onClick={() => autoSuggest(masterAccounts, masterDepartments)}
                disabled={masterAccounts.length === 0 || masterDepartments.length === 0 || loadingOpts || suggestLoading}
                title={masterAccounts.length === 0 ? 'Loading account codes...' : masterDepartments.length === 0 ? 'Loading departments...' : suggestLoading ? 'Suggesting...' : 'Click to get AI suggestions'}
                style={{ padding: '0.4rem 0.8rem', background: (masterAccounts.length === 0 || masterDepartments.length === 0 || loadingOpts || suggestLoading) ? '#f0f0f0' : 'var(--blue)', border: 'none', borderRadius: '6px', fontSize: '0.8rem', cursor: (masterAccounts.length === 0 || masterDepartments.length === 0 || loadingOpts || suggestLoading) ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', color: (masterAccounts.length === 0 || masterDepartments.length === 0 || loadingOpts || suggestLoading) ? '#999' : 'white', fontWeight: 500 }}
              >
                <i className={`fas fa-magic ${suggestLoading ? 'fa-spin' : ''}`}></i> AI Suggest
              </button>
              <button onClick={loadInitialData} disabled={loadingOpts} style={{ padding: '0.4rem 0.8rem', background: 'white', border: '1px solid var(--border)', borderRadius: '6px', fontSize: '0.8rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--text-2)' }}>
                <i className={`fas fa-sync-alt ${loadingOpts ? 'fa-spin' : ''}`}></i> Refresh
              </button>
            </div>
          </div>

          <div className="mapping-container" style={{ display: 'grid', gridTemplateColumns: '95px 150px 1fr 1fr auto', gap: '1rem', alignItems: 'center' }}>
            <div></div>
            <div></div>
            <div className="mapping-header" style={{ fontWeight: 600 }}>Department Code</div>
            <div className="mapping-header" style={{ fontWeight: 600 }}>Account Code</div>
            <div></div>

            {/* Amount */}
            <div className="mapping-type type-credit" style={{ color: 'var(--blue)', background: 'var(--blue-light)', padding: '0.2rem 0.5rem', borderRadius: '4px', textAlign: 'center', fontWeight: 'bold' }}>Credit</div>
            <div className="mapping-label clickable" style={{ cursor: 'pointer', color: 'var(--blue)', textDecoration: 'underline' }} onClick={() => setIsAmountModalOpen(true)}>Amount (Click to Map)</div>
             <div style={{ gridColumn: 'span 3' }}>
              <div id="amountMappingStatus" style={{
                fontSize: '0.85rem',
                padding: '0.7rem 1rem',
                borderRadius: '8px',
                border: '1px solid',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                color: requiredMissingCount > 0 ? '#dc2626' : 'var(--teal)',
                background: requiredMissingCount > 0 ? '#fff1f2' : 'var(--teal-light)',
                borderColor: requiredMissingCount > 0 ? '#fca5a5' : 'var(--teal)'
              }}>
                <div>
                  {requiredMissingCount > 0
                    ? <><i className="fas fa-exclamation-triangle" style={{ color: '#dc2626' }}></i> <strong>พบ {activeScan.paymentTypes.size} รายการในเอกสาร</strong> (ค้าง Mapping <strong>{requiredMissingCount}</strong> รายการ)</>
                    : amountMappedCount > 0
                      ? <><i className="fas fa-check-circle"></i> ตั้งค่าแล้ว {amountMappedCount}/{allPaymentTypes.length} รายการ (เรียบร้อย)</>
                      : <><i className="fas fa-info-circle"></i> กดที่ชื่อ Amount เพื่อเปิด Modal / ปุ่ม Suggest เพื่อให้ AI แนะนำ</>
                  }
                </div>
                {requiredMissingCount > 0 && <span style={{ fontSize: '0.75rem', background: '#dc2626', color: 'white', padding: '2px 8px', borderRadius: '10px', fontWeight: 'bold' }}>Required for this scan</span>}
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
                  <div className="mapping-type type-debit" style={natureStyle}>Debit</div>
                  <div className="mapping-label" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span>{labelMap[key]}</span>
                    {badge && (
                      <span style={{ fontSize: '0.75rem', color: badge.color, background: badge.bg, padding: '3px 8px', borderRadius: '4px', border: `1px solid ${badge.border}`, fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        <i className={`fas ${badge.icon}`}></i> {badge.label}
                      </span>
                    )}
                  </div>
                  <div>
                    <CustomSearchSelect
                      value={mappings[key].dept}
                      onChange={(val) => handleMappingChange(key, 'dept', val)}
                      options={masterDepartments}
                      placeholder="พิมพ์ Dept. Code..."
                      topChoice={deptTopChoice?.code ? deptTopChoice : null}
                      suggestedValue={suggestion?.dept || null}
                    />
                  </div>
                  <div>
                    <CustomSearchSelect
                      value={mappings[key].acc}
                      onChange={(val) => handleMappingChange(key, 'acc', val)}
                      options={masterAccounts}
                      placeholder="พิมพ์ Account Code..."
                      topChoice={accTopChoice?.code ? accTopChoice : null}
                      suggestedValue={suggestion?.acc || null}
                    />
                  </div>
                  <div style={{ display: 'flex', gap: '0.3rem' }}>
                    {badge && (
                      <>
                        <button
                          onClick={() => confirmMainSuggestion(key)}
                          title="ยอมรับค่าแนะนำ"
                          style={{ padding: '4px 10px', background: '#f0fdf4', color: '#15803d', border: '1px solid #86efac', borderRadius: '6px', cursor: 'pointer', fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: '0.3rem', fontWeight: 600 }}
                        >
                          <i className="fas fa-check"></i>
                        </button>
                        <button
                          onClick={() => rejectMainSuggestion(key)}
                          title="ปฏิเสธค่าแนะนำและล้างข้อมูล"
                          style={{ padding: '4px 10px', background: '#fff1f2', color: '#dc2626', border: '1px solid #fecaca', borderRadius: '6px', cursor: 'pointer', fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: '0.3rem', fontWeight: 600 }}
                        >
                          <i className="fas fa-times"></i>
                        </button>
                      </>
                    )}
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
            disabled={saving}
            style={{
              width: '100%',
              padding: '1.2rem',
              background: saving ? '#5eaca3' : 'var(--teal)',
              color: '#fff',
              borderRadius: '12px',
              cursor: saving ? 'not-allowed' : 'pointer',
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
            <i className={`fas ${saving ? 'fa-spinner fa-spin' : 'fa-check-circle'}`} style={{ fontSize: '1.2rem' }}></i>
            {saving ? 'กำลังบันทึก...' : 'บันทึกและปิดหน้าต่าง'}
          </button>
        </div>

      </div>

      {/* Amount Modal - rendered via Portal to escape container stacking context */}
      {isAmountModalOpen && ReactDOM.createPortal(
        <div className="mapping-modal" style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => { setPaymentSuggestions({}); setIsAmountModalOpen(false); }}>
          <div className="mapping-modal-overlay" style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(0, 0, 0, 0.5)' }}></div>
          <div className="mapping-modal-content" style={{ position: 'relative', zIndex: 1, backgroundColor: '#fff', width: '90%', maxWidth: '800px', borderRadius: '8px', display: 'flex', flexDirection: 'column', maxHeight: '90vh' }} onClick={(e) => e.stopPropagation()}>
             <div className="mapping-modal-header" style={{ padding: '1rem', borderBottom: '1px solid var(--border)', fontWeight: 'bold', display: 'flex', flexDirection: 'column', gap: '0.75rem', backgroundColor: '#f8fafc', borderTopLeftRadius: '8px', borderTopRightRadius: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', justifyContent: 'space-between' }}>
                <span>เลือก Payment Types สำหรับ Amount</span>
                {activeScan.paymentTypes.size > 0 && (
                  <span style={{ fontSize: '0.8rem', color: '#dc2626', background: '#fff', padding: '4px 12px', borderRadius: '20px', border: '1px solid #fca5a5', fontWeight: 700 }}>
                    <i className="fas fa-file-invoice"></i> เอกสารชุดนี้ต้องมี: {activeScan.paymentTypes.size} รายการ
                  </span>
                )}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button
                    onClick={() => autoSuggestPaymentTypes(masterAccounts, masterDepartments)}
                    disabled={loadingOpts || paymentSuggestLoading}
                    style={{ padding: '0.4rem 0.8rem', background: paymentSuggestLoading ? '#f0f0f0' : 'var(--blue)', border: 'none', borderRadius: '6px', fontSize: '0.8rem', cursor: paymentSuggestLoading ? 'wait' : 'pointer', display: 'flex', alignItems: 'center', gap: '0.4rem', color: paymentSuggestLoading ? '#999' : 'white', fontWeight: 500 }}
                  >
                    <i className={`fas fa-magic ${paymentSuggestLoading ? 'fa-spin' : ''}`}></i> AI Suggest
                  </button>
                  {Object.values(paymentSuggestions).some(s => s) && (
                    <button
                      onClick={() => setAcceptAllModal(true)}
                      style={{ padding: '0.4rem 0.8rem', background: '#d97706', border: 'none', borderRadius: '6px', fontSize: '0.8rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'white', fontWeight: 500 }}
                    >
                      <i className="fas fa-check-double"></i> Accept All
                    </button>
                  )}
                </div>
                <span style={{ fontSize: '0.85rem', color: 'var(--text-3)', fontWeight: 500 }}>
                  ({amountMappedCount}/{allPaymentTypes.length} mapped)
                </span>
              </div>
            </div>
            <div className="mapping-modal-body" style={{ padding: '1rem', overflowY: 'auto' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'minmax(120px, 1fr) 1fr 1fr auto', gap: '1rem', fontWeight: 'bold', marginBottom: '1rem', paddingRight: '0.5rem' }}>
                <div>Payment Type</div>
                <div>Department Code</div>
                <div>Account Code</div>
                <div></div>
              </div>
               {/* ── Required for Scan ── */}
              {activeScan.paymentTypes.size > 0 && (
                <>
                  <div style={{ padding: '0.5rem', background: '#fef2f2', color: '#991b1b', fontSize: '0.75rem', fontWeight: 700, borderRadius: '4px', marginBottom: '0.75rem', border: '1px solid #fecaca', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <i className="fas fa-exclamation-circle"></i> รายการที่พบในเอกสารปัจจุบัน (Required for this scan)
                  </div>
                  {[...activeScan.paymentTypes].map(type => {
                    const pAmt = paymentAmount[type] || { dept: '', acc: '' };
                    const suggestion = paymentSuggestions[type] || null;
                    const isPending = !pAmt.dept || !pAmt.acc;

                    // Resolve option objects for topChoice
                    const deptFromMaster = suggestion?.dept ? masterDepartments.find(d => d.code === suggestion.dept) : null;
                    const deptTopChoice = suggestion?.dept ? { code: suggestion.dept, name: deptFromMaster?.name || '(AI)', name2: deptFromMaster?.name2, source: suggestion.source } : null;
                    const accFromMaster = suggestion?.acc ? masterAccounts.find(a => a.code === suggestion.acc) : null;
                    const accTopChoice = suggestion?.acc ? { code: suggestion.acc, name: accFromMaster?.name || '(AI)', name2: accFromMaster?.name2, source: suggestion.source } : null;

                    return (
                      <div key={`req-${type}`} style={{
                        display: 'grid', gridTemplateColumns: 'minmax(120px, 1fr) 1fr 1fr auto', gap: '1rem', marginBottom: '0.5rem', alignItems: 'center', padding: '0.4rem', borderRadius: '8px',
                        background: isPending ? '#fff1f2' : '#f0fdf4', border: `1px solid ${isPending ? '#fecaca' : '#bbf7d0'}`
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                          <div style={{ background: isPending ? '#dc2626' : '#16a34a', color: '#fff', padding: '0.4rem 0.5rem', borderRadius: '4px', fontSize: '0.85rem', fontWeight: 600, textAlign: 'center', flex: 1 }}>{type}</div>
                          {isPending && <i className="fas fa-exclamation-triangle" style={{ color: '#dc2626' }} title="MISSING MAPPING"></i>}
                        </div>
                        <CustomSearchSelect value={pAmt.dept} onChange={(val) => handlePaymentMappingChange(type, 'dept', val)} options={masterDepartments} placeholder="Dept..." topChoice={deptTopChoice} suggestedValue={suggestion?.dept || null} />
                        <CustomSearchSelect value={pAmt.acc} onChange={(val) => handlePaymentMappingChange(type, 'acc', val)} options={masterAccounts} placeholder="Acc..." topChoice={accTopChoice} suggestedValue={suggestion?.acc || null} />
                        {suggestion && (
                          <div style={{ display: 'flex', gap: '0.3rem' }}>
                            <button
                              onClick={() => confirmPaymentSuggestion(type)}
                              title="ยอมรับค่าแนะนำ"
                              style={{ padding: '4px 10px', background: '#f0fdf4', color: '#15803d', border: '1px solid #86efac', borderRadius: '6px', cursor: 'pointer', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.3rem', fontWeight: 600 }}
                            >
                              <i className="fas fa-check"></i>
                            </button>
                            <button
                              onClick={() => rejectPaymentSuggestion(type)}
                              title="ปฏิเสธค่าแนะนำและล้างข้อมูล"
                              style={{ padding: '4px 10px', background: '#fff1f2', color: '#dc2626', border: '1px solid #fecaca', borderRadius: '6px', cursor: 'pointer', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.3rem', fontWeight: 600 }}
                            >
                              <i className="fas fa-times"></i>
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                  {customPaymentTypes.filter(t => !activeScan.paymentTypes.has(t)).length > 0 && (
                    <div style={{ margin: '1.5rem 0 1rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.5rem', fontSize: '0.75rem', fontWeight: 700, color: 'var(--gray-400)' }}>
                      Custom Types (เพิ่มเอง)
                    </div>
                  )}
                </>
              )}

              {allPaymentTypes
                .filter(t => !activeScan.paymentTypes.has(t))
                .map(type => {
                const pAmt = paymentAmount[type] || { dept: '', acc: '' };
                const isCustom = !activeScan.paymentTypes.has(type);
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
                  <div key={type} style={{
                    display: 'grid',
                    gridTemplateColumns: 'minmax(120px, 1fr) 1fr 1fr auto',
                    gap: '1rem',
                    marginBottom: '0.5rem',
                    alignItems: 'center',
                    padding: '0.4rem',
                    borderRadius: '8px',
                    background: 'transparent',
                    border: '1px solid transparent',
                    transition: 'all 0.2s'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <div style={{
                        background: isCustom ? '#f0fdf4' : 'var(--blue-light)',
                        color: isCustom ? '#16a34a' : 'var(--blue)',
                        padding: '0.4rem 0.5rem',
                        borderRadius: '4px',
                        border: `1px solid ${isCustom ? '#86efac' : 'var(--blue-mid)'}`,
                        fontSize: '0.85rem',
                        fontWeight: 600,
                        textAlign: 'center',
                        flex: 1,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px'
                      }}>
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
                      suggestedValue={suggestion?.dept || null}
                    />
                    <CustomSearchSelect
                      value={pAmt.acc}
                      onChange={(val) => handlePaymentMappingChange(type, 'acc', val)}
                      options={masterAccounts}
                      placeholder="Acc..."
                      topChoice={accTopChoice?.code ? accTopChoice : null}
                      suggestedValue={suggestion?.acc || null}
                    />
                    {suggestion && (
                      <div style={{ display: 'flex', gap: '0.3rem' }}>
                        <button
                          onClick={() => confirmPaymentSuggestion(type)}
                          title="ยอมรับค่าแนะนำ"
                          style={{ padding: '4px 10px', background: '#f0fdf4', color: '#15803d', border: '1px solid #86efac', borderRadius: '6px', cursor: 'pointer', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.3rem', fontWeight: 600 }}
                        >
                          <i className="fas fa-check"></i>
                        </button>
                        <button
                          onClick={() => rejectPaymentSuggestion(type)}
                          title="ปฏิเสธค่าแนะนำและล้างข้อมูล"
                          style={{ padding: '4px 10px', background: '#fff1f2', color: '#dc2626', border: '1px solid #fecaca', borderRadius: '6px', cursor: 'pointer', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.3rem', fontWeight: 600 }}
                        >
                          <i className="fas fa-times"></i>
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
              {/* Add custom type row */}
              <div style={{ display: 'grid', gridTemplateColumns: 'minmax(120px, 1fr) 1fr 1fr auto', gap: '1rem', marginTop: '1rem', paddingTop: '1rem', borderTop: '1px dashed var(--border)', alignItems: 'center' }}>
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
              <button className="btn-cancel" onClick={() => { setPaymentSuggestions({}); setIsAmountModalOpen(false); }} style={{ padding: '0.5rem 1rem', background: 'var(--gray-300)', borderRadius: '4px', cursor: 'pointer', border: 'none' }}>ยกเลิก</button>
              <button className="btn-confirm" onClick={saveAmountSelection} style={{ padding: '0.5rem 1rem', background: 'var(--blue)', color: '#fff', borderRadius: '4px', cursor: 'pointer', border: 'none' }}>ตกลง</button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
