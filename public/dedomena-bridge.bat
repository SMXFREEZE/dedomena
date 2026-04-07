@echo off
title dedomena bridge v3
cd /d "%USERPROFILE%\Downloads"

echo.
echo  ==========================================
echo   dedomena bridge  v3  ^|  starting...
echo  ==========================================
echo.

:: Check Node.js
where node >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo  ERROR: Node.js is not installed.
    echo  Download it free from https://nodejs.org (LTS version^).
    echo.
    pause
    exit /b 1
)

:: Always re-download to get the latest version
echo  Downloading latest bridge (v3^)...
powershell -Command "Invoke-WebRequest -Uri 'https://dedomena.vercel.app/dedomena-bridge.js' -OutFile '%USERPROFILE%\Downloads\dedomena-bridge.js' -UseBasicParsing" >nul 2>&1

if not exist "%USERPROFILE%\Downloads\dedomena-bridge.js" (
    echo  Download failed. Check your internet connection.
    pause
    exit /b 1
)

echo  Ready.
echo.

:: Run
node "%USERPROFILE%\Downloads\dedomena-bridge.js" %*

echo.
echo  Bridge stopped. Press any key to close.
pause >nul
