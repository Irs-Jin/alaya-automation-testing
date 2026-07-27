@echo off
REM Run this from anywhere by double-clicking it, or from cmd.exe.
REM Runs the Cash Sales "Post" pilot test against UAT with a visible browser.

cd /d "%~dp0..\.."

set ALAYA_CLIENT_ID=UAT
set ALAYA_USERNAME=admin
set ALAYA_PASSWORD=123
set ALAYA_TEST_CUSTOMER_CODE=000001
set ALAYA_TEST_ITEM_DESCRIPTION=BISKUT PLANTA

npx playwright test tests/sales/cash-sales.spec.js --headed -g "posts a new cash sales entry"

pause
