import { useState } from 'react'
import { BANKS } from '../constants'

export default function UploadSection({ bank, onBankChange, onFileChange, fileInputRef, fileName }) {
  const [isDragOver, setIsDragOver] = useState(false)

  const handleDragOver = (e) => {
    e.preventDefault()
    setIsDragOver(true)
  }

  const handleDragLeave = () => {
    setIsDragOver(false)
  }

  const handleDrop = (e) => {
    e.preventDefault()
    setIsDragOver(false)
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      // Create a spoof event to send to onFileChange
      const fakeEvent = {
        target: { files: e.dataTransfer.files }
      }
      onFileChange(fakeEvent)
      if (fileInputRef.current) {
        fileInputRef.current.files = e.dataTransfer.files
      }
    }
  }

  return (
    <div className="upload-section">
      {/* Bank Selector */}
      <div className="panel-card">
        <div className="field-label"><i className="fas fa-university"></i> เลือกธนาคาร</div>
        <div className="bank-select-grid">
          {BANKS.map((b) => {
            const isSelected = bank === b.value
            return (
              <label 
                key={b.value} 
                className={`bank-option ${isSelected ? 'selected' : ''}`}
              >
                <input 
                  type="radio" 
                  name="bank" 
                  value={b.value} 
                  checked={isSelected}
                  onChange={(e) => onBankChange(e.target.value)}
                />
                <div className="bank-dot"></div>
                <span className="bank-name">{b.label}</span>
                <span className="bank-code">{b.value}</span>
              </label>
            )
          })}
        </div>
      </div>

      {/* File Upload Drop Zone */}
      <div 
        className={`panel-card upload-drop ${isDragOver ? 'dragover' : ''}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <input 
          type="file" 
          id="fileInput" 
          ref={fileInputRef}
          accept="image/*, application/pdf"
          onChange={onFileChange}
        />
        <div className="upload-icon"><i className="fas fa-cloud-upload-alt"></i></div>
        <div className="upload-label">
          {fileName ? (fileName.length > 28 ? fileName.slice(0, 25) + '…' : fileName) : 'คลิกหรือลากไฟล์มาวาง'}
        </div>
        <div className="upload-hint">รองรับ JPG · PNG · PDF</div>
      </div>

      {/* How-to Card */}
      <div className="panel-card">
        <div className="field-label"><i className="fas fa-circle-info"></i> วิธีใช้งาน</div>
        <div className="how-to-list">
          <div className="how-to-item">
            <div className="how-step-num gold">1</div>
            <span>เลือกธนาคารที่ตรงกับเอกสาร</span>
          </div>
          <div className="how-to-item">
            <div className="how-step-num gold">2</div>
            <span>อัปโหลดไฟล์รายงาน (รูปภาพหรือ PDF)</span>
          </div>
          <div className="how-to-item">
            <div className="how-step-num gold">3</div>
            <span>กด "อ่านข้อมูล" เพื่อให้ AI ดึงข้อมูล</span>
          </div>
          <div className="how-to-item">
            <div className="how-step-num teal">4</div>
            <span>ตรวจสอบข้อมูล แล้วกด Submit</span>
          </div>
        </div>
      </div>
    </div>
  )
}
