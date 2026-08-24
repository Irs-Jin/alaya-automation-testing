@echo off
REM Run this from anywhere by double-clicking it, or from cmd.exe.
REM Runs the Stock Transfer Qty Out (No Cancel) verification test against UAT with a visible browser.
REM WARNING: this test does NOT delete the document it posts. It leaves a
REM real -1 Qty Available behind that must be cleaned up manually if desired
REM (only possible until a Stock Transfer Receipt is posted against it).

cd /d "%~dp0..\.."

set ALAYA_CLIENT_ID=uat
set ALAYA_USERNAME=admin
set ALAYA_PASSWORD=123

npx playwright test tests/inventory/stock-transfer-qty-out-no-cancel.spec.js --headed

pause
