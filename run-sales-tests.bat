@echo off
REM Run this from anywhere by double-clicking it, or from cmd.exe.
REM Runs every Sales transactional test against UAT, one test at a time
REM (--workers=1), headless. Reports > Sales is a SEPARATE run - see
REM run-sales-reports-tests.bat. Same rationale as run-all-tests.bat, just
REM scoped to this one module - see run-account-receivable-tests.bat's
REM header comment for the full reasoning behind splitting by module.
REM
REM Customer/Sales Branch/Item defaults below match UAT/TANJAK MEGA GROUP
REM SDN BHD (re-probed live 2026-08-19/20) - override via ALAYA_TEST_* env
REM vars when pointing at another client/company.

cd /d "%~dp0"

set ALAYA_CLIENT_ID=uat
set ALAYA_USERNAME=admin
set ALAYA_PASSWORD=123
set ALAYA_TEST_CUSTOMER_CODE=000001
set ALAYA_TEST_ITEM_DESCRIPTION=BISKUT PLANTA

npx playwright test tests/sales --workers=1

echo.
echo ================================================
echo  Sales test run finished. Opening the HTML report...
echo ================================================
npx playwright show-report

pause
