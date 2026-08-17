@echo off
REM Run this from anywhere by double-clicking it, or from cmd.exe.
REM Runs the ENTIRE test suite (all spec files under tests/) against UAT,
REM one test at a time (--workers=1) so no two tests ever share the "admin"
REM login session concurrently. Headless on purpose - a headed browser
REM window kept stealing focus and interrupting other work during a long
REM run. To watch a SPECIFIC test live instead, use its own runner under
REM runners/<module>/run-*.bat (those stay --headed). This will take a long
REM time (many dozens of report tests, each 15-90s) - let it run in the
REM background and check back later.

cd /d "%~dp0"

set ALAYA_CLIENT_ID=uat
set ALAYA_USERNAME=admin
set ALAYA_PASSWORD=123
REM cash-sales.spec.js defaults to qa3-only test data (customer "000000002")
REM if these aren't set - qa3 uses 9-digit customer codes, but UAT (the
REM client every other test in this suite targets) uses 6-digit codes like
REM "000001". Without this override, the full-suite run silently searches
REM for a customer that doesn't exist in UAT and times out - not a timing
REM issue, a wrong-environment-data issue. See tests/sales/cash-sales.spec.js
REM header comment for the full explanation.
set ALAYA_TEST_CUSTOMER_CODE=000001
set ALAYA_TEST_ITEM_DESCRIPTION=BISKUT PLANTA
REM Same class of issue for purchase-order.spec.js: defaults to qa3-only
REM vendor/warehouse/item codes ("000002"/"PRIMARY"/"000001") if these
REM aren't set. UAT's real equivalents aren't confirmed yet - set them here
REM (ALAYA_TEST_VENDOR_CODE / ALAYA_TEST_WAREHOUSE_CODE / ALAYA_TEST_ITEM_CODE)
REM once known, otherwise this test will fail against UAT with qa3 data.

npx playwright test --workers=1

echo.
echo ================================================
echo  Test run finished. Opening the HTML report...
echo ================================================
npx playwright show-report

pause
