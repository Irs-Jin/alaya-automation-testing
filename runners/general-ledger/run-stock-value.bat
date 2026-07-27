@echo off
REM Run this from anywhere by double-clicking it, or from cmd.exe.
REM Runs the Stock Value test case against UAT with a visible browser.

cd /d "%~dp0..\.."

set ALAYA_CLIENT_ID=UAT
set ALAYA_USERNAME=admin
set ALAYA_PASSWORD=123

npx playwright test tests/general-ledger/stock-value.spec.js --headed

pause
