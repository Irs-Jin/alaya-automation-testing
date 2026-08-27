@echo off
REM Run this from anywhere by double-clicking it, or from cmd.exe.
REM Runs the whole Reports > Purchase category against UAT, one test at a
REM time (--workers=1), headless. Split out from run-purchase-tests.bat
REM (which now covers only the Purchase transactional specs) so the two
REM can be run independently.

cd /d "%~dp0"

set ALAYA_CLIENT_ID=uat
set ALAYA_USERNAME=admin
set ALAYA_PASSWORD=123

npx playwright test tests/reports/purchase --workers=1

echo.
echo ================================================
echo  Purchase Reports test run finished. Opening the HTML report...
echo ================================================
npx playwright show-report

pause
