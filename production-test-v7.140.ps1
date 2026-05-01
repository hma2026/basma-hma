# production-test-v7.140.ps1
# -------------------------------------------------------------------
# Basma Integration Production Test Script
# Runs Phase 0 / Phase 2 / Phase 3 endpoints against production Basma.
# -------------------------------------------------------------------
# USAGE:
#   $env:HMA_INTERNAL_KEY    = "your-secret-key"
#   $env:TEST_EMPLOYEE_ID    = "1003022504"
#   $env:TEST_EMPLOYEE_PHONE = "0507755566"
#   # optional, default = https://b.hma.engineer:
#   # $env:BASMA_BASE_URL    = "https://b.hma.engineer"
#   .\production-test-v7.140.ps1
# -------------------------------------------------------------------
# SAFETY:
#   - All requests are GET only.
#   - No attendance, no login, no password endpoints touched.
#   - HMA_INTERNAL_KEY is never printed to the console.
#   - Forbidden fields (passwordHash, passwordSalt, idNumber, salary,
#     tokens) in any response → test marked FAIL.
#   - Results are NOT auto-saved. To save, redirect manually:
#       .\production-test-v7.140.ps1 | Tee-Object -FilePath results.txt
#     (verify the file has no secrets before sharing)
# -------------------------------------------------------------------

#Requires -Version 5.1

# ---- Configuration & guardrails ----------------------------------

$ErrorActionPreference = 'Stop'

function Read-RequiredEnv($name, $description) {
    $val = [Environment]::GetEnvironmentVariable($name, 'Process')
    if ([string]::IsNullOrWhiteSpace($val)) {
        Write-Host "ERROR: env variable `$env:$name is not set ($description)" -ForegroundColor Red
        exit 2
    }
    return $val
}

$internalKey   = Read-RequiredEnv 'HMA_INTERNAL_KEY' 'integration secret'
$testEmpId     = Read-RequiredEnv 'TEST_EMPLOYEE_ID' 'employeeId existing in Kawader'
$testEmpPhone  = Read-RequiredEnv 'TEST_EMPLOYEE_PHONE' 'phone existing in Kawader'

$baseUrl = $env:BASMA_BASE_URL
if ([string]::IsNullOrWhiteSpace($baseUrl)) { $baseUrl = 'https://b.hma.engineer' }
$baseUrl = $baseUrl.TrimEnd('/')

# Sanity prints (NO key value, only its length)
Write-Host ""
Write-Host "Basma Production Test Pack v7.140.1" -ForegroundColor Cyan
Write-Host ("=" * 60)
Write-Host "Base URL              : $baseUrl"
Write-Host "Test employeeId       : $testEmpId"
Write-Host "Test phone            : $testEmpPhone"
Write-Host ("HMA_INTERNAL_KEY len  : {0} chars (value redacted)" -f $internalKey.Length)
Write-Host ("=" * 60)
Write-Host ""

# Forbidden field names — any occurrence as a JSON property name → FAIL.
# v7.140.1 — expanded list to match the strict employee_ref schema.
$forbiddenFields = @(
    'passwordHash','passwordSalt','password',
    'idNumber','nationalId','iqamaNumber',
    'salary','salaryDetails','compensation',
    'token','tokens','sessionToken','apiKey','secret',
    'cv','cvFile','contracts','attachments','files',
    'faces','face','faceData',
    'username','hasAccount',
    'dob','joinDate','sceNumber','sceExpiry','sceStatus'
)

# ---- Helpers ------------------------------------------------------

function Invoke-Probe {
    param(
        [string]$Url,
        [hashtable]$Headers = @{}
    )
    # Use Invoke-WebRequest with -SkipHttpErrorCheck if available (PS 7+),
    # else wrap in try/catch to capture non-2xx responses.
    $result = [pscustomobject]@{
        StatusCode  = $null
        BodyText    = ''
        BodyJson    = $null
        Error       = $null
    }
    try {
        $resp = Invoke-WebRequest -Uri $Url -Headers $Headers -Method GET -UseBasicParsing -ErrorAction Stop -TimeoutSec 30
        $result.StatusCode = [int]$resp.StatusCode
        $result.BodyText   = [string]$resp.Content
    }
    catch [System.Net.WebException] {
        if ($_.Exception.Response) {
            $result.StatusCode = [int]$_.Exception.Response.StatusCode
            try {
                $stream = $_.Exception.Response.GetResponseStream()
                $reader = New-Object System.IO.StreamReader($stream)
                $result.BodyText = $reader.ReadToEnd()
            } catch {}
        } else {
            $result.Error = $_.Exception.Message
        }
    }
    catch {
        # PS 7+ throws different exception types; capture status if present
        if ($_.Exception.Response) {
            try { $result.StatusCode = [int]$_.Exception.Response.StatusCode } catch {}
            try {
                $stream = $_.Exception.Response.GetResponseStream()
                $reader = New-Object System.IO.StreamReader($stream)
                $result.BodyText = $reader.ReadToEnd()
            } catch {}
        }
        if (-not $result.StatusCode) { $result.Error = $_.Exception.Message }
    }
    if ($result.BodyText) {
        try { $result.BodyJson = $result.BodyText | ConvertFrom-Json -ErrorAction Stop }
        catch { $result.BodyJson = $null }
    }
    return $result
}

function Test-ForbiddenLeak {
    param([string]$BodyText)
    if ([string]::IsNullOrEmpty($BodyText)) { return @() }
    $found = @()
    foreach ($f in $forbiddenFields) {
        # Match JSON property "name":  (quoted key followed by colon)
        $pattern = '"' + [Regex]::Escape($f) + '"\s*:'
        if ([Regex]::IsMatch($BodyText, $pattern)) { $found += $f }
    }
    return $found
}

# Result accumulator
$tests = New-Object System.Collections.Generic.List[object]

function Add-TestResult {
    param(
        [string]$Name,
        [int]$ExpectedStatus,
        [int]$ActualStatus,
        [Nullable[bool]]$ExpectedOk,
        [Nullable[bool]]$ActualOk,
        [string[]]$LeakedFields,
        [string]$Notes = ''
    )
    $statusOk = ($ExpectedStatus -eq $ActualStatus)
    $okOk     = $true
    if ($null -ne $ExpectedOk) { $okOk = ($ExpectedOk -eq $ActualOk) }
    $noLeak   = ($LeakedFields.Count -eq 0)
    $verdict  = if ($statusOk -and $okOk -and $noLeak) { 'PASS' } else { 'FAIL' }

    $tests.Add([pscustomobject]@{
        Test           = $Name
        ExpectedStatus = $ExpectedStatus
        ActualStatus   = if ($null -ne $ActualStatus) { $ActualStatus } else { '-' }
        ExpectedOk     = if ($null -ne $ExpectedOk) { $ExpectedOk } else { '-' }
        ActualOk       = if ($null -ne $ActualOk) { $ActualOk } else { '-' }
        LeakedFields   = if ($noLeak) { '' } else { ($LeakedFields -join ',') }
        Verdict        = $verdict
        Notes          = $Notes
    })

    $color = if ($verdict -eq 'PASS') { 'Green' } else { 'Red' }
    Write-Host ("  [{0}] {1}" -f $verdict, $Name) -ForegroundColor $color
}

# Headers for authorized calls
$authHeaders = @{ 'x-internal-key' = $internalKey }

# =========================================================
# Test 1 — health WITH valid key
# =========================================================
Write-Host "Test 1: health with valid key" -ForegroundColor Cyan
$probe = Invoke-Probe "$baseUrl/api/data?action=health" $authHeaders
$leak  = Test-ForbiddenLeak $probe.BodyText
$okVal = if ($probe.BodyJson) { [bool]$probe.BodyJson.ok } else { $null }
$verNote = ''
if ($probe.BodyJson -and $probe.BodyJson.meta) { $verNote = "version=$($probe.BodyJson.meta.version)" }
Add-TestResult -Name 'health with valid key' `
    -ExpectedStatus 200 -ActualStatus $probe.StatusCode `
    -ExpectedOk $true -ActualOk $okVal -LeakedFields $leak `
    -Notes $verNote

# =========================================================
# Test 2 — health WITHOUT key
# =========================================================
Write-Host "Test 2: health without key" -ForegroundColor Cyan
$probe = Invoke-Probe "$baseUrl/api/data?action=health" @{}
$leak  = Test-ForbiddenLeak $probe.BodyText
$okVal = if ($probe.BodyJson) { [bool]$probe.BodyJson.ok } else { $null }
$code  = if ($probe.BodyJson -and $probe.BodyJson.error) { $probe.BodyJson.error.code } else { '' }
Add-TestResult -Name 'health without key' `
    -ExpectedStatus 401 -ActualStatus $probe.StatusCode `
    -ExpectedOk $false -ActualOk $okVal -LeakedFields $leak `
    -Notes "expected error.code=MISSING_INTERNAL_KEY actual=$code"

# =========================================================
# Test 3 — kawader-employee with valid employeeId
# =========================================================
Write-Host "Test 3: kawader-employee with valid employeeId" -ForegroundColor Cyan
$encEmpId = [System.Net.WebUtility]::UrlEncode($testEmpId)
$probe = Invoke-Probe "$baseUrl/api/data?action=kawader-employee&employeeId=$encEmpId" $authHeaders
$leak  = Test-ForbiddenLeak $probe.BodyText
$okVal = if ($probe.BodyJson) { [bool]$probe.BodyJson.ok } else { $null }
Add-TestResult -Name 'kawader-employee with valid employeeId' `
    -ExpectedStatus 200 -ActualStatus $probe.StatusCode `
    -ExpectedOk $true -ActualOk $okVal -LeakedFields $leak

# =========================================================
# Test 4 — kawader-employee-by-phone with valid phone
# =========================================================
Write-Host "Test 4: kawader-employee-by-phone with valid phone" -ForegroundColor Cyan
$encPhone = [System.Net.WebUtility]::UrlEncode($testEmpPhone)
$probe = Invoke-Probe "$baseUrl/api/data?action=kawader-employee-by-phone&phone=$encPhone" $authHeaders
$leak  = Test-ForbiddenLeak $probe.BodyText
$okVal = if ($probe.BodyJson) { [bool]$probe.BodyJson.ok } else { $null }
Add-TestResult -Name 'kawader-employee-by-phone with valid phone' `
    -ExpectedStatus 200 -ActualStatus $probe.StatusCode `
    -ExpectedOk $true -ActualOk $okVal -LeakedFields $leak

# =========================================================
# Test 5 — ensure-kawader-employee with valid employeeId
# =========================================================
Write-Host "Test 5: ensure-kawader-employee with valid employeeId" -ForegroundColor Cyan
$probe = Invoke-Probe "$baseUrl/api/data?action=ensure-kawader-employee&employeeId=$encEmpId" $authHeaders
$leak  = Test-ForbiddenLeak $probe.BodyText
$okVal = if ($probe.BodyJson) { [bool]$probe.BodyJson.ok } else { $null }
$provisioned = if ($probe.BodyJson -and $probe.BodyJson.data) { $probe.BodyJson.data.provisioned } else { '?' }
$srcVal = if ($probe.BodyJson -and $probe.BodyJson.data) { $probe.BodyJson.data.source } else { '?' }
Add-TestResult -Name 'ensure-kawader-employee with valid employeeId' `
    -ExpectedStatus 200 -ActualStatus $probe.StatusCode `
    -ExpectedOk $true -ActualOk $okVal -LeakedFields $leak `
    -Notes "provisioned=$provisioned source=$srcVal"

# =========================================================
# Test 6 — basma-employee-ref after ensure
# =========================================================
Write-Host "Test 6: basma-employee-ref after ensure" -ForegroundColor Cyan
$probe = Invoke-Probe "$baseUrl/api/data?action=basma-employee-ref&employeeId=$encEmpId" $authHeaders
$leak  = Test-ForbiddenLeak $probe.BodyText
$okVal = if ($probe.BodyJson) { [bool]$probe.BodyJson.ok } else { $null }
$srcVal2 = if ($probe.BodyJson -and $probe.BodyJson.data) { $probe.BodyJson.data.source } else { '' }
$srcSys = if ($probe.BodyJson -and $probe.BodyJson.data -and $probe.BodyJson.data.employee) { $probe.BodyJson.data.employee.sourceSystem } else { '' }
Add-TestResult -Name 'basma-employee-ref after ensure' `
    -ExpectedStatus 200 -ActualStatus $probe.StatusCode `
    -ExpectedOk $true -ActualOk $okVal -LeakedFields $leak `
    -Notes "source=$srcVal2 sourceSystem=$srcSys"

# =========================================================
# Test 7 — ensure-kawader-employee with non-existing employeeId
# =========================================================
Write-Host "Test 7: ensure-kawader-employee with non-existing employeeId" -ForegroundColor Cyan
$nonExistId = 'NEVER_EXISTED_88888'
$probe = Invoke-Probe "$baseUrl/api/data?action=ensure-kawader-employee&employeeId=$nonExistId" $authHeaders
$leak  = Test-ForbiddenLeak $probe.BodyText
$okVal = if ($probe.BodyJson) { [bool]$probe.BodyJson.ok } else { $null }
$code  = if ($probe.BodyJson -and $probe.BodyJson.error) { $probe.BodyJson.error.code } else { '' }
Add-TestResult -Name 'ensure with non-existing employeeId' `
    -ExpectedStatus 404 -ActualStatus $probe.StatusCode `
    -ExpectedOk $false -ActualOk $okVal -LeakedFields $leak `
    -Notes "expected error.code=NOT_FOUND actual=$code"

# =========================================================
# Test 8 — ensure-kawader-employee WITHOUT key
# =========================================================
Write-Host "Test 8: ensure-kawader-employee without key" -ForegroundColor Cyan
$probe = Invoke-Probe "$baseUrl/api/data?action=ensure-kawader-employee&employeeId=$encEmpId" @{}
$leak  = Test-ForbiddenLeak $probe.BodyText
$okVal = if ($probe.BodyJson) { [bool]$probe.BodyJson.ok } else { $null }
$code  = if ($probe.BodyJson -and $probe.BodyJson.error) { $probe.BodyJson.error.code } else { '' }
Add-TestResult -Name 'ensure without key' `
    -ExpectedStatus 401 -ActualStatus $probe.StatusCode `
    -ExpectedOk $false -ActualOk $okVal -LeakedFields $leak `
    -Notes "expected error.code=MISSING_INTERNAL_KEY actual=$code"

# =========================================================
# Summary
# =========================================================
Write-Host ""
Write-Host ("=" * 60)
Write-Host "SUMMARY" -ForegroundColor Cyan
Write-Host ("=" * 60)

$tests | Format-Table -Property Test,ExpectedStatus,ActualStatus,ExpectedOk,ActualOk,LeakedFields,Verdict -AutoSize

$passCount = ($tests | Where-Object { $_.Verdict -eq 'PASS' }).Count
$failCount = ($tests | Where-Object { $_.Verdict -eq 'FAIL' }).Count
$total = $tests.Count

Write-Host ""
Write-Host ("Results: {0} PASS / {1} FAIL / {2} total" -f $passCount, $failCount, $total)
if ($failCount -gt 0) {
    Write-Host ""
    Write-Host "FAILED tests:" -ForegroundColor Red
    $tests | Where-Object { $_.Verdict -eq 'FAIL' } | ForEach-Object {
        Write-Host (" - {0}" -f $_.Test) -ForegroundColor Red
        if ($_.LeakedFields) {
            Write-Host ("   leaked fields: {0}" -f $_.LeakedFields) -ForegroundColor Red
        }
        if ($_.Notes) {
            Write-Host ("   notes: {0}" -f $_.Notes) -ForegroundColor Yellow
        }
    }
}

Write-Host ""
Write-Host "Note: HMA_INTERNAL_KEY was NEVER printed in this output." -ForegroundColor Gray
Write-Host "Note: full response bodies were NOT printed; only status / ok / error.code." -ForegroundColor Gray
Write-Host ""

# Exit code: 0 if all pass, 1 otherwise
if ($failCount -gt 0) { exit 1 } else { exit 0 }
