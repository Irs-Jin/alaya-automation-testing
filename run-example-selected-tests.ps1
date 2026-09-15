# TEMPLATE / EXAMPLE: this is Jin's original selected-test-set runner, kept
# as a copyable example of the run-<name>-selected-tests.bat/.ps1 pattern -
# see EMAIL-REPORT-GUIDE.md. Copy this pair to
# run-<yourname>-selected-tests.bat/.ps1 and edit the test selection below
# to your own set; don't edit this one in place unless you actually are Jin.
#
# Runs Jin's selected test set and, once finished, offers to email a report
# (Task Breakdown / Testing Result / Time Used) to the QA team.
#
# Kept as a separate .ps1 (invoked by run-example-selected-tests.bat)
# because the report parsing + email popup need real control flow and .NET
# types that batch can't do on its own.
#
# -Smoke runs a small 10-test-case slice (one spec file per module: A/R,
# general ledger, POS, and a spread of report categories) instead of the
# full ~91-test set, so the report/email/rerun flow can be verified quickly
# without waiting on the whole suite. Remove -Smoke from the .bat once
# that's confirmed working end to end.
#
# -ResendOnly skips running any tests entirely and reuses the LAST run's
# JSON report (still on disk from last time) to go straight to the
# send-report popup - for when the tests already passed/reported fine but
# the email send itself failed (e.g. a transient SMTP/TLS blip) and you
# just want to retry sending, not re-run everything.
param(
    [switch]$Smoke,
    [switch]$ResendOnly
)

# Self-derived so a colleague's copy (run-<yourname>-selected-tests.ps1)
# shows its own name in the report/email/console output without needing to
# hand-edit every string below.
$scriptName = Split-Path -Leaf $PSCommandPath

$smokeSpecFiles = @(
    "tests/account-receivable/customer.spec.js",
    "tests/general-ledger/bank-reconciliation.spec.js",
    "tests/general-ledger/stock-value.spec.js",
    "tests/pos/birthday-setting.spec.js",
    "tests/pos/promotion.spec.js",
    "tests/reports/general-ledger/trial-balance-report.spec.js",
    "tests/reports/general-ledger/general-ledger-report.spec.js",
    "tests/reports/account-receivable/customer-aging-report.spec.js",
    "tests/reports/account-payable/vendor-aging-report.spec.js",
    "tests/reports/inventory/stock-balance-report.spec.js"
)

$ErrorActionPreference = "Stop"
Set-Location -Path $PSScriptRoot

$env:ALAYA_CLIENT_ID = "uat"
$env:ALAYA_USERNAME = "admin"
$env:ALAYA_PASSWORD = "123"
$env:ALAYA_TEST_CUSTOMER_CODE = "000001"
$env:ALAYA_TEST_ITEM_DESCRIPTION = "BISKUT PLANTA"

$jsonReportPath = Join-Path $PSScriptRoot "playwright-report-summary.$($scriptName -replace '\.ps1$','').json"

if ($ResendOnly -and -not (Test-Path $jsonReportPath)) {
    Write-Host "No previous report found at $jsonReportPath - nothing to resend. Run without -ResendOnly first." -ForegroundColor Red
    Read-Host "Press Enter to close"
    exit 1
}

if (-not $ResendOnly) {
    if (Test-Path $jsonReportPath) { Remove-Item $jsonReportPath -Force }
}
$env:PLAYWRIGHT_JSON_OUTPUT_NAME = $jsonReportPath

$recipients = @(
    "ivan.low@irs.com.my",
    "waisian.chong@irs.com.my",
    "yew@irs.com.my",
    "jin@irs.com.my"
)

if ($ResendOnly) {
    Write-Host "*** RESEND-ONLY MODE: reusing the last saved report, no tests will be run. ***" -ForegroundColor Yellow
    $reportFileInfo = Get-Item $jsonReportPath
    $startTime = $reportFileInfo.LastWriteTime
    $endTime = $reportFileInfo.LastWriteTime
    $testExitCode = 0
} else {
    $startTime = Get-Date

    if ($Smoke) {
        Write-Host "*** SMOKE MODE: running $($smokeSpecFiles.Count) test cases across A/R, GL, POS and Reports ***"
        Write-Host "*** to verify the report/email/rerun flow before running the full set.                 ***"
        Write-Host ""
        npx playwright test $smokeSpecFiles --workers=2 --reporter=list,json
    } else {
        npx playwright test tests/account-receivable/customer.spec.js tests/general-ledger tests/pos tests/reports --grep-invert "PBI 21784" --workers=2 --reporter=list,json
    }
    $testExitCode = $LASTEXITCODE

    $endTime = Get-Date

    Write-Host ""
    Write-Host "================================================"
    Write-Host " Test run finished. Opening the HTML report..."
    Write-Host "================================================"
    # `playwright show-report` starts a local server and blocks until closed
    # (like `npx serve`) - run it detached so this script can carry on to
    # the report/email prompt below instead of hanging here forever.
    Start-Process -FilePath "cmd.exe" -ArgumentList "/c npx playwright show-report" -WindowStyle Minimized
}
$elapsed = $endTime - $startTime

# ---- Parse the JSON report into a Task Breakdown + Testing Result ----

function Get-FlatSpecs {
    param($suite, $filePath)
    $results = @()
    if ($suite.file) { $filePath = $suite.file }
    foreach ($spec in $suite.specs) {
        foreach ($test in $spec.tests) {
            $lastResult = $test.results | Select-Object -Last 1
            $results += [PSCustomObject]@{
                File     = $filePath
                Title    = $spec.title
                Status   = $test.status
                Duration = ($test.results | Measure-Object -Property duration -Sum).Sum
            }
        }
    }
    foreach ($child in $suite.suites) {
        $results += Get-FlatSpecs -suite $child -filePath $filePath
    }
    return $results
}

$allSpecs = @()
$reportOk = $false
if (Test-Path $jsonReportPath) {
    try {
        $reportJson = Get-Content $jsonReportPath -Raw | ConvertFrom-Json
        foreach ($suite in $reportJson.suites) {
            $allSpecs += Get-FlatSpecs -suite $suite -filePath $null
        }
        $reportOk = $true
    } catch {
        Write-Host "Warning: could not parse $jsonReportPath ($_). Report email will use a minimal summary."
    }
}

# "flaky" = failed once then passed on retry (this repo's suite-wide
# retries:1 default) - counts as passed, not failed. Only "unexpected"
# (failed after using up all retries) counts as a real failure.
$passed = @($allSpecs | Where-Object { $_.Status -eq "expected" -or $_.Status -eq "flaky" })
$failed = @($allSpecs | Where-Object { $_.Status -eq "unexpected" })
$otherNonPass = @($allSpecs | Where-Object { $_.Status -ne "expected" -and $_.Status -ne "flaky" -and $_.Status -ne "unexpected" })

# ---- Offer to rerun just the still-failing tests (after retries:1 already
# ---- tried each one twice) before building the final report ----

Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

$rerunNote = $null
if ($failed.Count -gt 0) {
    # This still offers to rerun even under -ResendOnly - that mode only
    # skips re-running the FULL selected set; rerunning just the handful of
    # still-failing tests is the same cheap, targeted rerun this already
    # does normally, and updates the saved JSON report so the next
    # -ResendOnly (or this same run's send) reflects the new result.
    $failedListPreview = ($failed | ForEach-Object { "  - $($_.File) :: $($_.Title)" }) -join "`n"
    $rerunConfirm = [System.Windows.Forms.MessageBox]::Show(
        "$($failed.Count) test(s) still failed after retry:`n`n$failedListPreview`n`nRerun just these now before building the report?",
        "Rerun failed tests?",
        [System.Windows.Forms.MessageBoxButtons]::YesNo,
        [System.Windows.Forms.MessageBoxIcon]::Question
    )

    if ($rerunConfirm -eq [System.Windows.Forms.DialogResult]::Yes) {
        $failedFilesForRerun = @($failed.File | Sort-Object -Unique)
        $grepPattern = "(" + (($failed.Title | ForEach-Object { [regex]::Escape($_) }) -join "|") + ")"

        Write-Host ""
        Write-Host "*** Rerunning $($failed.Count) previously-failed test(s)... ***" -ForegroundColor Yellow

        # BUG FIXED (2026-09-15): this used to point PLAYWRIGHT_JSON_OUTPUT_NAME
        # at the SAME $jsonReportPath as the full run, which overwrote the
        # full run's saved report down to just this small rerun subset -
        # corrupting it for any later -ResendOnly (confirmed live: a 91-test
        # report got shrunk to 1 test across two rerun cycles). Use a
        # separate scratch file for the rerun's own output instead, so the
        # main report file is never touched by this step.
        $rerunJsonPath = Join-Path $PSScriptRoot "playwright-rerun-summary.$($scriptName -replace '\.ps1$','').json"
        if (Test-Path $rerunJsonPath) { Remove-Item $rerunJsonPath -Force }
        $previousJsonOutputName = $env:PLAYWRIGHT_JSON_OUTPUT_NAME
        $env:PLAYWRIGHT_JSON_OUTPUT_NAME = $rerunJsonPath
        try {
            npx playwright test $failedFilesForRerun --grep $grepPattern --workers=1 --reporter=list,json
            $rerunExitCode = $LASTEXITCODE
        } finally {
            $env:PLAYWRIGHT_JSON_OUTPUT_NAME = $previousJsonOutputName
        }

        $rerunSpecs = @()
        if (Test-Path $rerunJsonPath) {
            try {
                $rerunJson = Get-Content $rerunJsonPath -Raw | ConvertFrom-Json
                foreach ($suite in $rerunJson.suites) {
                    $rerunSpecs += Get-FlatSpecs -suite $suite -filePath $null
                }
            } catch {
                Write-Host "Warning: could not parse rerun results ($_). Original failures kept as-is in the report."
            } finally {
                Remove-Item $rerunJsonPath -Force -ErrorAction SilentlyContinue
            }
        }

        $rerunMatchedCount = 0
        foreach ($rs in $rerunSpecs) {
            $match = $allSpecs | Where-Object { $_.File -eq $rs.File -and $_.Title -eq $rs.Title } | Select-Object -First 1
            if ($match) {
                $match.Status = $rs.Status
                $match.Duration = $rs.Duration
                $rerunMatchedCount++
            }
        }

        # Recompute from the now-updated $allSpecs so the report below
        # reflects the rerun outcome, not the original failed attempt.
        $passed = @($allSpecs | Where-Object { $_.Status -eq "expected" -or $_.Status -eq "flaky" })
        $failed = @($allSpecs | Where-Object { $_.Status -eq "unexpected" })
        $otherNonPass = @($allSpecs | Where-Object { $_.Status -ne "expected" -and $_.Status -ne "flaky" -and $_.Status -ne "unexpected" })

        $endTime = Get-Date
        $elapsed = $endTime - $startTime
        $rerunNote = "$rerunMatchedCount test(s) were rerun after the initial failure; $($failed.Count) still failing after rerun."
        Write-Host $rerunNote -ForegroundColor $(if ($failed.Count -gt 0) { "Red" } else { "Green" })
    } else {
        Write-Host "Skipped rerun - report will reflect the original run's results."
    }
}

# Turn a "-"/"_"-separated path segment into readable Title Case, e.g.
# "cash-book-payment" -> "Cash Book Payment". Used to turn raw spec-file
# paths into a plain-English Module / Action instead of *.spec.js paths.
function Humanize([string]$segment) {
    if ([string]::IsNullOrWhiteSpace($segment)) { return $segment }
    $words = ($segment -replace '[-_]', ' ') -split ' ' | Where-Object { $_ -ne '' }
    return (($words | ForEach-Object { $_.Substring(0,1).ToUpper() + $_.Substring(1) }) -join ' ')
}

function Get-ModuleAndAction([string]$specFile) {
    if ([string]::IsNullOrWhiteSpace($specFile)) {
        return @{ Module = "(unknown)"; Action = "(unknown)" }
    }
    $parts = $specFile -replace '\.spec\.js$', '' -split '[\\/]' | Where-Object { $_ -ne '' -and $_ -ne 'tests' }
    if ($parts.Count -eq 0) { return @{ Module = "(unknown)"; Action = "(unknown)" } }
    $actionRaw = $parts[-1]
    $moduleRaw = if ($parts.Count -gt 1) { $parts[0..($parts.Count - 2)] -join ' / ' } else { $actionRaw }
    return @{
        Module = ($moduleRaw -split ' / ' | ForEach-Object { Humanize $_ }) -join ' / '
        Action = Humanize $actionRaw
    }
}

$byFile = $allSpecs | Group-Object File | Sort-Object Name

# Per-file breakdown, split by status so a file with a flaky/skipped test
# doesn't just get lumped into a vague "X/Y passed".
$fileBreakdown = @()
foreach ($group in $byFile) {
    $fileName = if ($group.Name) { $group.Name } else { "(unknown file)" }
    $ma = Get-ModuleAndAction $fileName
    $fileBreakdown += [PSCustomObject]@{
        File    = $fileName
        Module  = $ma.Module
        Action  = $ma.Action
        Total   = $group.Group.Count
        Passed  = @($group.Group | Where-Object { $_.Status -eq "expected" }).Count
        Flaky   = @($group.Group | Where-Object { $_.Status -eq "flaky" }).Count
        Failed  = @($group.Group | Where-Object { $_.Status -eq "unexpected" }).Count
        Skipped = @($group.Group | Where-Object { $_.Status -eq "skipped" }).Count
    }
}

$taskBreakdownLines = @()
foreach ($fb in $fileBreakdown) {
    $taskBreakdownLines += "  - $($fb.Module) - $($fb.Action) : $($fb.Passed + $fb.Flaky)/$($fb.Total) passed" + $(if ($fb.Flaky -gt 0) { " ($($fb.Flaky) flaky)" } else { "" }) + $(if ($fb.Failed -gt 0) { " -- $($fb.Failed) FAILED" } else { "" })
}
if ($taskBreakdownLines.Count -eq 0) {
    $taskBreakdownLines += "  - (no per-file breakdown available; see attached/console output)"
}

$failedLines = @()
foreach ($f in $failed) {
    $fma = Get-ModuleAndAction $f.File
    $failedLines += "  - $($fma.Module) - $($fma.Action) :: $($f.Title)"
}
if ($failedLines.Count -eq 0) { $failedLines += "  - (none - all tests passed)" }

$hasFailures = ($failed.Count -gt 0)
if ($hasFailures) {
    Write-Host ""
    Write-Host "*** NOTE: one or more tests failed or the run exited non-zero. ***" -ForegroundColor Red
    Write-Host "*** You'll be asked below whether to email the QA team a report. ***" -ForegroundColor Red
}

$elapsedStr = "{0:hh\:mm\:ss}" -f $elapsed

# Plain-text version - used for the console and as the email fallback if
# HTML build fails for any reason.
$reportBody = @"
Automated test run report - $scriptName

== Task Breakdown ==
$($taskBreakdownLines -join "`r`n")

== Testing Result ==
Total tests: $($allSpecs.Count)
Passed (incl. flaky retries): $($passed.Count)
Failed: $($failed.Count)
Skipped/Other: $($otherNonPass.Count)
$(if ($rerunNote) { "`nNote: $rerunNote" })

Failed tests:
$($failedLines -join "`r`n")

== Time Used ==
Started:  $($startTime.ToString("yyyy-MM-dd HH:mm:ss"))
Finished: $($endTime.ToString("yyyy-MM-dd HH:mm:ss"))
Duration: $elapsedStr

(Generated automatically by $scriptName)
"@

Write-Host ""
Write-Host "== Task Breakdown =="
foreach ($fb in $fileBreakdown) {
    $color = if ($fb.Failed -gt 0) { "Red" } elseif ($fb.Flaky -gt 0) { "Yellow" } else { "Green" }
    $label = "$($fb.Module) - $($fb.Action)"
    Write-Host ("  {0,-45} {1}/{2} passed{3}{4}" -f $label, ($fb.Passed + $fb.Flaky), $fb.Total, $(if ($fb.Flaky -gt 0) { " ($($fb.Flaky) flaky)" } else { "" }), $(if ($fb.Failed -gt 0) { " -- $($fb.Failed) FAILED" } else { "" })) -ForegroundColor $color
}
Write-Host ""
Write-Host "== Testing Result ==" -ForegroundColor Cyan
Write-Host ("  Total: {0}   Passed: {1}   Failed: {2}   Skipped/Other: {3}" -f $allSpecs.Count, $passed.Count, $failed.Count, $otherNonPass.Count)
Write-Host ""
Write-Host "== Time Used ==" -ForegroundColor Cyan
Write-Host "  Duration: $elapsedStr  ($($startTime.ToString('HH:mm:ss')) -> $($endTime.ToString('HH:mm:ss')))"
Write-Host ""

# ---- HTML version for the email, styled like the Playwright HTML report ----

function Html-Escape([string]$text) {
    if ($null -eq $text) { return "" }
    return [System.Web.HttpUtility]::HtmlEncode($text)
}
Add-Type -AssemblyName System.Web

$fileRowsHtml = ($fileBreakdown | ForEach-Object {
    $fb = $_
    $rowColor = if ($fb.Failed -gt 0) { "#fdecea" } elseif ($fb.Flaky -gt 0) { "#fff8e1" } else { "#eafaf1" }
    $statusBadges = ""
    if ($fb.Passed -gt 0)  { $statusBadges += "<span style=`"color:#1e7e34;font-weight:600;`">$($fb.Passed) passed</span> " }
    if ($fb.Flaky -gt 0)   { $statusBadges += "<span style=`"color:#b8860b;font-weight:600;`">$($fb.Flaky) flaky</span> " }
    if ($fb.Failed -gt 0)  { $statusBadges += "<span style=`"color:#c9302c;font-weight:600;`">$($fb.Failed) failed</span> " }
    if ($fb.Skipped -gt 0) { $statusBadges += "<span style=`"color:#6c757d;font-weight:600;`">$($fb.Skipped) skipped</span> " }
    "<tr style=`"background:$rowColor;`"><td style=`"padding:6px 10px;border:1px solid #ddd;`">$(Html-Escape $fb.Module)</td><td style=`"padding:6px 10px;border:1px solid #ddd;`">$(Html-Escape $fb.Action)</td><td style=`"padding:6px 10px;border:1px solid #ddd;text-align:center;`">$($fb.Total)</td><td style=`"padding:6px 10px;border:1px solid #ddd;`">$statusBadges</td></tr>"
}) -join "`n"

$failedRowsHtml = if ($failed.Count -eq 0) {
    "<tr><td style=`"padding:6px 10px;border:1px solid #ddd;color:#1e7e34;`">None - all tests passed.</td></tr>"
} else {
    ($failed | ForEach-Object {
        $fma = Get-ModuleAndAction $_.File
        "<tr><td style=`"padding:6px 10px;border:1px solid #ddd;`"><span style=`"color:#c9302c;font-weight:600;`">$(Html-Escape $fma.Module) - $(Html-Escape $fma.Action)</span><br/>$(Html-Escape $_.Title)</td></tr>"
    }) -join "`n"
}

$reportHtml = @"
<html><body style="font-family:Segoe UI,Arial,sans-serif;color:#222;">
<h2 style="margin-bottom:4px;">Test Report - $(Html-Escape $scriptName)</h2>
<div style="color:#666;margin-bottom:16px;">$($endTime.ToString('yyyy-MM-dd HH:mm'))</div>

<div style="margin-bottom:16px;">
  <span style="background:#eee;padding:4px 10px;border-radius:4px;margin-right:6px;">All <b>$($allSpecs.Count)</b></span>
  <span style="background:#eafaf1;color:#1e7e34;padding:4px 10px;border-radius:4px;margin-right:6px;">Passed <b>$($passed.Count)</b></span>
  <span style="background:#fdecea;color:#c9302c;padding:4px 10px;border-radius:4px;margin-right:6px;">Failed <b>$($failed.Count)</b></span>
  <span style="background:#fff8e1;color:#b8860b;padding:4px 10px;border-radius:4px;margin-right:6px;">Flaky <b>$(@($allSpecs | Where-Object { $_.Status -eq 'flaky' }).Count)</b></span>
  <span style="background:#f1f3f4;color:#6c757d;padding:4px 10px;border-radius:4px;">Skipped <b>$(@($allSpecs | Where-Object { $_.Status -eq 'skipped' }).Count)</b></span>
</div>
$(if ($rerunNote) { "<div style=`"background:#fff8e1;color:#8a6100;padding:8px 12px;border-radius:4px;margin-bottom:16px;`">Note: $(Html-Escape $rerunNote)</div>" })

<h3>Task Breakdown</h3>
<table style="border-collapse:collapse;width:100%;max-width:800px;">
<tr style="background:#f5f5f5;"><th style="padding:6px 10px;border:1px solid #ddd;text-align:left;">Module</th><th style="padding:6px 10px;border:1px solid #ddd;text-align:left;">Action</th><th style="padding:6px 10px;border:1px solid #ddd;">Tests</th><th style="padding:6px 10px;border:1px solid #ddd;text-align:left;">Result</th></tr>
$fileRowsHtml
</table>

<h3>Failed Tests</h3>
<table style="border-collapse:collapse;width:100%;max-width:800px;">
$failedRowsHtml
</table>

<h3>Time Used</h3>
<div>Started: $($startTime.ToString("yyyy-MM-dd HH:mm:ss"))</div>
<div>Finished: $($endTime.ToString("yyyy-MM-dd HH:mm:ss"))</div>
<div>Duration: <b>$elapsedStr</b></div>

<div style="color:#999;margin-top:20px;font-size:12px;">Generated automatically by $(Html-Escape $scriptName)</div>
</body></html>
"@

# ---- Ask whether to send the report ----

Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

$confirmResult = [System.Windows.Forms.MessageBox]::Show(
    "Test run finished ($($passed.Count)/$($allSpecs.Count) passed).`n`nSend the report email to the QA team now?`n($($recipients -join ', '))",
    "Send test report?",
    [System.Windows.Forms.MessageBoxButtons]::YesNo,
    [System.Windows.Forms.MessageBoxIcon]::Question
)

if ($confirmResult -ne [System.Windows.Forms.DialogResult]::Yes) {
    Write-Host "Report not sent (user declined)."
    Read-Host "Press Enter to close"
    exit 0
}

# ---- Popup for the sender's own outgoing-mail login + SMTP settings ----
# "Remember" uses Windows DPAPI (CurrentUser scope) for the password - it's
# encrypted with a key tied to this Windows account on this machine, so the
# cache file is useless if copied elsewhere or opened by another user. It
# is still local plaintext-equivalent access for *this* Windows login, so
# it's opt-in via the checkbox, not on by default. SMTP host/port/security
# mode are saved alongside it in plain text (not secrets) so the whole
# outgoing-mail setup only needs to be entered once, per Jin's request -
# useful if the company mail server's IP ever gets blocked and someone
# wants to switch to sending via their own personal mail account instead.

Add-Type -AssemblyName System.Security
$credCachePath = Join-Path $PSScriptRoot ".send-report-credential.$($scriptName -replace '\.ps1$','').dat"

function Save-CachedCredential([string]$id, [string]$password, [string]$smtpHost, [int]$smtpPort, [bool]$implicitTls) {
    $bytes = [System.Text.Encoding]::UTF8.GetBytes($password)
    $encrypted = [System.Security.Cryptography.ProtectedData]::Protect($bytes, $null, [System.Security.Cryptography.DataProtectionScope]::CurrentUser)
    $payload = "$id`n$([Convert]::ToBase64String($encrypted))`n$smtpHost`n$smtpPort`n$implicitTls"
    Set-Content -Path $credCachePath -Value $payload -Encoding utf8
}

function Load-CachedCredential {
    if (-not (Test-Path $credCachePath)) { return $null }
    try {
        $lines = Get-Content -Path $credCachePath
        if ($lines.Count -lt 2) { return $null }
        $encrypted = [Convert]::FromBase64String($lines[1])
        $bytes = [System.Security.Cryptography.ProtectedData]::Unprotect($encrypted, $null, [System.Security.Cryptography.DataProtectionScope]::CurrentUser)
        return @{
            Id          = $lines[0]
            Password    = [System.Text.Encoding]::UTF8.GetString($bytes)
            SmtpHost    = if ($lines.Count -ge 3) { $lines[2] } else { "mail.irs.com.my" }
            SmtpPort    = if ($lines.Count -ge 4) { [int]$lines[3] } else { 587 }
            ImplicitTls = if ($lines.Count -ge 5) { [bool]::Parse($lines[4]) } else { $false }
        }
    } catch {
        # Cache unreadable (different user/machine, corrupted, etc.) - ignore and ask fresh.
        return $null
    }
}

function Clear-CachedCredential {
    if (Test-Path $credCachePath) { Remove-Item $credCachePath -Force }
}

# Preset outgoing-mail providers for the popup's dropdown - picking one
# auto-fills server/port/security mode below. Gmail/Yahoo/Outlook.com all
# commonly require an app-specific password (not your normal login
# password) once 2-factor auth is on for that account - that's an account
# setting on the provider's side, nothing this script can do about it.
$mailPresets = @(
    [PSCustomObject]@{ Name = "Custom / other"; Host = $null; Port = $null; ImplicitTls = $null }
    [PSCustomObject]@{ Name = "IRS company mail (mail.irs.com.my)"; Host = "mail.irs.com.my"; Port = 587; ImplicitTls = $false }
    [PSCustomObject]@{ Name = "Gmail (smtp.gmail.com)"; Host = "smtp.gmail.com"; Port = 587; ImplicitTls = $false }
    [PSCustomObject]@{ Name = "Yahoo Mail (smtp.mail.yahoo.com)"; Host = "smtp.mail.yahoo.com"; Port = 587; ImplicitTls = $false }
    [PSCustomObject]@{ Name = "Outlook / Hotmail (smtp-mail.outlook.com)"; Host = "smtp-mail.outlook.com"; Port = 587; ImplicitTls = $false }
)

function Show-CredentialForm {
    $saved = Load-CachedCredential

    $form = New-Object System.Windows.Forms.Form
    $form.Text = "Send report - your outgoing mail settings"
    $form.Size = New-Object System.Drawing.Size(400, 420)
    $form.StartPosition = "CenterScreen"
    $form.FormBorderStyle = "FixedDialog"
    $form.MaximizeBox = $false
    $form.MinimizeBox = $false

    $lblId = New-Object System.Windows.Forms.Label
    $lblId.Text = "Your email (e.g. jin@irs.com.my):"
    $lblId.Location = New-Object System.Drawing.Point(10, 15)
    $lblId.AutoSize = $true
    $form.Controls.Add($lblId)

    $txtId = New-Object System.Windows.Forms.TextBox
    $txtId.Location = New-Object System.Drawing.Point(10, 35)
    $txtId.Size = New-Object System.Drawing.Size(360, 20)
    if ($saved) { $txtId.Text = $saved.Id }
    $form.Controls.Add($txtId)

    $lblPw = New-Object System.Windows.Forms.Label
    $lblPw.Text = "Password:"
    $lblPw.Location = New-Object System.Drawing.Point(10, 65)
    $lblPw.AutoSize = $true
    $form.Controls.Add($lblPw)

    $txtPw = New-Object System.Windows.Forms.TextBox
    $txtPw.Location = New-Object System.Drawing.Point(10, 85)
    $txtPw.Size = New-Object System.Drawing.Size(360, 20)
    $txtPw.PasswordChar = "*"
    if ($saved) { $txtPw.Text = $saved.Password }
    $form.Controls.Add($txtPw)

    $lblPreset = New-Object System.Windows.Forms.Label
    $lblPreset.Text = "Mail provider:"
    $lblPreset.Location = New-Object System.Drawing.Point(10, 115)
    $lblPreset.AutoSize = $true
    $form.Controls.Add($lblPreset)

    $comboPreset = New-Object System.Windows.Forms.ComboBox
    $comboPreset.Location = New-Object System.Drawing.Point(10, 135)
    $comboPreset.Size = New-Object System.Drawing.Size(360, 20)
    $comboPreset.DropDownStyle = [System.Windows.Forms.ComboBoxStyle]::DropDownList
    foreach ($p in $mailPresets) { $comboPreset.Items.Add($p.Name) | Out-Null }
    $form.Controls.Add($comboPreset)

    $lblHost = New-Object System.Windows.Forms.Label
    $lblHost.Text = "Outgoing (SMTP) server:"
    $lblHost.Location = New-Object System.Drawing.Point(10, 165)
    $lblHost.AutoSize = $true
    $form.Controls.Add($lblHost)

    $txtHost = New-Object System.Windows.Forms.TextBox
    $txtHost.Location = New-Object System.Drawing.Point(10, 185)
    $txtHost.Size = New-Object System.Drawing.Size(250, 20)
    $txtHost.Text = if ($saved) { $saved.SmtpHost } else { "mail.irs.com.my" }
    $form.Controls.Add($txtHost)

    $lblPort = New-Object System.Windows.Forms.Label
    $lblPort.Text = "Port:"
    $lblPort.Location = New-Object System.Drawing.Point(270, 188)
    $lblPort.AutoSize = $true
    $form.Controls.Add($lblPort)

    $txtPort = New-Object System.Windows.Forms.TextBox
    $txtPort.Location = New-Object System.Drawing.Point(305, 185)
    $txtPort.Size = New-Object System.Drawing.Size(65, 20)
    $txtPort.Text = if ($saved) { $saved.SmtpPort } else { "587" }
    $form.Controls.Add($txtPort)

    $chkImplicitTls = New-Object System.Windows.Forms.CheckBox
    $chkImplicitTls.Text = "Use SSL/implicit TLS (usually port 465, not 587/STARTTLS)"
    $chkImplicitTls.Location = New-Object System.Drawing.Point(10, 215)
    $chkImplicitTls.Size = New-Object System.Drawing.Size(360, 20)
    $chkImplicitTls.Checked = if ($saved) { $saved.ImplicitTls } else { $false }
    $form.Controls.Add($chkImplicitTls)

    # Picking a preset auto-fills server/port/security mode; picking
    # "Custom / other" leaves whatever's already typed alone.
    $comboPreset.add_SelectedIndexChanged({
        $selected = $mailPresets[$comboPreset.SelectedIndex]
        if ($null -ne $selected.Host) {
            $txtHost.Text = $selected.Host
            $txtPort.Text = $selected.Port
            $chkImplicitTls.Checked = $selected.ImplicitTls
        }
    }.GetNewClosure())

    # Default the dropdown to whichever preset matches the saved/default
    # host, so reopening the form doesn't silently show "Custom" for a
    # server that actually IS one of the presets.
    $currentHost = $txtHost.Text
    $matchedIndex = 0
    for ($i = 1; $i -lt $mailPresets.Count; $i++) {
        if ($mailPresets[$i].Host -eq $currentHost) { $matchedIndex = $i; break }
    }
    $comboPreset.SelectedIndex = $matchedIndex

    $lblHint = New-Object System.Windows.Forms.Label
    $lblHint.Text = "Default is the company mail server. To send via your own personal`nmail instead (e.g. if the office IP gets blocked), pick a provider`nabove or type its settings manually. Gmail/Yahoo/Outlook usually`nneed an app-specific password, not your normal login password,`nonce 2-factor auth is on for that account."
    $lblHint.Location = New-Object System.Drawing.Point(10, 245)
    $lblHint.Size = New-Object System.Drawing.Size(360, 65)
    $lblHint.ForeColor = [System.Drawing.Color]::Gray
    $form.Controls.Add($lblHint)

    $chkRemember = New-Object System.Windows.Forms.CheckBox
    $chkRemember.Text = "Remember these settings (incl. password) on this PC"
    $chkRemember.Location = New-Object System.Drawing.Point(10, 315)
    $chkRemember.Size = New-Object System.Drawing.Size(360, 20)
    $chkRemember.Checked = [bool]$saved
    $form.Controls.Add($chkRemember)

    $btnOk = New-Object System.Windows.Forms.Button
    $btnOk.Text = "Send"
    $btnOk.Location = New-Object System.Drawing.Point(210, 345)
    $btnOk.DialogResult = [System.Windows.Forms.DialogResult]::OK
    $form.Controls.Add($btnOk)
    $form.AcceptButton = $btnOk

    $btnCancel = New-Object System.Windows.Forms.Button
    $btnCancel.Text = "Cancel"
    $btnCancel.Location = New-Object System.Drawing.Point(295, 345)
    $btnCancel.DialogResult = [System.Windows.Forms.DialogResult]::Cancel
    $form.Controls.Add($btnCancel)
    $form.CancelButton = $btnCancel

    $result = $form.ShowDialog()
    if ($result -eq [System.Windows.Forms.DialogResult]::OK) {
        $portNum = 587
        [int]::TryParse($txtPort.Text, [ref]$portNum) | Out-Null
        return @{
            Id          = $txtId.Text
            Password    = $txtPw.Text
            SmtpHost    = $txtHost.Text
            SmtpPort    = $portNum
            ImplicitTls = $chkImplicitTls.Checked
            Remember    = $chkRemember.Checked
        }
    }
    return $null
}

$cred = Show-CredentialForm
if (-not $cred -or [string]::IsNullOrWhiteSpace($cred.Id) -or [string]::IsNullOrWhiteSpace($cred.Password) -or [string]::IsNullOrWhiteSpace($cred.SmtpHost)) {
    Write-Host "Report not sent (no credentials/SMTP settings entered)."
    Read-Host "Press Enter to close"
    exit 0
}

if ($cred.Remember) {
    Save-CachedCredential -id $cred.Id -password $cred.Password -smtpHost $cred.SmtpHost -smtpPort $cred.SmtpPort -implicitTls $cred.ImplicitTls
} else {
    Clear-CachedCredential
}

# ---- Send via SMTP - server/port/security mode all come from the popup ----
# (default: mail.irs.com.my:587/STARTTLS, the company server). CONFIRMED
# (2026-09-15): System.Net.Mail.SmtpClient always sends the local Windows
# computer name (e.g. "DESKTOP-F1OQ6G8") as its EHLO identity with NO
# public/supported way to override it (known .NET Framework limitation),
# and the company server's anti-spam rule rejects that - reproduced twice,
# a real repeatable bug, not a one-off. Using a hand-rolled sender instead
# so we can send a proper EHLO, and so the server itself is configurable
# (per Jin: lets you switch to a personal mail account if the office IP
# ever gets blocked, instead of being stuck on the company server).
$logPath = Join-Path $PSScriptRoot "last-report-email.$($scriptName -replace '\.ps1$','').log"

# Windows PowerShell 5.1's default SecurityProtocol often omits TLS 1.2,
# which makes modern mail servers forcibly reset the connection mid-
# handshake ("Unable to read data from the transport connection").
# Force TLS 1.2 explicitly before connecting.
[System.Net.ServicePointManager]::SecurityProtocol = [System.Net.SecurityProtocolType]::Tls12

function Send-SmtpMailRaw {
    param(
        [string]$SmtpHost,
        [int]$Port,
        [string]$User,
        [string]$Password,
        [string]$From,
        [string[]]$To,
        [string]$Subject,
        [string]$HtmlBody,
        [int]$TimeoutMs = 30000,
        # $true (typically port 465) = TLS wraps the connection immediately,
        # before any SMTP command. $false (typically port 587) = plaintext
        # EHLO first, then STARTTLS upgrades the same connection mid-
        # session. Configurable per the send-report popup's checkbox, since
        # this may now point at a personal mail provider instead of the
        # company server.
        [bool]$ImplicitTls = $false
    )

    $heloDomain = $From -replace '^[^@]*@', ''
    if ([string]::IsNullOrWhiteSpace($heloDomain)) { $heloDomain = "irs.com.my" }

    function Read-SmtpResponse($reader) {
        $lines = @()
        do {
            $line = $reader.ReadLine()
            if ($null -eq $line) { throw "SMTP connection closed unexpectedly while reading a response." }
            $lines += $line
        } while ($line.Length -ge 4 -and $line[3] -eq '-')
        # BUG FIXED (2026-09-15): most SMTP responses are a single line (220,
        # 250, 334, 235, ...) - PowerShell "unwraps" a single-element array
        # into the bare scalar when a function returns it, so $lines here
        # silently became a plain STRING instead of a 1-item array. The
        # caller's `$lines[-1]` then indexed the string's last CHARACTER,
        # not the line, and `.Substring()` doesn't exist on a Char -
        # confirmed live ("[System.Char] does not contain a method named
        # 'Substring'"). The leading comma forces this to stay an array of
        # strings regardless of how many lines it holds.
        return ,$lines
    }

    function Send-Cmd($writer, $reader, [string]$command, [int[]]$expectedCodes) {
        if ($null -ne $command) { $writer.Write("$command`r`n") }
        $lines = Read-SmtpResponse $reader
        $code = [int]($lines[-1].Substring(0, 3))
        if ($expectedCodes -and ($expectedCodes -notcontains $code)) {
            throw "SMTP error ($code): $($lines -join ' | ')"
        }
        return @{ Code = $code; Lines = $lines }
    }

    $tcp = New-Object System.Net.Sockets.TcpClient
    $connectTask = $tcp.ConnectAsync($SmtpHost, $Port)
    if (-not $connectTask.Wait($TimeoutMs)) { throw "Connection to $SmtpHost`:$Port timed out." }
    $tcp.ReceiveTimeout = $TimeoutMs
    $tcp.SendTimeout = $TimeoutMs

    try {
        $stream = $tcp.GetStream()

        if ($ImplicitTls) {
            # TLS handshake happens FIRST, before any SMTP command - no
            # plaintext EHLO/STARTTLS exchange beforehand.
            $sslStream = New-Object System.Net.Security.SslStream($stream, $false)
            $sslStream.AuthenticateAsClient($SmtpHost, $null, [System.Security.Authentication.SslProtocols]::Tls12, $false)
            $reader = New-Object System.IO.StreamReader($sslStream)
            $writer = New-Object System.IO.StreamWriter($sslStream)
            $writer.AutoFlush = $true

            Read-SmtpResponse $reader | Out-Null # 220 greeting (already over TLS)
            Send-Cmd $writer $reader "EHLO $heloDomain" @(250) | Out-Null
        } else {
            # Plaintext EHLO first, then STARTTLS upgrades this same
            # connection in place.
            $reader = New-Object System.IO.StreamReader($stream)
            $writer = New-Object System.IO.StreamWriter($stream)
            $writer.AutoFlush = $true

            Read-SmtpResponse $reader | Out-Null # 220 greeting
            Send-Cmd $writer $reader "EHLO $heloDomain" @(250) | Out-Null
            Send-Cmd $writer $reader "STARTTLS" @(220) | Out-Null

            $sslStream = New-Object System.Net.Security.SslStream($stream, $false)
            $sslStream.AuthenticateAsClient($SmtpHost, $null, [System.Security.Authentication.SslProtocols]::Tls12, $false)
            $reader = New-Object System.IO.StreamReader($sslStream)
            $writer = New-Object System.IO.StreamWriter($sslStream)
            $writer.AutoFlush = $true

            Send-Cmd $writer $reader "EHLO $heloDomain" @(250) | Out-Null
        }

        Send-Cmd $writer $reader "AUTH LOGIN" @(334) | Out-Null
        Send-Cmd $writer $reader ([Convert]::ToBase64String([System.Text.Encoding]::UTF8.GetBytes($User))) @(334) | Out-Null
        Send-Cmd $writer $reader ([Convert]::ToBase64String([System.Text.Encoding]::UTF8.GetBytes($Password))) @(235) | Out-Null

        Send-Cmd $writer $reader "MAIL FROM:<$From>" @(250) | Out-Null

        $rcptFailures = @()
        $rcptOk = @()
        foreach ($recipient in $To) {
            try {
                Send-Cmd $writer $reader "RCPT TO:<$recipient>" @(250, 251) | Out-Null
                $rcptOk += $recipient
            } catch {
                $rcptFailures += "$recipient : $($_.Exception.Message)"
            }
        }
        if ($rcptOk.Count -eq 0) {
            throw "BadRecipient: $($rcptFailures -join '; ')"
        }

        Send-Cmd $writer $reader "DATA" @(354) | Out-Null

        $headers = "From: $From`r`nTo: $($rcptOk -join ', ')`r`nSubject: $Subject`r`nMIME-Version: 1.0`r`nContent-Type: text/html; charset=utf-8`r`n`r`n"
        # RFC 5321 dot-stuffing: a line starting with "." must be escaped as
        # ".." so it isn't mistaken for the end-of-DATA terminator below.
        $bodyLines = ($headers + $HtmlBody) -split "`r`n|`n" | ForEach-Object { if ($_.StartsWith('.')) { ".$_" } else { $_ } }
        $writer.Write(($bodyLines -join "`r`n") + "`r`n.`r`n")
        $dataResult = Read-SmtpResponse $reader
        $dataCode = [int]($dataResult[-1].Substring(0, 3))
        if ($dataCode -ne 250) { throw "SMTP error ($dataCode) after DATA: $($dataResult -join ' | ')" }

        try { Send-Cmd $writer $reader "QUIT" @(221) | Out-Null } catch {}

        if ($rcptFailures.Count -gt 0) {
            throw "BadRecipient: $($rcptFailures -join '; ')"
        }
    } finally {
        $tcp.Close()
    }
}

# Confirmed live (2026-09-15): the TLS handshake to this server occasionally
# resets ("connection forcibly closed") as a one-off. Per Jin: 2 attempts is
# enough - don't keep hammering the server. Bad-recipient errors are
# deterministic (the address itself is wrong) so those are NEVER retried -
# only the generic transport-level catch below is.
$maxSendAttempts = 2
$retryDelaysSeconds = @(3)
$sendSucceeded = $false
for ($attempt = 1; $attempt -le $maxSendAttempts -and -not $sendSucceeded; $attempt++) {
    try {
        Send-SmtpMailRaw -SmtpHost $cred.SmtpHost -Port $cred.SmtpPort -ImplicitTls $cred.ImplicitTls -User $cred.Id -Password $cred.Password `
            -From $cred.Id -To $recipients `
            -Subject "Test Report - $scriptName ($($endTime.ToString('yyyy-MM-dd HH:mm')))" `
            -HtmlBody $reportHtml -TimeoutMs 30000

        "$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') OK - sent to $($recipients -join ', ') as $($cred.Id) (attempt $attempt/$maxSendAttempts)" | Out-File -FilePath $logPath -Append -Encoding utf8
        [System.Windows.Forms.MessageBox]::Show("Report sent to: $($recipients -join ', ')", "Sent", "OK", "Information") | Out-Null
        Write-Host "Report emailed successfully."
        $sendSucceeded = $true
    } catch {
        $realEx = if ($_.Exception.InnerException) { $_.Exception.InnerException } else { $_.Exception }
        $isBadRecipient = $realEx.Message -like "BadRecipient:*"

        if (-not $isBadRecipient -and $attempt -lt $maxSendAttempts) {
            $delay = $retryDelaysSeconds[[Math]::Min($attempt - 1, $retryDelaysSeconds.Count - 1)]
            Write-Host "Send attempt $attempt/$maxSendAttempts failed ($($realEx.Message)) - retrying in ${delay}s..." -ForegroundColor Yellow
            Start-Sleep -Seconds $delay
            continue
        }

        if ($isBadRecipient) {
            $badOnes = $realEx.Message -replace '^BadRecipient:\s*', ''
            "$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') FAILED (bad recipient) - $badOnes" | Out-File -FilePath $logPath -Append -Encoding utf8
            [System.Windows.Forms.MessageBox]::Show("Failed to send - server rejected these address(es):`n`n$badOnes", "Send failed", "OK", "Error") | Out-Null
            Write-Host "Failed to send - rejected recipient(s):`n$badOnes"
        } else {
            "$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') FAILED - $($_.Exception.ToString())" | Out-File -FilePath $logPath -Append -Encoding utf8
            [System.Windows.Forms.MessageBox]::Show("Failed to send report:`n$($realEx.Message)`n`nDetails logged to:`n$logPath", "Send failed", "OK", "Error") | Out-Null
            Write-Host "Failed to send report: $($realEx.Message)"
            Write-Host "Full details logged to $logPath"
        }
    }
}

Read-Host "Press Enter to close"
