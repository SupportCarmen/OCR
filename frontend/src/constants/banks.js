/** Thai display names for each bank code. */
export const BANK_THAI_NAMES = {
  BBL:   'ธนาคารกรุงเทพ',
  KBANK: 'ธนาคารกสิกรไทย',
  SCB:   'ธนาคารไทยพาณิชย์',
}

/** Infer bank code from the bank's company name extracted by the LLM. */
export function detectBankFromCompanyName(bankCompanyname) {
  if (!bankCompanyname) return null
  if (bankCompanyname.includes('กรุงเทพ'))    return 'BBL'
  if (bankCompanyname.includes('กสิกร'))      return 'KBANK'
  if (bankCompanyname.includes('ไทยพาณิชย์')) return 'SCB'
  return null
}

export const BANKS = [
  { value: 'BBL', label: 'Bangkok Bank', full: 'Bangkok Bank (BBL)' },
  { value: 'KBANK', label: 'Kasikornbank', full: 'Kasikornbank (KBANK)' },
  { value: 'SCB', label: 'Siam Commercial Bank', full: 'Siam Commercial Bank (SCB)' },
];
