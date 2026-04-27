/**
 * OCR API — extract receipt data from uploaded files.
 */

import { apiFetch } from './client'

export async function extractFromFile(file, bankType) {
  const formData = new FormData()
  formData.append('files', file)

  const url = bankType
    ? `/api/v1/ocr/extract?bank_type=${bankType}`
    : '/api/v1/ocr/extract'

  const res = await apiFetch(url, { method: 'POST', body: formData })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.detail || `Upload failed (${res.status})`)
  }

  const results = await res.json()
  const receipt = results[0] || {}

  const details = (receipt.details || []).map(d => ({
    Transaction: d.transaction || '',
    PayAmt:      d.pay_amt    || '',
    CommisAmt:   d.commis_amt || '',
    TaxAmt:      d.tax_amt    || '',
    WHTAmount:   '',
    Total:       d.total      || '',
  }))

  return {
    bank_name:        receipt.bank_name        || '',
    bank_type:        bankType                 || '',
    doc_name:         receipt.doc_name         || '',
    company_name:     receipt.company_name     || '',
    doc_date:         receipt.doc_date         || '',
    doc_no:           receipt.doc_no           || '',
    company_tax_id:   receipt.company_tax_id   || '',
    company_address:  receipt.company_address  || '',
    account_no:       receipt.account_no       || '',
    merchant_name:    receipt.merchant_name    || '',
    merchant_id:      receipt.merchant_id      || '',
    wht_rate:         receipt.wht_rate         || '',
    wht_amount:       receipt.wht_amount       || '',
    net_amount:       receipt.net_amount       || '',
    bank_companyname: receipt.bank_companyname || '',
    is_duplicate:     receipt.is_duplicate     || false,
    details,
  }
}

export async function markSubmitted(receiptId) {
  const res = await apiFetch(`/api/v1/ocr/receipts/${receiptId}/submit`, { method: 'PATCH' })
  if (!res.ok) {
    console.warn(`markSubmitted failed for ${receiptId}: ${res.status}`)
  }
}
