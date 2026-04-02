/**
 * Submit the processed document payload to the LOCAL backend DB (Stateless Creation).
 * @param {{ BankType: string, Overwrite: boolean, OriginalFilename: string, Header: object, Details: object[] }} payload
 * @returns {Promise<object>} response from backend
 */
export async function submitToLocal(payload) {
  const res = await fetch('/api/v1/ocr/submit', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })

  // Basic check for transport-level errors
  if (!res.ok) {
    const errTxt = await res.text()
    let detail = errTxt
    try {
      const parsed = JSON.parse(errTxt)
      if (Array.isArray(parsed.detail)) {
        detail = parsed.detail.map(d => typeof d === 'object' ? (d.msg || JSON.stringify(d)) : d).join(', ')
      } else {
        detail = parsed.detail || errTxt
      }
    } catch (e) { /* ignore */ }

    const error = new Error(`ไม่สามารถบันทึกข้อมูลได้ (${res.status})\n${detail}`)
    error.status = res.status
    error.detail = detail
    throw error
  }

  const data = await res.json()

  // Handle application-level errors (e.g. DUPLICATE_DOC_NO)
  if (data.ok === false) {
    const error = new Error(data.detail || 'เกิดข้อผิดพลาดในการบันทึกข้อมูล')
    error.status = 200
    error.code = data.error
    error.detail = data.detail
    throw error
  }

  return data
}

/**
 * Fetch Account Codes from proxy API
 * @returns {Promise<object[]>} Array of account codes
 */
export async function fetchAccountCodes() {
  const res = await fetch('/api/v1/ocr/carmen/account-codes')
  if (!res.ok) throw new Error(`Failed to fetch account codes (${res.status})`)
  const json = await res.json()
  return json.Data || []
}

/**
 * Fetch Departments from proxy API
 * @returns {Promise<object[]>} Array of departments
 */
export async function fetchDepartments() {
  const res = await fetch('/api/v1/ocr/carmen/departments')
  if (!res.ok) throw new Error(`Failed to fetch departments (${res.status})`)
  const json = await res.json()
  return json.Data || []
}
