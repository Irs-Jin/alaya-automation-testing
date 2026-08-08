@echo off
REM Run this from anywhere by double-clicking it, or from cmd.exe.
REM Runs every General Ledger test (Journal Entry/Cash Book Payment/Cash
REM Book Receipt/Stock Value/Bank Reconciliation transactional specs + the
REM whole Reports > General Ledger category) against UAT, one test at a
REM time (--workers=1), headless. Same rationale as run-all-tests.bat, just
REM scoped to this one module - see run-account-receivable-tests.bat's
REM header comment for the full reasoning behind splitting by module.

cd /d "%~dp0"

set ALAYA_CLIENT_ID=uat
set ALAYA_USERNAME=admin
set ALAYA_PASSWORD=123
set ALAYA_TEST_CUSTOMER_CODE=000001
set ALAYA_TEST_ITEM_DESCRIPTION=BISKUT PLANTA

npx playwright test tests/general-ledger tests/reports/general-ledger --workers=1

echo.
echo ================================================
echo  General Ledger test run finished. Opening the HTML report...
echo ================================================
npx playwright show-report

pause
