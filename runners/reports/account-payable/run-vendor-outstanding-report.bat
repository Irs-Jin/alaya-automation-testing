@echo off
REM Run this from anywhere by double-clicking it, or from cmd.exe.
REM Runs the Vendor Outstanding report test against UAT with a visible browser.

cd /d "%~dp0..\..\.."

set ALAYA_CLIENT_ID=uat
set ALAYA_USERNAME=admin
set ALAYA_PASSWORD=123

npx playwright test tests/reports/account-payable/vendor-outstanding-report.spec.js --headed

pause
