import DocumentPreview from '../components/ocr/DocumentPreview'
import CustomModal from '../components/common/CustomModal'
import StepWizard from '../components/common/StepWizard'
import APUploadStep from '../components/ap-invoice/APUploadStep'
import APFieldMappingStep from '../components/ap-invoice/APFieldMappingStep'
import APReviewStep from '../components/ap-invoice/APReviewStep'
import APAccountMappingStep from '../components/ap-invoice/APAccountMappingStep'
import APSuccessStep from '../components/ap-invoice/APSuccessStep'
import { useAPInvoice } from '../hooks/useAPInvoice'
import { AP_STEPS } from '../constants/apInvoice'

export default function APInvoice() {
  const ctrl = useAPInvoice()
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
        <div className="app-header ap-header">
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

        <StepWizard step={step} steps={AP_STEPS} />

        {/* Step 1 — Upload */}
        {step === 1 && !loading && !error && (
          <APUploadStep t={t} fileInputRef={fileInputRef} onFileChange={handleFileChange} />
        )}

        {/* Loading */}
        {loading && (
          <div className="ap-loading">
            <div className="ap-spinner" />
            <div style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text)' }}>{t.processing}</div>
            <div style={{ fontSize: '0.82rem', color: 'var(--text-3)' }}>Gemini AI กำลังวิเคราะห์โครงสร้างเอกสาร</div>
          </div>
        )}

        {/* Error */}
        {error && (
          <div style={{ maxWidth: 480, margin: '0 auto', padding: '2rem 0' }}>
            <div className="ap-error-box">
              <i className="fas fa-circle-exclamation" />
              <div>
                <div className="ap-error-title">OCR Processing Error</div>
                <div className="ap-error-msg">{error}</div>
                <button className="btn btn-sm btn-outline" style={{ marginTop: '0.75rem' }} onClick={() => setError(null)}>
                  <i className="fas fa-rotate-right" /> {t.retry}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Steps 2 & 3 — Split layout with document preview */}
        {(step === 2 || step === 3) && previewUrl && !loading && (
          <div className="ap-split-layout">
            <DocumentPreview previewUrl={previewUrl} previewType={previewType} fileName={file?.name} />

            <div className="ap-work-area">
              {step === 2 && (
                <APFieldMappingStep
                  t={t}
                  lineItems={lineItems}
                  fieldMappings={fieldMappings}
                  availableFields={availableFields}
                  onMappingChange={(col, val) => setFieldMappings(p => ({ ...p, [`col${col}`]: val }))}
                  onBack={() => setStep(1)}
                  onConfirm={confirmMapping}
                />
              )}
              {step === 3 && <APReviewStep ctrl={ctrl} />}
            </div>
          </div>
        )}

        {/* Step 4 — Account Mapping */}
        {step === 4 && (
          <APAccountMappingStep
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
          <APSuccessStep
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
