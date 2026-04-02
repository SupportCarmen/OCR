# 3. แผนภาพการทำงาน (System Interface Diagrams)

## 3.1 High-Level Architecture

แผนภาพแสดงภาพรวมการทำงานและการเชื่อมต่อระหว่างส่วนต่างๆ ภายในระบบ (Bank Receipt OCR & Import System) และระบบภายนอก เรียงตามลำดับขั้นตอนการทำงาน:

```mermaid
flowchart LR
    %% Definitions
    User([พนักงานผู้ใช้งาน])
    
    subgraph OCR_System["Bank Receipt OCR & Import System"]
        direction TB
        UI["Web Frontend\n(React + Vite)"]
        API["API Service\n(FastAPI Python)"]
        DB[(ฐานข้อมูล\nMySQL / MariaDB)]
    end
    
    OpenRouter["OpenRouter API\n(Vision LLM)"]
    

    %% Connections
    User -- "1. Upload File" --> UI
    UI -- "2. POST: /api/v1/ocr/extract" --> API
    API -- "3. Vision LLM Analysis" --> OpenRouter
    OpenRouter -- "4. Response JSON Data" --> API
    API -- "5. Return Extracted Data" --> UI
    UI -- "6. รูปแบบให้ผู้ใช้งานตรวจสอบ/แก้ไข" --> User
    User -- "7. Validate & Submit" --> UI
    UI -- "8. POST: /api/v1/ocr/submit" --> API
    API -- "9. บันทึกข้อมูล Task & Receipt (ครั้งแรก)" --> DB
```

### คำอธิบายเชื่อมโยงการทำงานระหว่างระบบ (Flow Details)

1. **User (พนักงานผู้ใช้งาน)** เลือกไฟล์และระบบสร้าง Local Preview (Blob URL) ทันที
2. **Web Frontend** ส่งไฟล์ไปที่ **API Service (FastAPI)**
3. **API Service** ส่งข้อมูลรูปภาพไปให้ **OpenRouter (Vision LLM)** วิเคราะห์โดยตรง (Stateless)
4. **OpenRouter** ส่งผลลัพธ์เป็น Structured Data กลับมาที่แบคเอนด์
5. **API Service** ส่งต่อข้อมูล JSON ให้ **Web Frontend** **(ยังไม่มีการบันทึกลงฐานข้อมูลในขั้นตอนนี้)**
6. **User** ตรวจสอบและแก้ไขข้อมูลบนหน้าจอ
7. **User** กดยืนยันการนำเข้าข้อมูล (Submit)
8. **Web Frontend** ส่งข้อมูลชุดสมบูรณ์ (Final Data) ไปที่ **API Service**
9. **API Service** ทำการบันทึกลงใน **Database (MySQL / MariaDB)** และเก็บชื่อไฟล์ดั้งเดิมไว้เป็นหลักฐาน

---

## 3.2 Sequence Diagram: API 1 - Extract OCR Data (Upload)

ขั้นตอนการส่งไฟล์รูปภาพหรือ PDF เพื่อให้ระบบใช้ Vision LLM ในการอ่านและสกัดข้อมูล

```mermaid
sequenceDiagram
    participant User as User / Frontend (React)
    participant API as API Service (FastAPI)
    participant LLM as OpenRouter (Vision LLM)

    User->>API: POST /api/v1/ocr/extract (files, bank_type)
    activate API
    API->>API: Load image bytes to memory
    API->>LLM: Request Analysis (Vision LLM)
    activate LLM
    LLM-->>API: JSON Response (Extracted Fields)
    deactivate LLM
    API-->>User: 200 OK (Extracted Data Array)
    deactivate API
    Note over User,API: No Database or Disk write performed
```

## 3.3 Sequence Diagram: API 2 - Get OCR Result (Polling/Fetch)

การดึงข้อมูลที่สกัดได้จากฐานข้อมูลเพื่อนำมาแสดงผลบนหน้าจอให้ผู้ใช้งานตรวจสอบ

```mermaid
sequenceDiagram
    participant User as User / Frontend (React)
    participant API as API Service (FastAPI)
    participant DB as Database (MySQL / MariaDB)

    User->>API: GET /api/v1/ocr/tasks/{task_id}
    activate API
    API->>DB: Query Task & Receipt details
    DB-->>API: Task/Receipt data
    API-->>User: 200 OK (JSON Data with extracted fields)
    deactivate API
    User->>User: Display data for validation
```

## 3.4 Sequence Diagram: API 3 - Submit Validated Data (Final Save)

ขั้นตอนการบันทึกข้อมูลลงฐานข้อมูลโดยเสร็จสมบูรณ์เมื่อผ่านการตรวจสอบแล้ว

```mermaid
sequenceDiagram
    participant User as User / Frontend (React)
    participant API as API Service (FastAPI)
    participant DB as Database (MySQL / MariaDB)

    User->>API: POST /api/v1/ocr/submit (Full Payload)
    activate API
    API->>DB: Check Duplicate Doc No (within DB)
    DB-->>API: Duplicate result
    
    alt is Duplicate & Overwrite False
        API-->>User: 200 OK (ok: false, error: DUPLICATE_DOC_NO)
    else is Valid or Overwrite True
        API->>DB: Create New Task record (id, original_filename)
        API->>DB: Create Receipt & Details records
        API-->>User: 200 OK (ok: true, receipt_id, submitted_at)
    end
    deactivate API
```

---
