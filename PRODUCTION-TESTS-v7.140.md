# PRODUCTION-TESTS-v7.140.md
## Basma Integration — Production Test Pack (v7.140.1)

**النطاق:** اختبار endpoints التكامل في الإنتاج بعد نشر `Basma v7.140.1`
(Phase 0 + Phase 2 + Phase 3 Fix).

**معمارية Phase 3 (مهم):**
- `ensure-kawader-employee` يكتب فقط في:
  - `basma:employee_ref:{employeeId}` (سجل المرجع)
  - `basma:employee_ref_idx` (فهرس الـ IDs المُموَّن لها)
- `basma-employee-ref` يقرأ فقط من `basma:employee_ref:{employeeId}`
- **لا يكتب أو يقرأ من `basma:employees` نهائيًا**

---

### ⚠️ تنبيه أمني مهم — اقرأ قبل البدء

- **لا تلصق `HMA_INTERNAL_KEY` داخل هذا التقرير أو داخل المحادثة أو في أي ملف يُحفظ في الـ git.**
- **لا تنسخ الـ JSON responses الكاملة في التقرير — فقط الـ status code و `ok` و `error.code`.**
- **إذا لاحظت في أي response حقول مثل `passwordHash`, `passwordSalt`, `idNumber`, `salary`, `tokens`, `faces`, `username`, `hasAccount`, `dob`, `joinDate`, `sceNumber` — يُعتبر الاختبار FAIL واتصل بفريق التطوير فوراً.**
- كل الاختبارات هنا **GET فقط** — لا تستخدم POST/PUT/DELETE في أي اختبار إنتاج.
- لا اختبار يلمس `basma:attendance` أو يعدّل بيانات.

---

## 1. إعداد متغيرات PowerShell

افتح PowerShell على جهازك (Windows) واضبط هذي المتغيرات قبل تشغيل الأوامر.
**هذه المتغيرات تعيش في session واحد فقط ولا تُحفظ في الملفات.**

```powershell
# المفتاح السري — لا تشاركه ولا تلصقه في تقارير
$env:HMA_INTERNAL_KEY = "ضع_المفتاح_هنا"

# عنوان بصمة (الإنتاج)
$env:BASMA_BASE_URL = "https://b.hma.engineer"

# موظف للاختبار — استخدم employeeId حقيقي موجود في كوادر بحالة active
$env:TEST_EMPLOYEE_ID = "ضع_employeeId_حقيقي"

# رقم جوال موجود في كوادر
$env:TEST_EMPLOYEE_PHONE = "0500000000"
```

للتحقق من الإعداد:

```powershell
Write-Host "BASMA_BASE_URL = $env:BASMA_BASE_URL"
Write-Host "TEST_EMPLOYEE_ID = $env:TEST_EMPLOYEE_ID"
Write-Host "TEST_EMPLOYEE_PHONE = $env:TEST_EMPLOYEE_PHONE"
Write-Host "HMA_INTERNAL_KEY length = $($env:HMA_INTERNAL_KEY.Length)"
# لا تطبع المفتاح نفسه — فقط الطول للتأكد أنه محمَّل
```

---

## 2. اختبارات Phase 0 — Health

### اختبار 1: health بدون مفتاح (يجب أن يفشل)

```powershell
curl.exe -i "$env:BASMA_BASE_URL/api/data?action=health"
```

**النتيجة المتوقعة:**
- HTTP Status: `401`
- `ok`: `false`
- `error.code`: `MISSING_INTERNAL_KEY`
- `meta.service`: `basma`
- `meta.version`: `7.140.1`

### اختبار 2: health بمفتاح صحيح

```powershell
curl.exe -i -H "x-internal-key: $env:HMA_INTERNAL_KEY" `
    "$env:BASMA_BASE_URL/api/data?action=health"
```

**النتيجة المتوقعة:**
- HTTP Status: `200`
- `ok`: `true`
- `data.service`: `basma`
- `data.status`: `healthy`
- `data.version`: `7.140.1`
- `data.redis`: `connected`
- `meta.requestId`: قيمة تبدأ بـ `req_basma_`

### اختبار 3: health بمفتاح خاطئ

```powershell
curl.exe -i -H "x-internal-key: wrong-key-test" `
    "$env:BASMA_BASE_URL/api/data?action=health"
```

**النتيجة المتوقعة:**
- HTTP Status: `401`
- `error.code`: `INVALID_INTERNAL_KEY`

---

## 3. اختبارات Phase 2 — Read-through من كوادر

### اختبار 4: قراءة موظف من كوادر بـ employeeId

```powershell
curl.exe -i -H "x-internal-key: $env:HMA_INTERNAL_KEY" `
    "$env:BASMA_BASE_URL/api/data?action=kawader-employee&employeeId=$env:TEST_EMPLOYEE_ID"
```

**النتيجة المتوقعة:**
- HTTP Status: `200`
- `ok`: `true`
- `data.source`: `kawader`
- `data.employee.employeeId`: نفس قيمة `TEST_EMPLOYEE_ID`
- لا حقول حساسة في `data.employee`

### اختبار 5: قراءة موظف بالجوال

```powershell
curl.exe -i -H "x-internal-key: $env:HMA_INTERNAL_KEY" `
    "$env:BASMA_BASE_URL/api/data?action=kawader-employee-by-phone&phone=$env:TEST_EMPLOYEE_PHONE"
```

**النتيجة المتوقعة:**
- HTTP Status: `200`, `ok`: `true`, لا حقول حساسة.

### اختبار 6: موظف غير موجود في كوادر

```powershell
curl.exe -i -H "x-internal-key: $env:HMA_INTERNAL_KEY" `
    "$env:BASMA_BASE_URL/api/data?action=kawader-employee&employeeId=NEVER_EXISTED_99999"
```

**النتيجة المتوقعة:** `404`, `error.code`: `NOT_FOUND`.

---

## 4. اختبارات Phase 3 Fix — Employee Reference Provisioning

> **مهم:** Phase 3 يستخدم طبقة منفصلة `basma:employee_ref:*` وليس `basma:employees`.
> الـ response shape يحوي `source: "basma_employee_ref"` و `provisioned: true|false`.

### اختبار 7: ensure بـ employeeId صحيح (active)

```powershell
curl.exe -i -H "x-internal-key: $env:HMA_INTERNAL_KEY" `
    "$env:BASMA_BASE_URL/api/data?action=ensure-kawader-employee&employeeId=$env:TEST_EMPLOYEE_ID"
```

**النتيجة المتوقعة (المرة الأولى):**
- HTTP Status: `200`
- `ok`: `true`
- `data.source`: `basma_employee_ref`
- `data.provisioned`: `true`
- `data.employee` يحوي **فقط** الحقول الـ14 المعتمدة:
  `employeeId, employeeCode, name, phone, email, jobTitle, department, status, managerEmployeeId, branch, sourceSystem, provisionedAt, lastKawaderSyncAt, updatedAt`
- `data.employee.sourceSystem`: `kawader`
- لا حقول ممنوعة (passwordHash, idNumber, salary, faces, username, hasAccount, dob, ...)

### اختبار 8: ensure مرة ثانية لنفس الموظف (تأكيد idempotent)

نفس الأمر:

```powershell
curl.exe -i -H "x-internal-key: $env:HMA_INTERNAL_KEY" `
    "$env:BASMA_BASE_URL/api/data?action=ensure-kawader-employee&employeeId=$env:TEST_EMPLOYEE_ID"
```

**النتيجة المتوقعة:**
- HTTP Status: `200`
- `data.source`: `basma_employee_ref`
- `data.provisioned`: **`false`** (لم يُنشأ مرة جديدة)
- `data.employee` نفس البيانات

### اختبار 9: قراءة الـ ref من بصمة بعد ensure

```powershell
curl.exe -i -H "x-internal-key: $env:HMA_INTERNAL_KEY" `
    "$env:BASMA_BASE_URL/api/data?action=basma-employee-ref&employeeId=$env:TEST_EMPLOYEE_ID"
```

**النتيجة المتوقعة:**
- HTTP Status: `200`
- `ok`: `true`
- `data.source`: `basma_employee_ref`
- `data.employee` نفس الـ schema (14 حقل، لا حقول حساسة)

### اختبار 10: ensure بمعرف غير موجود في كوادر

```powershell
curl.exe -i -H "x-internal-key: $env:HMA_INTERNAL_KEY" `
    "$env:BASMA_BASE_URL/api/data?action=ensure-kawader-employee&employeeId=NEVER_EXISTED_88888"
```

**النتيجة المتوقعة:**
- HTTP Status: `404`
- `error.code`: `NOT_FOUND`
- (يجب ألا يُنشأ employee_ref وهمي)

### اختبار 11: ensure بدون مفتاح

```powershell
curl.exe -i "$env:BASMA_BASE_URL/api/data?action=ensure-kawader-employee&employeeId=$env:TEST_EMPLOYEE_ID"
```

**النتيجة المتوقعة:**
- HTTP Status: `401`
- `error.code`: `MISSING_INTERNAL_KEY`

---

## 5. جدول النتائج (PASS/FAIL)

عبّئه بنفسك بعد تشغيل كل اختبار.

| # | الاختبار | Status متوقع | Status فعلي | ok متوقع | ok فعلي | حقول حساسة؟ | PASS/FAIL |
|---|---------|-------------|------------|----------|---------|------------|-----------|
| 1 | health بدون مفتاح | 401 | | false | | لا | |
| 2 | health بمفتاح صحيح | 200 | | true | | لا | |
| 3 | health بمفتاح خاطئ | 401 | | false | | لا | |
| 4 | kawader-employee بمعرف صحيح | 200 | | true | | لا | |
| 5 | kawader-employee-by-phone | 200 | | true | | لا | |
| 6 | kawader-employee غير موجود | 404 | | false | | لا | |
| 7 | ensure-kawader-employee (أول مرة) | 200 | | true | | لا | |
| 8 | ensure مرة ثانية (idempotent) | 200 | | true | | لا | |
| 9 | basma-employee-ref بعد ensure | 200 | | true | | لا | |
| 10 | ensure بمعرف غير موجود | 404 | | false | | لا | |
| 11 | ensure بدون مفتاح | 401 | | false | | لا | |

**قاعدة:** أي صف فيه "حقول حساسة؟ نعم" يُعتبر **FAIL تلقائيًا** بغض النظر عن باقي الأعمدة.

---

## 6. تنظيف بعد الاختبار

```powershell
Remove-Item Env:HMA_INTERNAL_KEY -ErrorAction SilentlyContinue
Remove-Item Env:TEST_EMPLOYEE_ID -ErrorAction SilentlyContinue
Remove-Item Env:TEST_EMPLOYEE_PHONE -ErrorAction SilentlyContinue
Remove-Item Env:BASMA_BASE_URL -ErrorAction SilentlyContinue
```

---

## 7. ملاحظات

- لو أردت تشغيل الاختبارات تلقائيًا، استخدم `production-test-v7.140.ps1` (في نفس المجلد).
- السكربت يقرأ نفس متغيرات البيئة ويطبع جدول ملخص بدون كشف المفتاح.
- لا تُشغّل أي endpoint غير مذكور هنا — أي endpoint خارج Phase 0/2/3 لم يُختبر.
- إذا كان الموظف في كوادر بحالة `inactive` أو `suspended`، اختبار 7 يرجع `409 EMPLOYEE_INACTIVE` (هذا سلوك صحيح).

