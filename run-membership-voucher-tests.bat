@echo off
REM Run this from anywhere by double-clicking it, or from cmd.exe.
REM Runs every Membership Voucher test (the whole Reports > Membership
REM Voucher category - there is no separate transactional module for this
REM one yet) against UAT, one test at a time (--workers=1), headless. Same
REM rationale as run-all-tests.bat, just scoped to this one module - see
REM run-account-receivable-tests.bat's header comment for the full reasoning
REM behind splitting by module.

cd /d "%~dp0"

set ALAYA_CLIENT_ID=uat
set ALAYA_USERNAME=admin
set ALAYA_PASSWORD=123

npx playwright test tests/reports/membership-voucher --workers=1

echo.
echo ================================================
echo  Membership Voucher test run finished. Opening the HTML report...
echo ================================================
npx playwright show-report

pause
