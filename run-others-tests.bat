@echo off
REM Run this from anywhere by double-clicking it, or from cmd.exe.
REM Runs every "Others" test (the whole Reports > Others category - just
REM Clock In Clock Out so far) against UAT, one test at a time
REM (--workers=1), headless. Same rationale as run-all-tests.bat, just
REM scoped to this one module - see run-account-receivable-tests.bat's
REM header comment for the full reasoning behind splitting by module.

cd /d "%~dp0"

set ALAYA_CLIENT_ID=uat
set ALAYA_USERNAME=admin
set ALAYA_PASSWORD=123

npx playwright test tests/reports/others --workers=1

echo.
echo ================================================
echo  Others test run finished. Opening the HTML report...
echo ================================================
npx playwright show-report

pause
