const BANKS = [
  { value: 'BBL', label: 'Bangkok Bank (BBL)' },
  { value: 'KBANK', label: 'Kasikornbank (KBANK)' },
  { value: 'SCB', label: 'Siam Commercial Bank (SCB)' },
];

const DETAIL_COLUMNS = ['TerminalID', 'PayAmt', 'CommisAmt', 'TaxAmt', 'Total', 'WHTAmount', 'Transaction'];

const HEADER_LABELS = {
  DateProcessed: 'Input Date<br><span style="font-size: 0.8em; color: #666;">Date Processed (วันที่ระบบอ่าน)</span>',
  BankName: 'Bank Name<br><span style="font-size: 0.8em; color: #666;">Bank Name</span>',
  DocName: 'Doc. Name<br><span style="font-size: 0.8em; color: #666;">Doc Name</span>',
  CompanyName: 'Company Name<br><span style="font-size: 0.8em; color: #666;">Company Name</span>',
  DocDate: 'Doc. Date<br><span style="font-size: 0.8em; color: #666;">Doc Date</span>',
  DocNo: 'Doc. No<br><span style="font-size: 0.8em; color: #666;">Doc No</span>',
  MerchantName: 'Merchant name<br><span style="font-size: 0.8em; color: #666;">Merchant name</span>'
};

const DETAIL_LABELS = {
  TerminalID: 'Terminal ID<br><span style="font-size: 0.8em; color: #666;">Terminal ID</span>',
  PayAmt: 'Amount<br><span style="font-size: 0.8em; color: #666;">Pay Amt</span>',
  CommisAmt: 'Commision Amt.<br><span style="font-size: 0.8em; color: #666;">Commis Amt</span>',
  TaxAmt: 'Tax Amt.<br><span style="font-size: 0.8em; color: #666;">Tax Amt</span>',
  Total: 'Net Amt.<br><span style="font-size: 0.8em; color: #666;">Total</span>',
  WHTAmount: 'WHT Amount<br><span style="font-size: 0.8em; color: #666;">WHT Amount</span>',
  Transaction: 'Payment Type<br><span style="font-size: 0.8em; color: #666;">Transaction</span>'
};

const EMPTY_DETAIL_ROW = {
  TerminalID: '',
  PayAmt: '',
  CommisAmt: '',
  TaxAmt: '',
  Total: '',
  WHTAmount: '',
  Transaction: ''
};

let currentData = {
  header: {},
  details: []
};

const submittedDocNos = new Set();

const fileInput = document.getElementById('fileInput');
const bankSelector = document.getElementById('bankSelector');
const documentPreview = document.getElementById('documentPreview');
const pdfPreview = document.getElementById('pdfPreview');
const previewPlaceholder = document.getElementById('previewPlaceholder');
const btnProcess = document.getElementById('btnProcess');
const loading = document.getElementById('loading');
const processStatus = document.getElementById('processStatus');
const resultArea = document.getElementById('resultArea');
const headerForm = document.getElementById('headerForm');
const tableHeader = document.getElementById('tableHeader');
const tableBody = document.getElementById('tableBody');

if (bankSelector) {
  bankSelector.innerHTML = '';
  BANKS.forEach(b => {
    const option = document.createElement('option');
    option.value = b.value;
    option.innerText = b.label;
    bankSelector.appendChild(option);
  });
}

fileInput.addEventListener('change', function (e) {
  const file = e.target.files[0];
  if (!file) return;

  const fileName = file.name.toLowerCase();
  const isImage = file.type.startsWith('image/') || fileName.match(/\.(jpg|jpeg|png|gif|bmp|webp)$/i);
  const isPDF = file.type === 'application/pdf' || fileName.match(/\.pdf$/i);

  if (isImage || isPDF) {
    const fileURL = URL.createObjectURL(file);

    previewPlaceholder.style.display = 'none';
    if (isImage) {
      documentPreview.src = fileURL;
      documentPreview.style.display = 'block';
      if (pdfPreview) pdfPreview.style.display = 'none';
    } else if (isPDF) {
      if (pdfPreview) {
        pdfPreview.src = fileURL + '#view=FitH';
        pdfPreview.style.display = 'block';
      }
      documentPreview.style.display = 'none';
    }
  } else {
    documentPreview.style.display = 'none';
    if (pdfPreview) pdfPreview.style.display = 'none';
    previewPlaceholder.style.display = 'block';

    let fileExt = fileName.split('.').pop().toUpperCase();
    previewPlaceholder.innerHTML = `<i class="fas fa-file-alt placeholder-icon"></i><p>${fileExt} File Selected<br><span style="font-size: 0.8em; color: gray;">(Preview not available for this type)</span></p>`;
  }

  resultArea.classList.add('hidden');
  processStatus.innerText = '';
});

async function processFile() {
  const bank = bankSelector.value;

  if (fileInput.files.length === 0) {
    alert("กรุณาเลือกไฟล์ก่อนดำเนินการ");
    return;
  }

  loading.style.display = 'block';
  processStatus.innerText = "AI กำลังอ่านข้อมูลจากเอกสาร...";
  resultArea.classList.add('hidden');
  btnProcess.disabled = true;

  // จำลองระยะเวลาที่ AI ใช้ในการอ่านข้อมูล
  await new Promise(r => setTimeout(r, 1500));

  const todayStr = new Date().toLocaleDateString('en-GB');
  const selectedBank = BANKS.find(b => b.value === bank);
  const bankLabel = selectedBank ? selectedBank.label : bank;

  // สร้างข้อมูลเริ่มต้น (Header) และรายการว่าง (Details)
  currentData = {
    header: {
      DateProcessed: todayStr,
      BankName: bankLabel,
      DocName: fileInput.files[0].name,
      CompanyName: "",
      DocDate: "",
      DocNo: "",
      MerchantName: ""
    },
    details: []
  };

  // หากต้องการใช้ระบบ OCR จริง สามารถเรียก API ได้ที่นี่
  // const extractedData = await extractFromFile(fileInput.files[0]);
  // currentData.header.CompanyName = extractedData.company_name || "";
  // currentData.details = extractedData.details || [];

  renderUI(bank);

  loading.style.display = 'none';
  processStatus.innerText = "อ่านข้อมูลสำเร็จ";
  resultArea.classList.remove('hidden');
  btnProcess.disabled = false;
}

function renderUI(bank) {
  headerForm.innerHTML = '';
  for (const [key, value] of Object.entries(currentData.header)) {
    const div = document.createElement('div');
    div.className = 'form-field';
    const labelText = HEADER_LABELS[key] || key;
    div.innerHTML = `
            <label>${labelText}</label>
            <input type="text" id="head_${key}" value="${value}">
        `;
    headerForm.appendChild(div);
  }

  let columns = DETAIL_COLUMNS;

  tableHeader.innerHTML = '';
  columns.forEach(col => {
    const th = document.createElement('th');
    th.innerHTML = DETAIL_LABELS[col] || col;
    tableHeader.appendChild(th);
  });
  tableHeader.innerHTML += '<th style="text-align: center;">Action</th>';

  tableBody.innerHTML = '';
  currentData.details.forEach((row, index) => {
    const tr = document.createElement('tr');

    let rowHtml = '';
    columns.forEach(col => {
      rowHtml += `
                <td>
                    <input type="text" value="${row[col] !== undefined ? row[col] : ''}" data-row="${index}" data-col="${col}" class="detail-input" >
                </td>
            `;
    });

    rowHtml += `
            <td style="text-align: center;">
                <button onclick="deleteRow(${index})" class="btn-delete" title="ลบรายการ">
                    <i class="fas fa-trash"></i>
                </button>
            </td>
        `;

    tr.innerHTML = rowHtml;
    tableBody.appendChild(tr);
  });
}



function deleteRow(index) {
  currentData.details.splice(index, 1);
  const bank = bankSelector.value;
  renderUI(bank);
}

function cancelProcess() {
  if (confirm("คุณต้องการยกเลิกและล้างข้อมูลหรือไม่?")) {
    resultArea.classList.add('hidden');
    fileInput.value = '';
    processStatus.innerText = '';
    documentPreview.style.display = 'none';
    if (pdfPreview) pdfPreview.style.display = 'none';
    previewPlaceholder.style.display = 'block';
    currentData = { header: {}, details: [] };
  }
}

async function submitData() {
  const bank = bankSelector.value;

  for (const key of Object.keys(currentData.header)) {
    const input = document.getElementById(`head_${key}`);
    if (input) currentData.header[key] = input.value;
  }

  const detailInputs = document.querySelectorAll('.detail-input');
  detailInputs.forEach(input => {
    const r = input.dataset.row;
    const c = input.dataset.col;

    if (['PayAmt', 'CommisAmt', 'TaxAmt', 'Total'].includes(c)) {
      const val = parseFloat(input.value.replace(/,/g, ''));
      currentData.details[r][c] = isNaN(val) ? 0 : val;
    } else {
      currentData.details[r][c] = input.value;
    }
  });

  const docNo = currentData.header.DocNo;

  let isOverwrite = false;
  if (submittedDocNos.has(docNo)) {
    const warningMsg = `ระบบตรวจพบว่าเอกสารหมายเลข: ${docNo} มีการบันทึกอยู่ใน Database แล้ว\n\n`
      + `>> กด "ตกลง" (OK) เพื่อ ทำการเขียนข้อมูลทับ (Overwrite)\n`
      + `>> กด "ยกเลิก" (Cancel) เพื่อ หยุดการอัปโหลด`;

    const userWantsOverwrite = confirm(warningMsg);

    if (!userWantsOverwrite) {
      console.log("Submit cancelled by user due to duplicate entry.");
      return;
    }
    isOverwrite = true;
  }

  const payload = {
    BankType: bank,
    ImportDate: new Date().toISOString(),
    Overwrite: isOverwrite,
    Header: currentData.header,
    Details: currentData.details
  };

  console.log("Submitting Payload:", JSON.stringify(payload, null, 2));

  const endpoint = "https://dev.carmen4.com/Carmen.API/api/interface/PMS/Test/Daily";
  const token = "direct f9ebce3d77f2f445dee52ba252cc53ee|d1f09146-6393-434b-a4a1-117845aff2ca";

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Authorization': token,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    if (response.ok) {
      alert("✅ Success: อัปโหลดข้อมูลสมบูรณ์");
      if (!isOverwrite) {
        submittedDocNos.add(docNo);
      }
      cancelProcess();
    } else {
      const errTxt = await response.text();
      alert(`Error: ไม่สามารถส่งข้อมูลได้ (${response.status})\n${errTxt}`);
    }
  } catch (error) {
    console.error("Submission error:", error);
    alert(`Error: ไม่สามารถเชื่อมต่อกับเซิร์ฟเวอร์ได้\n${error.message}`);
  }
}
