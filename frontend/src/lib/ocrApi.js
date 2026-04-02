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

  const uploadRes = await fetch(url, {
    method: 'POST',
    body: formData,
  })

  if (!uploadRes.ok) {
    const err = await uploadRes.json().catch(() => ({}))
    throw new Error(err.detail || `Upload failed (${uploadRes.status})`)
  }

  const { task_ids } = await uploadRes.json()
  const taskId = task_ids[0]

  const taskRes = await fetch(`/api/v1/ocr/tasks/${taskId}`)
  if (!taskRes.ok) throw new Error(`ดึงผล OCR ไม่สำเร็จ (${taskRes.status})`)

  const task = await taskRes.json()
  if (task.status === 'failed') {
    throw new Error(task.error_message || 'OCR processing failed')
  }

  const receipt = task.receipt || {}

  // Map all detail rows from DB (preserves multi-row BBL, single-row SCB/KBANK)
  const details = (receipt.details || []).map(d => ({
    Transaction: d.transaction || '',
    PayAmt: d.pay_amt != null ? String(d.pay_amt) : '',
    CommisAmt: d.commis_amt != null ? String(d.commis_amt) : '',
    TaxAmt: d.tax_amt != null ? String(d.tax_amt) : '',
    WHTAmount: d.wht_amount != null ? String(d.wht_amount) : '',
    Total: d.total != null ? String(d.total) : '',
  }))

  return {
    task_id: task.id,
    receipt_id: receipt.id,
    // display header fields (6 fields shown in UI)
    bank_name: receipt.bank_name || '',
    bank_type: receipt.bank_type || '',
    doc_name: receipt.doc_name || '',
    company_name: receipt.company_name || '',
    doc_date: receipt.doc_date || '',
    doc_no: receipt.doc_no || '',
    // extra fields (stored in DB, not displayed in UI yet)
    company_tax_id: receipt.company_tax_id || '',
    company_address: receipt.company_address || '',
    account_no: receipt.account_no || '',
    merchant_name: receipt.merchant_name || '',
    merchant_id: receipt.merchant_id || '',
    wht_rate: receipt.wht_rate || '',
    wht_amount: receipt.wht_amount != null ? String(receipt.wht_amount) : '',
    net_amount: receipt.net_amount != null ? String(receipt.net_amount) : '',
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
