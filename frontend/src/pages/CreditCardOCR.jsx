import { useOcrWizard } from '../hooks/useOcrWizard'
import { StepWizard, FormActions, CustomModal, LoadingOverlay, DocumentPreview } from '../components/common'
import { UploadSection, ActionBar, HeaderCard, DetailTable, AccountingReview, InputTaxReconciliation } from '../components/credit-card'

export default function CreditCardOCR() {
  const {
    step, bank, files, previewUrl, previewType,
    loading, submitting, status,
    headerData, receiptMeta, details,
    fileInputRef,
    toasts, modal, showToast, showModal, closeModal,
    setBank, setStep,
    handleFileChange, processFile,
    updateHeader, updateDetail, addRow, deleteRow,
    handleSubmitFinal, handleCancel, resetAll,
  } = useOcrWizard()

  return (
    <>
      <CustomModal
        show={modal.show}
        title={modal.title}
        message={modal.message}
        type={modal.type}
        confirmText={modal.confirmText}
        cancelText={modal.cancelText}
        cancelStyle={modal.cancelStyle}
        onConfirm={modal.onConfirm}
        onCancel={modal.onCancel}
      />

      <LoadingOverlay show={loading} status={status} />

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
            <div className="logo-box" style={{ background: 'linear-gradient(135deg, #2563eb 0%, #3b82f6 100%)', color: 'white' }}>
              <i className="fas fa-file-invoice-dollar" />
            </div>
            <div>
              <h1 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0, color: 'var(--text)' }}>Carmen ERP</h1>
              <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#2563eb', letterSpacing: '0.08em', textTransform: 'uppercase', marginTop: '0.1rem' }}>
                Credit Card Report OCR
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <button
              className="btn btn-sm btn-outline"
              onClick={() => {
                if (step <= 1) { window.location.hash = '/'; return }
                showModal({
                  title: 'ออกจากหน้านี้?',
                  message: 'ข้อมูลที่กรอกทั้งหมดจะหายไป คุณต้องการกลับหน้าหลักใช่ไหม?',
                  type: 'warning',
                  confirmText: 'กลับหน้าหลัก',
                  cancelText: 'อยู่หน้านี้ต่อ',
                  onConfirm: () => { closeModal(); window.location.hash = '/' },
                  onCancel: closeModal,
                })
              }}
            >
              <i className="fas fa-arrow-left" /> กลับหน้าหลัก
            </button>
          </div>
        </div>

        <StepWizard step={step} />

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
                  onSubmit={() => setStep(4)}
                  submitLabel="ถัดไป (Review Accounting)"
                  showBack={false}
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
                  onGoMapping={() => { showToast('เปิด tab ใหม่สำหรับตั้งค่า Mapping แล้ว', 'info'); window.open('#/CreditCardOCR/mapping', '_blank') }}
                  submitting={submitting}
                />
              </div>
            )}

            {step === 5 && (
              <div id="step5">
                <InputTaxReconciliation
                  details={details}
                  headerData={headerData}
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
