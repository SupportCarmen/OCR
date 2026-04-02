const BANKS = [
    { value: 'BBL',   label: 'Bangkok Bank',        full: 'Bangkok Bank (BBL)' },
    { value: 'KBANK', label: 'Kasikornbank',         full: 'Kasikornbank (KBANK)' },
    { value: 'SCB',   label: 'Siam Commercial Bank', full: 'Siam Commercial Bank (SCB)' },
];

const DETAIL_COLUMNS = ['Transaction','PayAmt','CommisAmt','TaxAmt','Net'];

const HEADER_LABELS = {
    DateProcessed: 'Input Date<br><span>Date Processed (วันที่ระบบอ่าน)</span>',
    BankName:      'Bank Name<br><span>Bank Name</span>',
    DocName:       'Doc. Name<br><span>Doc Name</span>',
    CompanyName:   'Company Name<br><span>Company Name</span>',
    DocDate:       'Doc. Date<br><span>Doc Date</span>',
    DocNo:         'Doc. No<br><span>Doc No</span>',
    MerchantName:  'Merchant Name<br><span>Merchant name</span>',
    MerchantID:    'Merchant ID<br><span>Merchant ID</span>',
};

const DETAIL_LABELS = {
    PayAmt:      'Amount<br><span>Pay Amt</span>',
    CommisAmt:   'Commision Amt.<br><span>Commis Amt.</span>',
    TaxAmt:      'Tax Amt.<br><span>Tax Amt.</span>',
    Net:         'Net Amt.<br><span>Net</span>',
    Transaction: 'Payment Type<br><span>Transaction</span>',
};

const EMPTY_DETAIL_ROW = () => ({
    PayAmt: '', CommisAmt: '', TaxAmt: '',
    Net: '', Transaction: '',
    TerminalID: '', // คืนค่าไว้สำหรับ API แต่ไม่แสดงในตาราง
});

let currentData = { header: {}, details: [] };
const submittedDocNos = new Set();
let _modalResolve = null;

// DOM refs
const fileInput          = document.getElementById('fileInput');
const uploadDrop         = document.getElementById('uploadDrop');
const uploadLabel        = document.getElementById('uploadLabel');
const documentPreview    = document.getElementById('documentPreview');
const pdfPreview         = document.getElementById('pdfPreview');
const previewPlaceholder = document.getElementById('previewPlaceholder');
const fileInfoStrip      = document.getElementById('fileInfoStrip');
const fileNameDisplay    = document.getElementById('fileNameDisplay');
const btnProcess         = document.getElementById('btnProcess');
const loading            = document.getElementById('loading');
const processStatus      = document.getElementById('processStatus');
const resultArea         = document.getElementById('resultArea');
const headerForm         = document.getElementById('headerForm');
const tableHeader        = document.getElementById('tableHeader');
const tableBody          = document.getElementById('tableBody');
const rowCount           = document.getElementById('rowCount');
const bankOptions        = document.getElementById('bankOptions');

// Build bank radio cards
BANKS.forEach((b, i) => {
    const label = document.createElement('label');
    label.className = 'bank-option' + (i === 0 ? ' selected' : '');
    label.id = 'bank-' + b.value;
    label.innerHTML = `
        <input type="radio" name="bank" value="${b.value}" ${i === 0 ? 'checked' : ''}>
        <div class="bank-dot"></div>
        <span class="bank-name">${b.label}</span>
        <span class="bank-code">${b.value}</span>
    `;
    label.addEventListener('click', () => {
        document.querySelectorAll('.bank-option').forEach(o => o.classList.remove('selected'));
        label.classList.add('selected');
        label.querySelector('input').checked = true;
    });
    bankOptions.appendChild(label);
});

// cc// ดึงค่ารหัสธนาคารที่ผู้ใช้งานเลือกจาก Radio Button
function getSelectedBank() {
    const checked = document.querySelector('input[name="bank"]:checked');
    return checked ? checked.value : 'BBL';
}

// cc// ดึงชื่อเต็มของธนาคารที่เลือกเพื่อนำไปแสดงผล
function getSelectedBankFull() {
    const val = getSelectedBank();
    return BANKS.find(b => b.value === val)?.full || val;
}

// Step Wizard
// cc// จัดการการเปลี่ยนหน้า (Step) ของระบบ และควบคุมการแสดงผลของ UI ในแต่ละขั้นตอน
function setStep(n) {
    [1, 2, 3, 4, 5].forEach(i => {
        // 1. Update Wizard UI
        const wiz = document.getElementById('wiz-step-' + i);
        if (wiz) {
            wiz.classList.remove('active', 'done'); 
            if (i < n) wiz.classList.add('done');
            else if (i === n) wiz.classList.add('active');
        }

        // 2. Update Content UI
        const stepEl = document.getElementById('step' + i);
        if (stepEl) {
            if (i === n) stepEl.classList.remove('hidden');
            else stepEl.classList.add('hidden');
        }
    });

    // Special Visibility for Step 1
    const uploadSect = document.querySelector('.upload-section');
    const actBar = document.querySelector('.action-bar');
    if (n === 1) {
        if (uploadSect) uploadSect.style.display = 'grid';
        if (actBar)     actBar.style.display = 'block';
    } else {
        if (uploadSect) uploadSect.style.display = 'none';
        if (actBar)     actBar.style.display = 'none';
    }

    // Special visibility for columns/preview
    const previewCol = document.getElementById('previewColumn');
    const container  = document.querySelector('.main-grid');

    if (n === 4 || n === 5) {
        if (previewCol) previewCol.style.display = 'none';
        if (container)  container.style.gridTemplateColumns = '1fr';
        resultArea.style.display = 'block'; // Override grid to block for centering
    } else {
        if (previewCol) previewCol.style.display = 'block';
        if (container)  container.style.gridTemplateColumns = '1fr 1fr';
        resultArea.style.display = ''; // Reset to default grid
    }

    if (n >= 3 && n <= 5) {
        resultArea.classList.remove('hidden');
    } else {
        resultArea.classList.add('hidden');
    }
}

// Drag & Drop
uploadDrop.addEventListener('dragover', e => { e.preventDefault(); uploadDrop.classList.add('dragover'); });
uploadDrop.addEventListener('dragleave', () => uploadDrop.classList.remove('dragover'));
uploadDrop.addEventListener('drop', e => {
    e.preventDefault();
    uploadDrop.classList.remove('dragover');
    const file = e.dataTransfer.files[0];
    if (file) {
        const dt = new DataTransfer();
        dt.items.add(file);
        fileInput.files = dt.files;
        handleFileSelected(file);
    }
});

fileInput.addEventListener('change', e => {
    if (e.target.files[0]) handleFileSelected(e.target.files[0]);
});

// cc// จัดการเมื่อผู้ใช้งานเลือกไฟล์ โดยตรวจสอบประเภทไฟล์ (รูปภาพ/PDF) และแสดงตัวอย่างเบื้องต้น
function handleFileSelected(file) {
    const name = file.name.toLowerCase();
    const isImage = file.type.startsWith('image/') || /\.(jpg|jpeg|png|gif|bmp|webp)$/i.test(name);
    const isPDF   = file.type === 'application/pdf' || /\.pdf$/i.test(name);

    uploadLabel.textContent = file.name.length > 28 ? file.name.slice(0, 25) + '…' : file.name;

    const url = URL.createObjectURL(file);
    previewPlaceholder.style.display = 'none';

    if (isImage) {
        documentPreview.src = url;
        documentPreview.style.display = 'block';
        pdfPreview.style.display = 'none';
        document.getElementById('btnZoomAction').classList.remove('hidden');
    } else if (isPDF) {
        pdfPreview.src = url + '#view=FitH';
        pdfPreview.style.display = 'block';
        documentPreview.style.display = 'none';
        document.getElementById('btnZoomAction').classList.remove('hidden'); // Enable for PDF too!
    } else {
        documentPreview.style.display = 'none';
        pdfPreview.style.display = 'none';
        previewPlaceholder.style.display = 'block';
        const ext = name.split('.').pop().toUpperCase();
        previewPlaceholder.innerHTML = `
            <div class="placeholder-icon-wrap"><i class="fas fa-file-alt"></i></div>
            <p>${ext} File Selected<br><span style="font-size:.75rem;opacity:.5;">Preview ไม่รองรับประเภทนี้</span></p>
        `;
        document.getElementById('btnZoomAction').classList.add('hidden');
    }

    fileInfoStrip.style.display = 'flex';
    fileNameDisplay.textContent = file.name;
    
    // Show Preview immediately, but hide the data section until processed
    resultArea.classList.remove('hidden');
    resultArea.classList.add('hide-data');
    
    processStatus.innerText = '';
    setStep(1);
}

// Process File
// cc// จำลองการทำงานของ AI ในการอ่านข้อมูลจากไฟล์เอกสาร และนำข้อมูลที่ได้มาใส่ในระบบ
async function processFile() {
    if (!fileInput.files.length) {
        showToast('กรุณาเลือกไฟล์ก่อนดำเนินการ', 'error');
        return;
    }

    setStep(2);
    loading.style.display = 'block';
    processStatus.innerText = 'AI กำลังอ่านข้อมูลจากเอกสาร...';
    resultArea.classList.add('hidden');
    btnProcess.disabled = true;

    await new Promise(r => setTimeout(r, 1500));

    const todayStr = new Date().toLocaleDateString('en-GB');

    currentData = {
        header: {
            DateProcessed: todayStr,
            BankName:      'Bangkok Bank',
            DocName:       'Credit Card Report',
            CompanyName:   'SAMPLE CORP CO., LTD.',
            DocDate:       '31/12/2025',
            DocNo:         '25120004',
            MerchantName:  'Sample Store',
            MerchantID:    'MID-999999',
        },
        details: [
            { Transaction: 'VISA-INT-P', PayAmt: 4090.00, CommisAmt: 130.88, TaxAmt: 9.16, Net: 3949.96, TerminalID: '' },
            { Transaction: 'VISA-INT',   PayAmt: 6520.00, CommisAmt: 169.52, TaxAmt: 11.87, Net: 6338.61, TerminalID: '' }
        ],
    };

    // จำลองค่า Mapping เบื้องต้นลงใน localStorage เพื่อให้เห็นผลใน Step 4 ทันที (Demo Mode: ใส่ทุกครั้ง)
    const mockConfig = {
        mappings: {
            commission: { dept: 'DEPT-HO', acc: '5100-001 - Commission Expense' },
            tax:        { dept: 'DEPT-HO', acc: '2100-010 - VAT Payable' },
            net:        { dept: 'DEPT-FIN', acc: '1100-005 - Cash at Bank - Current' }
        },
        paymentAmount: {
            'VISA-INT-P':  { dept: 'DEPT-ACC',   acc: '1100-011 - Receivable - VISA' },
            'VISA-INT':    { dept: 'DEPT-SALES',  acc: '1100-012 - Receivable - MasterCard' },
            'VSA-DCC-P':   { dept: 'DEPT-ACC',    acc: '1100-011 - Receivable - VISA' },
            'VSA-P':       { dept: 'DEPT-ACC',    acc: '1100-011 - Receivable - VISA' },
            'VSA-AFF-P':   { dept: 'DEPT-ACC',    acc: '1100-011 - Receivable - VISA' },
            'VSC':         { dept: 'DEPT-ACC',    acc: '1100-012 - Receivable - MasterCard' },
            'TPN':         { dept: 'DEPT-FIN',    acc: '1100-020 - Receivable - QR Payment' },
            'THSTD-P':     { dept: 'DEPT-ACC',    acc: '1100-011 - Receivable - VISA' },
            'QR-JCB':      { dept: 'DEPT-FIN',    acc: '1100-013 - Receivable - JCB' },
            'QR-UPI':      { dept: 'DEPT-FIN',    acc: '1100-020 - Receivable - QR Payment' },
            'VSA-SCB-P':   { dept: 'DEPT-ACC',    acc: '1100-011 - Receivable - VISA' },
            'MCA-SCB-P':   { dept: 'DEPT-ACC',    acc: '1100-012 - Receivable - MasterCard' }
        }
    };
    localStorage.setItem('accountingConfig', JSON.stringify(mockConfig));

    renderUI();

    loading.style.display = 'none';
    processStatus.innerText = '';
    resultArea.classList.remove('hidden', 'hide-data'); // Show data column now
    btnProcess.disabled = false;
    setStep(3);
    showToast('อ่านข้อมูลสำเร็จ — กรุณาตรวจสอบและแก้ไข', 'success');
}

// Render UI
// cc// วาดส่วนประกอบของหน้าจอ (UI) ทั้งส่วนหัว (Header) และตารางข้อมูล (Detail)
function renderUI() {
    headerForm.innerHTML = '';
    for (const [key, value] of Object.entries(currentData.header)) {
        const div = document.createElement('div');
        div.className = 'form-field';
        div.innerHTML = `
            <label>${HEADER_LABELS[key] || key}</label>
            <input type="text" id="head_${key}" value="${value}" placeholder="—">
        `;
        headerForm.appendChild(div);
    }

    tableHeader.innerHTML = '';
    DETAIL_COLUMNS.forEach(col => {
        const th = document.createElement('th');
        th.innerHTML = DETAIL_LABELS[col] || col;
        tableHeader.appendChild(th);
    });


    renderTableBody();
}

// cc// วาดเฉพาะส่วนของตารางรายการข้อมูล เพื่อรองรับการเพิ่มหรือลบแถว
function renderTableBody() {
    tableBody.innerHTML = '';
    currentData.details.forEach((row, index) => {
        const tr = document.createElement('tr');
        let html = '';
        DETAIL_COLUMNS.forEach(col => {
            html += `<td><input type="text" value="${row[col] ?? ''}" data-row="${index}" data-col="${col}" class="detail-input"></td>`;
        });

        tr.innerHTML = html;
        tableBody.appendChild(tr);
    });
    rowCount.textContent = currentData.details.length + ' รายการ';
    renderTotalSummary();
}

// cc// คำนวณและแสดงยอดรวมของคอลัมน์ตัวเลขทั้งหมดในตาราง Detail
function renderTotalSummary() {
    const grid = document.getElementById('totalSummaryGrid');
    if (!grid) return;

    // Sync latest input values before calculating
    document.querySelectorAll('.detail-input').forEach(input => {
        const r = input.dataset.row;
        const c = input.dataset.col;
        if (['PayAmt', 'CommisAmt', 'TaxAmt', 'Net'].includes(c)) {
            const val = parseFloat(input.value.replace(/,/g, ''));
            currentData.details[r][c] = isNaN(val) ? 0 : val;
        }
    });

    const totals = { PayAmt: 0, CommisAmt: 0, TaxAmt: 0, Net: 0 };
    currentData.details.forEach(row => {
        totals.PayAmt    += parseFloat(row.PayAmt) || 0;
        totals.CommisAmt += parseFloat(row.CommisAmt) || 0;
        totals.TaxAmt    += parseFloat(row.TaxAmt) || 0;
        totals.Net       += parseFloat(row.Net) || 0;
    });

    const fmt = (v) => v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    grid.innerHTML = `
        <div class="total-item">
            <div class="total-label">Pay Amt (Amount)</div>
            <div class="total-value">${fmt(totals.PayAmt)}</div>
        </div>
        <div class="total-item">
            <div class="total-label">Commission Amt.</div>
            <div class="total-value">${fmt(totals.CommisAmt)}</div>
        </div>
        <div class="total-item">
            <div class="total-label">Tax Amt.</div>
            <div class="total-value">${fmt(totals.TaxAmt)}</div>
        </div>
        <div class="total-item highlight">
            <div class="total-label">Net Amt. (ยอดสุทธิ)</div>
            <div class="total-value">${fmt(totals.Net)}</div>
        </div>
    `;
}

// cc// เพิ่มแถวว่างใหม่เข้าไปในตารางข้อมูล
function addRow() {
    currentData.details.push(EMPTY_DETAIL_ROW());
    renderTableBody();
}

// cc// ลบแถวข้อมูลตามลำดับ (Index) ที่ระบุ
function deleteRow(index) {
    currentData.details.splice(index, 1);
    renderTableBody();
}

// Cancel
// cc// ยกเลิกการทำงานทั้งหมด ล้างข้อมูล และกลับไปเริ่มขั้นตอนแรก
function cancelProcess() {
    if (!confirm('ยืนยันการยกเลิกและล้างข้อมูลทั้งหมด?')) return;
    resultArea.classList.add('hidden');
    fileInput.value = '';
    uploadLabel.textContent = 'คลิกหรือลากไฟล์มาวาง';
    documentPreview.style.display = 'none';
    pdfPreview.style.display = 'none';
    previewPlaceholder.style.display = 'block';
    previewPlaceholder.innerHTML = `
        <div class="placeholder-icon-wrap"><i class="fas fa-file-image"></i></div>
        <p>ยังไม่มีไฟล์ Preview<br><span style="font-size:.75rem;opacity:.5;">Preview จะแสดงที่นี่</span></p>
    `;
    fileInfoStrip.style.display = 'none';
    processStatus.innerText = '';
    currentData = { header: {}, details: [] };
    setStep(1);
}

// Modal
// cc// แสดงหน้าต่างยืนยันเมื่อมีการส่งข้อมูลซ้ำ (Doc No เดิม)
function showConfirmModal(docNo) {
    return new Promise(resolve => {
        document.getElementById('modalDocNo').textContent = docNo;
        document.getElementById('confirmModal').classList.remove('hidden');
        _modalResolve = resolve;
    });
}

// cc// จัดการผลลัพธ์จากการตอบตกลงหรือยกเลิกในหน้าต่าง Modal
function resolveModal(result) {
    document.getElementById('confirmModal').classList.add('hidden');
    if (_modalResolve) { _modalResolve(result); _modalResolve = null; }
}

// Toast
// cc// แสดงข้อความแจ้งเตือนขนาดเล็ก (Toast) ที่มุมหน้าจอ
function showToast(msg, type = 'info') {
    const icons = { success: 'fa-circle-check', error: 'fa-circle-xmark', info: 'fa-circle-info' };
    const tc = document.getElementById('toastContainer');
    const t = document.createElement('div');
    t.className = `toast ${type}`;
    t.innerHTML = `<i class="fas ${icons[type]}"></i> ${msg}`;
    tc.appendChild(t);
    setTimeout(() => {
        t.style.opacity = '0';
        t.style.transform = 'translateY(8px)';
        setTimeout(() => t.remove(), 320);
    }, 3500);
}

// Submit
// cc// รวบรวมข้อมูลทั้งหมดและส่งไปยัง API (ในตัวอย่างนี้เป็นโหมดจำลอง)
async function submitData() {
    for (const key of Object.keys(currentData.header)) {
        const input = document.getElementById(`head_${key}`);
        if (input) currentData.header[key] = input.value;
    }

    document.querySelectorAll('.detail-input').forEach(input => {
        const r = input.dataset.row;
        const c = input.dataset.col;
        if (['PayAmt', 'CommisAmt', 'TaxAmt', 'Net'].includes(c)) {
            const val = parseFloat(input.value.replace(/,/g, ''));
            currentData.details[r][c] = isNaN(val) ? 0 : val;
        } else {
            currentData.details[r][c] = input.value;
        }
    });

    // 1. Sync data everything first
    syncDataFromInputs();

    // 2. Prepare Payload
    const bank = getSelectedBank();
    const docNo = currentData.header.DocNo || '';
    let isOverwrite = false;

    if (submittedDocNos.has(docNo)) {
        const confirmed = await showConfirmModal(docNo);
        if (!confirmed) return;
        isOverwrite = true;
    }

    // Cleaned Details: Map fields and ensure NO null values
    const cleanedDetails = currentData.details.map(row => ({
        PaymentType: row.Transaction || '', // API Might use PaymentType
        Transaction: row.Transaction || '', // API Might use Transaction
        PayAmt:      parseFloat(row.PayAmt) || 0,
        CommisAmt:   parseFloat(row.CommisAmt) || 0,
        TaxAmt:      parseFloat(row.TaxAmt) || 0,
        Net:         parseFloat(row.Net) || 0,
        TerminalID:  row.TerminalID || ''   // Ensure not null
    }));

    // Date today in YYYY-MM-DD for wider compatibility
    const today = new Date().toISOString().split('T')[0];

    const payload = {
        BankType:   bank,
        ImportDate: today, 
        Overwrite:  isOverwrite,
        Header:     currentData.header,
        Details:    cleanedDetails,
    };

    console.log('Submitting Cleaned Payload:', JSON.stringify(payload, null, 2));

    try {
        showToast('กำลังส่งข้อมูล (DEMO MODE)...', 'info');
        
        // --- BYPASS API FOR DEMO ---
        await new Promise(r => setTimeout(r, 1000)); // Sim delay
        
        console.log('DEMO SUBMIT PAYLOAD:', payload);
        showToast('✓ อัปโหลดข้อมูลสำเร็จ (Demo Mode)', 'success');
        
        if (docNo && !isOverwrite) submittedDocNos.add(docNo);
        
        // --- GO TO STEP 5 FOR DEMO ---
        setTimeout(() => {
            renderJV();
            setStep(5);
        }, 1200);
        // ---------------------------
        
    } catch (err) {
        console.error('Submission error:', err);
        showToast('เกิดข้อผิดพลาดในการส่งข้อมูล', 'error');
    }
}
// --- Step Back Navigation ---

// cc// ย้อนกลับจาก Step 3 ไปยัง Step 1 (เลือกไฟล์ใหม่)
function goBackToStep1() {
    resultArea.classList.add('hidden');
    setStep(1);
    showToast('กลับไปหน้าเลือกไฟล์', 'info');
}

// cc// ย้อนกลับจาก Step 4 ไปยัง Step 3 (แก้ไขข้อมูล)
function goBackToStep3() {
    setStep(3);
    renderUI();
    showToast('กลับไปหน้าตรวจสอบข้อมูล', 'info');
}

// cc// ย้อนกลับจาก Step 5 ไปยัง Step 4 (ตรวจสอบบัญชี)
function goBackToStep4() {
    setStep(4);
    renderAccountingRows();
    showToast('กลับไปหน้า Review Accounting', 'info');
}

// --- Step 4: Accounting Review Logic ---

// cc// ตรวจสอบข้อมูลและเตรียมตัวเข้าสู่ขั้นตอนการตรวจสอบทางบัญชี (Step 4)
function proceedToStep4() {
    // 1. Sync data from inputs first
    syncDataFromInputs();
    
    // 2. Clear old rows
    const tbody = document.getElementById('accountingRows');
    tbody.innerHTML = '';
    
    // 3. Render
    setStep(4);
    renderAccountingRows();
}

// cc// ดึงข้อมูลจากช่อง Input ต่างๆ บนหน้าจอมาเก็บไว้ในตัวแปรหลัก (Sync Data)
function syncDataFromInputs() {
    // 1. Sync Header Fields
    for (const key of Object.keys(currentData.header)) {
        const input = document.getElementById(`head_${key}`);
        if (input) currentData.header[key] = input.value;
    }

    // 2. Sync Detail Table
    document.querySelectorAll('.detail-input').forEach(input => {
        const r = input.dataset.row;
        const c = input.dataset.col;
        if (['PayAmt', 'CommisAmt', 'TaxAmt', 'Net'].includes(c)) {
            const val = parseFloat(input.value.replace(/,/g, ''));
            currentData.details[r][c] = isNaN(val) ? 0 : val;
        } else {
            currentData.details[r][c] = input.value;
        }
    });
}

// cc// คำนวณและแสดงรายการบันทึกบัญชี (Debit/Credit) ตามการตั้งค่า Mapping
function renderAccountingRows() {
    const tbody = document.getElementById('accountingRows');
    const alert = document.getElementById('mappingAlert');
    let hasMissingMapping = false;
    
    // Get config from localStorage
    const configStr = localStorage.getItem('accountingConfig');
    const config = configStr ? JSON.parse(configStr) : null;
    
    if (!config) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:2rem;color:var(--text-4);">ยังไม่มีการตั้งค่า Account Mapping กรุณากดปุ่มเพื่อไปตั้งค่าก่อนครับ</td></tr>';
        alert.classList.remove('hidden');
        return;
    }

    let rowsHtml = '';
    
    currentData.details.forEach(detail => {
        const payType = detail.Transaction || 'UNKNOWN';
        
        // 1. Debit Row (Amount)
        const amtConfig = config.paymentAmount[payType] || { dept: '', acc: '' };
        rowsHtml += createJournalRow(amtConfig.dept, amtConfig.acc, payType, detail.PayAmt, 0);
        
        // 2. Credit Row (Commission)
        const commConfig = config.mappings.commission;
        rowsHtml += createJournalRow(commConfig.dept, commConfig.acc, 'Commission', 0, detail.CommisAmt);
        
        // 3. Credit Row (Tax)
        const taxConfig = config.mappings.tax;
        rowsHtml += createJournalRow(taxConfig.dept, taxConfig.acc, 'Tax', 0, detail.TaxAmt);
        
        // 4. Credit Row (Net Payment)
        const netConfig = config.mappings.net;
        rowsHtml += createJournalRow(netConfig.dept, netConfig.acc, 'Net Payment', 0, detail.Net);

        // Check if any mapping is missing for these rows
        if (!amtConfig.dept || !amtConfig.acc || !commConfig.dept || !commConfig.acc || !taxConfig.dept || !taxConfig.acc || !netConfig.dept || !netConfig.acc) {
            hasMissingMapping = true;
        }
    });

    tbody.innerHTML = rowsHtml;
    
    if (hasMissingMapping) alert.classList.remove('hidden');
    else alert.classList.add('hidden');
}

// cc// สร้างแถวรายการบัญชี (HTML) สำหรับแสดงในตารางตรวจสอบ
function createJournalRow(dept, acc, desc, debit, credit) {
    if (!debit && !credit) return ''; // Skip empty rows

    // Check if codes are placeholders like "เลือก..."
    const isDeptEmpty = !dept || dept.includes('เลือก');
    const isAccEmpty = !acc || acc.includes('เลือก');

    return `
        <tr>
            <td class="${isDeptEmpty ? 'missing-cell' : ''}">${isDeptEmpty ? '<i class="fas fa-exclamation-circle"></i> MISSING' : dept}</td>
            <td class="${isAccEmpty ? 'missing-cell' : ''}">${isAccEmpty ? '<i class="fas fa-exclamation-circle"></i> MISSING' : acc}</td>
            <td>${desc}</td>
            <td class="text-right">${debit ? debit.toLocaleString(undefined, {minimumFractionDigits: 2}) : ''}</td>
            <td class="text-right">${credit ? credit.toLocaleString(undefined, {minimumFractionDigits: 2}) : ''}</td>
        </tr>
    `;
}

// cc// สั่งใหระบบคำนวณรายการบัญชีใหม่ตาม Mapping ล่าสุด
function refreshAccountingReview() {
    showToast('กำลังอัปเดตข้อมูลจาก Mapping...', 'info');
    renderAccountingRows();
}

// cc// ตรวจสอบความถูกต้องขั้นสุดท้ายก่อนทำการส่งข้อมูลจริง
function submitFinalData() {
    const alert = document.getElementById('mappingAlert');
    if (!alert.classList.contains('hidden')) {
        showToast('กรุณาตั้งค่ารหัสบัญชีให้ครบถ้วนก่อนส่งข้อมูล', 'error');
        return;
    }
    
    // Reuse existing submit logic
    submitData();
}

// cc// สร้างและแสดงผลใบสำคัญรายวัน (Journal Voucher) ในขั้นตอนสุดท้าย
function renderJV() {
    const jvRows = document.getElementById('jvRows');
    const accRows = document.getElementById('accountingRows'); // We pull from Step 4
    
    // Copy Header Data
    document.getElementById('jvPrefix').innerText = currentData.header.Prefix || 'TX';
    document.getElementById('jvVoucherNo').innerText = currentData.header.DocNo || '—';
    document.getElementById('jvDate').innerText = currentData.header.DocDate || '—';
    document.getElementById('jvDescription').innerText = `Post from OCR: ${currentData.header.DocName || 'Credit Card Report'}`;

    // Generate Rows
    let html = '';
    let totalDr = 0;
    let totalCr = 0;
    let index = 1;

    // We can iterate the DOM rows of Step 4 to ensure consistency
    accRows.querySelectorAll('tr').forEach(row => {
        const cells = row.querySelectorAll('td');
        if (cells.length < 5) return;

        const dept = cells[0].innerText;
        const acc  = cells[1].innerText;
        const desc = cells[2].innerText;
        const drStr = cells[3].innerText.replace(/,/g, '');
        const crStr = cells[4].innerText.replace(/,/g, '');
        
        const dr = parseFloat(drStr) || 0;
        const cr = parseFloat(crStr) || 0;

        totalDr += dr;
        totalCr += cr;

        html += `
            <tr>
                <td style="text-align:center;">${index++}</td>
                <td>${dept}</td>
                <td>${acc}</td>
                <td>${desc}</td>
                <td style="text-align:right; font-family:'DM Mono',monospace;">${dr ? dr.toLocaleString(undefined,{minimumFractionDigits:2}) : '0.00'}</td>
                <td style="text-align:right; font-family:'DM Mono',monospace;">${cr ? cr.toLocaleString(undefined,{minimumFractionDigits:2}) : '0.00'}</td>
            </tr>
        `;
    });

    jvRows.innerHTML = html;
    document.getElementById('totalDr').innerText = totalDr.toLocaleString(undefined, {minimumFractionDigits: 2});
    document.getElementById('totalCr').innerText = totalCr.toLocaleString(undefined, {minimumFractionDigits: 2});
}

// 🔥 Enlarged Preview Control (Open in New Tab)
// cc// เปิดรูปภาพหรือไฟล์ PDF ตัวอย่างในหน้าต่างใหม่แบบเต็มจอ
window.toggleFullScreenPreview = function() {
    const isImage = documentPreview.style.display === 'block';
    const isPDF   = pdfPreview.style.display === 'block';
    let url = '';

    if (isImage) url = documentPreview.src;
    else if (isPDF) url = pdfPreview.src.split('#')[0]; // Remove PDF view params

    if (url) {
        window.open(url, '_blank');
    } else {
        showToast('ไม่พบบันทึกรูปภาพสำหรับขยาย', 'error');
    }
}
