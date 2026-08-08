@echo off
REM Run this from anywhere by double-clicking it, or from cmd.exe.
REM Runs every Sales test (the Cash Sales transactional spec + the whole
REM Reports > Sales category) against UAT, one test at a time
REM (--workers=1), headless. Same rationale as run-all-tests.bat, just
REM scoped to this one module - see run-account-receivable-tests.bat's
REM header comment for the full reasoning behind splitting by module.
REM
REM cash-sales.spec.js defaults to qa3-only test data (customer
REM "000000002") if ALAYA_TEST_CUSTOMER_CODE/ALAYA_TEST_ITEM_DESCRIPTION
REM aren't set - UAT (the client every test in this suite targets) uses
REM 6-digit customer codes like "000001", not qa3's 9-digit codes.

cd /d "%~dp0"

set ALAYA_CLIENT_ID=uat
set ALAYA_USERNAME=admin
set ALAYA_PASSWORD=123
set ALAYA_TEST_CUSTOMER_CODE=000001
set ALAYA_TEST_ITEM_DESCRIPTION=BISKUT PLANTA

npx playwright test tests/sales tests/reports/sales --workers=1

echo.
echo ================================================
echo  Sales test run finished. Opening the HTML report...
echo ================================================
npx playwright show-report

pause
