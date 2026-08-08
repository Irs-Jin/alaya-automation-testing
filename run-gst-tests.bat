@echo off
REM Run this from anywhere by double-clicking it, or from cmd.exe.
REM Runs every GST test (the whole Reports > GST category - there is no
REM separate transactional module for this one yet) against UAT, one test
REM at a time (--workers=1), headless. Same rationale as run-all-tests.bat,
REM just scoped to this one module - see run-account-receivable-tests.bat's
REM header comment for the full reasoning behind splitting by module.

cd /d "%~dp0"

set ALAYA_CLIENT_ID=uat
set ALAYA_USERNAME=admin
set ALAYA_PASSWORD=123

npx playwright test tests/reports/gst --workers=1

echo.
echo ================================================
echo  GST test run finished. Opening the HTML report...
echo ================================================
npx playwright show-report

pause
