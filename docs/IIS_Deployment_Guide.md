# คู่มือการนำระบบ AI OCR ขึ้น Windows Server (IIS Production)

เอกสารนี้รวบรวมขั้นตอนตั้งแต่เริ่มต้น จนถึงการนำทั้ง Frontend และ Backend ขึ้นรันบน IIS อย่างสมบูรณ์แบบและถูกต้องตามหลักความปลอดภัย (Best Practice)

---

## 🛠 1. การเตรียมความพร้อมของ Server (Prerequisites)

1. **เปิดใช้งานฟีเจอร์ IIS:**
   - ค้นหาและเปิด `Turn Windows features on or off` (หรือ `Server Manager` > `Add roles and features` สำหรับ Windows Server)
   - ติ๊กเปิดใช้งาน **Internet Information Services**
   - ภายใต้ `Web Management Tools` ต้องติ๊ก **IIS Management Console**
   - ภายใต้ `World Wide Web Services` > `Application Development Features` แนะนำให้เปิด **CGI**, **ISAPI Extensions**, **ISAPI Filters** และ **WebSocket Protocol**

2. **ติดตั้ง Python (สำคัญมาก):**
   - ดาวน์โหลดตัวติดตั้ง Python (แนะนำ 3.12+)
   - **ข้อควรระวัง:** ตอนติดตั้งต้องติ๊กเลือก **"Install Python for all users"** (อยู่ใน Custom Installation) เพื่อให้โปรแกรมไปติดตั้งที่ `C:\Program Files` ซึ่งจะทำให้ IIS มองเห็นและเรียกใช้งานได้อย่างปลอดภัย

3. **ติดตั้ง HttpPlatformHandler:**
   - ดาวน์โหลดและติดตั้ง: [HttpPlatformHandler v1.2 x64](https://www.iis.net/downloads/microsoft/httpplatformhandler)
   - ติดตั้งเสร็จแล้ว แนะนำให้ Restart โปรแกรม IIS Manager 1 รอบ

---

## 🐍 2. การเตรียมฝั่ง Backend (Python/FastAPI)

1. นำโฟลเดอร์ `backend` ไปวางบน Server (เช่น นำไปวางที่ `C:\inetpub\wwwroot\OCR\backend`)
2. เปิด Command Prompt (Run as Administrator) แล้วเข้าไปที่โฟลเดอร์ `backend`
3. สร้าง Virtual Environment ใหม่ (เพื่อให้เชื่อมกับ Python ในเครื่อง Server):
   ```cmd
   python -m venv venv
   ```
4. เปิดใช้งาน venv และติดตั้ง Packages:
   ```cmd
   venv\Scripts\activate
   pip install -r requirements.txt
   ```
5. ตรวจสอบให้แน่ใจว่าในโฟลเดอร์ `backend` มีไฟล์ `web.config` และไฟล์เขียนตั้งค่าเรียกใช้ `venv\Scripts\python.exe` ไว้อย่างถูกต้องแล้ว

---

## ⚛️ 3. การเตรียมฝั่ง Frontend (React/Vite)

1. ที่เครื่องคอมพิวเตอร์ของคุณ (เครื่อง Dev) ให้รันคำสั่ง Build โค้ด:
   ```cmd
   npm run build
   ```
2. นำโฟลเดอร์ `dist` ที่ได้ ไปวางบน Server (เช่น วางที่ `C:\inetpub\wwwroot\OCR\frontend\dist`)
3. ตรวจสอบให้แน่ใจว่าในโฟลเดอร์ `dist` มีไฟล์ `web.config` สำหรับรองรับ React Router (เพื่อกัน Error 404 เวลากด Refresh)

---

## ⚙️ 4. การตั้งค่าในโปรแกรม IIS Manager (หัวใจสำคัญ)

### 4.1 ปลดล็อคระบบความปลอดภัย (Feature Delegation)
1. เปิด IIS Manager
2. คลิกที่ชื่อ Server ของคุณ (ซ้ายบนสุด)
3. ดับเบิ้ลคลิกไอคอน **Feature Delegation** (อยู่ในหมวด Management)
4. เลื่อนหาบรรทัด **Handler Mappings** คลิก 1 ที แล้วกด **Read/Write** ที่แถบเมนูด้านขวา

### 4.2 สร้าง Website สำหรับ Frontend
1. คลิกขวาที่โฟลเดอร์ **Sites** > เลือก **Add Website...**
2. **Site name:** `OCR-Web` (ตั้งชื่อตามต้องการ)
3. **Physical path:** ชี้ไปที่โฟลเดอร์ `dist` (เช่น `C:\inetpub\wwwroot\OCR\frontend\dist`)
4. **Port:** กำหนดตามต้องการ (เช่น 80 หรือ 8080)
5. กด OK

### 4.3 เชื่อม Backend ให้แฝงตัวอยู่หลัง Frontend (Sub-Application)
1. คลิกขวาที่ Site `OCR-Web` ที่เพิ่งสร้าง > เลือก **Add Application...**
2. **Alias:** พิมพ์คำว่า `api` *(บังคับ! เนื่องจาก Frontend จะยิง API มาหาชื่อนี้)*
3. **Application pool:** เลือก `OCR-Web`
4. **Physical path:** ชี้ไปที่โฟลเดอร์ `backend` (เช่น `C:\inetpub\wwwroot\OCR\backend`)
5. กด OK

### 4.4 การให้สิทธิ์เข้าถึง (Permissions)
ขั้นตอนนี้เพื่ออนุญาตให้ Backend สามารถบันทึกรูปภาพ (Uploads) และเขียนไฟล์ฐานข้อมูล (SQLite) ได้:
1. เปิด File Explorer ไปที่โฟลเดอร์ `C:\inetpub\wwwroot\OCR\backend`
2. คลิกขวาที่โฟลเดอร์ `backend` เลือก **Properties** > ไปที่แท็บ **Security**
3. กดปุ่ม **Edit...** > กด **Add...**
4. พิมพ์ชื่อ `IIS_IUSRS` แล้วกด Check Names > กด OK
5. ติ๊กเครื่องหมายถูกที่ช่อง **Modify** แล้วกด OK บันทึกทั้งหมด

*(หมายเหตุ: Application Pool Identity ใน IIS จะถูกตั้งค่าเป็น `ApplicationPoolIdentity` ตามค่าเริ่มต้นอยู่แล้ว ซึ่งเป็นค่าที่ปลอดภัยที่สุด ไม่จำเป็นต้องเปลี่ยนเป็น LocalSystem บน Server)*

---

## 🚀 5. การทดสอบและใช้งาน

- เปิดเว็บบราวเซอร์บน Server แล้วเข้า URL: `http://localhost` (หรือ Port ที่ตั้งไว้)
- หน้าเว็บ Frontend จะแสดงผลขึ้นมา
- เมื่อทำการอัพโหลดเอกสาร ตัว Frontend จะส่ง Request ไปที่ `http://localhost/api/...` ซึ่ง IIS จะโยนข้อมูลเข้าไปประมวลผลที่ Backend โดยอัตโนมัติอย่างไร้รอยต่อ

**หากพบปัญหา:**
- Error 500: ให้เข้าไปดู Log การทำงานของ Python ได้ในโฟลเดอร์ `backend/logs`
- Database Locked: เกิดจากการไม่ได้ให้สิทธิ์ `Modify` แก่ `IIS_IUSRS` ที่โฟลเดอร์ backend
