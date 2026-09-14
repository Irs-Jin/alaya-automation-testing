@echo off
REM Run this from anywhere by double-clicking it, or from cmd.exe.
REM Runs the Close Stock Transfer Request Save Draft/Post/Post & New (No Cancel) test cases against UAT with a visible browser.
REM WARNING: these tests do NOT delete either the closing document or its
REM source Stock Transfer Request. They leave real leftover documents
REM behind that must be cleaned up manually if desired.

cd /d "%~dp0..\.."

set ALAYA_CLIENT_ID=uat
set ALAYA_USERNAME=admin
set ALAYA_PASSWORD=123

npx playwright test tests/inventory/close-stock-transfer-request-no-cancel.spec.js --headed

pause
