@echo off
REM Run this from anywhere by double-clicking it, or from cmd.exe.
REM Runs the Stock Transfer (Copy From) Save Draft/Post/Post & New (No Cancel) test cases against UAT with a visible browser.
REM WARNING: these tests do NOT delete either the transfer or its source
REM Stock Transfer Request. They leave real leftover documents behind that
REM must be cleaned up manually if desired.

cd /d "%~dp0..\.."

set ALAYA_CLIENT_ID=uat
set ALAYA_USERNAME=admin
set ALAYA_PASSWORD=123

npx playwright test tests/inventory/stock-transfer-copy-from-no-cancel.spec.js --headed

pause
