@echo off
REM Run this from anywhere by double-clicking it, or from cmd.exe.
REM
REM TEMPLATE / EXAMPLE: this is Jin's original selected-test-set runner,
REM kept in the repo as a copyable example of the run-<name>-selected-
REM tests.bat/.ps1 pattern - see EMAIL-REPORT-GUIDE.md. Copy this pair to
REM run-<yourname>-selected-tests.bat/.ps1 and edit the test selection
REM below (and the matching npx line in the .ps1) to your own set; don't
REM edit this one in place unless you actually are Jin.
REM
REM Jin's confirmed working set (2026-09-09): only what's actually needed
REM right now, not the full suite.
REM   - tests/account-receivable/customer.spec.js  (just Customer - the
REM     other 5 A/R spec files - Invoice/Credit Note/Debit Note/Payment/
REM     Payment Refund - are NOT needed and are deliberately excluded)
REM   - tests/general-ledger  (all)
REM   - tests/pos  (all)
REM   - tests/reports  (all EXCEPT pbi21784-calculated-columns.spec.js -
REM     see below)
REM Explicitly NOT run: tests/sales, tests/inventory, tests/purchase (not
REM needed for this set), and tests/reports/sales/pbi21784-calculated-
REM columns.spec.js.
REM
REM pbi21784-calculated-columns.spec.js is excluded on purpose: it's an
REM ad-hoc script (untracked in git, not written to this repo's page-object
REM convention) that tries to detect a native desktop Report Designer
REM launcher opening - that's inherently unreliable to observe from an
REM automated browser and fails consistently for that reason, not because
REM of an ERP bug. --grep-invert filters it out by its describe title.
REM
REM All 91 remaining tests were individually confirmed passing on
REM 2026-09-09 after bumping several timeouts that were too tight for this
REM UAT environment under load (see playwright.config.js's actionTimeout,
REM accountReceivableReportPage.js's click/frame-search timeouts, and the
REM 90000->150000 test.setTimeout bumps in customer-last-visit-listing,
REM item-point-setting-listing, item-price-level-listing, item-reorder-
REM point, and stock-aging report specs). stock-balance-report got the same
REM 90000->150000 bump on 2026-09-14 (unfiltered ALL-warehouse/ALL-item
REM scan - same heavy shape as the others in that list).

cd /d "%~dp0"

REM Test run + report-email flow now lives in run-example-selected-tests.ps1
REM (needs real control flow / .NET forms for the send-report prompt and
REM credential popup that batch can't do on its own).
REM
REM Full selected set (the ~91 tests described above). Pass -Smoke instead
REM of nothing if you ever need to re-verify the report/email/rerun flow
REM quickly against a small 10-test slice before trusting a full run.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0run-example-selected-tests.ps1"
