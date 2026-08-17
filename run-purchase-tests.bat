@echo off
REM Run this from anywhere by double-clicking it, or from cmd.exe.
REM Runs every Purchase test (the Purchase Order transactional spec + the
REM whole Reports > Purchase category) against UAT, one test at a time
REM (--workers=1), headless. Same rationale as run-all-tests.bat, just
REM scoped to this one module - see run-account-receivable-tests.bat's
REM header comment for the full reasoning behind splitting by module.
REM
REM purchase-order.spec.js defaults to qa3-only test data (vendor
REM "000002", warehouse "PRIMARY", item "000001") if the ALAYA_TEST_*
REM overrides below aren't set - same qa3-vs-UAT data mismatch already
REM documented for cash-sales.spec.js in run-all-tests.bat. UAT's real
REM vendor/warehouse/item codes aren't confirmed yet - set these once
REM known, or override via env vars when running against UAT.

cd /d "%~dp0"

set ALAYA_CLIENT_ID=uat
set ALAYA_USERNAME=admin
set ALAYA_PASSWORD=123

npx playwright test tests/purchase tests/reports/purchase --workers=1

echo.
echo ================================================
echo  Purchase test run finished. Opening the HTML report...
echo ================================================
npx playwright show-report

pause
