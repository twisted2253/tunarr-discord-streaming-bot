@echo off
title TunarrBot System
color 0A

:: Change to the bot directory
cd /d "%~dp0"

:: Check if main files exist
if not exist "tunarr-bot.js" goto :error_bot
if not exist "channel-changer.js" goto :error_changer
if not exist ".env" goto :error_env
if not exist "config.js" goto :error_config
if not exist "package.json" goto :error_package

:: Check if node_modules exists
if not exist "node_modules" goto :error_modules

:: Create logs directory if it doesn't exist
if not exist "logs" mkdir logs

:: Create timestamp for log files
for /f "tokens=1-4 delims=/ " %%i in ("%date%") do (
    set dow=%%i
    set month=%%j
    set day=%%k
    set year=%%l
)
for /f "tokens=1-3 delims=: " %%i in ("%time%") do (
    set hour=%%i
    set min=%%j
    set sec=%%k
)
set timestamp=%year%-%month%-%day%_%hour%-%min%
set timestamp=%timestamp: =0%

:: Define log files
set bot_logfile=logs\tunarr-bot_%timestamp%.log
set changer_logfile=logs\channel-changer_%timestamp%.log

echo ============================================
echo       TunarrBot System Launcher
echo ============================================
echo.
echo Starting services...
echo   Channel Changer (Port 3001)
echo   Discord Bot
echo.
echo Logs:
echo   Bot: %bot_logfile%
echo   Changer: %changer_logfile%
echo.
echo ============================================
echo.

:: Start Channel Changer in background
echo [1/2] Starting Channel Changer Service (background)...
start /b node channel-changer.js 2>>%changer_logfile% 1>&2

:: Wait for Channel Changer to initialize
timeout /t 5 /nobreak >nul

:: Verify Channel Changer started successfully
echo Verifying Channel Changer is running...
curl -s http://localhost:3001/health >nul 2>&1
if errorlevel 1 goto :error_changer_failed

echo [OK] Channel Changer is running on port 3001
echo [2/2] Starting Discord Bot Service...
echo.
echo ============================================
echo Services are running in this window
echo.
echo TO STOP SERVICES:
echo   1. Press Ctrl+C (waits for graceful shutdown)
echo   2. Or run Stop-TunarrBot.bat in another window
echo   3. Or simply close this window (services will stop)
echo.
echo ============================================
echo.

:: Start Discord Bot in foreground (this will show all bot output)
node tunarr-bot.js 2>>%bot_logfile%

:: If bot exits, clean up background services
echo.
echo ============================================
echo TunarrBot has stopped
echo ============================================
echo.
echo Cleaning up background services...

:: Stop channel-changer service
for /f "tokens=5" %%a in ('netstat -ano 2^>nul ^| findstr ":3001"') do (
    taskkill /PID %%a /F >nul 2>&1
)

echo Services stopped.
echo.
echo Check log files for details:
echo   %bot_logfile%
echo   %changer_logfile%
echo.
pause
goto :end

:error_bot
echo [ERROR] tunarr-bot.js not found in this folder
echo.
pause
goto :end

:error_changer
echo [ERROR] channel-changer.js not found in this folder
echo.
pause
goto :end

:error_env
echo [ERROR] .env file not found
echo Please create .env with your configuration
echo.
pause
goto :end

:error_config
echo [ERROR] config.js not found
echo.
pause
goto :end

:error_package
echo [ERROR] package.json not found
echo.
pause
goto :end

:error_modules
echo [ERROR] node_modules not found
echo Please run: npm install
echo.
pause
goto :end

:error_changer_failed
echo.
echo ============================================
echo [ERROR] Channel Changer failed to start!
echo ============================================
echo.
echo The channel-changer service could not initialize.
echo This usually means Chrome failed to launch.
echo.
echo Common causes:
echo   1. Orphaned Chrome processes are running
echo   2. Port 3001 is already in use
echo   3. Puppeteer needs to download Chromium
echo.
echo Check the log file for details:
echo   %changer_logfile%
echo.
echo To fix orphaned Chrome processes, run:
echo   powershell -Command "Get-Process chrome -ErrorAction SilentlyContinue | Stop-Process -Force"
echo.
pause
goto :end

:end
