import { useState, useRef, useEffect } from 'react'
import { EMPTY_DETAIL_ROW, BANK_THAI_NAMES, detectBankFromCompanyName } from './constants'
import { extractFromFile } from './lib/api/ocr'
import { submitToLocal } from './lib/api/submit'
import { submitToCarmen } from './lib/api/carmen'
import { useToast } from './hooks/useToast'
import { useModal } from './hooks/useModal'
import StepWizard from './components/StepWizard'
import UploadSection from './components/UploadSection'
import ActionBar from './components/ActionBar'
import HeaderCard from './components/HeaderCard'
import DetailTable from './components/DetailTable'
import FormActions from './components/FormActions'
import DocumentPreview from './components/DocumentPreview'
import CustomModal from './components/CustomModal'
import AccountingReview from './components/AccountingReview'
import JournalVoucher from './components/JournalVoucher'
import InputTaxReconciliation from './components/InputTaxReconciliation'

export default function App() {
  const initialState = (() => {
    try {
      const saved = localStorage.getItem('ocr_wizard_state')
      return saved ? JSON.parse(saved) : null
    } catch { return null }
  })()

  const [step, setStep] = useState(initialState?.step > 1 ? initialState.step : 1)
  const [bank, setBank] = useState(initialState?.bank || '')
  const [files, setFiles] = useState([])
  const [previewUrl, setPreviewUrl] = useState(null)
  const [previewType, setPreviewType] = useState(null)
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [status, setStatus] = useState('')
  const [headerData, setHeaderData] = useState(initialState?.headerData || {})
  const [receiptMeta, setReceiptMeta] = useState(initialState?.receiptMeta || {})
  const [details, setDetails] = useState(initialState?.details || [])
  const [jvRows, setJvRows] = useState([])
  const [filePrefix, setFilePrefix] = useState('')
  const [fileSource, setFileSource] = useState('')
  const [jvDescription, setJvDescription] = useState('')

  const { toasts, showToast } = useToast()
  const { modal, showModal, closeModal } = useModal()

  const fileInputRef = useRef(null)
  const submittedDocNos = useRef(new Set())

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl.split('#')[0])
    }
  }, [previewUrl])

  // โหลด filePrefix และ fileSource จาก localStorage (accountingConfig)
  // Update whenever we move to step 5 (JournalVoucher) to get latest values from Mapping page
  useEffect(() => {
    try {
      const config = JSON.parse(localStorage.getItem('accountingConfig') || '{}')
      setFilePrefix(config.filePrefix || '')
      setFileSource(config.fileSource || '')
      const desc = config.description
        ? `${config.description}${headerData.DocDate ? ` - ${headerData.DocDate}` : ''}`
        : ''
      setJvDescription(desc)
    } catch { /* ignore */ }
  }, [step])

  // Auto-save wizard state to localStorage
  useEffect(() => {
    if (step > 1) {
      const ocrState = { step, bank, headerData, receiptMeta, details }
      localStorage.setItem('ocr_wizard_state', JSON.stringify(ocrState))
    }
  }, [step, bank, headerData, receiptMeta, details])

  function handleFileChange(e) {
    const selectedFiles = e.target.files
    if (!selectedFiles || selectedFiles.length === 0) return
    if (previewUrl) URL.revokeObjectURL(previewUrl.split('#')[0])

    const fileArray = Array.from(selectedFiles)
    setFiles(fileArray)
    setStatus('')

    const f = fileArray[0]
    const name = f.name.toLowerCase()
    const isImage = f.type.startsWith('image/') || /\.(jpe?g|png|gif|bmp|webp)$/i.test(name)
    const isPDF   = f.type === 'application/pdf'  || /\.pdf$/i.test(name)
    if (isImage) {
      setPreviewUrl(URL.createObjectURL(f))
      setPreviewType('image')
    } else if (isPDF) {
      setPreviewUrl(URL.createObjectURL(f) + '#view=FitH')
      setPreviewType('pdf')
    } else {
      setPreviewUrl(null)
      setPreviewType(name.split('.').pop().toUpperCase() || 'other')
    }
    setStep(1)
  }

  function applyExtractedData(ext) {
    setHeaderData({
      DateProcessed: new Date().toLocaleDateString('en-GB'),
      BankName:     ext.bank_name     || '',
      DocName:      ext.doc_name      || '',
      CompanyName:  ext.company_name  || '',
      DocDate:      ext.doc_date      || '',
      DocNo:        ext.doc_no        || '',
      MerchantName: ext.merchant_name || '',
      MerchantId:   ext.merchant_id   || '',
    })
    setReceiptMeta({
      CompanyTaxId:   ext.company_tax_id  || '',
      CompanyAddress: ext.company_address || '',
      AccountNo:      ext.account_no      || '',
      WhtRate:        ext.wht_rate        || '',
      WhtAmount: ext.wht_amount != null ? parseFloat(ext.wht_amount) || null : null,
      NetAmount: ext.net_amount != null ? parseFloat(ext.net_amount) || null : null,
    })
    setDetails(ext.details?.length ? ext.details : [{ ...EMPTY_DETAIL_ROW }])

    if (ext.bank_companyname || ext.bank_tax_id || ext.bank_address || ext.branch_no) {
      try {
        const existing = JSON.parse(localStorage.getItem('accountingConfig') || '{}')
        existing.company = {
          ...existing.company,
          ...(ext.bank_companyname && { name: ext.bank_companyname }),
          ...((ext.bank_tax_id || ext.back_tax_id) && { taxId: ext.bank_tax_id || ext.back_tax_id }),
          ...(ext.bank_address && { address: ext.bank_address }),
          ...(ext.branch_no    && { branch:  ext.branch_no }),
        }
        const detectedBankCode = detectBankFromCompanyName(ext.bank_companyname)
        const BANK_CODE_TO_NAME = {
          BBL:   'Bangkok Bank (BBL)',
          KBANK: 'Kasikornbank (KBANK)',
          SCB:   'Siam Commercial Bank (SCB)',
        }
        if (detectedBankCode && BANK_CODE_TO_NAME[detectedBankCode]) {
          existing.bank = BANK_CODE_TO_NAME[detectedBankCode]
        }
        localStorage.setItem('accountingConfig', JSON.stringify(existing))
      } catch { /* ignore */ }
    }
  }

  async function processFile() {
    if (!bank) {
      showModal({
        title: 'ข้อมูลไม่ครบถ้วน',
        message: 'กรุณาเลือกธนาคารที่ต้องการนำเข้าข้อมูลก่อนดำเนินการ',
        type: 'warning', confirmText: 'รับทราบ', onConfirm: closeModal,
      })
      return
    }
    if (files.length === 0) {
      showModal({
        title: 'ไม่พบไฟล์เอกสาร',
        message: 'กรุณาเลือกไฟล์รูปภาพหรือ PDF ที่ต้องการประมวลผล',
        type: 'warning', confirmText: 'ตกลง', onConfirm: closeModal,
      })
      return
    }
    setLoading(true)
    setStep(2)
    setStatus('AI กำลังอ่านข้อมูลจากเอกสาร...')
    try {
      const ext = await extractFromFile(files[0], bank)

      // Duplicate check — stop immediately if doc_no already submitted
      if (ext.is_duplicate) {
        setStatus('พบเอกสารซ้ำ')
        showModal({
          title: 'พบเอกสารซ้ำในระบบ',
          message: `เอกสารหมายเลข ${ext.doc_no} ถูกบันทึกไว้ในระบบแล้ว\nไม่สามารถนำเข้าเอกสารซ้ำได้`,
          type: 'error',
          confirmText: 'ตกลง',
          onConfirm: () => { closeModal(); setStep(1) },
        })
        return
      }

      applyExtractedData(ext)

      const detectedBank = detectBankFromCompanyName(ext.bank_companyname)
      if (detectedBank && detectedBank !== bank) {
        setStatus('อ่านข้อมูลสำเร็จ ✓')
        setStep(3)
        showModal({
          title: 'ตรวจพบธนาคารไม่ตรงกัน',
          message: `เอกสารนี้น่าจะเป็นของ ${BANK_THAI_NAMES[detectedBank]}\nแต่เลือกธนาคาร: ${BANK_THAI_NAMES[bank]}\n\nต้องการประมวลผลใหม่ด้วย ${BANK_THAI_NAMES[detectedBank]} หรือไม่?`,
          type: 'warning',
          confirmText: `ประมวลผลด้วย ${detectedBank}`,
          cancelText: 'ใช้ผลลัพธ์ปัจจุบัน',
          onConfirm: async () => {
            closeModal()
            setBank(detectedBank)
            setLoading(true)
            setStep(2)
            setStatus('AI กำลังอ่านข้อมูลใหม่...')
            try {
              const ext2 = await extractFromFile(files[0], detectedBank)
              if (ext2.is_duplicate) {
                setStatus('พบเอกสารซ้ำ')
                showModal({
                  title: 'พบเอกสารซ้ำในระบบ',
                  message: `เอกสารหมายเลข ${ext2.doc_no} ถูกบันทึกไว้ในระบบแล้ว\nไม่สามารถนำเข้าเอกสารซ้ำได้`,
                  type: 'error',
                  confirmText: 'ตกลง',
                  onConfirm: () => { closeModal(); setStep(1) },
                })
                return
              }
              applyExtractedData(ext2)
              setStatus('อ่านข้อมูลสำเร็จ ✓')
              setStep(3)
              showToast(`ประมวลผลใหม่ด้วย ${BANK_THAI_NAMES[detectedBank]} สำเร็จ`, 'success')
            } catch (err) {
              setStatus(err.message)
              showModal({
                title: 'เกิดข้อผิดพลาด',
                message: `ไม่สามารถอ่านข้อมูลได้: ${err.message}`,
                type: 'error', confirmText: 'ปิด', onConfirm: closeModal,
              })
              setStep(1)
            } finally {
              setLoading(false)
            }
          },
          onCancel: closeModal,
        })
      } else {
        setStatus('อ่านข้อมูลสำเร็จ ✓')
        setStep(3)
        showToast(`อ่านข้อมูลสำเร็จ ${files.length} ไฟล์ — กรุณาตรวจสอบและแก้ไข`, 'success')
      }
    } catch (err) {
      setStatus(err.message)
      showModal({
        title: 'เกิดข้อผิดพลาด',
        message: `ไม่สามารถอ่านข้อมูลได้: ${err.message}`,
        type: 'error', confirmText: 'ปิด', onConfirm: closeModal,
      })
      setStep(1)
    } finally {
      setLoading(false)
    }
  }

  function updateHeader(key, value) {
    setHeaderData(prev => ({ ...prev, [key]: value }))
  }

  function updateDetail(rowIndex, col, value) {
    setDetails(prev =>
      prev.map((row, i) => (i === rowIndex ? { ...row, [col]: value } : row))
    )
  }

  function addRow()          { setDetails(prev => [...prev, { ...EMPTY_DETAIL_ROW }]) }
  function deleteRow(index)  { setDetails(prev => prev.filter((_, i) => i !== index)) }

  async function handleSubmitFinal(rows) {
    setSubmitting(true)
    setJvRows(rows)
    const docNo = headerData.DocNo
    const payload = {
      BankType:         bank,
      OriginalFilename: files[0]?.name,
      Header: {
        DateProcessed:  headerData.DateProcessed  || '',
        BankName:       headerData.BankName        || '',
        DocName:        headerData.DocName         || '',
        CompanyName:    headerData.CompanyName     || '',
        CompanyTaxId:   receiptMeta.CompanyTaxId   || '',
        CompanyAddress: receiptMeta.CompanyAddress || '',
        AccountNo:      receiptMeta.AccountNo      || '',
        DocDate:        headerData.DocDate         || '',
        DocNo:          headerData.DocNo           || '',
        MerchantName:   headerData.MerchantName    || '',
        MerchantId:     headerData.MerchantId      || '',
        WhtRate:        receiptMeta.WhtRate        || '',
        WhtAmount:      receiptMeta.WhtAmount      || null,
        NetAmount:      receiptMeta.NetAmount      || null,
      },
      Details: details.map(row => ({
        Transaction: row.Transaction || row.transaction || '',
        PayAmt:      parseFloat(String(row.PayAmt    || row.pay_amt    || 0).replace(/,/g, '')) || 0,
        CommisAmt:   parseFloat(String(row.CommisAmt || row.commis_amt || 0).replace(/,/g, '')) || 0,
        TaxAmt:      parseFloat(String(row.TaxAmt    || row.tax_amt    || 0).replace(/,/g, '')) || 0,
        Total:       parseFloat(String(row.Total     || row.total      || 0).replace(/,/g, '')) || 0,
        WHTAmount:   parseFloat(String(row.WHTAmount || row.wht_amount || 0).replace(/,/g, '')) || 0,
      })),
    }
    try {
      showToast('กำลังส่งข้อมูล...', 'info')
      await submitToLocal(payload)
      submittedDocNos.current.add(docNo)

      // Build and submit Carmen GL JV payload
      let carmenError = null
      try {
        const carmenConfig = (() => {
          try { return JSON.parse(localStorage.getItem('accountingConfig') || '{}') } catch { return {} }
        })()
        const carmenPayload = {
          JvhSeq: -1,
          JvhDate: (() => {
            if (headerData.DocDate) {
              const [d, m, y] = headerData.DocDate.split('/')
              const parsed = new Date(`${y}-${m}-${d}`)
              if (!isNaN(parsed)) return parsed.toISOString()
            }
            return new Date().toISOString()
          })(),
          Prefix:      carmenConfig.filePrefix || '',
          JvhNo:       'Auto',
          JvhSource:   carmenConfig.fileSource || '',
          Status:      'Draft',
          Description: carmenConfig.description
            ? `${carmenConfig.description}${headerData.DocDate ? ` - ${headerData.DocDate}` : ''}`
            : '',
          Detail: rows.map(r => ({
            JvhSeq: -1, JvdSeq: -1,
            DeptCode: r.dept, AccCode: r.acc, Description: r.desc,
            CurCode: 'THB', CurRate: 1,
            CrAmount: r.credit, CrBase: r.credit,
            DrAmount: r.debit,  DrBase: r.debit,
            DimList: {},
          })),
          DimHList: { Dim: [] },
          UserModified: '',
        }
        console.log('[Carmen GL JV] payload:', JSON.stringify(carmenPayload, null, 2))
        await submitToCarmen(carmenPayload)
        showToast('ส่งข้อมูลเข้า Carmen GL JV สำเร็จ', 'success')
      } catch (err) {
        carmenError = err.message
        showToast(`Carmen GL JV: ${err.message}`, 'error')
      }

      showModal({
        title:   carmenError ? 'บันทึกสำเร็จ (Carmen มีปัญหา)' : 'บันทึกสำเร็จ!',
        message: carmenError
          ? `เอกสารหมายเลข ${docNo} บันทึกลงฐานข้อมูลแล้ว\n\nแต่การส่ง Carmen GL JV ล้มเหลว:\n${carmenError}`
          : `เอกสารหมายเลข ${docNo} ได้ถูกบันทึกและส่ง Carmen GL JV เรียบร้อยแล้ว`,
        type:        carmenError ? 'warning' : 'success',
        confirmText: 'ดูรายการรายวัน (JV)',
        onConfirm: () => { closeModal(); setStep(5) },
      })
    } catch (err) {
      showModal({
        title: 'เกิดข้อผิดพลาดในการบันทึก',
        message: err.message,
        type: 'error', confirmText: 'ปิด', onConfirm: closeModal,
      })
    } finally {
      setSubmitting(false)
    }
  }

  function resetAll() {
    setStep(1)
    setFiles([])
    setStatus('')
    if (previewUrl) URL.revokeObjectURL(previewUrl.split('#')[0])
    setPreviewUrl(null)
    setPreviewType(null)
    setHeaderData({})
    setReceiptMeta({})
    setDetails([])
    setJvRows([])
    if (fileInputRef.current) fileInputRef.current.value = ''
    localStorage.removeItem('ocr_wizard_state')
    closeModal()
  }

  function handleCancel() {
    if (step === 1) return
    showModal({
      title: 'ยกเลิกการทำงาน',
      message: 'ยืนยันการยกเลิกและล้างข้อมูลทั้งหมดหรือไม่?',
      type: 'warning',
      confirmText: 'ยืนยัน', cancelText: 'กลับตัว',
      onConfirm: resetAll, onCancel: closeModal,
    })
  }

  function goBack() {
    if (step > 1) setStep(step - 1)
  }

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

      {/* OCR loading overlay */}
      {loading && (
        <div className="ocr-loading-overlay">
          <div className="ocr-loading-box">
            <div className="ocr-loading-spinner" />
            <div className="ocr-loading-title">AI กำลังอ่านเอกสาร</div>
            <div className="ocr-loading-status">{status || 'กรุณารอสักครู่...'}</div>
          </div>
        </div>
      )}

      <div className="app-container">
        <div className="toast-container" id="toastContainer">
          {toasts.slice(-1).map(t => (
            <div key={t.id} className={`toast ${t.type}`} style={{ opacity: 1, transform: 'none' }}>
              <i className={`fas ${t.type === 'success' ? 'fa-circle-check' : t.type === 'error' ? 'fa-circle-xmark' : 'fa-circle-info'}`} />
              {t.msg}
            </div>
          ))}
        </div>

        <div className="app-header">
          <div className="brand">
            <div className="logo-box"><i className="fas fa-file-invoice-dollar" /></div>
            <h1>ระบบนำเข้าข้อมูล Credit Card Report</h1>
          </div>
        </div>

        <StepWizard step={step} />

        {/* Step 1 & 2: Upload */}
        {step <= 2 && (
          <>
            <UploadSection
              bank={bank}
              onBankChange={setBank}
              onFileChange={handleFileChange}
              fileInputRef={fileInputRef}
              fileName={files.length > 1 ? `${files.length} ไฟล์ที่เลือก` : files[0]?.name}
              multiple={true}
            />
            <ActionBar loading={loading} status={status} onProcess={processFile} />
          </>
        )}

        {/* Main Grid: Data and Previews */}
        <div
          className={`main-content ${step < 3 ? 'hide-data' : ''} ${files.length === 0 && step < 3 ? 'hidden' : ''}`}
          style={step >= 4 ? { gridTemplateColumns: '1fr' } : {}}
        >
          {step <= 3 && (
            <DocumentPreview previewUrl={previewUrl} previewType={previewType} fileName={files[0]?.name} />
          )}

          <div className="data-column">
            {step <= 3 && (
              <div id="step3">
                <h2 className="section-title">
                  <i className="fas fa-edit" /> Step 3: ตรวจสอบข้อมูล
                </h2>
                <HeaderCard headerData={headerData} onUpdate={updateHeader} />
                <DetailTable
                  details={details}
                  onUpdate={updateDetail}
                  onAddRow={addRow}
                  onDeleteRow={deleteRow}
                />
                <FormActions
                  onCancel={handleCancel}
                  onBack={goBack}
                  onSubmit={() => setStep(4)}
                  submitLabel="ถัดไป (Review Accounting)"
                  showBack={step >= 3}
                />
              </div>
            )}

            {step === 4 && (
              <div id="step4">
                <AccountingReview
                  details={details}
                  headerData={headerData}
                  onBack={() => setStep(3)}
                  onSubmit={handleSubmitFinal}
                  onGoMapping={() => { window.open('#mapping', '_blank') }}
                  submitting={submitting}
                />
              </div>
            )}

            {step === 5 && (
              <div id="step5">
                <JournalVoucher
                  jvRows={jvRows}
                  headerData={headerData}
                  filePrefix={filePrefix}
                  fileSource={fileSource}
                  description={jvDescription}
                  onFinish={() => setStep(6)}
                  onBack={() => setStep(4)}
                />
              </div>
            )}

            {step === 6 && (
              <div id="step6">
                <InputTaxReconciliation
                  details={details}
                  headerData={headerData}
                  onBack={() => setStep(5)}
                  onFinish={resetAll}
                  showToast={showToast}
                />
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
