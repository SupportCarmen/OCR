import { useState, useEffect, useRef } from 'react'
import DocumentPreview from '../components/ocr/DocumentPreview'
import CustomModal from '../components/common/CustomModal'
import StepWizard from '../components/common/StepWizard'

// ── AR Invoice Step Definitions ──────────────────────────────────
const AR_STEPS = [
  { n: 1, label: 'อัปโหลด',    sub: 'เอกสาร' },
  { n: 2, label: 'จับคู่',      sub: 'Field Mapping' },
  { n: 3, label: 'ตรวจสอบ',    sub: 'Review' },
  { n: 4, label: 'ผังบัญชี',   sub: 'Account' },
  { n: 5, label: 'สำเร็จ',     sub: 'Result' },
]

// ── Mock Vendor DB ───────────────────────────────────────────────
const mockVendorDB = {
  '0105555059298': { code: 'V-10023', name: 'บริษัท บี 47 เซอร์วิส จำกัด สำนักงานใหญ่' },
  '0105562202751': { code: 'V-10045', name: 'บริษัท คาร์เมน ซอฟต์แวร์ จำกัด' },
  '0105545000000': { code: 'V-10088', name: 'บริษัท ตัวอย่าง ซัพพลายเออร์ จำกัด' },
}
const vendorList = Object.entries(mockVendorDB).map(([taxId, d]) => ({ taxId, ...d }))

// ── i18n ─────────────────────────────────────────────────────────
const T = {
  th: {
    appTitle: 'Carmen ERP', appSub: 'AR Invoice OCR',
    uploadTitle: 'อัปโหลดเอกสารใบแจ้งหนี้',
    uploadDesc: 'รองรับไฟล์รูปภาพ JPG, PNG และ PDF (สูงสุด 20 MB)',
    uploadBtn: 'เลือกไฟล์เอกสาร',
    mapTitle: 'ตรวจสอบและจับคู่ Field (Field Mapping)',
    confirmMap: 'ยืนยัน Field Mapping',
    reviewTitle: 'ตรวจสอบข้อมูล (Review Data)',
    headerTitle: 'ข้อมูลทั่วไป (Header Info)',
    systemVendor: 'ข้อมูลผู้ขาย (ระบบ ERP)',
    vendorNotFound: 'ไม่พบในระบบ (ตรวจสอบ Tax ID)',
    vendorName: 'ชื่อผู้ขาย', vendorTaxId: 'เลขผู้เสียภาษี',
    vendorBranch: 'สาขา', docName: 'ประเภทเอกสาร',
    docNo: 'เลขที่เอกสาร', docDate: 'วันที่เอกสาร',
    subTotal: 'มูลค่าก่อนภาษี', discount: 'ส่วนลดรวม',
    tax: 'ภาษีมูลค่าเพิ่ม', grandTotal: 'ยอดรวมทั้งสิ้น',
    summaryAccount: 'รายการสรุปบัญชี', sumFromTable: 'ยอดจากตาราง',
    sumFromDoc: 'ยอดตามเอกสาร', adjust: 'Adjust',
    validOk: 'ยอดรวมบัญชีตรงกัน', validOkDesc: 'ข้อมูลยอดรวมตรงกัน 100%',
    validErr: 'พบข้อผิดพลาดด้านตัวเลข', validErrPrefix: 'ส่วนต่าง:',
    acctTitle: 'ผังบัญชี (Account Mapping)', aiSuggest: 'AI แนะนำบัญชี',
    debitTax: 'Debit — ภาษีซื้อ (Tax 1)', creditAp: 'Credit — เจ้าหนี้ (A/P)',
    debitExpense: 'Debit — ค่าใช้จ่าย (Expense)',
    taxProfile: 'Tax Profile', deptCode: 'Dept. Code',
    accountCode: 'Account Code', vendorGroup: 'Vendor Group',
    expenseDesc: 'จับคู่ผังบัญชีค่าใช้จ่ายตามรายการสินค้า',
    generateInv: 'Generate AR Invoice',
    successTitle: 'บันทึกข้อมูลสำเร็จ!',
    successDesc: 'AR Invoice เลขที่', successDesc2: 'ถูกสร้างและผูกผังบัญชีเรียบร้อยแล้ว',
    uploadNew: 'อัปโหลดเอกสารใหม่',
    ignore: 'ไม่นำเข้า (Ignore)',
    category: 'ประเภท (Account)', description: 'รายละเอียดสินค้า',
    qty: 'จำนวน', unitPrice: 'ราคา/หน่วย',
    discountPct: 'ส่วนลด%', discountAmt: 'มูลค่าส่วนลด',
    lineSubTotal: 'มูลค่าก่อนภาษี', taxPct: 'อัตราภาษี%',
    taxType: 'ประเภทภาษี', taxAmt: 'มูลค่าภาษี', lineTotal: 'รวม',
    backUpload: 'กลับ', backMap: 'กลับแก้ Mapping',
    backReview: 'กลับแก้ไข', processing: 'AI กำลังประมวลผล...',
    retry: 'ลองใหม่',
    searchVendor: 'ค้นหา รหัส หรือ ชื่อผู้ขาย...',
    searchDept: 'รหัส/ชื่อแผนก', searchAcc: 'รหัส/ชื่อบัญชี',
    warnMismatch: 'ยอดเงินไม่สัมพันธ์กัน — ดำเนินการต่อข้ามคำเตือนนี้?',
    errProcess: 'เกิดข้อผิดพลาดในการประมวลผล OCR กรุณาลองใหม่อีกครั้ง',
    itemCount: 'จำนวนรายการ', items: 'รายการ',
    tableTotal: 'ยอดรวมตาราง',
  },
  en: {
    appTitle: 'Carmen ERP', appSub: 'AR Invoice OCR',
    uploadTitle: 'Upload Invoice Document',
    uploadDesc: 'Supports JPG, PNG, and PDF files (max 20 MB)',
    uploadBtn: 'Select Document',
    mapTitle: 'Review and Field Mapping',
    confirmMap: 'Confirm Field Mapping',
    reviewTitle: 'Review Data',
    headerTitle: 'Header Info',
    systemVendor: 'System Vendor (ERP)',
    vendorNotFound: 'Not found in system (check Tax ID)',
    vendorName: 'Vendor Name', vendorTaxId: 'Tax ID',
    vendorBranch: 'Branch', docName: 'Document Type',
    docNo: 'Document No.', docDate: 'Document Date',
    subTotal: 'Sub Total', discount: 'Total Discount',
    tax: 'VAT Amount', grandTotal: 'Grand Total',
    summaryAccount: 'Account Summary', sumFromTable: 'From Table',
    sumFromDoc: 'From Document', adjust: 'Adjust',
    validOk: 'Totals matched', validOkDesc: 'Table and document totals are 100% synchronized.',
    validErr: 'Number mismatch', validErrPrefix: 'Difference:',
    acctTitle: 'Account Mapping', aiSuggest: 'AI Suggest',
    debitTax: 'Debit — Input Tax (Tax 1)', creditAp: 'Credit — Account Payable (A/P)',
    debitExpense: 'Debit — Expense',
    taxProfile: 'Tax Profile', deptCode: 'Dept. Code',
    accountCode: 'Account Code', vendorGroup: 'Vendor Group',
    expenseDesc: 'Map expense accounts based on extracted items',
    generateInv: 'Generate AR Invoice',
    successTitle: 'Saved Successfully!',
    successDesc: 'AR Invoice No.', successDesc2: 'has been created and mapped to ERP.',
    uploadNew: 'Upload New Document',
    ignore: 'Ignore',
    category: 'Category (Account)', description: 'Description',
    qty: 'Qty', unitPrice: 'Unit Price',
    discountPct: 'Discount%', discountAmt: 'Discount Amt',
    lineSubTotal: 'Line Sub Total', taxPct: 'Tax%',
    taxType: 'Tax Type', taxAmt: 'Tax Amount', lineTotal: 'Line Total',
    backUpload: 'Back', backMap: 'Back to Mapping',
    backReview: 'Back to Review', processing: 'AI is processing...',
    retry: 'Retry',
    searchVendor: 'Search by code or name...',
    searchDept: 'Dept code/name', searchAcc: 'Account code/name',
    warnMismatch: 'Totals do not match. Are you sure you want to proceed?',
    errProcess: 'OCR processing error. Please try again.',
    itemCount: 'Total Items', items: 'items',
    tableTotal: 'Table Total',
  },
}

// ── Helpers ──────────────────────────────────────────────────────
const parseNum = (v) => {
  if (typeof v === 'number') return v
  const n = Number(String(v || '').replace(/,/g, ''))
  return isNaN(n) ? 0 : n
}
const fmt = (v) => parseNum(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const round2 = (v) => Math.round(parseNum(v) * 100) / 100
const isNumFld = (f) => ['qty','unitPrice','discountPct','discountAmt','lineSubTotal','taxPct','taxAmt','lineTotal'].includes(f)

const EMPTY_HEADER = {
  vendorName:'', vendorTaxId:'', vendorBranch:'',
  documentName:'', documentDate:'', documentNumber:'',
  subTotal:'0.00', taxAmount:'0.00', totalDiscount:'0.00', grandTotal:'0.00',
}
const DEFAULT_MAPPINGS = {
  col1:'category', col2:'description', col3:'qty', col4:'unitPrice',
  col5:'discountPct', col6:'discountAmt', col7:'lineSubTotal',
  col8:'taxPct', col9:'taxType', col10:'taxAmt', col11:'lineTotal',
}

// ── Component ────────────────────────────────────────────────────
export default function ARInvoice() {
  const [lang, setLang] = useState('th')
  const t = T[lang]

  // Wizard state
  const [step, setStep] = useState(1)
  const [file, setFile] = useState(null)
  const [previewUrl, setPreviewUrl] = useState(null)
  const [previewType, setPreviewType] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  // Data state
  const [headerData, setHeaderData] = useState(EMPTY_HEADER)
  const [lineItems, setLineItems] = useState([])
  const [fieldMappings, setFieldMappings] = useState(DEFAULT_MAPPINGS)

  // Vendor search
  const [systemVendor, setSystemVendor] = useState({ code: '', name: '' })
  const [vendorSearch, setVendorSearch] = useState('')
  const [showVendorDrop, setShowVendorDrop] = useState(false)

  // Modal
  const [modal, setModal] = useState({ show: false })

  const fileInputRef = useRef(null)

  // Auto-match vendor by Tax ID
  useEffect(() => {
    if (showVendorDrop) return
    const raw = String(headerData.vendorTaxId).replace(/\D/g, '')
    if (mockVendorDB[raw]) {
      setSystemVendor(mockVendorDB[raw])
      setVendorSearch(`${mockVendorDB[raw].code} — ${mockVendorDB[raw].name}`)
    } else if (raw.length >= 10) {
      setSystemVendor({ code: '', name: t.vendorNotFound })
      setVendorSearch('')
    } else {
      setSystemVendor({ code: '', name: '' })
      setVendorSearch('')
    }
  }, [headerData.vendorTaxId, lang])

  const filteredVendors = vendorList.filter(v =>
    v.name.toLowerCase().includes(vendorSearch.toLowerCase()) ||
    v.code.toLowerCase().includes(vendorSearch.toLowerCase()) ||
    v.taxId.includes(vendorSearch)
  )

  // ── Computed totals ──
  const sumLineSubTotal = lineItems.reduce((s, i) => s + Math.round(parseNum(i.lineSubTotal) * 100), 0) / 100
  const sumLineTotal    = lineItems.reduce((s, i) => s + Math.round(parseNum(i.lineTotal) * 100), 0) / 100
  const sumDiscount     = lineItems.reduce((s, i) => s + Math.round(parseNum(i.discountAmt) * 100), 0) / 100
  const sumTax          = lineItems.reduce((s, i) => s + Math.round(parseNum(i.taxAmt) * 100), 0) / 100

  const tgtSubTotal  = round2(headerData.subTotal)
  const tgtDiscount  = round2(headerData.totalDiscount)
  const tgtTax       = round2(headerData.taxAmount)
  const tgtGrand     = round2(headerData.grandTotal)

  const isSubDiff  = sumLineSubTotal !== tgtSubTotal
  const isDiscDiff = sumDiscount !== tgtDiscount
  const isTaxDiff  = sumTax !== tgtTax
  const isGrandDiff = ((Math.round(sumLineSubTotal * 100) + Math.round(sumTax * 100)) / 100) !== tgtGrand

  const validationErrors = [
    isSubDiff  && t.subTotal,
    isDiscDiff && t.discount,
    isTaxDiff  && t.tax,
    isGrandDiff && t.grandTotal,
  ].filter(Boolean)
  const isValid = validationErrors.length === 0

  // ── Adjust helpers ──
  const adjustField = (tgt, sumCur, itemKey, adjustTotal = false, isDiscount = false) => {
    if (!lineItems.length) return
    const diff = (Math.round(tgt * 100) - Math.round(sumCur * 100)) / 100
    if (diff === 0) return
    const items = [...lineItems]
    const last = items.length - 1
    items[last][itemKey] = fmt((Math.round(round2(items[last][itemKey]) * 100) + Math.round(diff * 100)) / 100)
    if (adjustTotal) {
      const ltDiff = isDiscount ? -diff : diff
      items[last].lineTotal = fmt((Math.round(round2(items[last].lineTotal) * 100) + Math.round(ltDiff * 100)) / 100)
    }
    setLineItems(items)
  }

  // ── File upload & OCR ──
  const handleFileChange = (e) => {
    const f = e.target.files?.[0]
    if (!f) return
    setFile(f)
    const url = URL.createObjectURL(f)
    setPreviewUrl(url)
    setPreviewType(f.type === 'application/pdf' ? 'pdf' : 'image')
    runOCR(f)
  }

  const runOCR = async (fileObj) => {
    setLoading(true)
    setError(null)
    try {
      let retries = 3, delay = 800
      while (retries > 0) {
        try {
          const formData = new FormData()
          formData.append('file', fileObj)
          const res = await fetch('http://localhost:8010/api/v1/ar-invoice/extract', {
            method: 'POST',
            body: formData,
          })
          if (!res.ok) throw new Error(`HTTP ${res.status}`)
          const data = await res.json()
          
          const numFlds = ['qty','unitPrice','discountPct','discountAmt','lineSubTotal','taxPct','taxAmt','lineTotal']
          setHeaderData({
            vendorName: data.vendorName || '',
            vendorTaxId: data.vendorTaxId || '',
            vendorBranch: data.vendorBranch || '',
            documentName: data.documentName || '',
            documentDate: data.documentDate || '',
            documentNumber: data.documentNumber || '',
            subTotal: fmt(data.subTotal),
            taxAmount: fmt(data.taxAmount),
            totalDiscount: fmt(data.totalDiscount),
            grandTotal: fmt(data.grandTotal),
          })
          const formattedItems = (data.items || []).map(item => {
            const ni = { ...item, deptCode: '', accountCode: '' }
            numFlds.forEach(k => { if (ni[k] !== undefined && ni[k] !== '') ni[k] = fmt(ni[k]) })
            return ni
          })
          setLineItems(formattedItems)
          if (data.vendorTaxId) {
            const saved = localStorage.getItem(`ar_mapping_${data.vendorTaxId}`)
            if (saved) setFieldMappings(JSON.parse(saved))
          }
          setStep(2)
          return
        } catch (err) {
          retries--
          if (retries === 0) throw err
          await new Promise(r => setTimeout(r, delay))
          delay *= 2
        }
      }
    } catch (err) {
      console.error(err)
      setError(t.errProcess)
    } finally {
      setLoading(false)
    }
  }

  // ── Handlers ──
  const updateHeader = (key, val) => setHeaderData(p => ({ ...p, [key]: val }))
  const blurHeader   = (key, val) => { if (val) setHeaderData(p => ({ ...p, [key]: fmt(val) })) }
  const updateItem   = (idx, key, val) => { const items = [...lineItems]; items[idx][key] = val; setLineItems(items) }
  const blurItem     = (idx, key, val) => { if (val) { const items = [...lineItems]; items[idx][key] = fmt(val); setLineItems(items) } }

  const confirmMapping = () => {
    if (headerData.vendorTaxId) localStorage.setItem(`ar_mapping_${headerData.vendorTaxId}`, JSON.stringify(fieldMappings))
    setStep(3)
  }

  const goToAccount = () => {
    if (!isValid) {
      setModal({
        show: true, type: 'warning',
        title: 'ยอดเงินไม่ตรงกัน',
        message: t.warnMismatch,
        confirmText: 'ดำเนินการต่อ',
        cancelText: 'กลับแก้ไข',
        onConfirm: () => { setModal({ show: false }); setStep(4) },
        onCancel:  () => setModal({ show: false }),
      })
    } else {
      setStep(4)
    }
  }

  const handleAISuggest = () => {
    setLineItems(lineItems.map(item => {
      if (item.deptCode && item.accountCode) return item
      const cat = item.category || ''
      let dept = '000 — Head Office', acct = '5100-00 — General Expense'
      if (cat.match(/ยานพาหนะ|น้ำมัน|vehicle/i)) { acct = '5200-10 — Vehicle Expense'; dept = '200 — Admin Dept' }
      else if (cat.match(/ไอที|ซอฟต์แวร์|IT|software/i)) { acct = '5300-20 — IT Software'; dept = '300 — IT Dept' }
      else if (cat.match(/อาหาร|วัตถุดิบ|food/i)) { acct = '4100-00 — Cost of Food'; dept = '150 — F&B Dept' }
      return { ...item, deptCode: item.deptCode || dept, accountCode: item.accountCode || acct }
    }))
  }

  const handleGenerate = () => setStep(5)

  const handleReset = () => {
    setFile(null); setPreviewUrl(null); setPreviewType(null)
    setHeaderData(EMPTY_HEADER); setSystemVendor({ code: '', name: '' })
    setLineItems([]); setFieldMappings(DEFAULT_MAPPINGS); setStep(1)
  }

  // ── Available fields for mapping ──
  const availableFields = [
    { value: 'ignore',       label: t.ignore },
    { value: 'category',     label: t.category },
    { value: 'description',  label: t.description },
    { value: 'qty',          label: t.qty },
    { value: 'unitPrice',    label: t.unitPrice },
    { value: 'discountPct',  label: t.discountPct },
    { value: 'discountAmt',  label: t.discountAmt },
    { value: 'lineSubTotal', label: t.lineSubTotal },
    { value: 'taxPct',       label: t.taxPct },
    { value: 'taxType',      label: t.taxType },
    { value: 'taxAmt',       label: t.taxAmt },
    { value: 'lineTotal',    label: t.lineTotal },
  ]

  const activeCols = [1,2,3,4,5,6,7,8,9,10,11].filter(c => fieldMappings[`col${c}`] !== 'ignore')

  // ─────────────────────────────────────────────────────────────────
  return (
    <>
      <CustomModal
        show={modal.show}
        title={modal.title}
        message={modal.message}
        type={modal.type}
        confirmText={modal.confirmText}
        cancelText={modal.cancelText}
        onConfirm={modal.onConfirm}
        onCancel={modal.onCancel}
      />

      <div className="app-container" style={{ padding: '1.5rem' }}>

        {/* ── Header ── */}
        <div className="app-header ar-header">
          <div className="brand">
            <div className="logo-box"><i className="fas fa-receipt" /></div>
            <div>
              <h1>{t.appTitle}</h1>
              <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#7c3aed', letterSpacing: '0.08em', textTransform: 'uppercase', marginTop: '0.1rem' }}>
                {t.appSub}
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <button className="lang-toggle" onClick={() => setLang(l => l === 'th' ? 'en' : 'th')}>
              <i className="fas fa-globe" />
              {lang === 'th' ? 'EN' : 'TH'}
            </button>
            <a href="#/" className="btn btn-sm btn-outline">
              <i className="fas fa-arrow-left" /> กลับหน้าหลัก
            </a>
          </div>
        </div>

        {/* ── Step Wizard ── */}
        <StepWizard step={step} steps={AR_STEPS} />

        {/* ══ STEP 1 — UPLOAD ══════════════════════════════════════ */}
        {step === 1 && !loading && !error && (
          <div style={{ maxWidth: 560, margin: '0 auto' }}>
            <div
              className="panel-card upload-drop"
              style={{ minHeight: 260, cursor: 'pointer' }}
              onClick={() => fileInputRef.current?.click()}
              onDragOver={e => { e.preventDefault() }}
              onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleFileChange({ target: { files: [f] } }) }}
            >
              <input type="file" ref={fileInputRef} accept="image/*,application/pdf" onChange={handleFileChange} style={{ display: 'none' }} />
              <div className="upload-icon"><i className="fas fa-cloud-upload-alt" /></div>
              <div className="upload-label">{t.uploadTitle}</div>
              <div className="upload-hint">{t.uploadDesc}</div>
              <button
                className="btn btn-primary"
                style={{ marginTop: '1.5rem' }}
                onClick={e => { e.stopPropagation(); fileInputRef.current?.click() }}
              >
                <i className="fas fa-folder-open" /> {t.uploadBtn}
              </button>
            </div>

            <div className="panel-card" style={{ marginTop: '1rem' }}>
              <div className="field-label"><i className="fas fa-circle-info" /> วิธีใช้งาน AR Invoice OCR</div>
              <div className="how-to-list">
                {[
                  { n: 1, c: 'gold', text: 'อัปโหลดไฟล์ใบแจ้งหนี้ (JPG, PNG, PDF)' },
                  { n: 2, c: 'gold', text: 'ตรวจสอบ Field Mapping ให้ตรงกับตารางในเอกสาร' },
                  { n: 3, c: 'teal', text: 'ตรวจสอบข้อมูล Header และยอดเงิน' },
                  { n: 4, c: 'teal', text: 'ผูกผังบัญชีแต่ละรายการ แล้วกด Generate Invoice' },
                ].map(({ n, c, text }) => (
                  <div key={n} className="how-to-item">
                    <div className={`how-step-num ${c}`}>{n}</div>
                    <span>{text}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── Loading ── */}
        {loading && (
          <div className="ar-loading">
            <div className="ar-spinner" />
            <div style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text)' }}>{t.processing}</div>
            <div style={{ fontSize: '0.82rem', color: 'var(--text-3)' }}>Gemini AI กำลังวิเคราะห์โครงสร้างเอกสาร</div>
          </div>
        )}

        {/* ── Error ── */}
        {error && (
          <div style={{ maxWidth: 480, margin: '0 auto', padding: '2rem 0' }}>
            <div className="ar-error-box">
              <i className="fas fa-circle-exclamation" />
              <div>
                <div className="ar-error-title">OCR Processing Error</div>
                <div className="ar-error-msg">{error}</div>
                <button className="btn btn-sm btn-outline" style={{ marginTop: '0.75rem' }} onClick={() => setError(null)}>
                  <i className="fas fa-rotate-right" /> {t.retry}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ══ STEP 2 & 3 — Split Layout (Preview + Work Area) ═════ */}
        {(step === 2 || step === 3) && previewUrl && !loading && (
          <div className="ar-split-layout">
            {/* Left — Document Preview */}
            <DocumentPreview previewUrl={previewUrl} previewType={previewType} fileName={file?.name} />

            {/* Right — Work Area */}
            <div className="ar-work-area">

              {/* ── STEP 2 — Field Mapping ── */}
              {step === 2 && (
                <div className="data-card">
                  <div className="card-title">
                    <div className="card-title-left">
                      <i className="fas fa-sliders" />
                      {t.mapTitle}
                    </div>
                  </div>
                  <div className="card-body-flush">
                    <div className="mapping-table-wrap" style={{ padding: '1rem' }}>
                      <table className="mapping-table">
                        <thead>
                          <tr>
                            {[1,2,3,4,5,6,7,8,9,10,11].map(c => {
                              const val = fieldMappings[`col${c}`]
                              return (
                                <th key={c}>
                                  <div className="col-label">Column {c}</div>
                                  <select
                                    value={val}
                                    onChange={e => setFieldMappings(p => ({ ...p, [`col${c}`]: e.target.value }))}
                                    className={val === 'ignore' ? 'ignored' : 'mapped'}
                                  >
                                    {availableFields.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                                  </select>
                                </th>
                              )
                            })}
                          </tr>
                        </thead>
                        <tbody>
                          {lineItems.slice(0, 3).map((item, ri) => (
                            <tr key={ri}>
                              {[1,2,3,4,5,6,7,8,9,10,11].map(c => {
                                const fld = fieldMappings[`col${c}`]
                                const ignored = fld === 'ignore'
                                const numeric = isNumFld(fld)
                                return (
                                  <td key={c} className={ignored ? 'is-ignored' : numeric ? 'is-numeric' : ''}>
                                    {ignored ? '(ละเว้น)' : (numeric && item[fld] !== undefined ? fmt(item[fld]) : (item[fld] || '—'))}
                                  </td>
                                )
                              })}
                            </tr>
                          ))}
                          {lineItems.length > 3 && (
                            <tr>
                              <td colSpan={11} style={{ textAlign: 'center', color: 'var(--text-4)', fontStyle: 'italic', fontSize: '0.8rem', padding: '0.75rem' }}>
                                … ดูเพิ่มอีก {lineItems.length - 3} รายการในขั้นตอนถัดไป
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                  <div className="ar-step-nav">
                    <button className="btn btn-outline" onClick={() => setStep(1)}>
                      <i className="fas fa-arrow-left" /> {t.backUpload}
                    </button>
                    <button className="btn btn-primary" onClick={confirmMapping}>
                      {t.confirmMap} <i className="fas fa-arrow-right" />
                    </button>
                  </div>
                </div>
              )}

              {/* ── STEP 3 — Review ── */}
              {step === 3 && (
                <>
                  {/* Header Info */}
                  <div className="data-card">
                    <div className="card-title">
                      <div className="card-title-left">
                        <i className="fas fa-building" />
                        {t.headerTitle}
                      </div>
                    </div>
                    <div className="card-body">
                      {/* Vendor Search */}
                      <div className="vendor-search-wrap">
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.6rem' }}>
                          <div className="field-label" style={{ marginBottom: 0 }}>
                            <i className="fas fa-user-tie" /> {t.systemVendor}
                          </div>
                          <span className={`vendor-badge ${systemVendor.code ? 'mapped' : 'unmapped'}`}>
                            <i className={`fas fa-${systemVendor.code ? 'circle-check' : 'triangle-exclamation'}`} />
                            {systemVendor.code ? 'Mapped' : 'Unmapped'}
                          </span>
                        </div>
                        <div className="vendor-search-input-wrap">
                          <i className="fas fa-magnifying-glass" />
                          <input
                            type="text"
                            className={`vendor-search-input ${systemVendor.code ? 'matched' : ''}`}
                            placeholder={t.searchVendor}
                            value={vendorSearch}
                            onChange={e => { setVendorSearch(e.target.value); setShowVendorDrop(true); if (!e.target.value) setSystemVendor({ code: '', name: '' }) }}
                            onFocus={() => setShowVendorDrop(true)}
                            onBlur={() => setTimeout(() => setShowVendorDrop(false), 180)}
                          />
                        </div>
                        {showVendorDrop && (
                          <div className="vendor-dropdown">
                            {filteredVendors.length > 0 ? filteredVendors.map(v => (
                              <div key={v.taxId} className="vendor-dropdown-item"
                                onMouseDown={() => { setSystemVendor({ code: v.code, name: v.name }); setVendorSearch(`${v.code} — ${v.name}`); setShowVendorDrop(false) }}
                              >
                                <div className="vd-name">{v.code} — {v.name}</div>
                                <div className="vd-tax">Tax ID: {v.taxId}</div>
                              </div>
                            )) : (
                              <div style={{ padding: '0.75rem 1rem', fontSize: '0.83rem', color: 'var(--text-4)', textAlign: 'center' }}>ไม่พบข้อมูลผู้ขาย</div>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Header fields */}
                      <div className="header-form">
                        {[
                          { key: 'vendorName',      label: t.vendorName },
                          { key: 'vendorTaxId',     label: t.vendorTaxId },
                          { key: 'vendorBranch',    label: t.vendorBranch },
                          { key: 'documentName',    label: t.docName },
                          { key: 'documentNumber',  label: t.docNo },
                          { key: 'documentDate',    label: t.docDate },
                        ].map(({ key, label }) => (
                          <div key={key} className="form-field">
                            <label>{label}</label>
                            <input
                              type="text"
                              value={headerData[key]}
                              onChange={e => updateHeader(key, e.target.value)}
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Line Items Table */}
                  <div className="data-card">
                    <div className="card-title">
                      <div className="card-title-left">
                        <i className="fas fa-table-list" />
                        {t.reviewTitle}
                      </div>
                      <span className="row-count">{lineItems.length} รายการ</span>
                    </div>
                    <div className="table-wrapper">
                      <table className="ar-review-table">
                        <thead>
                          <tr>
                            {activeCols.map(c => (
                              <th key={c}>{availableFields.find(f => f.value === fieldMappings[`col${c}`])?.label}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {lineItems.map((item, ri) => (
                            <tr key={ri}>
                              {activeCols.map(c => {
                                const fld = fieldMappings[`col${c}`]
                                const numeric = isNumFld(fld)
                                return (
                                  <td key={c}>
                                    <input
                                      type="text"
                                      className={`ar-edit-input ${numeric ? 'numeric' : ''} ${fld === 'category' ? 'category' : ''}`}
                                      value={item[fld] || ''}
                                      onChange={e => updateItem(ri, fld, e.target.value)}
                                      onBlur={e => numeric && blurItem(ri, fld, e.target.value)}
                                    />
                                  </td>
                                )
                              })}
                            </tr>
                          ))}
                        </tbody>
                        <tfoot>
                          <tr>
                            {activeCols.map((c, i) => {
                              const fld = fieldMappings[`col${c}`]
                              if (i === 0) return <td key="lbl" style={{ color: 'var(--text-3)' }}>{t.tableTotal}</td>
                              if (fld === 'lineSubTotal') return <td key="st" style={{ textAlign: 'right', color: 'var(--emerald)' }}>{fmt(sumLineSubTotal)}</td>
                              if (fld === 'lineTotal')    return <td key="lt" style={{ textAlign: 'right', color: 'var(--rose)', fontWeight: 800 }}>{fmt(sumLineTotal)}</td>
                              if (fld === 'discountAmt')  return <td key="da" style={{ textAlign: 'right' }}>{fmt(sumDiscount)}</td>
                              if (fld === 'taxAmt')       return <td key="ta" style={{ textAlign: 'right' }}>{fmt(sumTax)}</td>
                              return <td key={`e${c}`} />
                            })}
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </div>

                  {/* Validation + Summary */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                    {/* Validation banner */}
                    <div className={isValid ? 'ar-valid-ok' : 'ar-valid-err'}>
                      <i className={`fas fa-${isValid ? 'circle-check' : 'circle-exclamation'}`} style={{ fontSize: '1.3rem', flexShrink: 0 }} />
                      <div>
                        <div style={{ fontWeight: 700 }}>{isValid ? t.validOk : t.validErr}</div>
                        <div style={{ fontSize: '0.8rem', marginTop: '0.2rem', fontWeight: 400 }}>
                          {isValid ? t.validOkDesc : `${t.validErrPrefix} ${validationErrors.join(', ')}`}
                        </div>
                      </div>
                    </div>

                    {/* Summary card */}
                    <div className="data-card">
                      <div className="card-title">
                        <div className="card-title-left">
                          <i className="fas fa-calculator" />
                          {t.summaryAccount}
                        </div>
                        <div style={{ display: 'flex', gap: '0.4rem' }}>
                          <span style={{ fontSize: '0.68rem', fontWeight: 700, padding: '0.15rem 0.5rem', background: 'var(--emerald-light)', color: 'var(--emerald)', borderRadius: 4 }}>{t.sumFromTable}</span>
                          <span style={{ fontSize: '0.68rem', fontWeight: 700, padding: '0.15rem 0.5rem', background: 'var(--primary-light)', color: 'var(--primary)', borderRadius: 4 }}>{t.sumFromDoc}</span>
                        </div>
                      </div>
                      <div className="card-body">
                        {/* Sub Total */}
                        <div className="ar-summary-row">
                          <span className="ar-summary-label">{t.subTotal}</span>
                          <div className="ar-summary-values">
                            {isSubDiff && <button className="ar-adjust-btn" onClick={() => adjustField(tgtSubTotal, sumLineSubTotal, 'lineSubTotal', true)}><i className="fas fa-arrows-rotate" /> {t.adjust}</button>}
                            <span className={`ar-sum-from-table ${isSubDiff ? 'diff' : ''}`}>{fmt(sumLineSubTotal)}</span>
                            <input className={`ar-sum-from-doc ${isSubDiff ? 'diff' : ''}`} value={headerData.subTotal} onChange={e => updateHeader('subTotal', e.target.value)} onBlur={e => blurHeader('subTotal', e.target.value)} />
                          </div>
                        </div>
                        {/* Discount */}
                        <div className="ar-summary-row">
                          <span className="ar-summary-label">{t.discount}</span>
                          <div className="ar-summary-values">
                            {isDiscDiff && <button className="ar-adjust-btn" onClick={() => adjustField(tgtDiscount, sumDiscount, 'discountAmt', true, true)}><i className="fas fa-arrows-rotate" /> {t.adjust}</button>}
                            <span className={`ar-sum-from-table ${isDiscDiff ? 'diff' : ''}`} style={{ color: isDiscDiff ? undefined : 'var(--rose)' }}>{fmt(sumDiscount)}</span>
                            <input className={`ar-sum-from-doc ${isDiscDiff ? 'diff' : ''}`} value={headerData.totalDiscount} onChange={e => updateHeader('totalDiscount', e.target.value)} onBlur={e => blurHeader('totalDiscount', e.target.value)} />
                          </div>
                        </div>
                        {/* Tax */}
                        <div className="ar-summary-row">
                          <span className="ar-summary-label">{t.tax}</span>
                          <div className="ar-summary-values">
                            {isTaxDiff && <button className="ar-adjust-btn" onClick={() => adjustField(tgtTax, sumTax, 'taxAmt', true)}><i className="fas fa-arrows-rotate" /> {t.adjust}</button>}
                            <span className={`ar-sum-from-table ${isTaxDiff ? 'diff' : ''}`}>{fmt(sumTax)}</span>
                            <input className={`ar-sum-from-doc ${isTaxDiff ? 'diff' : ''}`} value={headerData.taxAmount} onChange={e => updateHeader('taxAmount', e.target.value)} onBlur={e => blurHeader('taxAmount', e.target.value)} />
                          </div>
                        </div>
                        {/* Grand Total */}
                        <div className="ar-grand-total-row">
                          <span style={{ fontWeight: 800, fontSize: '1rem' }}>{t.grandTotal}</span>
                          <div className="ar-summary-values">
                            <span style={{ fontFamily: 'IBM Plex Mono', fontWeight: 800, fontSize: '1rem', color: isGrandDiff ? 'var(--rose)' : 'var(--text)' }}>
                              {fmt((Math.round(sumLineSubTotal * 100) + Math.round(sumTax * 100)) / 100)}
                            </span>
                            <input className={`ar-sum-from-doc ${isGrandDiff ? 'diff' : ''}`} style={{ fontSize: '0.95rem', fontWeight: 800 }} value={headerData.grandTotal} onChange={e => updateHeader('grandTotal', e.target.value)} onBlur={e => blurHeader('grandTotal', e.target.value)} />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Step 3 Nav */}
                  <div className="ar-step-nav">
                    <button className="btn btn-outline" onClick={() => setStep(2)}>
                      <i className="fas fa-arrow-left" /> {t.backMap}
                    </button>
                    <button className={`btn ${isValid ? 'btn-primary' : 'btn-success'}`} onClick={goToAccount}>
                      {isValid ? 'ดำเนินการต่อ' : 'ดำเนินการต่อ (ข้ามคำเตือน)'}
                      <i className="fas fa-arrow-right" />
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* ══ STEP 4 — Account Mapping (Full Width) ═══════════════ */}
        {step === 4 && (
          <div style={{ maxWidth: 1080, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

            {/* Fixed GL accounts (Tax + AP) */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>
              {/* Debit Tax */}
              <div className="ar-account-card">
                <div className="ar-account-card-header">
                  <div className="ar-account-icon blue"><i className="fas fa-database" /></div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '0.87rem', color: 'var(--text)' }}>{t.debitTax}</div>
                  </div>
                </div>
                <div className="ar-account-body">
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '0.6rem' }}>
                    <div>
                      <div className="field-label" style={{ marginBottom: '0.3rem' }}>{t.taxProfile}</div>
                      <div className="ar-static-field">VAT 7%</div>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem' }}>
                      <div>
                        <div className="field-label" style={{ marginBottom: '0.3rem' }}>{t.deptCode}</div>
                        <div className="ar-static-field">000 — Head Office</div>
                      </div>
                      <div>
                        <div className="field-label" style={{ marginBottom: '0.3rem' }}>{t.accountCode}</div>
                        <div className="ar-static-field" style={{ color: 'var(--primary)', fontWeight: 700 }}>1154-00 — Input VAT</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Credit A/P */}
              <div className="ar-account-card">
                <div className="ar-account-card-header">
                  <div className="ar-account-icon green"><i className="fas fa-database" /></div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '0.87rem', color: 'var(--text)' }}>{t.creditAp}</div>
                  </div>
                </div>
                <div className="ar-account-body">
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '0.6rem' }}>
                    <div>
                      <div className="field-label" style={{ marginBottom: '0.3rem' }}>{t.vendorGroup}</div>
                      <div className="ar-static-field">Trade Payable</div>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem' }}>
                      <div>
                        <div className="field-label" style={{ marginBottom: '0.3rem' }}>{t.deptCode}</div>
                        <div className="ar-static-field">000 — Head Office</div>
                      </div>
                      <div>
                        <div className="field-label" style={{ marginBottom: '0.3rem' }}>{t.accountCode}</div>
                        <div className="ar-static-field" style={{ color: 'var(--emerald)', fontWeight: 700 }}>2111-00 — A/P Trade</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
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
                  <button className="btn btn-sm btn-primary" style={{ background: 'linear-gradient(135deg, #7c3aed, #6d28d9)' }} onClick={handleAISuggest}>
                    <i className="fas fa-wand-magic-sparkles" /> {t.aiSuggest}
                  </button>
                </div>
              </div>
              <div className="table-wrapper">
                <table className="ar-acct-table">
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
                        <td><span className="ar-acct-table cat-badge">{item.category || '—'}</span></td>
                        <td style={{ fontSize: '0.83rem', color: 'var(--text-2)' }}>{item.description || '—'}</td>
                        <td>
                          <div className="ar-search-input-wrap">
                            <i className="fas fa-magnifying-glass" />
                            <input placeholder={t.searchDept} value={item.deptCode || ''} onChange={e => updateItem(ri, 'deptCode', e.target.value)} />
                          </div>
                        </td>
                        <td>
                          <div className="ar-search-input-wrap">
                            <i className="fas fa-magnifying-glass" />
                            <input placeholder={t.searchAcc} value={item.accountCode || ''} onChange={e => updateItem(ri, 'accountCode', e.target.value)} />
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Step 4 nav */}
            <div className="ar-step-nav">
              <button className="btn btn-outline" onClick={() => setStep(3)}>
                <i className="fas fa-arrow-left" /> {t.backReview}
              </button>
              <button className="btn btn-success" onClick={handleGenerate}>
                <i className="fas fa-floppy-disk" /> {t.generateInv}
              </button>
            </div>
          </div>
        )}

        {/* ══ STEP 5 — Result ══════════════════════════════════════ */}
        {step === 5 && (
          <div style={{ padding: '2rem 0' }}>
            <div className="ar-success-wrap">
              <div className="ar-success-icon">
                <i className="fas fa-circle-check" />
              </div>
              <h2 style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text)', marginBottom: '0.75rem' }}>{t.successTitle}</h2>
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
                  <div className="ar-success-field-val" style={{ color: 'var(--primary)', fontWeight: 700 }}>{lineItems.length} {t.items}</div>
                </div>
                <div style={{ gridRow: 'span 2', background: 'white', border: '1px solid var(--border)', borderRadius: 8, padding: '1rem' }}>
                  {[
                    { label: t.subTotal, val: fmt(headerData.subTotal), color: undefined },
                    { label: t.discount, val: fmt(headerData.totalDiscount), color: 'var(--rose)' },
                    { label: t.tax,      val: fmt(headerData.taxAmount), color: undefined },
                  ].map(({ label, val, color }) => (
                    <div key={label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.83rem', marginBottom: '0.4rem' }}>
                      <span style={{ color: 'var(--text-3)' }}>{label}:</span>
                      <span style={{ fontFamily: 'IBM Plex Mono', fontWeight: 600, color: color || 'var(--text)' }}>{val}</span>
                    </div>
                  ))}
                  <div style={{ height: 1, background: 'var(--border)', margin: '0.6rem 0' }} />
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontWeight: 800 }}>{t.grandTotal}</span>
                    <span style={{ fontFamily: 'IBM Plex Mono', fontWeight: 800, color: 'var(--emerald)', fontSize: '1.05rem' }}>{fmt(headerData.grandTotal)}</span>
                  </div>
                </div>
              </div>

              <button className="btn btn-primary" style={{ margin: '0 auto' }} onClick={handleReset}>
                <i className="fas fa-rotate-right" /> {t.uploadNew}
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  )
}
