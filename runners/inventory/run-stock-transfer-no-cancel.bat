@echo off
REM Run this from anywhere by double-clicking it, or from cmd.exe.
REM Runs the Stock Transfer Save Draft/Post/Post & New (No Cancel) test cases against UAT with a visible browser.
REM WARNING: these tests do NOT delete the documents they create. They leave
REM real Draft/Posted Stock Transfer documents behind that must be cleaned
REM up manually if desired.

cd /d "%~dp0..\.."

set ALAYA_CLIENT_ID=uat
set ALAYA_USERNAME=admin
set ALAYA_PASSWORD=123

npx playwright test tests/inventory/stock-transfer-no-cancel.spec.js --headed

pause
