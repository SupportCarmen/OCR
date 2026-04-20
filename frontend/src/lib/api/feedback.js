/**
 * Feedback API — log user corrections for learning
 *
 * Field names are mapped from frontend PascalCase to snake_case
 * to match the LLM prompt field names.
 */

const FIELD_NAME_MAP = {
  // Header fields (PascalCase → snake_case)
  DateProcessed: 'date_processed',
  BankName: 'bank_name',
  DocName: 'doc_name',
  CompanyName: 'company_name',
  DocDate: 'doc_date',
  DocNo: 'doc_no',
  MerchantName: 'merchant_name',
  MerchantId: 'merchant_id',
  // Detail fields (already snake_case — pass through)
  transaction: 'transaction',
  pay_amt: 'pay_amt',
  commis_amt: 'commis_amt',
  tax_amt: 'tax_amt',
  wht_amount: 'wht_amount',
  total: 'total',
}

function mapFieldName(key) {
  return FIELD_NAME_MAP[key] || key
}

/**
 * Log all corrections at submit time — compares final values against originals.
 * Sends batch to backend (one request per correction, fire-and-forget).
 */
export async function logCorrections(receiptId, bankType, corrections) {
  if (!receiptId || !bankType || !corrections.length) return

  const results = await Promise.allSettled(
    corrections.map(({ fieldName, originalValue, correctedValue }) =>
      fetch('/api/v1/feedback/correction', {
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

/**
 * Compare current header + details against originals and return diff list.
 */
export function diffCorrections(headerData, originalHeader, details, originalDetails) {
  const corrections = []

  // Header diff
  for (const [key, value] of Object.entries(headerData)) {
    const orig = originalHeader[key]
    if (orig !== undefined && String(orig ?? '') !== String(value ?? '')) {
      corrections.push({ fieldName: key, originalValue: orig, correctedValue: value })
    }
  }

  // Detail diff
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
