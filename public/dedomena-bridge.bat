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

:: Delete old version so we always run fresh
if exist "%USERPROFILE%\Downloads\dedomena-bridge.js" (
    del "%USERPROFILE%\Downloads\dedomena-bridge.js" >nul 2>&1
)

:: Download latest
echo  Downloading bridge v3...
powershell -Command "try { Invoke-WebRequest -Uri 'https://dedomena.vercel.app/dedomena-bridge.js' -OutFile '%USERPROFILE%\Downloads\dedomena-bridge.js' -UseBasicParsing -ErrorAction Stop; Write-Host 'OK' } catch { Write-Host 'FAIL'; exit 1 }"

if not exist "%USERPROFILE%\Downloads\dedomena-bridge.js" (
    echo.
    echo  Download failed.
    echo  Go back to dedomena, click the JS download button
    echo  and save it to your Downloads folder, then run this again.
    echo.
    pause
    exit /b 1
)

echo.
echo  Starting bridge...
echo.
node "%USERPROFILE%\Downloads\dedomena-bridge.js" %*

echo.
echo  Bridge stopped. Press any key to close.
pause >nul
