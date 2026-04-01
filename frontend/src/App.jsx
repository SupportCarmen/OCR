import { useState, useRef, useEffect } from 'react'
import { BANKS, EMPTY_DETAIL_ROW } from './constants'
import { extractFromFile } from './lib/ocrApi'
import { submitToLocal } from './lib/carmenApi'
import UploadSection from './components/UploadSection'
import ActionBar from './components/ActionBar'
import HeaderCard from './components/HeaderCard'
import DetailTable from './components/DetailTable'
import FormActions from './components/FormActions'
import DocumentPreview from './components/DocumentPreview'
import CustomModal from './components/CustomModal'

export default function App() {
  const [bank, setBank] = useState('BBL')
  const [file, setFile] = useState(null)
  const [previewUrl, setPreviewUrl] = useState(null)
  const [previewType, setPreviewType] = useState(null)
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState('')
  const [showResults, setShowResults] = useState(false)
  const [receiptId, setReceiptId] = useState(null)
  const [headerData, setHeaderData] = useState({})
  const [details, setDetails] = useState([])
  const [modal, setModal] = useState({
    show: false,
    title: '',
    message: '',
    type: 'info',
    onConfirm: null,
    onCancel: null,
    confirmText: 'ตกลง',
    cancelText: 'ยกเลิก'
  })

  const showAlert = (title, message, type = 'info') => {
    setModal({
      show: true,
      title,
      message,
      type,
      onConfirm: () => setModal(prev => ({ ...prev, show: false })),
      onCancel: null,
      confirmText: 'ตกลง'
    })
  }

  const showConfirm = (title, message, onConfirm, onCancel = null, confirmText = 'ยืนยัน') => {
    setModal({
      show: true,
      title,
      message,
      type: 'warning',
      onConfirm: () => {
        onConfirm()
        setModal(prev => ({ ...prev, show: false }))
      },
      onCancel: () => {
        if (onCancel) onCancel()
        setModal(prev => ({ ...prev, show: false }))
      },
      confirmText,
      cancelText: 'ยกเลิก'
    })
  }

  const fileInputRef = useRef(null)

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl.split('#')[0])
    }
  }, [previewUrl])

  function handleFileChange(e) {
    const f = e.target.files[0]
    if (!f) return

    if (previewUrl) URL.revokeObjectURL(previewUrl.split('#')[0])

    const name = f.name.toLowerCase()
    const isImage = f.type.startsWith('image/') || /\.(jpe?g|png|gif|bmp|webp)$/i.test(name)
    const isPDF = f.type === 'application/pdf' || /\.pdf$/i.test(name)

    setFile(f)
    setShowResults(false)
    setStatus('')

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
  }

  async function processFile() {
    if (!file) {
      showAlert('ข้อมูลไม่ครบถ้วน', 'กรุณาเลือกไฟล์ก่อนดำเนินการ', 'warning')
      return
    }

    setLoading(true)
    setStatus('AI กำลังอ่านข้อมูลจากเอกสาร...')
    setShowResults(false)

    try {
      const ext = await extractFromFile(file, bank)

      setReceiptId(ext.receipt_id || null)
      setHeaderData({
        DateProcessed: new Date().toLocaleDateString('en-GB'),
        BankName: BANKS.find(b => b.value === bank)?.label || ext.bank_name || '',
        DocName: ext.doc_name || '',
        CompanyName: ext.company_name || '',
        DocDate: ext.doc_date || '',
        DocNo: ext.doc_no || '',
      })

      setDetails([{
        TerminalID: ext.terminal_id || '',
        PayAmt: ext.pay_amt || '',
        CommisAmt: ext.commis_amt || '',
        TaxAmt: ext.tax_amt || '',
        WHTAmount: ext.wht_amount || '',
        Total: ext.total || '',
        MerchantName: ext.merchant_name || '',
        Transaction: ext.transaction_type || '',
      }])

      setStatus('อ่านข้อมูลสำเร็จ ✓ กรุณาตรวจสอบแล้วกด Submit')
      setShowResults(true)
    } catch (err) {
      setStatus(`❌ ${err.message}`)
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

  function addRow() {
    setDetails(prev => [...prev, { ...EMPTY_DETAIL_ROW }])
  }

  function deleteRow(index) {
    setDetails(prev => prev.filter((_, i) => i !== index))
  }

  async function submitData() {
    if (!receiptId) {
      showAlert('เกิดข้อผิดพลาด', 'ไม่พบ Receipt ID — กรุณาอ่านข้อมูลจากเอกสารก่อน', 'error')
      return
    }

    const toFloat = v => parseFloat(String(v ?? '').replace(/,/g, '')) || 0
    const buildPayload = (ow = false) => ({
      BankType: bank,
      Overwrite: ow,
      Header: headerData,
      Details: details.map(row => ({
        TerminalID: row.TerminalID,
        PayAmt: toFloat(row.PayAmt),
        CommisAmt: toFloat(row.CommisAmt),
        TaxAmt: toFloat(row.TaxAmt),
        WHTAmount: toFloat(row.WHTAmount),
        Total: toFloat(row.Total),
      })),
    })

    try {
      await submitToLocal(receiptId, buildPayload(false))
      showAlert('สำเร็จ', `เอกสาร ${headerData.DocNo} บันทึกเข้าฐานข้อมูลแล้ว`, 'success')
      resetAll()
    } catch (err) {
      if (err.code === 'DUPLICATE_DOC_NO') {
        showConfirm(
          'พบเลขที่เอกสารซ้ำ',
          `หมายเลขบิล: ${headerData.DocNo} มีอยู่ในระบบแล้ว\nคุณต้องการบันทึกทับ (Overwrite) ข้อมูลเดิมหรือไม่?`,
          async () => {
            try {
              await submitToLocal(receiptId, buildPayload(true))
              showAlert('สำเร็จ', `เอกสาร ${headerData.DocNo} ถูกอัพเดตแล้ว`, 'success')
              resetAll()
            } catch (err2) {
              showAlert('ผิดพลาด', `บันทึกทับไม่สำเร็จ: ${err2.message}`, 'error')
            }
          },
          null,
          'บันทึกทับ'
        )
      } else if (err.code === 'ALREADY_SUBMITTED') {
        showAlert('แจ้งเตือน', err.message || 'เอกสารนี้ถูกบันทึกไปแล้ว', 'warning')
      } else {
        showAlert('ผิดพลาด', `บันทึกข้อมูลไม่สำเร็จ: ${err.message}`, 'error')
      }
    }
  }

  function resetAll() {
    setShowResults(false)
    setReceiptId(null)
    setFile(null)
    setStatus('')
    if (previewUrl) URL.revokeObjectURL(previewUrl.split('#')[0])
    setPreviewUrl(null)
    setPreviewType(null)
    setHeaderData({})
    setDetails([])
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  function handleCancel() {
    if (!showResults) {
      resetAll()
    } else {
      showConfirm(
        'ยกเลิกการแก้ไข',
        'คุณต้องการยกเลิกและล้างข้อมูลหรือไม่?',
        resetAll
      )
    }
  }

  return (
    <div className="app-container">
      <div className="app-header">
        <h1>
          <i className="fas fa-file-invoice-dollar" />
          ระบบนำเข้าข้อมูล Credit Card Report
        </h1>
      </div>

      <UploadSection
        bank={bank}
        onBankChange={setBank}
        onFileChange={handleFileChange}
        fileInputRef={fileInputRef}
      />

      <ActionBar
        loading={loading}
        status={status}
        onProcess={processFile}
      />

      {showResults && (
        <div className="main-content">
          <div className="data-column">
            <h2 className="section-title">
              <i className="fas fa-edit" /> ตรวจสอบและแก้ไขข้อมูล
            </h2>
            <HeaderCard headerData={headerData} onUpdate={updateHeader} />
            <DetailTable
              details={details}
              onUpdate={updateDetail}
              onAddRow={addRow}
              onDeleteRow={deleteRow}
            />
            <FormActions onCancel={handleCancel} onSubmit={submitData} />
          </div>

          <DocumentPreview previewUrl={previewUrl} previewType={previewType} />
        </div>
      )}

      <CustomModal {...modal} />
    </div>
  )
}
