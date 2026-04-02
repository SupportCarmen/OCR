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
    d.transaction                           AS `Transaction`,
    d.pay_amt                               AS `Pay Amt`,
    d.commis_amt                            AS `Commis Amt`,
    d.tax_amt                               AS `Tax Amt`,
    d.total                                 AS `Total`,
    d.wht_amount                            AS `WHT Amount`,
    r.id                                    AS receipt_id,
    r.bank_type                             AS bank_type
FROM receipts r
LEFT JOIN receipt_details d ON d.receipt_id = r.id
WHERE r.submitted_at IS NOT NULL
ORDER BY r.submitted_at DESC;


-- ════════════════════════════════════════════════════
-- Basic Queries
-- ════════════════════════════════════════════════════

-- 1. ดูข้อมูลทั้งหมด
SELECT * FROM v_receipts;

-- 2. ดูเฉพาะธนาคาร (BBL / KBANK / SCB)
SELECT * FROM v_receipts WHERE bank_type = 'BBL';

-- 3. ดูเฉพาะวันที่ submit วันนี้
SELECT * FROM v_receipts WHERE DATE(`Input Date`) = CURDATE();

-- 4. ค้นหาจาก Doc No
SELECT * FROM v_receipts WHERE `Doc. No` LIKE '%0001954%';

-- 5. ค้นหาจาก Tax ID (query ตรง receipts เพราะ view ไม่มี field นี้)
SELECT v.* FROM v_receipts v
JOIN receipts r ON r.id = v.receipt_id
WHERE r.company_tax_id = '0105555181506';

-- 6. ค้นหาจาก Merchant ID (query ตรง receipts เพราะ view ไม่มี field นี้)
SELECT v.* FROM v_receipts v
JOIN receipts r ON r.id = v.receipt_id
WHERE r.merchant_id = '002206198772';

-- 7. ดูเอกสารที่ยังไม่ได้ submit (pending review)
SELECT
    r.id,
    r.bank_name,
    r.bank_type,
    r.doc_no,
    r.company_name,
    r.company_tax_id,
    r.merchant_id,
    r.doc_date,
    r.created_at
FROM receipts r
WHERE r.submitted_at IS NULL
ORDER BY r.created_at DESC;


-- ════════════════════════════════════════════════════
-- Summary Queries
-- ════════════════════════════════════════════════════

-- 8. สรุปยอดรวมแยกตามธนาคาร
SELECT
    bank_type,
    COUNT(DISTINCT receipt_id)  AS total_docs,
    SUM(`Pay Amt`)              AS total_pay_amt,
    SUM(`Commis Amt`)           AS total_commission,
    SUM(`Tax Amt`)              AS total_tax,
    SUM(`WHT Amount`)           AS total_wht,
    SUM(`Total`)                AS total_net
FROM v_receipts
GROUP BY bank_type;

-- 9. สรุปยอดรวมแยกตามวันที่เอกสาร
SELECT
    `Doc. Date`,
    COUNT(DISTINCT receipt_id)  AS total_docs,
    SUM(`Pay Amt`)              AS total_pay_amt,
    SUM(`WHT Amount`)           AS total_wht,
    SUM(`Total`)                AS total_net
FROM v_receipts
GROUP BY `Doc. Date`
ORDER BY `Doc. Date` DESC;

-- 10. สรุปยอดรวมแยกตาม Transaction (Payment Type)
SELECT
    bank_type,
    `Transaction`,
    COUNT(*)                    AS total_rows,
    SUM(`Pay Amt`)              AS total_pay_amt,
    SUM(`Commis Amt`)           AS total_commission,
    SUM(`Tax Amt`)              AS total_tax,
    SUM(`Total`)                AS total_net
FROM v_receipts
WHERE `Transaction` IS NOT NULL
GROUP BY bank_type, `Transaction`
ORDER BY bank_type, total_pay_amt DESC;


-- ════════════════════════════════════════════════════
-- Migration Script — อัปเดต DB เดิมให้รองรับ schema ใหม่
-- (รันเฉพาะกรณีมี DB เก่าอยู่แล้ว)
-- ════════════════════════════════════════════════════

ALTER TABLE receipts
    ADD COLUMN IF NOT EXISTS company_tax_id  VARCHAR(50)   NULL COMMENT 'เลขประจำตัวผู้เสียภาษี'          AFTER company_name,
    ADD COLUMN IF NOT EXISTS company_address TEXT          NULL COMMENT 'ที่อยู่ร้านค้า'                    AFTER company_tax_id,
    ADD COLUMN IF NOT EXISTS account_no      VARCHAR(100)  NULL COMMENT 'เลขที่บัญชีรับเงิน'               AFTER company_address,
    ADD COLUMN IF NOT EXISTS merchant_name   VARCHAR(255)  NULL COMMENT 'MERCHANT NAME จากธนาคาร'          AFTER doc_no,
    ADD COLUMN IF NOT EXISTS merchant_id     VARCHAR(100)  NULL COMMENT 'MERCHANT NUMBER / หมายเลขร้านค้า' AFTER merchant_name,
    ADD COLUMN IF NOT EXISTS wht_rate        VARCHAR(20)   NULL COMMENT 'อัตราภาษีหัก ณ ที่จ่าย'           AFTER merchant_id,
    ADD COLUMN IF NOT EXISTS wht_amount      DECIMAL(15,2) NULL COMMENT 'ภาษีหัก ณ ที่จ่าย (บาท)'         AFTER wht_rate,
    ADD COLUMN IF NOT EXISTS net_amount      DECIMAL(15,2) NULL COMMENT 'ยอดเงินสุทธิรวม'                  AFTER wht_amount;

ALTER TABLE receipt_details
    CHANGE COLUMN IF EXISTS terminal_id `transaction` VARCHAR(255) NULL COMMENT 'card type / payment type label';
