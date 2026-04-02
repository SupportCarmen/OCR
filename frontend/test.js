const MASTER_DEPARTMENTS = [];
const MASTER_ACCOUNTS    = [];
const MASTER_FILE_PREFIXES = [
    { code: 'PFX-01', name: 'Invoice' },
    { code: 'PFX-02', name: 'Receipt' },
    { code: 'PFX-03', name: 'Daily Report' }
];

const PAYMENT_TYPES = [
    'VSA-DCC-P', 'VSA-INT-P', 'VSA-P', 'VSA-AFF-P', 'VSC', 'TPN',
    'THSTD-P', 'QR-JCB', 'QR-UPI', 'VSA-SCB-P', 'MCA-SCB-P'
];

// ใช้สำหรับเก็บค่า Mapping ที่เลือกใน Pop-up
let paymentMappingState = {}; 
PAYMENT_TYPES.forEach(type => {
    paymentMappingState[type] = { dept: '', acc: '' };
});

function toggleDropdown(id) {
    const dropdown = document.getElementById(id);
    const isOpen = dropdown.style.display === 'block';
    
    document.querySelectorAll('.search-select-dropdown').forEach(d => d.style.display = 'none');
    
    if (!isOpen) {
        dropdown.style.display = 'block';
        const searchInput = dropdown.querySelector('.search-input');
        if (searchInput) {
            setTimeout(() => searchInput.focus(), 50);
        }
    }
}

function selectOption(targetId, value, displayId) {
    const display = document.getElementById(displayId);
    if (display) {
        display.innerText = value;
        display.classList.remove('placeholder');
    }
    const dropdown = document.getElementById(targetId);
    if (dropdown) dropdown.style.display = 'none';

    // If bank selected, we might want to "load" mapping
    if (targetId === 'bankDropdown') {
        clearMappingRows();
        // Here you could fetch bank-specific mapping
    }
}

function clearMappingRows() {
    // Clear all display spans for mapping rows
    for (let i = 1; i <= 5; i++) {
        const d = document.getElementById(`deptDisplay${i}`);
        const a = document.getElementById(`accDisplay${i}`);
        if (d) d.innerText = 'เลือก...';
        if (a) a.innerText = 'เลือก...';
    }
}

function filterOptions(dropdownId, query) {
    const list = document.querySelector(`#${dropdownId} .option-list`);
    const items = list.getElementsByClassName('option-item');
    const filter = query.toLowerCase();

    for (let i = 0; i < items.length; i++) {
        const text = items[i].textContent || items[i].innerText;
        items[i].style.display = text.toLowerCase().indexOf(filter) > -1 ? "" : "none";
    }
}

function renderMasterOptions() {
    // Populate all Dept dropdowns
    for (let i = 1; i <= 5; i++) {
        const deptList = document.querySelector(`#deptDropdown${i} .option-list`);
        if (deptList) {
            deptList.innerHTML = MASTER_DEPARTMENTS.map(item => 
                `<div class="option-item" onclick="selectOption('deptDropdown${i}', '${item.code} - ${item.name}', 'deptDisplay${i}')">
                    ${item.code} - ${item.name}
                </div>`
            ).join('');
        }

        const accList = document.querySelector(`#accDropdown${i} .option-list`);
        if (accList) {
            accList.innerHTML = MASTER_ACCOUNTS.map(item => 
                `<div class="option-item" onclick="selectOption('accDropdown${i}', '${item.code} - ${item.name}', 'accDisplay${i}')">
                    ${item.code} - ${item.name}
                </div>`
            ).join('');
        }
    }

    // Populate File Prefix dropdown
    const prefixList = document.getElementById('prefixList');
    if (prefixList) {
        prefixList.innerHTML = MASTER_FILE_PREFIXES.map(item => `
            <div class="option-item" onclick="selectOption('prefixDropdown', '${item.code} - ${item.name}', 'prefixDisplay')">
                ${item.code} - ${item.name}
            </div>
        `).join('');
    }
}

window.onclick = function(event) {
    if (!event.target.closest('.search-select-container')) {
        document.querySelectorAll('.search-select-dropdown').forEach(d => d.style.display = 'none');
    }
}

document.addEventListener('DOMContentLoaded', () => {
    renderMasterOptions();
    renderTransactionList();
    
    // ผูกเหตุการณ์กับปุ่มบันทึกใหญ่
    const saveBtn = document.querySelector('.btn-save');
    if (saveBtn) saveBtn.onclick = saveAllSettings;
});

// ฟังก์ชันบันทึกข้อมูลทั้งหมด
function saveAllSettings() {
    const config = {
        bank: document.getElementById('bankDisplay').innerText,
        filePrefix: document.getElementById('prefixDisplay').innerText,
        fileSource: document.querySelector('input[placeholder*="แหล่งที่มา"]').value,
        company: {
            name: document.querySelector('input[placeholder*="ชื่อบริษัท"]').value,
            taxId: document.querySelector('input[placeholder*="เลขประจำตัว"]').value,
            branch: document.querySelector('input[placeholder*="รหัสสาขา"]').value
        },
        mappings: {
            commission: { dept: document.getElementById('deptDisplay2').innerText, acc: document.getElementById('accDisplay2').innerText },
            tax: { dept: document.getElementById('deptDisplay3').innerText, acc: document.getElementById('accDisplay3').innerText },
            net: { dept: document.getElementById('deptDisplay4').innerText, acc: document.getElementById('accDisplay4').innerText },
            wht: { dept: document.getElementById('deptDisplay5').innerText, acc: document.getElementById('accDisplay5').innerText }
        },
        paymentAmount: paymentMappingState
    };

    localStorage.setItem('accountingConfig', JSON.stringify(config));
    
    // แจ้งเตือนเมื่อบันทึกสำเร็จ
    alert('บันทึกการตั้งค่าเรียบร้อยแล้ว! ข้อมูลจะถูกนำไปใช้ในหน้าหลักทันทีครับ');
}

// Modal Logic
function openAmountPopup() {
    renderTransactionList(); // Force render when opening
    document.getElementById('amountModal').classList.remove('hidden');
}

function closeAmountPopup() {
    document.getElementById('amountModal').classList.add('hidden');
}

function renderTransactionList() {
    const list = document.getElementById('transactionList');
    if (!list) return;

    let html = `
        <div class="modal-mapping-grid">
            <div class="modal-mapping-header">Payment Type</div>
            <div class="modal-mapping-header">Department Code</div>
            <div class="modal-mapping-header">Account Code</div>
    `;

    PAYMENT_TYPES.forEach((type, index) => {
        const rowId = `row_${index}`;
        const deptDropdownId = `modal_dept_dropdown_${index}`;
        const deptDisplayId  = `modal_dept_display_${index}`;
        const accDropdownId  = `modal_acc_dropdown_${index}`;
        const accDisplayId   = `modal_acc_display_${index}`;

        html += `
            <div class="modal-mapping-row">
                <div class="modal-type-label">${type}</div>
                <!-- Dept Select -->
                <div class="search-select-container">
                    <div class="search-select-trigger" id="${deptDisplayId}" onclick="toggleMappingDropdown('${deptDropdownId}')">
                        <span>${paymentMappingState[type].dept || 'เลือก...'}</span>
                    </div>
                    <div class="search-select-dropdown" id="${deptDropdownId}">
                        <input type="text" class="search-input" placeholder="Search..." onkeyup="filterOptions('${deptDropdownId}', this.value)">
                        <div class="option-list">
                            ${MASTER_DEPARTMENTS.map(item => `
                                <div class="option-item" onclick="selectMappingOption('${type}', 'dept', '${item.code} - ${item.name}', '${deptDisplayId}', '${deptDropdownId}')">
                                    ${item.code} - ${item.name}
                                </div>
                            `).join('')}
                        </div>
                    </div>
                </div>
                <!-- Acc Select -->
                <div class="search-select-container">
                    <div class="search-select-trigger" id="${accDisplayId}" onclick="toggleMappingDropdown('${accDropdownId}')">
                        <span>${paymentMappingState[type].acc || 'เลือก...'}</span>
                    </div>
                    <div class="search-select-dropdown" id="${accDropdownId}">
                        <input type="text" class="search-input" placeholder="Search..." onkeyup="filterOptions('${accDropdownId}', this.value)">
                        <div class="option-list">
                            ${MASTER_ACCOUNTS.map(item => `
                                <div class="option-item" onclick="selectMappingOption('${type}', 'acc', '${item.code} - ${item.name}', '${accDisplayId}', '${accDropdownId}')">
                                    ${item.code} - ${item.name}
                                </div>
                            `).join('')}
                        </div>
                    </div>
                </div>
            </div>
        `;
    });

    html += `</div>`;
    list.innerHTML = html;
}

// แยกฟังก์ชันจัดการ Dropdown ใน Modal
function toggleMappingDropdown(id) {
    const dropdown = document.getElementById(id);
    const isOpen = (dropdown.style.display === 'block');
    
    // ปิด dropdown อื่นๆ ทั้งหมด
    document.querySelectorAll('.search-select-dropdown').forEach(d => d.style.display = 'none');
    
    if (!isOpen) {
        dropdown.style.display = 'block';
        const searchInput = dropdown.querySelector('.search-input');
        if (searchInput) setTimeout(() => searchInput.focus(), 50);
    }
}

function selectMappingOption(type, field, value, displayId, dropdownId) {
    // บันทึกลง State
    paymentMappingState[type][field] = value;
    
    // อัปเดตการแสดงผล
    const display = document.getElementById(displayId);
    if (display) display.querySelector('span').innerText = value;
    
    // ปิดเมนู
    document.getElementById(dropdownId).style.display = 'none';
}

function saveAmountSelection() {
    // เก็บค่าคอนฟิกทั้งหมดเมื่อกดบันทึก
    console.log('Final Payment Mapping Config:', paymentMappingState);
    
    // บันทึกลง localStorage เพื่อให้หน้าหลัก (index.html) นำไปใช้งานได้
    localStorage.setItem('accountMappingAmount', JSON.stringify(paymentMappingState));
    
    // อัปเดตสถานะที่หน้าหลัก (ถ้ามีองค์ประกอบนี้)
    const statusDiv = document.getElementById('amountMappingStatus');
    if (statusDiv) {
        const count = Object.values(paymentMappingState).filter(m => m.dept && m.acc).length;
        if (count > 0) {
            statusDiv.innerHTML = `<i class="fas fa-check-circle" style="color: var(--teal)"></i> ตั้งค่าแล้ว ${count}/${PAYMENT_TYPES.length} รายการ`;
            statusDiv.style.borderColor = 'var(--teal)';
            statusDiv.style.background = 'var(--teal-light)';
            statusDiv.style.color = 'var(--teal)';
        } else {
            statusDiv.innerHTML = `<i class="fas fa-info-circle"></i> กดที่ชื่อ Amount เพื่อตั้งค่าแยกตาม Payment Type`;
            statusDiv.style.borderColor = 'var(--gray-300)';
            statusDiv.style.background = 'var(--gray-50)';
            statusDiv.style.color = 'var(--gray-500)';
        }
    }
    
    closeAmountPopup();
}
