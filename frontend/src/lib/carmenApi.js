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

/**
 * Fetch GL Prefixes from proxy API
 * @returns {Promise<object[]>} Array of GL prefixes
 */
export async function fetchGLPrefixes() {
  const res = await fetch('/api/v1/ocr/carmen/gl-prefix')
  if (!res.ok) throw new Error(`Failed to fetch GL prefixes (${res.status})`)
  const json = await res.json()
  return json.Data || []
}

/**
 * Ask LLM to suggest dept/acc codes for Commission, Tax Amount, Net Amount (fixed types).
 * @param {{ bank_name: string, accounts: {code,name}[], departments: {code,name}[] }} payload
 * @returns {Promise<{ suggestions: { Commission, "Tax Amount", "Net Amount" }, source: string }>}
 */
export async function suggestMapping(payload) {
  const res = await fetch('/api/v1/mapping/suggest', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!res.ok) {
    const errBody = await res.text().catch(() => '')
    console.error('[suggestMapping] Error body:', errBody)
    throw new Error(`Suggest failed (${res.status})`)
  }
  return res.json()
}

/**
 * Load saved mapping history for a bank.
 * @param {string} bankName
 * @returns {Promise<{ bank_name: string, history: object }>}
 */
export async function fetchMappingHistory(bankName) {
  const res = await fetch(`/api/v1/mapping/history?bank_name=${encodeURIComponent(bankName)}`)
  if (!res.ok) throw new Error(`History fetch failed (${res.status})`)
  return res.json()
}

/**
 * Ask LLM to suggest dept/acc codes for a list of payment types.
 * @param {{ bank_name: string, payment_types: string[], accounts: {code,name}[], departments: {code,name}[] }} payload
 * @returns {Promise<{ suggestions: object, source: string }>}
 */
export async function suggestPaymentTypes(payload) {
  const res = await fetch('/api/v1/mapping/suggest-payment-types', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!res.ok) throw new Error(`Suggest payment types failed (${res.status})`)
  return res.json()
}

/**
 * Save confirmed mappings to history.
 * @param {{ bank_name: string, mappings: object }} payload
 */
export async function saveMappingHistory(payload) {
  const res = await fetch('/api/v1/mapping/history/save', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!res.ok) throw new Error(`History save failed (${res.status})`)
  return res.json()
}
