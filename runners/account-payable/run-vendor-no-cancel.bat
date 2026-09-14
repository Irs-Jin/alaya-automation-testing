@echo off
REM Run this from anywhere by double-clicking it, or from cmd.exe.
REM Runs the Vendor create/edit (No Cancel) test case against UAT with a visible browser.
REM WARNING: this test does NOT delete the vendor it creates. It leaves a
REM real leftover Vendor that must be cleaned up manually if desired.

cd /d "%~dp0..\.."

set ALAYA_CLIENT_ID=uat
set ALAYA_USERNAME=admin
set ALAYA_PASSWORD=123

npx playwright test tests/account-payable/vendor-no-cancel.spec.js --headed

pause
