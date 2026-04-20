import '../styles/pages/home.css'

const MODULES = [
  {
    id: 'credit-card-ocr',
    route: '#/CreditCardOCR',
    name: 'Credit Card Report OCR',
    description: 'ระบบ AI อ่านใบเสร็จ Credit Card Report จากธนาคาร แปลงเป็นข้อมูลอัตโนมัติ พร้อมส่งเข้า Carmen GL',
    icon: 'fa-file-invoice-dollar',
    iconBg: 'linear-gradient(135deg, #2563eb 0%, #3b82f6 100%)',
    iconColor: '#fff',
    accent: '#2563eb',
    tag: { label: 'ACTIVE', bg: '#f0fdf4', color: '#16a34a', border: '#86efac' },
    features: ['OCR AI', 'Carmen GL', 'Input Tax'],
  },
  {
    id: 'ar-invoice',
    route: '#/ARInvoice', // Activated AR Invoice route
    name: 'AR Invoice Processing',
    description: 'ระบบจัดการใบแจ้งหนี้ลูกค้า (AR Invoice) อ่านข้อมูลอัตโนมัติ และบันทึกเข้าระบบบัญชี',
    icon: 'fa-receipt',
    iconBg: 'linear-gradient(135deg, #7c3aed 0%, #a78bfa 100%)',
    iconColor: '#fff',
    accent: '#7c3aed',
    tag: { label: 'COMING SOON', bg: '#faf5ff', color: '#7c3aed', border: '#d8b4fe' },
    features: ['Invoice OCR', 'Auto Matching'],
  },
  {
    id: 'bank-reconciliation',
    route: null, // coming soon
    name: 'Bank Reconciliation',
    description: 'ระบบกระทบยอดธนาคาร เปรียบเทียบ Statement กับรายการบัญชีอัตโนมัติ',
    icon: 'fa-building-columns',
    iconBg: 'linear-gradient(135deg, #0d9488 0%, #14b8a6 100%)',
    iconColor: '#fff',
    accent: '#0d9488',
    tag: { label: 'COMING SOON', bg: '#f0fdfa', color: '#0d9488', border: '#99f6e4' },
    features: ['Statement Import', 'Auto Match'],
  },
]

export default function Home() {
  const navigate = (route) => {
    if (route) window.location.hash = route.replace('#', '')
  }

  return (
    <div className="home-page">
      {/* ─── Hero Header ─── */}
      <div className="home-hero">
        <div className="home-logo">
          <i className="fas fa-brain" />
        </div>
        <h1 className="home-title">
          Carmen <span>AI Automation</span>
        </h1>
        <p className="home-subtitle">
          ระบบ AI อัตโนมัติสำหรับงานบัญชี — เลือกโมดูลที่ต้องการใช้งาน
        </p>
        <div className="home-version">
          <span className="dot" />
          System Online — v1.0.0
        </div>
      </div>

      {/* ─── Module Cards ─── */}
      <div className="home-modules">
        <div className="home-modules-title">เลือกโมดูล</div>

        <div className="module-grid">
          {MODULES.map((mod) => {
            const isComingSoon = !mod.route
            return (
              <div
                key={mod.id}
                className={`module-card ${isComingSoon ? 'coming-soon' : ''}`}
                style={{ '--card-accent': mod.accent }}
                onClick={() => !isComingSoon && navigate(mod.route)}
                role={isComingSoon ? undefined : 'button'}
                tabIndex={isComingSoon ? undefined : 0}
                onKeyDown={(e) => {
                  if (!isComingSoon && (e.key === 'Enter' || e.key === ' ')) {
                    e.preventDefault()
                    navigate(mod.route)
                  }
                }}
              >
                <div className="module-card-header">
                  <div
                    className="module-card-icon"
                    style={{ background: mod.iconBg, color: mod.iconColor }}
                  >
                    <i className={`fas ${mod.icon}`} />
                  </div>
                  <div className="module-card-info">
                    <div className="module-card-name">{mod.name}</div>
                    <span
                      className="module-card-tag"
                      style={{
                        background: mod.tag.bg,
                        color: mod.tag.color,
                        border: `1px solid ${mod.tag.border}`,
                      }}
                    >
                      <i className={`fas ${isComingSoon ? 'fa-clock' : 'fa-circle-check'}`} style={{ fontSize: '0.6rem' }} />
                      {mod.tag.label}
                    </span>
                  </div>
                </div>

                <div className="module-card-desc">{mod.description}</div>

                <div className="module-card-footer">
                  <div className="module-card-features">
                    {mod.features.map((f) => (
                      <span key={f} className="module-card-feature">{f}</span>
                    ))}
                  </div>
                  <div className="module-card-arrow">
                    <i className={`fas ${isComingSoon ? 'fa-lock' : 'fa-arrow-right'}`} />
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* ─── Footer ─── */}
      <div className="home-footer">
        Carmen AI Automation Platform • Powered by AI OCR & LLM
      </div>
    </div>
  )
}
