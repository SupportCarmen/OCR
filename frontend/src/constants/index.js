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

// cc// ลบ WHTAmount ออกจากคอลัมน์ Detail ตามที่ user ต้องการ
export const DETAIL_COLUMNS = ['Transaction', 'PayAmt', 'CommisAmt', 'TaxAmt', 'Total'];

export const HEADER_LABELS = {
  DateProcessed: 'Input Date<br><span style="font-size: 0.8em; color: #666;">Date Processed (วันที่ระบบอ่าน)</span>',
  BankName: 'Bank Name<br><span style="font-size: 0.8em; color: #666;">Bank Name</span>',
  DocName: 'Doc. Name<br><span style="font-size: 0.8em; color: #666;">Doc Name</span>',
  CompanyName: 'Company Name<br><span style="font-size: 0.8em; color: #666;">Company Name</span>',
  DocDate: 'Doc. Date<br><span style="font-size: 0.8em; color: #666;">Doc Date</span>',
  DocNo: 'Doc. No<br><span style="font-size: 0.8em; color: #666;">Doc No</span>',
  MerchantName: 'Merchant Name<br><span style="font-size: 0.8em; color: #666;">Merchant name</span>',
  MerchantId: 'Merchant ID<br><span style="font-size: 0.8em; color: #666;">Merchant ID</span>',
};

export const DETAIL_LABELS = {
  Transaction: 'Payment Type / Terminal<br><span style="font-size: 0.8em; color: #666;">Transaction</span>',
  PayAmt: 'Amount<br><span style="font-size: 0.8em; color: #666;">Pay Amt</span>',
  CommisAmt: 'Commision Amt.<br><span style="font-size: 0.8em; color: #666;">Commis Amt</span>',
  TaxAmt: 'Tax Amt.<br><span style="font-size: 0.8em; color: #666;">Tax Amt</span>',
  Total: 'Net Amt.<br><span style="font-size: 0.8em; color: #666;">Total</span>',
};

// cc// ลบ WHTAmount ออกจาก EMPTY_DETAIL_ROW ด้วย
export const EMPTY_DETAIL_ROW = {
  Transaction: '',
  PayAmt: '',
  CommisAmt: '',
  TaxAmt: '',
  Total: '',
};
