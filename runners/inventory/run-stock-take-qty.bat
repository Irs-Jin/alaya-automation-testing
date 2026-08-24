@echo off
REM Run this from anywhere by double-clicking it, or from cmd.exe.
REM Runs the Stock Take Qty verification test against UAT with a visible browser.
REM WARNING: this test posts a real Physical Qty discrepancy that cannot be
REM cancelled/deleted afterward (see stockTakePage.js) — each run permanently
REM shifts item 526014's real Qty Available by +1.

cd /d "%~dp0..\.."

set ALAYA_CLIENT_ID=uat
set ALAYA_USERNAME=admin
set ALAYA_PASSWORD=123

npx playwright test tests/inventory/stock-take-qty.spec.js --headed

pause
