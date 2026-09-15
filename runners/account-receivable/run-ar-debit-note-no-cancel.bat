@echo off
REM Run this from anywhere by double-clicking it, or from cmd.exe.
REM Runs the A/R Debit Note Save Draft/Post/Post & New (No Cancel) test cases against UAT with a visible browser.
REM WARNING: these tests do NOT cancel the documents they create. They leave
REM real Draft/Posted A/R Debit Note documents behind that must be cleaned
REM up manually if desired.

cd /d "%~dp0..\.."

set ALAYA_CLIENT_ID=uat
set ALAYA_USERNAME=admin
set ALAYA_PASSWORD=123

npx playwright test tests/account-receivable/ar-debit-note-no-cancel.spec.js --headed

pause
