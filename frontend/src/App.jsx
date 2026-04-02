import { useState, useRef, useEffect } from 'react'
import { EMPTY_DETAIL_ROW } from './constants'
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
  const [bank, setBank] = useState('')
  const [file, setFile] = useState(null)
  const [previewUrl, setPreviewUrl] = useState(null)
  const [previewType, setPreviewType] = useState(null)
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState('')
  const [showResults, setShowResults] = useState(false)
  const [headerData, setHeaderData] = useState({})
  const [details, setDetails] = useState([])
  const [receiptId, setReceiptId] = useState(null)
  const [modal, setModal] = useState({ show: false })

  const fileInputRef = useRef(null)
  const submittedDocNos = useRef(new Set())

  function showModal(config) {
    setModal({ show: true, ...config })
  }

  function closeModal() {
    setModal({ show: false })
  }

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
    if (!bank) {
      showModal({ title: 'แจ้งเตือน', message: 'กรุณาเลือกธนาคารก่อนดำเนินการ', type: 'warning', onConfirm: closeModal })
      return
    }
    if (!file) {
      showModal({ title: 'แจ้งเตือน', message: 'กรุณาเลือกไฟล์ก่อนดำเนินการ', type: 'warning', onConfirm: closeModal })
      return
    }

    setLoading(true)
    setStatus('AI กำลังอ่านข้อมูลจากเอกสาร...')
    setShowResults(false)

    try {
      const ext = await extractFromFile(file, bank)

      setHeaderData({
        DateProcessed: new Date().toLocaleDateString('en-GB'),
        BankName: ext.bank_name || '',
        DocName: ext.doc_name || '',
        CompanyName: ext.company_name || '',
        DocDate: ext.doc_date || '',
        DocNo: ext.doc_no || '',
      })

      setDetails(ext.details?.length ? ext.details : [{ ...EMPTY_DETAIL_ROW }])

      // เก็บ receiptId ไว้สำหรับใช้ตอน submit
      setReceiptId(ext.receipt_id || null)

      setStatus('อ่านข้อมูลสำเร็จ ✓')
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

  async function submitData(overwrite = false) {
    const docNo = headerData.DocNo

    if (details.length === 0) {
      showModal({ title: 'แจ้งเตือน', message: 'กรุณาเพิ่มอย่างน้อย 1 รายการก่อนส่ง', type: 'warning', onConfirm: closeModal })
      return
    }

    const payload = {
      BankType: bank,
      Overwrite: overwrite,
      ImportDate: new Date().toISOString(),
      Header: headerData,
      Details: details.map(row => ({
        ...row,
        PayAmt: parseFloat(String(row.PayAmt).replace(/,/g, '')) || 0,
        CommisAmt: parseFloat(String(row.CommisAmt).replace(/,/g, '')) || 0,
        TaxAmt: parseFloat(String(row.TaxAmt).replace(/,/g, '')) || 0,
        WHTAmount: parseFloat(String(row.WHTAmount).replace(/,/g, '')) || null,
        Total: parseFloat(String(row.Total).replace(/,/g, '')) || 0,
      })),
    }

    console.log('Submitting payload:', JSON.stringify(payload, null, 2))

    try {
      await submitToLocal(receiptId, payload)
      submittedDocNos.current.add(docNo)
      showModal({ title: 'อัปโหลดสำเร็จ', message: `เอกสาร ${docNo} ส่งเข้าระบบแล้ว`, type: 'success', onConfirm: () => { closeModal(); resetAll() } })
    } catch (err) {
      if (err.code === 'DUPLICATE_DOC_NO') {
        showModal({
          title: 'เอกสารซ้ำซ้อนในระบบ',
          message: `หมายเลข ${docNo} ถูก submit ไปแล้ว\n\nต้องการ Overwrite ข้อมูลเดิมหรือไม่?`,
          type: 'warning',
          confirmText: 'Overwrite',
          cancelText: 'ยกเลิก',
          onConfirm: () => { closeModal(); submitData(true) },
          onCancel: closeModal,
        })
      } else {
        showModal({ title: 'เกิดข้อผิดพลาด', message: err.message, type: 'error', onConfirm: closeModal })
      }
    }
  }

  function resetAll() {
    setShowResults(false)
    setFile(null)
    setStatus('')
    if (previewUrl) URL.revokeObjectURL(previewUrl.split('#')[0])
    setPreviewUrl(null)
    setPreviewType(null)
    setHeaderData({})
    setDetails([])
    setReceiptId(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  function handleCancel() {
    if (!showResults) {
      resetAll()
      return
    }
    showModal({
      title: 'ยืนยันการยกเลิก',
      message: 'คุณต้องการยกเลิกและล้างข้อมูลหรือไม่?',
      type: 'warning',
      onConfirm: () => { closeModal(); resetAll() },
      onCancel: closeModal,
    })
  }

  return (
    <div className="app-container">
      <CustomModal
        show={modal.show}
        title={modal.title}
        message={modal.message}
        type={modal.type}
        onConfirm={modal.onConfirm}
        onCancel={modal.onCancel}
      />
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
            <FormActions onCancel={handleCancel} onSubmit={() => submitData()} />
          </div>

          <DocumentPreview previewUrl={previewUrl} previewType={previewType} />
        </div>
      )}
    </div>
  )
}
