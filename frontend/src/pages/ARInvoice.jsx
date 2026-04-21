import DocumentPreview from '../components/ocr/DocumentPreview'
import CustomModal from '../components/common/CustomModal'
import StepWizard from '../components/common/StepWizard'
import ARUploadStep from '../components/ar-invoice/ARUploadStep'
import ARFieldMappingStep from '../components/ar-invoice/ARFieldMappingStep'
import ARReviewStep from '../components/ar-invoice/ARReviewStep'
import ARAccountMappingStep from '../components/ar-invoice/ARAccountMappingStep'
import ARSuccessStep from '../components/ar-invoice/ARSuccessStep'
import { useARInvoice } from '../hooks/useARInvoice'
import { AR_STEPS } from '../constants/arInvoice'

export default function ARInvoice() {
  const ctrl = useARInvoice()
  const {
    t, lang, setLang,
    step, setStep,
    file, previewUrl, previewType, fileInputRef,
    loading, error, setError,
    lineItems, fieldMappings, setFieldMappings, headerData,
    availableFields,
    handleFileChange, confirmMapping,
    handleAISuggest, handleReset,
    updateItem, modal,
  } = ctrl

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

        {/* Page Header */}
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

        <StepWizard step={step} steps={AR_STEPS} />

        {/* Step 1 — Upload */}
        {step === 1 && !loading && !error && (
          <ARUploadStep t={t} fileInputRef={fileInputRef} onFileChange={handleFileChange} />
        )}

        {/* Loading */}
        {loading && (
          <div className="ar-loading">
            <div className="ar-spinner" />
            <div style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text)' }}>{t.processing}</div>
            <div style={{ fontSize: '0.82rem', color: 'var(--text-3)' }}>Gemini AI กำลังวิเคราะห์โครงสร้างเอกสาร</div>
          </div>
        )}

        {/* Error */}
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

        {/* Steps 2 & 3 — Split layout with document preview */}
        {(step === 2 || step === 3) && previewUrl && !loading && (
          <div className="ar-split-layout">
            <DocumentPreview previewUrl={previewUrl} previewType={previewType} fileName={file?.name} />

            <div className="ar-work-area">
              {step === 2 && (
                <ARFieldMappingStep
                  t={t}
                  lineItems={lineItems}
                  fieldMappings={fieldMappings}
                  availableFields={availableFields}
                  onMappingChange={(col, val) => setFieldMappings(p => ({ ...p, [`col${col}`]: val }))}
                  onBack={() => setStep(1)}
                  onConfirm={confirmMapping}
                />
              )}
              {step === 3 && <ARReviewStep ctrl={ctrl} />}
            </div>
          </div>
        )}

        {/* Step 4 — Account Mapping */}
        {step === 4 && (
          <ARAccountMappingStep
            t={t}
            lineItems={lineItems}
            updateItem={updateItem}
            onBack={() => setStep(3)}
            onGenerate={() => setStep(5)}
            onAISuggest={handleAISuggest}
          />
        )}

        {/* Step 5 — Success */}
        {step === 5 && (
          <ARSuccessStep
            t={t}
            headerData={headerData}
            lineItems={lineItems}
            onReset={handleReset}
          />
        )}

      </div>
    </>
  )
}
