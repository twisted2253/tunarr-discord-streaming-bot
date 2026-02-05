@echo off
title Stop TunarrBot Services
color 0C

echo ============================================
echo      Stopping TunarrBot Services
echo ============================================
echo.

:: Find and kill node processes running the bot services
echo [1/2] Stopping Discord Bot...
for /f "tokens=2" %%a in ('tasklist /fi "imagename eq node.exe" /fo list ^| findstr /i "PID:"') do (
    netstat -ano | findstr ":3001" | findstr "%%a" >nul
    if not errorlevel 1 (
        echo Found channel-changer on PID %%a, stopping...
        taskkill /PID %%a /F >nul 2>&1
    )
)

echo [2/2] Stopping Channel Changer...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":3001"') do (
    taskkill /PID %%a /F >nul 2>&1
    echo Stopped process on port 3001
)

echo.
echo NOTE: Chrome windows are not force-closed by this script.
echo Close the Tunarr Chrome window manually if needed.

echo.
echo ============================================
echo All services stopped
echo ============================================
echo.
pause
