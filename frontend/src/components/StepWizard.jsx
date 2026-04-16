const STEPS = [
  { n: 1, label: 'เลือกธนาคารและไฟล์' },
  { n: 2, label: 'AI อ่านข้อมูล' },
  { n: 3, label: 'ตรวจสอบข้อมูล' },
  { n: 4, label: 'Review Accounting & Submit' },
  { n: 5, label: 'Journal Voucher' },
  { n: 6, label: 'Input Tax Reconciliation' },
]

export default function StepWizard({ step }) {
  return (
    <div className="step-wizard">
      {STEPS.map((s, i) => (
        <div key={s.n} style={{ display: 'contents' }}>
          <div className={`step ${step === s.n ? 'active' : step > s.n ? 'done' : ''}`}>
            <div className="step-num">
              {step > s.n ? <i className="fas fa-check" /> : String(s.n).padStart(2, '0')}
            </div>
            <span>{s.label}</span>
          </div>
          {i < STEPS.length - 1 && <div className="step-sep" />}
        </div>
      ))}
    </div>
  )
}
