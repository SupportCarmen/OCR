/**
 * Submit API — save confirmed receipt data to the local database.
 */

/**
 * Submit the processed document payload to the local backend DB.
 * @param {{ BankType: string, Overwrite: boolean, OriginalFilename: string, Header: object, Details: object[] }} payload
 * @returns {Promise<object>} response from backend
 */
export async function submitToLocal(payload) {
  const res = await fetch('/api/v1/ocr/submit', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })

  if (!res.ok) {
    const errTxt = await res.text()
    let detail = errTxt
    try {
      const parsed = JSON.parse(errTxt)
      if (Array.isArray(parsed.detail)) {
        detail = parsed.detail
          .map(d => (typeof d === 'object' ? d.msg || JSON.stringify(d) : d))
          .join(', ')
      } else {
        detail = parsed.detail || errTxt
      }
    } catch { /* ignore */ }

    const error = new Error(`ไม่สามารถบันทึกข้อมูลได้ (${res.status})\n${detail}`)
    error.status = res.status
    error.detail = detail
    throw error
  }

  const data = await res.json()

  // Application-level errors (e.g. DUPLICATE_DOC_NO — HTTP 200 but ok:false)
  if (data.ok === false) {
    const error = new Error(data.detail || 'เกิดข้อผิดพลาดในการบันทึกข้อมูล')
    error.status = 200
    error.code   = data.error
    error.detail = data.detail
    throw error
  }

  return data
}
