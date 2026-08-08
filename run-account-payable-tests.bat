@echo off
REM Run this from anywhere by double-clicking it, or from cmd.exe.
REM Runs every Account Payable test (the whole Reports > Account Payable
REM category - there is no separate transactional module for this one yet)
REM against UAT, one test at a time (--workers=1), headless. Same rationale
REM as run-all-tests.bat, just scoped to this one module - see
REM run-account-receivable-tests.bat's header comment for the full reasoning
REM behind splitting by module.

cd /d "%~dp0"

set ALAYA_CLIENT_ID=uat
set ALAYA_USERNAME=admin
set ALAYA_PASSWORD=123
set ALAYA_TEST_CUSTOMER_CODE=000001
set ALAYA_TEST_ITEM_DESCRIPTION=BISKUT PLANTA

npx playwright test tests/reports/account-payable --workers=1

echo.
echo ================================================
echo  Account Payable test run finished. Opening the HTML report...
echo ================================================
npx playwright show-report

pause
