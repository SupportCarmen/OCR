/**
 * Feedback API — log user corrections for learning
 */

import { apiFetch } from './client'

const FIELD_NAME_MAP = {
  DateProcessed: 'date_processed',
  BankName: 'bank_name',
  DocName: 'doc_name',
  CompanyName: 'company_name',
  DocDate: 'doc_date',
  DocNo: 'doc_no',
  MerchantName: 'merchant_name',
  MerchantId: 'merchant_id',
  transaction: 'transaction',
  pay_amt: 'pay_amt',
  commis_amt: 'commis_amt',
  tax_amt: 'tax_amt',
  total: 'total',
}

function mapFieldName(key) {
  return FIELD_NAME_MAP[key] || key
}

export async function logCorrections(receiptId, bankType, corrections) {
  if (!receiptId || !bankType || !corrections.length) return

  const results = await Promise.allSettled(
    corrections.map(({ fieldName, originalValue, correctedValue }) =>
      apiFetch('/api/v1/feedback/correction', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          receipt_id: receiptId,
          bank_type: bankType,
          field_name: mapFieldName(fieldName),
          original_value: String(originalValue ?? ''),
          corrected_value: String(correctedValue ?? ''),
        }),
      })
    )
  )

  const logged = results.filter(r => r.status === 'fulfilled').length
  console.log(`[feedback] ✓ Logged ${logged}/${corrections.length} corrections`)
}

export function diffCorrections(headerData, originalHeader, details, originalDetails) {
  const corrections = []

  for (const [key, value] of Object.entries(headerData)) {
    const orig = originalHeader[key]
    if (orig !== undefined && String(orig ?? '') !== String(value ?? '')) {
      corrections.push({ fieldName: key, originalValue: orig, correctedValue: value })
    }
  }

  details.forEach((row, rowIdx) => {
    const origRow = originalDetails[rowIdx]
    if (!origRow) return
    for (const [col, value] of Object.entries(row)) {
      const orig = origRow[col]
      if (orig !== undefined && String(orig ?? '') !== String(value ?? '')) {
        corrections.push({ fieldName: col, originalValue: orig, correctedValue: value })
      }
    }
  })

  return corrections
}
