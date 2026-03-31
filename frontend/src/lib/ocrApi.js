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
  const detail = (receipt.details || [])[0] || {}

  return {
    task_id: task.id,
    receipt_id: receipt.id,
    // header fields
    bank_name: receipt.bank_name || '',
    bank_type: receipt.bank_type || '',
    doc_name: receipt.doc_name || '',
    company_name: receipt.company_name || '',
    doc_date: receipt.doc_date || '',
    doc_no: receipt.doc_no || '',
    // detail fields (first row)
    terminal_id: detail.terminal_id || '',
    pay_amt: detail.pay_amt != null ? String(detail.pay_amt) : '',
    commis_amt: detail.commis_amt != null ? String(detail.commis_amt) : '',
    tax_amt: detail.tax_amt != null ? String(detail.tax_amt) : '',
    wht_amount: detail.wht_amount != null ? String(detail.wht_amount) : '',
    total: detail.total != null ? String(detail.total) : '',
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
