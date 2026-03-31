/**
 * Submit the processed document payload to the LOCAL backend DB.
 * @param {string} receiptId - receipt UUID from OCR extraction
 * @param {{ BankType: string, Overwrite: boolean, Header: object, Details: object[] }} payload
 * @returns {Promise<object>} response from backend
 */
export async function submitToLocal(receiptId, payload) {
  const res = await fetch(`/api/v1/ocr/receipts/${receiptId}/submit-local`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })

  // Basic check for transport-level errors (4xx/5xx NOT handled by our custom logic)
  if (!res.ok) {
    const errTxt = await res.text()
    let detail = errTxt
    try {
      const parsed = JSON.parse(errTxt)
      detail = parsed.detail || errTxt
    } catch (e) { /* ignore */ }

    const error = new Error(`ไม่สามารถบันทึกข้อมูลได้ (${res.status})\n${detail}`)
    error.status = res.status
    error.detail = detail
    throw error
  }

  const data = await res.json()

  // Handle application-level errors (returned as 200 OK but with ok: false)
  if (data.ok === false) {
    const error = new Error(data.detail || 'เกิดข้อผิดพลาดในการบันทึกข้อมูล')
    error.status = 200 // Technically it was a 200 OK
    error.code = data.error // e.g., 'DUPLICATE_DOC_NO'
    error.detail = data.detail
    throw error
  }

  return data
}
