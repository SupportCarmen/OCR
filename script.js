// --- 1. Global State to hold current data ---
let currentData = {
    header: {},
    details: []
};

// ฐานข้อมูลจำลองหน้าเว็บ (Session Data) เพื่อทดสอบระบบเช็คบิลซ้ำด้วย "Doc No"
const submittedDocNos = new Set();

// UI Elements
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

// --- 2. Image/PDF Preview Logic ---
fileInput.addEventListener('change', function(e) {
    const file = e.target.files[0];
    if (!file) return;

    const fileName = file.name.toLowerCase();
    const isImage = file.type.startsWith('image/') || fileName.match(/\.(jpg|jpeg|png|gif|bmp|webp)$/i);
    const isPDF = file.type === 'application/pdf' || fileName.match(/\.pdf$/i);

    if (isImage || isPDF) {
        // Use object URL for better performance and to allow PDF viewing options
        const fileURL = URL.createObjectURL(file);
        
        previewPlaceholder.style.display = 'none';
        if (isImage) {
            documentPreview.src = fileURL;
            documentPreview.style.display = 'block';
            if(pdfPreview) pdfPreview.style.display = 'none';
        } else if (isPDF) {
            if(pdfPreview) {
                // #view=FitH forces the PDF to fit the width of the viewer!
                pdfPreview.src = fileURL + '#view=FitH';
                pdfPreview.style.display = 'block';
            }
            documentPreview.style.display = 'none';
        }
    } else {
        documentPreview.style.display = 'none';
        if(pdfPreview) pdfPreview.style.display = 'none';
        previewPlaceholder.style.display = 'block';
        
        let fileExt = fileName.split('.').pop().toUpperCase();
        previewPlaceholder.innerHTML = `<i class="fas fa-file-alt placeholder-icon"></i><p>${fileExt} File Selected<br><span style="font-size: 0.8em; color: gray;">(Preview not available for this type)</span></p>`;
    }
    
    // Auto-clear results if new file is selected
    resultArea.classList.add('hidden');
    processStatus.innerText = '';
});

// --- 3. AI Simulation Logic ---
async function processFile() {
    const bank = bankSelector.value;
    
    if (fileInput.files.length === 0) {
        alert("กรุณาเลือกไฟล์ก่อนดำเนินการ");
        return;
    }

    // UI Loading State
    loading.style.display = 'block';
    processStatus.innerText = "AI กำลังอ่านข้อมูลจากเอกสาร...";
    resultArea.classList.add('hidden');
    btnProcess.disabled = true;

    // Simulate Network / AI Processing Time (1.5s)
    await new Promise(r => setTimeout(r, 1500));

    // MOCK UP: จำลองการดึงข้อมูลตามที่ระบุใน Prompt Source
    const todayStr = new Date().toLocaleDateString('en-GB');

    if (bank === 'BBL') {
        currentData = {
            header: {
                DateProcessed: todayStr,
                BankName: "Bangkok Bank (BBL)",
                DocName: "ใบเสร็จรับเงิน/ใบกำกับภาษี",
                CompanyName: "THE ICONIC BANGNA CO.,LTD",
                DocDate: "09/09/2025",
                DocNo: "25251-01-00193"
            },
            details: [
                {
                    TerminalID: "002206198772",
                    PayAmt: 88911.00,
                    CommisAmt: 1333.67,
                    TaxAmt: 93.36,
                    WHTAmount: 66.10,
                    Total: 87483.97
                }
            ]
        };
    } else if (bank === 'KBANK') {
        currentData = {
            header: {
                DateProcessed: todayStr,
                BankName: "Kasikornbank (KBANK)",
                DocName: "ใบเสร็จรับเงิน / ใบกำกับภาษี",
                CompanyName: "บ.ปุรณาการ จก.",
                DocDate: "31/12/2025",
                DocNo: "311225E00032857"
            },
            details: [
                {
                    TerminalID: "451005282039001",
                    PayAmt: 16921.00,
                    CommisAmt: 406.10,
                    TaxAmt: 28.43,
                    WHTAmount: 0.00,
                    Total: 16486.47
                }
            ]
        };
    } else if (bank === 'SCB') {
        currentData = {
            header: {
                DateProcessed: todayStr,
                BankName: "Siam Commercial Bank (SCB)",
                DocName: "ใบเสร็จรับเงิน / ใบแจ้งหนี้",
                CompanyName: "บริษัท สยาม โกลบอล จำกัด",
                DocDate: "15/01/2026",
                DocNo: "SCB99202601001"
            },
            details: [
                {
                    TerminalID: "TID-SCB-0081",
                    PayAmt: 50000.00,
                    CommisAmt: 1250.00,
                    TaxAmt: 87.50,
                    WHTAmount: 37.50,
                    Total: 48625.00
                }
            ]
        };
    }

    // Render Result
    renderUI(bank);
    
    // UI Success State
    loading.style.display = 'none';
    processStatus.innerText = "อ่านข้อมูลสำเร็จ";
    resultArea.classList.remove('hidden');
    btnProcess.disabled = false;
}

// --- 4. Render UI Functions ---
function renderUI(bank) {
    // 4.1 Render Header Inputs
    headerForm.innerHTML = '';
    for (const [key, value] of Object.entries(currentData.header)) {
        const div = document.createElement('div');
        div.className = 'form-field';
        div.innerHTML = `
            <label>${key}</label>
            <input type="text" id="head_${key}" value="${value}">
        `;
        headerForm.appendChild(div);
    }

    // Determine Columns (Standardized for all banks to include the required 12 fields missing parts)
    let columns = ['TerminalID', 'PayAmt', 'CommisAmt', 'TaxAmt', 'WHTAmount', 'Total'];

    // 4.2 Render Table Headers
    tableHeader.innerHTML = '';
    columns.forEach(col => {
        const th = document.createElement('th');
        th.innerText = col;
        tableHeader.appendChild(th);
    });
    tableHeader.innerHTML += '<th style="text-align: center;">Action</th>'; // Delete Col

    // 4.3 Render Table Rows
    tableBody.innerHTML = '';
    currentData.details.forEach((row, index) => {
        const tr = document.createElement('tr');
        
        let rowHtml = '';
        columns.forEach(col => {
            rowHtml += `
                <td>
                    <input type="text" value="${row[col] !== undefined ? row[col] : ''}" data-row="${index}" data-col="${col}" class="detail-input" readonly style="background-color: transparent; cursor: default; border: none; font-weight: 500;">
                </td>
            `;
        });
        
        // Action Button
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

// Adds an empty row dynamically
function addRow() {
    const bank = bankSelector.value;
    let newRow = { TerminalID: "", PayAmt: 0, CommisAmt: 0, TaxAmt: 0, WHTAmount: 0, Total: 0 };
    
    currentData.details.push(newRow);
    renderUI(bank);
}

function deleteRow(index) {
    currentData.details.splice(index, 1);
    const bank = bankSelector.value;
    renderUI(bank);
}

// --- 5. Submit & Cancel Functions ---
function cancelProcess() {
    if(confirm("คุณต้องการยกเลิกและล้างข้อมูลหรือไม่?")) {
        resultArea.classList.add('hidden');
        fileInput.value = '';
        processStatus.innerText = '';
        documentPreview.style.display = 'none';
        previewPlaceholder.style.display = 'block';
        currentData = { header: {}, details: [] };
    }
}

async function submitData() {
    const bank = bankSelector.value;
    
    // 5.1 Update Header from DOM
    for (const key of Object.keys(currentData.header)) {
        const input = document.getElementById(`head_${key}`);
        if (input) currentData.header[key] = input.value;
    }

    // 5.2 Update Details from DOM
    const detailInputs = document.querySelectorAll('.detail-input');
    detailInputs.forEach(input => {
        const r = input.dataset.row;
        const c = input.dataset.col;
        
        // Parse numbers safely
        if (['PayAmt', 'CommisAmt', 'TaxAmt', 'Total'].includes(c)) {
            const val = parseFloat(input.value.replace(/,/g, ''));
            currentData.details[r][c] = isNaN(val) ? 0 : val; 
        } else {
            currentData.details[r][c] = input.value;
        }
    });

    const docNo = currentData.header.DocNo;

    // --- ระบบเช็คเอกสารซ้ำ (Method 3 - Duplicate Check by Doc No) ---
    // เช็คว่าเลข Doc No ในรอบนี้ มีประวัติบันทึกในฐานข้อมูล (จำลอง) หรือยัง
    if (submittedDocNos.has(docNo)) {
        alert(`❌ เอกสารซ้ำซ้อน!\nหมายเลขบิล/เอกสาร: ${docNo}\n\nเอกสารนี้ถูกนำเข้าระบบไปแล้วก่อนหน้า ระบบจึงไม่อนุญาตให้ Submit ข้อมูลชุดเดิมซ้ำครับ`);
        return; // เบรกการทำงาน API ทันที
    }

    // 5.3 Build Payload
    const payload = {
        BankType: bank,
        ImportDate: new Date().toISOString(),
        Header: currentData.header,
        Details: currentData.details
    };

    console.log("Submitting Payload:", JSON.stringify(payload, null, 2));

    // 5.4 Call API
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
            alert(`✅ Success: อัปโหลดข้อมูลสมบูรณ์\n\n(ระบบจำลองอัปเดตฐานข้อมูลว่าเอกสาร ${docNo} ส่งเข้าระบบแล้ว)`);
            submittedDocNos.add(docNo); // จำลองว่าฝั่ง Database ของระบบเซฟเข้าตารางไปแล้ว
            cancelProcess();
        } else {
            const errTxt = await response.text();
            alert(`Error: ไม่สามารถส่งข้อมูลได้ (${response.status})\n${errTxt}`);
        }
    } catch (error) {
        console.error("Submission error:", error);
        alert(`✅ Success (จำลอง): Payload เตรียมพร้อมใช้งานแล้ว!\n\n(ระบบฐานข้อมูลจำลองบันทึกหมายเลข ${docNo} เอาไว้แล้วเพื่อทดสอบเตือนไฟล์ซ้ำ)`);
        submittedDocNos.add(docNo); // จำลองว่าเซิร์ฟเวอร์ตอบกลับว่าเซฟแล้ว
        cancelProcess();
    }
}
