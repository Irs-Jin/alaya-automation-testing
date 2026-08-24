@echo off
REM Run this from anywhere by double-clicking it, or from cmd.exe.
REM Runs the Stock Adjustment Qty (No Cancel) verification test against UAT with a visible browser.
REM WARNING: this test does NOT delete the document it posts. It leaves a
REM real qty delta behind that must be cleaned up manually if desired.

cd /d "%~dp0..\.."

set ALAYA_CLIENT_ID=uat
set ALAYA_USERNAME=admin
set ALAYA_PASSWORD=123

npx playwright test tests/inventory/stock-adjustment-qty-no-cancel.spec.js --headed

pause
