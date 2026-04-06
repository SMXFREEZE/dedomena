@echo off
title dedomena bridge
cd /d "%USERPROFILE%\Downloads"

echo.
echo  ==========================================
echo   dedomena bridge  ^|  local search agent
echo  ==========================================
echo.

:: Check Node.js is installed
where node >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo  ERROR: Node.js is not installed.
    echo  Download it from https://nodejs.org ^(LTS version^) and re-run this.
    echo.
    pause
    exit /b 1
)

:: Download bridge script if it's not already here
if not exist "%USERPROFILE%\Downloads\dedomena-bridge.js" (
    echo  Downloading bridge script...
    powershell -Command "Invoke-WebRequest -Uri 'https://dedomena.vercel.app/dedomena-bridge.js' -OutFile '%USERPROFILE%\Downloads\dedomena-bridge.js'" >nul 2>&1
    if not exist "%USERPROFILE%\Downloads\dedomena-bridge.js" (
        echo  Download failed. Please download dedomena-bridge.js manually from the app.
        pause
        exit /b 1
    )
    echo  Done.
    echo.
)

:: Run the bridge
node "%USERPROFILE%\Downloads\dedomena-bridge.js" %*

echo.
echo  Bridge stopped. Press any key to close.
pause >nul
