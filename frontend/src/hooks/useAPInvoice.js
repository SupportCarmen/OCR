import { useState, useEffect, useRef } from 'react'
import {
  MOCK_VENDOR_DB, VENDOR_LIST, EMPTY_HEADER, DEFAULT_MAPPINGS,
  fmt, round2, isNumFld, getAvailableFields, AP_I18N,
} from '../constants/apInvoice'
import { parseNum } from '../constants/apInvoice'

export function useAPInvoice() {
  const [lang, setLang] = useState('th')
  const t = AP_I18N[lang]

  const [step, setStep] = useState(1)
  const [file, setFile] = useState(null)
  const [previewUrl, setPreviewUrl] = useState(null)
  const [previewType, setPreviewType] = useState(null)
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState('')
  const [error, setError] = useState(null)

  const [headerData, setHeaderData] = useState(EMPTY_HEADER)
  const [lineItems, setLineItems] = useState([])
  const [fieldMappings, setFieldMappings] = useState(DEFAULT_MAPPINGS)

  const [systemVendor, setSystemVendor] = useState({ code: '', name: '' })
  const [vendorSearch, setVendorSearch] = useState('')
  const [showVendorDrop, setShowVendorDrop] = useState(false)

  const [modal, setModal] = useState({ show: false })

  const fileInputRef = useRef(null)

  useEffect(() => {
    if (showVendorDrop) return
    const raw = String(headerData.vendorTaxId).replace(/\D/g, '')
    if (MOCK_VENDOR_DB[raw]) {
      setSystemVendor(MOCK_VENDOR_DB[raw])
      setVendorSearch(`${MOCK_VENDOR_DB[raw].code} — ${MOCK_VENDOR_DB[raw].name}`)
    } else if (raw.length >= 10) {
      setSystemVendor({ code: '', name: t.vendorNotFound })
      setVendorSearch('')
    } else {
      setSystemVendor({ code: '', name: '' })
      setVendorSearch('')
    }
  }, [headerData.vendorTaxId, lang])

  const filteredVendors = VENDOR_LIST.filter(v =>
    v.name.toLowerCase().includes(vendorSearch.toLowerCase()) ||
    v.code.toLowerCase().includes(vendorSearch.toLowerCase()) ||
    v.taxId.includes(vendorSearch)
  )

  // Computed totals
  const sumLineSubTotal = lineItems.reduce((s, i) => s + Math.round(parseNum(i.lineSubTotal) * 100), 0) / 100
  const sumLineTotal    = lineItems.reduce((s, i) => s + Math.round(parseNum(i.lineTotal) * 100), 0) / 100
  const sumDiscount     = lineItems.reduce((s, i) => s + Math.round(parseNum(i.discountAmt) * 100), 0) / 100
  const sumTax          = lineItems.reduce((s, i) => s + Math.round(parseNum(i.taxAmt) * 100), 0) / 100

  const tgtSubTotal = round2(headerData.subTotal)
  const tgtDiscount = round2(headerData.totalDiscount)
  const tgtTax      = round2(headerData.taxAmount)
  const tgtGrand    = round2(headerData.grandTotal)

  const isInclude = headerData.taxType === 'Include'

  const isSubDiff   = sumLineSubTotal !== tgtSubTotal
  const isDiscDiff  = sumDiscount !== tgtDiscount
  const isTaxDiff   = sumTax !== tgtTax
  const calcGrandFromLines = isInclude
    ? (Math.round(sumLineSubTotal * 100) - Math.round(sumDiscount * 100)) / 100
    : (Math.round(sumLineSubTotal * 100) - Math.round(sumDiscount * 100) + Math.round(sumTax * 100)) / 100
  const isGrandDiff = calcGrandFromLines !== tgtGrand

  const validationErrors = [
    isSubDiff  && t.subTotal,
    isDiscDiff && t.discount,
    isTaxDiff  && t.tax,
    isGrandDiff && t.grandTotal,
  ].filter(Boolean)
  const isValid = validationErrors.length === 0

  const availableFields = getAvailableFields(t)
  const activeCols = [1,2,3,4,5,6,7,8,9,10,11].filter(c => fieldMappings[`col${c}`] !== 'ignore')

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

  const handleFileChange = (e) => {
    const f = e.target.files?.[0]
    if (!f) return
    setFile(f)
    setPreviewUrl(URL.createObjectURL(f))
    setPreviewType(f.type === 'application/pdf' ? 'pdf' : 'image')
    runOCR(f)
  }

  const runOCR = async (fileObj) => {
    setLoading(true)
    setStatus('AI กำลังอ่านข้อมูลจากเอกสาร...')
    setError(null)
    try {
      let retries = 3, delay = 800
      while (retries > 0) {
        try {
          const formData = new FormData()
          formData.append('file', fileObj)
          const res = await fetch('/api/v1/ap-invoice/extract', { method: 'POST', body: formData })
          if (!res.ok) throw new Error(`HTTP ${res.status}`)
          const data = await res.json()

          setHeaderData({
            vendorName:     data.vendorName     || '',
            vendorTaxId:    data.vendorTaxId    || '',
            vendorBranch:   data.vendorBranch   || '',
            documentName:   data.documentName   || '',
            documentDate:   data.documentDate   || '',
            documentNumber: data.documentNumber || '',
            taxType:        data.taxType        || '',
            subTotal:       fmt(data.subTotal),
            taxAmount:      fmt(data.taxAmount),
            totalDiscount:  fmt(data.totalDiscount),
            grandTotal:     fmt(data.grandTotal),
          })

          const formattedItems = (data.items || []).map(item => {
            const ni = { ...item, deptCode: '', accountCode: '' }
            Object.keys(ni).forEach(k => {
              if (isNumFld(k) && ni[k] !== undefined && ni[k] !== '') ni[k] = fmt(ni[k])
            })
            return ni
          })
          setLineItems(formattedItems)

          if (data.vendorTaxId) {
            const saved = localStorage.getItem(`ap_mapping_${data.vendorTaxId}`)
            if (saved) setFieldMappings(JSON.parse(saved))
          }
          setStatus('อ่านข้อมูลสำเร็จ ✓')
          setStep(2)
          return
        } catch (err) {
          retries--
          if (retries === 0) throw err
          setStatus('กำลังลองใหม่...')
          await new Promise(r => setTimeout(r, delay))
          delay *= 2
        }
      }
    } catch (err) {
      console.error(err)
      setStatus(err.message)
      setError(t.errProcess)
    } finally {
      setLoading(false)
    }
  }

  const updateHeader = (key, val) => setHeaderData(p => ({ ...p, [key]: val }))
  const blurHeader   = (key, val) => { if (val) setHeaderData(p => ({ ...p, [key]: fmt(val) })) }
  const updateItem   = (idx, key, val) => setLineItems(items => items.map((r, i) => i === idx ? { ...r, [key]: val } : r))
  const blurItem     = (idx, key, val) => { if (val) setLineItems(items => items.map((r, i) => i === idx ? { ...r, [key]: fmt(val) } : r)) }

  const confirmMapping = () => {
    if (headerData.vendorTaxId) {
      localStorage.setItem(`ap_mapping_${headerData.vendorTaxId}`, JSON.stringify(fieldMappings))
    }
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
      if      (cat.match(/ยานพาหนะ|น้ำมัน|vehicle/i))       { acct = '5200-10 — Vehicle Expense'; dept = '200 — Admin Dept' }
      else if (cat.match(/ไอที|ซอฟต์แวร์|IT|software/i))    { acct = '5300-20 — IT Software';     dept = '300 — IT Dept' }
      else if (cat.match(/อาหาร|วัตถุดิบ|food/i))            { acct = '4100-00 — Cost of Food';    dept = '150 — F&B Dept' }
      return { ...item, deptCode: item.deptCode || dept, accountCode: item.accountCode || acct }
    }))
  }

  const handleReset = () => {
    setFile(null); setPreviewUrl(null); setPreviewType(null)
    setHeaderData(EMPTY_HEADER); setSystemVendor({ code: '', name: '' })
    setLineItems([]); setFieldMappings(DEFAULT_MAPPINGS); setStep(1)
  }

  return {
    // i18n
    lang, setLang, t,
    // Wizard
    step, setStep,
    // File & preview
    file, previewUrl, previewType, fileInputRef,
    loading, status, error, setError,
    // Data
    headerData, lineItems, fieldMappings, setFieldMappings,
    // Vendor search
    systemVendor, vendorSearch, setVendorSearch,
    showVendorDrop, setShowVendorDrop, filteredVendors,
    // Modal
    modal, setModal,
    // Computed totals & diffs
    sumLineSubTotal, sumLineTotal, sumDiscount, sumTax,
    tgtSubTotal, tgtDiscount, tgtTax, tgtGrand,
    isSubDiff, isDiscDiff, isTaxDiff, isGrandDiff,
    isInclude, calcGrandFromLines,
    validationErrors, isValid,
    availableFields, activeCols,
    // Handlers
    handleFileChange,
    updateHeader, blurHeader,
    updateItem, blurItem,
    confirmMapping, goToAccount,
    handleAISuggest, handleReset,
    adjustField,
  }
}
