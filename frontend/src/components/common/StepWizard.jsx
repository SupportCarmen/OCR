const DEFAULT_STEPS = [
  { n: 1, label: 'เลือกธนาคาร', sub: 'และไฟล์' },
  { n: 2, label: 'AI อ่านข้อมูล', sub: '' },
  { n: 3, label: 'ตรวจสอบข้อมูล', sub: '' },
  { n: 4, label: 'Accounting', sub: 'Review' },
  { n: 5, label: 'Input Tax', sub: 'Reconciliation' },
]

export default function StepWizard({ step, steps }) {
  const STEPS = steps || DEFAULT_STEPS
  return (
    <div className="step-wizard-wrap">
      <div className="step-wizard">
        {STEPS.map((s, i) => {
          const isDone   = step > s.n
          const isActive = step === s.n
          return (
            <div key={s.n} style={{ display: 'contents' }}>
              <div className={`step ${isActive ? 'active' : isDone ? 'done' : ''}`}>
                <div className="step-num">
                  {isDone ? <i className="fas fa-check" style={{ fontSize: '0.6rem' }} /> : String(s.n).padStart(2, '0')}
                </div>
                <span>
                  {s.label}
                  {s.sub && <span style={{ display: 'inline', opacity: 0.65 }}>{' '}{s.sub}</span>}
                </span>
              </div>
              {i < STEPS.length - 1 && (
                <div
                  className="step-sep"
                  style={step > s.n ? { background: 'var(--teal)', opacity: 0.4 } : {}}
                />
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
