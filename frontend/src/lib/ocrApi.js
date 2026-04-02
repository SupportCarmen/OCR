/**
 * Upload a file to the OCR backend and return extracted fields.
 * @param {File} file
 * @param {string} bankType - BBL | KBANK | SCB
 * @returns {Promise<object>} flat extracted fields + task_id + receipt_id
 */
export async function extractFromFile(file, bankType) {
  const formData = new FormData()
  formData.append('files', file)

  const url = bankType
    ? `/api/v1/ocr/extract?bank_type=${bankType}`
    : '/api/v1/ocr/extract'

  const res = await fetch(url, {
    method: 'POST',
    body: formData,
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.detail || `Upload failed (${res.status})`)
  }

  const results = await res.json()
  const receipt = results[0] || {}

  // Map all detail rows from stateless response
  const details = (receipt.details || []).map(d => ({
    Transaction: d.transaction || '',
    PayAmt: d.pay_amt || '',
    CommisAmt: d.commis_amt || '',
    TaxAmt: d.tax_amt || '',
    WHTAmount: '', // extracted separately in header usually, or can be empty for now
    Total: d.total || '',
  }))

  return {
    // display header fields (6 fields shown in UI)
    bank_name: receipt.bank_name || '',
    bank_type: bankType || '',
    doc_name: receipt.doc_name || '',
    company_name: receipt.company_name || '',
    doc_date: receipt.doc_date || '',
    doc_no: receipt.doc_no || '',
    // extra fields
    company_tax_id: receipt.company_tax_id || '',
    company_address: receipt.company_address || '',
    account_no: receipt.account_no || '',
    merchant_name: receipt.merchant_name || '',
    merchant_id: receipt.merchant_id || '',
    wht_rate: receipt.wht_rate || '',
    wht_amount: receipt.wht_amount || '',
    net_amount: receipt.net_amount || '',
    // all detail rows
    details,
  }
}

/**
 * Mark a receipt as submitted (sets submitted_at in DB).
 * @param {string} receiptId
 */
export async function markSubmitted(receiptId) {
  const res = await fetch(`/api/v1/ocr/receipts/${receiptId}/submit`, {
    method: 'PATCH',
  })
  if (!res.ok) {
    console.warn(`markSubmitted failed for ${receiptId}: ${res.status}`)
  }
}
