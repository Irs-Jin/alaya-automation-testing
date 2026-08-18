@echo off
REM Run this from anywhere by double-clicking it, or from cmd.exe.
REM Runs the Bank Reconciliation test case against UAT with a visible browser.
REM
REM CAUTION (2026-07-26): a live debug run of this test previously caused an
REM extra, unintended row deletion due to a bug in the delete-confirmation
REM step (since fixed - see bankReconciliationPage.js's confirmDelete()
REM comment). Verify the fix yourself before trusting this test's delete
REM step on real data again.

cd /d "%~dp0..\.."

set ALAYA_CLIENT_ID=uat
set ALAYA_USERNAME=admin
set ALAYA_PASSWORD=123

npx playwright test tests/general-ledger/bank-reconciliation.spec.js --headed

pause
