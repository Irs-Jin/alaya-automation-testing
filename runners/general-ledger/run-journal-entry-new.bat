@echo off
REM Run this from anywhere by double-clicking it, or from cmd.exe.
REM Runs ALL Journal Entry test cases (New, Save Draft, Post, Post & New) against UAT with a visible browser.

cd /d "%~dp0..\.."

set ALAYA_CLIENT_ID=uat
set ALAYA_USERNAME=admin
set ALAYA_PASSWORD=123

npx playwright test tests/general-ledger/journal-entry.spec.js --headed

pause
