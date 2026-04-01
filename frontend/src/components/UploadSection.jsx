import { BANKS } from '../constants'

export default function UploadSection({ bank, onBankChange, onFileChange, fileInputRef }) {
  return (
    <div className="upload-section">
      <div className="control-group">
        <label htmlFor="bankSelector">
          <i className="fas fa-university" /> 1. เลือกธนาคาร (Bank)
        </label>
        <select id="bankSelector" value={bank} onChange={e => onBankChange(e.target.value)}>
          <option value="" disabled>-- กรุณาเลือกธนาคาร --</option>
          {BANKS.map(b => (
            <option key={b.value} value={b.value}>{b.label}</option>
          ))}
        </select>
      </div>
      <div className="control-group">
        <label htmlFor="fileInput">
          <i className="fas fa-cloud-upload-alt" /> 2. อัปโหลดไฟล์ (Image/PDF)
        </label>
        <input
          type="file"
          id="fileInput"
          ref={fileInputRef}
          accept="image/*, application/pdf"
          onChange={onFileChange}
        />
      </div>
    </div>
  )
}
