import { useOcrWizard } from '../hooks/useOcrWizard'
import { StepWizard, FormActions, CustomModal } from '../components/common'
import { UploadSection, ActionBar, HeaderCard, DetailTable, DocumentPreview } from '../components/ocr'
import { AccountingReview, JournalVoucher, InputTaxReconciliation } from '../components/accounting'

export default function CreditCardOCR() {
  const {
    step, bank, files, previewUrl, previewType,
    loading, submitting, status,
    headerData, receiptMeta, details,
    jvRows, filePrefix, fileSource, jvDescription, carmenJvId,
    fileInputRef,
    toasts, modal, closeModal,
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
        onConfirm={modal.onConfirm}
        onCancel={modal.onCancel}
      />

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
            <a href="#/" className="btn btn-sm btn-outline" style={{ textDecoration: 'none' }}>
              <i className="fas fa-arrow-left" /> กลับหน้าหลัก
            </a>
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
                  onGoMapping={() => { window.open('#/CreditCardOCR/mapping', '_blank') }}
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
                  carmenJvId={carmenJvId}
                  onFinish={() => setStep(6)}
                />
              </div>
            )}

            {step === 6 && (
              <div id="step6">
                <InputTaxReconciliation
                  details={details}
                  headerData={headerData}
                  onFinish={resetAll}
                />
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
