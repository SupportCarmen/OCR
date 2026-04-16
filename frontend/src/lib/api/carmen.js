/**
 * Carmen API — proxy calls to the Carmen ERP system.
 */

/**
 * Fetch Account Codes from Carmen (via backend proxy).
 * @returns {Promise<object[]>}
 */
export async function fetchAccountCodes() {
  const res = await fetch('/api/v1/ocr/carmen/account-codes')
  if (!res.ok) throw new Error(`Failed to fetch account codes (${res.status})`)
  const json = await res.json()
  return json.Data || []
}

/**
 * Fetch Departments from Carmen (via backend proxy).
 * @returns {Promise<object[]>}
 */
export async function fetchDepartments() {
  const res = await fetch('/api/v1/ocr/carmen/departments')
  if (!res.ok) throw new Error(`Failed to fetch departments (${res.status})`)
  const json = await res.json()
  return json.Data || []
}

/**
 * Fetch GL Prefixes from Carmen (via backend proxy).
 * @returns {Promise<object[]>}
 */
export async function fetchGLPrefixes() {
  const res = await fetch('/api/v1/ocr/carmen/gl-prefix')
  if (!res.ok) throw new Error(`Failed to fetch GL prefixes (${res.status})`)
  const json = await res.json()
  return json.Data || []
}

/**
 * Submit a GL Journal Voucher to Carmen (via backend proxy).
 * @param {object} payload - Full Carmen gljv payload
 * @returns {Promise<object>}
 */
export async function submitToCarmen(payload) {
  const res = await fetch('/api/v1/ocr/carmen/gljv', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!res.ok) {
    const errTxt = await res.text()
    throw new Error(`Carmen GL JV ล้มเหลว (${res.status}): ${errTxt}`)
  }
  return res.json()
}
