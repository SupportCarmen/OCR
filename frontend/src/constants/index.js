export const BANKS = [
  { value: 'BBL', label: 'Bangkok Bank (BBL)' },
  { value: 'KBANK', label: 'Kasikornbank (KBANK)' },
  { value: 'SCB', label: 'Siam Commercial Bank (SCB)' },
];

export const DETAIL_COLUMNS = ['TerminalID', 'PayAmt', 'CommisAmt', 'TaxAmt', 'Total', 'WHTAmount', 'Transaction'];

export const HEADER_LABELS = {
  DateProcessed: 'Input Date<br><span style="font-size: 0.8em; color: #666;">Date Processed (วันที่ระบบอ่าน)</span>',
  BankName: 'Bank Name<br><span style="font-size: 0.8em; color: #666;">Bank Name</span>',
  DocName: 'Doc. Name<br><span style="font-size: 0.8em; color: #666;">Doc Name</span>',
  CompanyName: 'Company Name<br><span style="font-size: 0.8em; color: #666;">Company Name</span>',
  DocDate: 'Doc. Date<br><span style="font-size: 0.8em; color: #666;">Doc Date</span>',
  DocNo: 'Doc. No<br><span style="font-size: 0.8em; color: #666;">Doc No</span>',
  MerchantName: 'Merchant name<br><span style="font-size: 0.8em; color: #666;">Merchant name</span>'
};

export const DETAIL_LABELS = {
  TerminalID: 'Terminal ID<br><span style="font-size: 0.8em; color: #666;">Terminal ID</span>',
  PayAmt: 'Amount<br><span style="font-size: 0.8em; color: #666;">Pay Amt</span>',
  CommisAmt: 'Commision Amt.<br><span style="font-size: 0.8em; color: #666;">Commis Amt</span>',
  TaxAmt: 'Tax Amt.<br><span style="font-size: 0.8em; color: #666;">Tax Amt</span>',
  Total: 'Net Amt.<br><span style="font-size: 0.8em; color: #666;">Total</span>',
  WHTAmount: 'WHT Amount<br><span style="font-size: 0.8em; color: #666;">WHT Amount</span>',
  Transaction: 'Payment Type<br><span style="font-size: 0.8em; color: #666;">Transaction</span>'
};

export const EMPTY_DETAIL_ROW = {
  TerminalID: '',
  PayAmt: '',
  CommisAmt: '',
  TaxAmt: '',
  Total: '',
  WHTAmount: '',
  Transaction: ''
};
