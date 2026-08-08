@echo off
REM Run this from anywhere by double-clicking it, or from cmd.exe.
REM Runs every Account Receivable test (the Customer CRUD transactional
REM spec + the whole Reports > Account Receivable category) against UAT,
REM one test at a time (--workers=1), headless - same rationale as
REM run-all-tests.bat, just scoped to this one module. Splitting the full
REM suite by module like this means a re-check of one area doesn't have to
REM eat the ~2h a full-suite run takes, and keeps failures from one module
REM from being muddied by UAT load building up over dozens of unrelated
REM tests first.

cd /d "%~dp0"

set ALAYA_CLIENT_ID=uat
set ALAYA_USERNAME=admin
set ALAYA_PASSWORD=123
set ALAYA_TEST_CUSTOMER_CODE=000001
set ALAYA_TEST_ITEM_DESCRIPTION=BISKUT PLANTA

npx playwright test tests/account-receivable tests/reports/account-receivable --workers=1

echo.
echo ================================================
echo  Account Receivable test run finished. Opening the HTML report...
echo ================================================
npx playwright show-report

pause
