-- ============================================================
-- OCR Database — Useful Views & Queries
-- ============================================================

USE ocr_db;

-- ────────────────────────────────────────────────────
-- VIEW: v_receipts — ดูข้อมูลทั้งหมดง่ายๆ ในตารางเดียว
-- ────────────────────────────────────────────────────

CREATE OR REPLACE VIEW v_receipts AS
SELECT
    r.submitted_at                          AS `Input Date`,
    r.bank_name                             AS `Bank Name`,
    r.doc_name                              AS `Doc. Name`,
    r.company_name                          AS `Company Name`,
    r.doc_date                              AS `Doc. Date`,
    r.doc_no                                AS `Doc. No`,
    d.terminal_id                           AS `Terminal ID`,
    d.pay_amt                               AS `Amount`,
    d.commis_amt                            AS `Commision Amt.`,
    d.tax_amt                               AS `Tax Amt.`,
    d.wht_amount                            AS `WHT Amount`,
    d.total                                 AS `Net Amt.`,
    r.id                                    AS receipt_id,
    r.bank_type                             AS bank_type
FROM receipts r
LEFT JOIN receipt_details d ON d.receipt_id = r.id
WHERE r.submitted_at IS NOT NULL
ORDER BY r.submitted_at DESC;


-- ════════════════════════════════════════════════════
-- ตัวอย่าง Queries
-- ════════════════════════════════════════════════════

-- 1. ดูข้อมูลทั้งหมด
SELECT * FROM v_receipts;

-- 2. ดูเฉพาะธนาคาร BBL
SELECT * FROM v_receipts WHERE bank_type = 'BBL';

-- 3. ดูเฉพาะวันที่ submit วันนี้
SELECT * FROM v_receipts WHERE DATE(`Input Date`) = CURDATE();

-- 4. สรุปยอดรวมแยกตามธนาคาร
SELECT
    bank_type,
    COUNT(*)                    AS total_docs,
    SUM(`Amount`)               AS total_amount,
    SUM(`Commision Amt.`)       AS total_commission,
    SUM(`Tax Amt.`)             AS total_tax,
    SUM(`WHT Amount`)           AS total_wht,
    SUM(`Net Amt.`)             AS total_net
FROM v_receipts
GROUP BY bank_type;

-- 5. สรุปยอดรวมแยกตามวันที่เอกสาร
SELECT
    `Doc. Date`,
    COUNT(*)                    AS total_docs,
    SUM(`Amount`)               AS total_amount,
    SUM(`Net Amt.`)             AS total_net
FROM v_receipts
GROUP BY `Doc. Date`
ORDER BY `Doc. Date` DESC;

-- 6. ค้นหาเอกสารจาก Doc No
SELECT * FROM v_receipts WHERE `Doc. No` LIKE '%0001954%';

-- 7. ดูเอกสารที่ยังไม่ได้ submit (pending review)
SELECT
    r.id,
    r.doc_no,
    r.bank_name,
    r.company_name,
    r.created_at
FROM receipts r
WHERE r.submitted_at IS NULL
ORDER BY r.created_at DESC;
