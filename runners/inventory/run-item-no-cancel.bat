@echo off
REM Run this from anywhere by double-clicking it, or from cmd.exe.
REM Runs the Item (No Cancel) test case against UAT with a visible browser.
REM WARNING: this test does NOT delete the item it creates. It leaves a
REM real leftover Item that must be cleaned up manually if desired.

cd /d "%~dp0..\.."

set ALAYA_CLIENT_ID=uat
set ALAYA_USERNAME=admin
set ALAYA_PASSWORD=123

npx playwright test tests/inventory/item-no-cancel.spec.js --headed

pause
