@echo off
REM Run this from anywhere by double-clicking it, or from cmd.exe.
REM Runs the Stock Transfer + Receipt Qty verification test against UAT with a visible browser.
REM WARNING: this test permanently creates a Stock Transfer + Stock Transfer
REM Receipt pair (see stockTransferReceiptPage.js: no Cancel/Delete exists
REM for Stock Transfer Receipt). Item 526014's overall Qty Available is
REM unaffected, but 1 unit permanently moves from AMPANG to BERCHAM RAYA
REM each run.

cd /d "%~dp0..\.."

set ALAYA_CLIENT_ID=uat
set ALAYA_USERNAME=admin
set ALAYA_PASSWORD=123

npx playwright test tests/inventory/stock-transfer-receipt-qty.spec.js --headed

pause
