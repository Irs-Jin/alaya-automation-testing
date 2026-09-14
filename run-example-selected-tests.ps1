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
param(
    [switch]$Smoke
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
if (Test-Path $jsonReportPath) { Remove-Item $jsonReportPath -Force }
$env:PLAYWRIGHT_JSON_OUTPUT_NAME = $jsonReportPath

$recipients = @(
    "ivan.low@irs.com.my",
    "waisian.chong@irs.com.my",
    "yew@irs.com.my",
    "jin@irs.com.my"
)

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
$elapsed = $endTime - $startTime

Write-Host ""
Write-Host "================================================"
Write-Host " Test run finished. Opening the HTML report..."
Write-Host "================================================"
# `playwright show-report` starts a local server and blocks until closed
# (like `npx serve`) - run it detached so this script can carry on to the
# report/email prompt below instead of hanging here forever.
Start-Process -FilePath "cmd.exe" -ArgumentList "/c npx playwright show-report" -WindowStyle Minimized

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

        npx playwright test $failedFilesForRerun --grep $grepPattern --workers=1 --reporter=list,json
        $rerunExitCode = $LASTEXITCODE

        $rerunSpecs = @()
        if (Test-Path $jsonReportPath) {
            try {
                $rerunJson = Get-Content $jsonReportPath -Raw | ConvertFrom-Json
                foreach ($suite in $rerunJson.suites) {
                    $rerunSpecs += Get-FlatSpecs -suite $suite -filePath $null
                }
            } catch {
                Write-Host "Warning: could not parse rerun results ($_). Original failures kept as-is in the report."
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

# ---- Popup for the sender's own webmail credentials ----
# "Remember password" uses Windows DPAPI (CurrentUser scope) - the password
# is encrypted with a key tied to this Windows account on this machine, so
# the cache file is useless if copied elsewhere or opened by another user.
# It is still local plaintext-equivalent access for *this* Windows login,
# so it's opt-in via the checkbox, not on by default.

Add-Type -AssemblyName System.Security
$credCachePath = Join-Path $PSScriptRoot ".send-report-credential.$($scriptName -replace '\.ps1$','').dat"

function Save-CachedCredential([string]$id, [string]$password) {
    $bytes = [System.Text.Encoding]::UTF8.GetBytes($password)
    $encrypted = [System.Security.Cryptography.ProtectedData]::Protect($bytes, $null, [System.Security.Cryptography.DataProtectionScope]::CurrentUser)
    $payload = "$id`n$([Convert]::ToBase64String($encrypted))"
    Set-Content -Path $credCachePath -Value $payload -Encoding utf8
}

function Load-CachedCredential {
    if (-not (Test-Path $credCachePath)) { return $null }
    try {
        $lines = Get-Content -Path $credCachePath
        if ($lines.Count -lt 2) { return $null }
        $encrypted = [Convert]::FromBase64String($lines[1])
        $bytes = [System.Security.Cryptography.ProtectedData]::Unprotect($encrypted, $null, [System.Security.Cryptography.DataProtectionScope]::CurrentUser)
        return @{ Id = $lines[0]; Password = [System.Text.Encoding]::UTF8.GetString($bytes) }
    } catch {
        # Cache unreadable (different user/machine, corrupted, etc.) - ignore and ask fresh.
        return $null
    }
}

function Clear-CachedCredential {
    if (Test-Path $credCachePath) { Remove-Item $credCachePath -Force }
}

function Show-CredentialForm {
    $saved = Load-CachedCredential

    $form = New-Object System.Windows.Forms.Form
    $form.Text = "Send report - your webmail login"
    $form.Size = New-Object System.Drawing.Size(380, 230)
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
    $txtId.Size = New-Object System.Drawing.Size(340, 20)
    if ($saved) { $txtId.Text = $saved.Id }
    $form.Controls.Add($txtId)

    $lblPw = New-Object System.Windows.Forms.Label
    $lblPw.Text = "Password:"
    $lblPw.Location = New-Object System.Drawing.Point(10, 65)
    $lblPw.AutoSize = $true
    $form.Controls.Add($lblPw)

    $txtPw = New-Object System.Windows.Forms.TextBox
    $txtPw.Location = New-Object System.Drawing.Point(10, 85)
    $txtPw.Size = New-Object System.Drawing.Size(340, 20)
    $txtPw.PasswordChar = "*"
    if ($saved) { $txtPw.Text = $saved.Password }
    $form.Controls.Add($txtPw)

    $chkRemember = New-Object System.Windows.Forms.CheckBox
    $chkRemember.Text = "Remember password on this PC"
    $chkRemember.Location = New-Object System.Drawing.Point(10, 115)
    $chkRemember.Size = New-Object System.Drawing.Size(340, 20)
    $chkRemember.Checked = [bool]$saved
    $form.Controls.Add($chkRemember)

    $btnOk = New-Object System.Windows.Forms.Button
    $btnOk.Text = "Send"
    $btnOk.Location = New-Object System.Drawing.Point(190, 150)
    $btnOk.DialogResult = [System.Windows.Forms.DialogResult]::OK
    $form.Controls.Add($btnOk)
    $form.AcceptButton = $btnOk

    $btnCancel = New-Object System.Windows.Forms.Button
    $btnCancel.Text = "Cancel"
    $btnCancel.Location = New-Object System.Drawing.Point(275, 150)
    $btnCancel.DialogResult = [System.Windows.Forms.DialogResult]::Cancel
    $form.Controls.Add($btnCancel)
    $form.CancelButton = $btnCancel

    $result = $form.ShowDialog()
    if ($result -eq [System.Windows.Forms.DialogResult]::OK) {
        return @{ Id = $txtId.Text; Password = $txtPw.Text; Remember = $chkRemember.Checked }
    }
    return $null
}

$cred = Show-CredentialForm
if (-not $cred -or [string]::IsNullOrWhiteSpace($cred.Id) -or [string]::IsNullOrWhiteSpace($cred.Password)) {
    Write-Host "Report not sent (no credentials entered)."
    Read-Host "Press Enter to close"
    exit 0
}

if ($cred.Remember) {
    Save-CachedCredential -id $cred.Id -password $cred.Password
} else {
    Clear-CachedCredential
}

# ---- Send via the company's SMTP (mail.irs.com.my, STARTTLS port 587) ----
# NOTE: port 465 is "implicit TLS" and .NET's SmtpClient does NOT support
# it (only explicit STARTTLS) - using 465 here fails/hangs silently instead
# of sending. Port 587 (STARTTLS) is what SmtpClient actually supports and
# matches the webmail portal's own "Non-SSL Settings" SMTP port.

$logPath = Join-Path $PSScriptRoot "last-report-email.$($scriptName -replace '\.ps1$','').log"

try {
    # Windows PowerShell 5.1's default SecurityProtocol often omits TLS 1.2,
    # which makes modern mail servers forcibly reset the connection mid-
    # handshake ("Unable to read data from the transport connection").
    # Force TLS 1.2 explicitly before connecting.
    [System.Net.ServicePointManager]::SecurityProtocol = [System.Net.SecurityProtocolType]::Tls12

    $smtp = New-Object System.Net.Mail.SmtpClient("mail.irs.com.my", 587)
    $smtp.EnableSsl = $true
    $smtp.Timeout = 30000
    $smtp.Credentials = New-Object System.Net.NetworkCredential($cred.Id, $cred.Password)

    $mail = New-Object System.Net.Mail.MailMessage
    $mail.From = $cred.Id
    foreach ($r in $recipients) { $mail.To.Add($r) }
    $mail.Subject = "Test Report - $scriptName ($($endTime.ToString('yyyy-MM-dd HH:mm')))"
    $mail.Body = $reportHtml
    $mail.IsBodyHtml = $true

    $smtp.Send($mail)
    "$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') OK - sent to $($recipients -join ', ') as $($cred.Id)" | Out-File -FilePath $logPath -Append -Encoding utf8
    [System.Windows.Forms.MessageBox]::Show("Report sent to: $($recipients -join ', ')", "Sent", "OK", "Information") | Out-Null
    Write-Host "Report emailed successfully."
} catch {
    # PowerShell wraps direct .NET method-call exceptions in a
    # MethodInvocationException - the real SMTP exception (with the
    # specific rejected recipient) is the InnerException, not $_.Exception.
    $realEx = if ($_.Exception.InnerException) { $_.Exception.InnerException } else { $_.Exception }

    if ($realEx -is [System.Net.Mail.SmtpFailedRecipientsException]) {
        $badOnes = ($realEx.InnerExceptions | ForEach-Object { "$($_.FailedRecipient): $($_.Message)" }) -join "`n"
        "$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') FAILED (bad recipient) - $badOnes" | Out-File -FilePath $logPath -Append -Encoding utf8
        [System.Windows.Forms.MessageBox]::Show("Failed to send - server rejected these address(es):`n`n$badOnes", "Send failed", "OK", "Error") | Out-Null
        Write-Host "Failed to send - rejected recipient(s):`n$badOnes"
    } elseif ($realEx -is [System.Net.Mail.SmtpFailedRecipientException]) {
        $badOne = "$($realEx.FailedRecipient): $($realEx.Message)"
        "$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') FAILED (bad recipient) - $badOne" | Out-File -FilePath $logPath -Append -Encoding utf8
        [System.Windows.Forms.MessageBox]::Show("Failed to send - server rejected this address:`n`n$badOne", "Send failed", "OK", "Error") | Out-Null
        Write-Host "Failed to send - rejected recipient: $badOne"
    } else {
        "$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') FAILED - $($_.Exception.ToString())" | Out-File -FilePath $logPath -Append -Encoding utf8
        [System.Windows.Forms.MessageBox]::Show("Failed to send report:`n$($realEx.Message)`n`nDetails logged to:`n$logPath", "Send failed", "OK", "Error") | Out-Null
        Write-Host "Failed to send report: $($realEx.Message)"
        Write-Host "Full details logged to $logPath"
    }
}

Read-Host "Press Enter to close"
