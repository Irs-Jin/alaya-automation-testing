@echo off
REM Run this from anywhere by double-clicking it, or from cmd.exe.
REM Runs every Inventory test (the whole Reports > Inventory category -
REM there is no separate transactional module for this one yet) against
REM UAT, one test at a time (--workers=1), headless. Same rationale as
REM run-all-tests.bat, just scoped to this one module - see
REM run-account-receivable-tests.bat's header comment for the full reasoning
REM behind splitting by module.

cd /d "%~dp0"

set ALAYA_CLIENT_ID=uat
set ALAYA_USERNAME=admin
set ALAYA_PASSWORD=123

npx playwright test tests/reports/inventory --workers=1

echo.
echo ================================================
echo  Inventory test run finished. Opening the HTML report...
echo ================================================
npx playwright show-report

pause
