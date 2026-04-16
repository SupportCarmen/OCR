/**
 * Mapping API — GL account/department mapping suggestions and history.
 */

/**
 * Ask LLM to suggest dept/acc codes for Commission, Tax Amount, Net Amount.
 * @param {{ accounts: {code,name}[], departments: {code,name}[] }} payload
 * @returns {Promise<{ suggestions: object, source: string }>}
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
 * Ask LLM to suggest dept/acc codes for a list of payment types.
 * @param {{ payment_types: string[], accounts: {code,name}[], departments: {code,name}[] }} payload
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
