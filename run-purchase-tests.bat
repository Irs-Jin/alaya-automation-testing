@echo off
REM Run this from anywhere by double-clicking it, or from cmd.exe.
REM Runs every Purchase transactional test against UAT, one test at a time
REM (--workers=1), headless. Reports > Purchase is a SEPARATE run - see
REM run-purchase-reports-tests.bat. Same rationale as run-all-tests.bat,
REM just scoped to this one module - see run-account-receivable-tests.bat's
REM header comment for the full reasoning behind splitting by module.
REM
REM Vendor/Warehouse/Item defaults below match UAT/TANJAK MEGA GROUP SDN
REM BHD (re-probed live 2026-08-20) - override via ALAYA_TEST_* env vars
REM when pointing at another client/company.

cd /d "%~dp0"

set ALAYA_CLIENT_ID=uat
set ALAYA_USERNAME=admin
set ALAYA_PASSWORD=123

npx playwright test tests/purchase --workers=1

echo.
echo ================================================
echo  Purchase test run finished. Opening the HTML report...
echo ================================================
npx playwright show-report

pause
