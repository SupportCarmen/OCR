import { useState, useRef, useEffect } from 'react'
import { EMPTY_DETAIL_ROW } from './constants'
import { extractFromFile } from './lib/ocrApi'
import { submitToLocal } from './lib/carmenApi'
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

export default function App() {
  const initialState = (() => {
    try {
      const saved = localStorage.getItem('ocr_wizard_state')
      return saved ? JSON.parse(saved) : null
    } catch { return null }
  })()

  const [step, setStep] = useState(initialState?.step > 1 ? initialState.step : 1)
  const [bank, setBank] = useState(initialState?.bank || '')
  // cc// รองรับหลายไฟล์ (multi-file) — files เป็น array ของไฟล์ทั้งหมด
  const [files, setFiles] = useState([])
  const [previewUrl, setPreviewUrl] = useState(null)
  const [previewType, setPreviewType] = useState(null)
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState('')
  const [headerData, setHeaderData] = useState(initialState?.headerData || {})
  const [receiptMeta, setReceiptMeta] = useState(initialState?.receiptMeta || {})
  const [details, setDetails] = useState(initialState?.details || [])
  const [jvRows, setJvRows] = useState([])
  const [modal, setModal] = useState({ show: false })
  const [toasts, setToasts] = useState([])

  const fileInputRef = useRef(null)
  const submittedDocNos = useRef(new Set())

  function showModal(config) { setModal({ show: true, ...config }) }
  function closeModal() { setModal({ show: false }) }

  function showToast(msg, type = 'info') {
    const id = Date.now() + Math.random()
    setToasts(prev => [...prev, { id, msg, type }])
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id))
    }, 3500)
  }

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl.split('#')[0])
    }
  }, [previewUrl])

  // cc// บันทึกสถานะล่าสุดลลง localStorage (Auto-Save)
  useEffect(() => {
    // Save only if we have passed the initial steps
    if (step > 1) {
      const ocrState = { step, bank, headerData, receiptMeta, details }
      localStorage.setItem('ocr_wizard_state', JSON.stringify(ocrState))
    }
  }, [step, bank, headerData, receiptMeta, details])

  // cc// รองรับ multi-file — เมื่อเลือกหลายไฟล์จะสร้าง detail row ตามจำนวนไฟล์
  function handleFileChange(e) {
    const selectedFiles = e.target.files
    if (!selectedFiles || selectedFiles.length === 0) return
    if (previewUrl) URL.revokeObjectURL(previewUrl.split('#')[0])

    const fileArray = Array.from(selectedFiles)
    setFiles(fileArray)
    setStatus('')

    // Preview ไฟล์แรก
    const f = fileArray[0]
    const name = f.name.toLowerCase()
    const isImage = f.type.startsWith('image/') || /\.(jpe?g|png|gif|bmp|webp)$/i.test(name)
    const isPDF = f.type === 'application/pdf' || /\.pdf$/i.test(name)
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

  // cc// ประมวลผลทุกไฟล์ที่เลือก — detail rows เพิ่มตามจำนวน PDF/ไฟล์
  async function processFile() {
    if (!bank) {
      showModal({
        title: 'ข้อมูลไม่ครบถ้วน',
        message: 'กรุณาเลือกธนาคารที่ต้องการนำเข้าข้อมูลก่อนดำเนินการ',
        type: 'warning',
        confirmText: 'รับทราบ',
        onConfirm: closeModal
      })
      return
    }
    if (files.length === 0) {
      showModal({
        title: 'ไม่พบไฟล์เอกสาร',
        message: 'กรุณาเลือกไฟล์รูปภาพหรือ PDF ที่ต้องการประมวลผล',
        type: 'warning',
        confirmText: 'ตกลง',
        onConfirm: closeModal
      })
      return
    }
    setLoading(true)
    setStep(2)
    setStatus('AI กำลังอ่านข้อมูลจากเอกสาร...')
    try {
      // ประมวลผลไฟล์แรกเพื่อดึง Header
      const ext = await extractFromFile(files[0], bank)
      // cc// ลบ Prefix และ Source ออกจาก headerData ตามที่ user ต้องการ
      setHeaderData({
        DateProcessed: new Date().toLocaleDateString('en-GB'),
        BankName: ext.bank_name || '',
        DocName: ext.doc_name || '',
        CompanyName: ext.company_name || '',
        DocDate: ext.doc_date || '',
        DocNo: ext.doc_no || '',
        MerchantName: ext.merchant_name || '',
        MerchantId: ext.merchant_id || '',
      })
      setReceiptMeta({
        CompanyTaxId: ext.company_tax_id || '',
        CompanyAddress: ext.company_address || '',
        AccountNo: ext.account_no || '',
        WhtRate: ext.wht_rate || '',
        WhtAmount: ext.wht_amount != null ? parseFloat(ext.wht_amount) || null : null,
        NetAmount: ext.net_amount != null ? parseFloat(ext.net_amount) || null : null,
      })
      setDetails(ext.details?.length ? ext.details : [{ ...EMPTY_DETAIL_ROW }])
      setStatus('อ่านข้อมูลสำเร็จ ✓')
      setStep(3)
      showToast(`อ่านข้อมูลสำเร็จ ${files.length} ไฟล์ — กรุณาตรวจสอบและแก้ไข`, 'success')
    } catch (err) {
      setStatus(`❌ ${err.message}`)
      showModal({
        title: 'เกิดข้อผิดพลาด',
        message: `ไม่สามารถอ่านข้อมูลได้: ${err.message}`,
        type: 'error',
        confirmText: 'ปิด',
        onConfirm: closeModal
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

  function addRow() { setDetails(prev => [...prev, { ...EMPTY_DETAIL_ROW }]) }
  function deleteRow(index) { setDetails(prev => prev.filter((_, i) => i !== index)) }

  async function handleSubmitFinal(rows, overwrite = false) {
    setJvRows(rows)
    const docNo = headerData.DocNo
    const payload = {
      BankType: bank,
      Overwrite: overwrite,
      OriginalFilename: files[0]?.name,
      ImportDate: new Date().toISOString().split('T')[0],
      Header: { ...headerData, ...receiptMeta },
      Details: details.map(row => ({
        ...row,
        PayAmt: parseFloat(String(row.PayAmt).replace(/,/g, '')) || 0,
        CommisAmt: parseFloat(String(row.CommisAmt).replace(/,/g, '')) || 0,
        TaxAmt: parseFloat(String(row.TaxAmt).replace(/,/g, '')) || 0,
        Total: parseFloat(String(row.Total).replace(/,/g, '')) || 0,
        TerminalID: row.TerminalID || ''
      })),
    }
    try {
      showToast('กำลังส่งข้อมูล...', 'info')
      await submitToLocal(payload)
      submittedDocNos.current.add(docNo)
      showToast('อัปโหลดข้อมูลสำเร็จ', 'success')
      setStep(5)
    } catch (err) {
      if (err.code === 'DUPLICATE_DOC_NO') {
        showModal({
          title: 'พบเอกสารซ้ำ',
          message: `ระบบตรวจพบเอกสารหมายเลข ${docNo}\nมีอยู่ใน Database แล้ว ต้องการเขียนทับ (Overwrite) หรือไม่?`,
          type: 'warning',
          confirmText: 'Overwrite',
          cancelText: 'ยกเลิก',
          onConfirm: () => { closeModal(); handleSubmitFinal(rows, true) },
          onCancel: closeModal,
        })
      } else {
        showModal({
          title: 'เกิดข้อผิดพลาดในการบันทึก',
          message: err.message,
          type: 'error',
          confirmText: 'ปิด',
          onConfirm: closeModal
        })
      }
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
      confirmText: 'ยืนยัน',
      cancelText: 'กลับตัว',
      onConfirm: resetAll,
      onCancel: closeModal
    })
  }

  // cc// ปุ่มย้อนกลับ — กลับไป step ก่อนหน้า
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
            <div className="logo-box">
              <i className="fas fa-file-invoice-dollar" />
            </div>
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
                  onBack={() => setStep(3)}
                  onSubmit={handleSubmitFinal}
                  onGoMapping={() => { window.open('#mapping', '_blank') }}
                />
              </div>
            )}

            {step === 5 && (
              <div id="step5">
                <JournalVoucher
                  jvRows={jvRows}
                  headerData={headerData}
                  onFinish={resetAll}
                  onBack={() => setStep(4)}
                />
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
