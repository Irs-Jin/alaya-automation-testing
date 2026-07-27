@echo off
REM Run this from anywhere by double-clicking it, or from cmd.exe.
REM Runs the ENTIRE test suite (all 85 spec files under tests/) against UAT
REM with a visible browser, one test at a time (--workers=1) so no two
REM tests ever share the "admin" login session concurrently. This will
REM take a long time (many dozens of report tests, each 15-90s) - let it
REM run in the background and check back later.

cd /d "%~dp0"

set ALAYA_CLIENT_ID=uat
set ALAYA_USERNAME=admin
set ALAYA_PASSWORD=123

npx playwright test --headed --workers=1

echo.
echo ================================================
echo  Test run finished. Opening the HTML report...
echo ================================================
npx playwright show-report

pause
