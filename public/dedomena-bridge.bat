@echo off
title dedomena bridge v3
cd /d "%USERPROFILE%\Downloads"

echo.
echo  ==========================================
echo   dedomena bridge  v3
echo  ==========================================
echo.

:: Check Node.js
where node >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo  ERROR: Node.js not found.
    echo  Install it from https://nodejs.org (click LTS^)
    echo  then run this file again.
    echo.
    pause
    exit /b 1
)

:: Check the JS file exists
if not exist "%USERPROFILE%\Downloads\dedomena-bridge.js" (
    echo  ERROR: dedomena-bridge.js not found in Downloads.
    echo.
    echo  Go back to dedomena app - Add Source - Live Desktop Bridge
    echo  and click the green download button for dedomena-bridge.js
    echo  Save it to your Downloads folder, then run this .bat again.
    echo.
    pause
    exit /b 1
)

echo  Starting...
echo.
node "%USERPROFILE%\Downloads\dedomena-bridge.js" %*

echo.
echo  Bridge stopped. Press any key to close.
pause >nul
