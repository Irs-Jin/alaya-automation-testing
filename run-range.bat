@echo off
REM Run this from anywhere by double-clicking it, or from cmd.exe.
REM
REM Resumes a run-all-tests.bat run that got interrupted partway through,
REM without re-running the tests that already passed. Look at the terminal
REM output from the interrupted run - each line starts with "ok N" or "x N"
REM (e.g. "ok 62 ...") - and give the number right AFTER the last one you
REM saw finish as the start, so you pick back up from there.
REM
REM Can also be used to run any arbitrary numbered slice of the suite, not
REM just for resuming - e.g. to re-check just tests #63-77 after a fix.
REM
REM Usage:
REM   run-range.bat 63 77          (no prompts, runs immediately)
REM   run-range.bat                (prompts for start/end interactively)

cd /d "%~dp0"

set ALAYA_CLIENT_ID=uat
set ALAYA_USERNAME=admin
set ALAYA_PASSWORD=123
REM Same UAT-specific override run-all-tests.bat uses - only matters if
REM your range happens to include tests/sales/cash-sales.spec.js, but
REM harmless to set every time.
set ALAYA_TEST_CUSTOMER_CODE=000001
set ALAYA_TEST_ITEM_DESCRIPTION=BISKUT PLANTA

set STARTNUM=%~1
set ENDNUM=%~2

if "%STARTNUM%"=="" set /p STARTNUM=Start test number (e.g. the one right after the last "ok"/"x" you saw): 
if "%ENDNUM%"=="" set /p ENDNUM=End test number (e.g. last test in the suite, or wherever you want to stop): 

node run-range.js %STARTNUM% %ENDNUM%

echo.
echo ================================================
echo  Range run finished. Opening the HTML report...
echo ================================================
npx playwright show-report

pause
