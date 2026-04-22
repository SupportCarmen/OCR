import { useState, useEffect, useRef } from 'react'
import {
  EMPTY_HEADER, DEFAULT_MAPPINGS,
  fmt, round2, isNumFld, getAvailableFields, AP_I18N,
} from '../constants/apInvoice'
import { parseNum } from '../constants/apInvoice'
import { fetchAccountCodes, fetchDepartments } from '../lib/api/carmen'

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
  const [vendors, setVendors] = useState([])
  const [vendorDbByTax, setVendorDbByTax] = useState({})

  const [suggestLoading, setSuggestLoading] = useState(false)
  const [masterAccounts, setMasterAccounts] = useState([])
  const [masterDepts, setMasterDepts] = useState([])
  const [glLoaded, setGlLoaded] = useState(false)
  const [modal, setModal] = useState({ show: false })

  const fileInputRef = useRef(null)

  useEffect(() => {
    fetch('/api/v1/ocr/carmen/vendors')
      .then(r => r.json())
      .then(data => {
        const list = (data.Data || []).map(v => ({
          code:            v.VnCode          || '',
          name:            v.VnName          || '',
          taxId:           String(v.VnTaxNo  || '').replace(/\D/g, ''),
          active:          v.Active,
          catCode:         v.VnCateCode,
          catDesc:         v.VnCateDesc,
          vat1DrAccCode:   v.VnVat1DrAccCode,
          vat1DrAccDesc:   v.VnVat1DrAccDesc,
          vat1DrDeptCode:  v.VnVat1DrDeptCode,
          vat1DrDeptDesc:  v.VnVat1DrDeptDesc,
          vatCrAccCode:    v.VnVatCrAccCode,
          vatCrAccDesc:    v.VnVatCrAccDesc,
          crDeptCode:      v.VnCrDeptCode,
          crDeptDesc:      v.VnCrDeptDesc,
          taxProfileCode1: v.TaxProfileCode1,
          taxProfileDesc1: v.TaxProfileDesc1,
          branchNo:        v.BranchNo,
        }))
        setVendors(list)
        const db = {}
        list.forEach(v => { if (v.taxId) db[v.taxId] = v })
        setVendorDbByTax(db)
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (step !== 4 || glLoaded) return
    setGlLoaded(true)
    Promise.all([fetchAccountCodes(), fetchDepartments()])
      .then(([accs, depts]) => {
        setMasterAccounts(
          accs.filter(a => a.AccCode && a.AccCode !== 'AccCode')
              .map(a => ({ code: a.AccCode, name: a.Description || '', name2: a.Description2 || '' }))
        )
        setMasterDepts(
          depts.filter(d => d.DeptCode && d.DeptCode !== 'CodeDep')
               .map(d => ({ code: d.DeptCode, name: d.Description || '', name2: d.Description2 || '' }))
        )
      })
      .catch(() => {})
  }, [step])

  useEffect(() => {
    if (showVendorDrop) return
    const raw = String(headerData.vendorTaxId).replace(/\D/g, '')
    const found = vendorDbByTax[raw]
    if (found) {
      setSystemVendor(found)
      setVendorSearch(`${found.code} — ${found.name}`)
    } else if (raw.length >= 10) {
      setSystemVendor({ code: '', name: t.vendorNotFound })
      setVendorSearch('')
    } else {
      setSystemVendor({ code: '', name: '' })
      setVendorSearch('')
    }
  }, [headerData.vendorTaxId, lang, vendorDbByTax])

  const filteredVendors = vendors.filter(v => {
    const q = vendorSearch.toLowerCase()
    return (
      v.name.toLowerCase().includes(q) ||
      v.code.toLowerCase().includes(q) ||
      v.taxId.includes(vendorSearch) ||
      String(v.branchNo || '').includes(vendorSearch)
    )
  })

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
  const calcGrandFromLines = sumLineTotal
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
  const updateItem   = (idx, key, val) => setLineItems(items => items.map((r, i) => {
    if (i !== idx) return r
    const clearSuggest = key === 'deptCode' ? { _suggestDept: undefined } : key === 'accountCode' ? { _suggestAcc: undefined } : {}
    return { ...r, [key]: val, ...clearSuggest }
  }))
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

  const handleAISuggest = async () => {
    const itemsToSuggest = lineItems
      .map((item, idx) => ({ index: idx, category: item.category || '', description: item.description || '' }))
      .filter((_, idx) => !lineItems[idx].deptCode || !lineItems[idx].accountCode)

    if (!itemsToSuggest.length) return

    setSuggestLoading(true)
    try {
      const res = await fetch('/api/v1/ap-invoice/suggest-gl', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: itemsToSuggest }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      const suggestions = data.suggestions || {}
      setLineItems(prev => prev.map((item, idx) => {
        const s = suggestions[idx]
        if (!s) return item
        const newDept = !item.deptCode    && s.deptCode    ? s.deptCode    : null
        const newAcc  = !item.accountCode && s.accountCode ? s.accountCode : null
        return {
          ...item,
          deptCode:    newDept ?? item.deptCode,
          accountCode: newAcc  ?? item.accountCode,
          _suggestDept: newDept || undefined,
          _suggestAcc:  newAcc  || undefined,
        }
      }))
    } catch (err) {
      console.error('AI suggest error:', err)
    } finally {
      setSuggestLoading(false)
    }
  }

  const handleReset = () => {
    setFile(null); setPreviewUrl(null); setPreviewType(null)
    setHeaderData(EMPTY_HEADER); setSystemVendor({ code: '', name: '' }); setVendorSearch('')
    setLineItems([]); setFieldMappings(DEFAULT_MAPPINGS); setStep(1)
    setGlLoaded(false)
  }

  return {
    // i18n
    lang, setLang, t,
    // Wizard
    step, setStep,
    // File & preview
    file, previewUrl, previewType, fileInputRef,
    loading, status, error, setError, suggestLoading,
    // Data
    headerData, lineItems, fieldMappings, setFieldMappings,
    masterAccounts, masterDepts,
    // Vendor search
    systemVendor, setSystemVendor, vendorSearch, setVendorSearch,
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
