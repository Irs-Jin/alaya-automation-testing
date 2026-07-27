@echo off
REM Launches Playwright Codegen against ALAYA's SIT login page.
REM A browser window + a "Playwright Inspector" window will open.
REM Perform your flow by hand (login -> navigate -> fill form -> save),
REM then copy the generated code from the Inspector window and send it over.

cd /d "%~dp0"

echo Starting Playwright Codegen...
echo (Close both windows when you're done recording.)
echo.

npx playwright codegen https://sit.irsbizsuite.com.my/Account/Login.aspx --output=recordings\codegen-output.spec.js

echo.
echo Done. The recorded script was also saved to recordings\codegen-output.spec.js
pause
