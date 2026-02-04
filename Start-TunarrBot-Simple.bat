@echo off
title TunarrBot - Simple Unified Console
color 0A
chcp 65001 >nul

echo ============================================
echo       TunarrBot Simple Unified Console      
echo ============================================
echo.

:: Change to the bot directory
cd /d "C:\tunarr-bot"

:: Check if main files exist
if not exist "tunarr-bot.js" goto :error_bot
if not exist "channel-changer.js" goto :error_changer
if not exist ".env" goto :error_env
if not exist "config.js" goto :error_config

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

echo Starting TunarrBot System...
echo Current time: %date% %time%
echo.
echo Components to launch:
echo   [1] Channel Changer Service (Port 3001)
echo   [2] Discord Bot Service
echo.
echo ============================================

echo.
echo [STEP 1] Starting Channel Changer Service...
echo          This will open a Chrome window for streaming
echo.

:: Start Channel Changer in a minimized window
start /MIN "TunarrBot-ChannelChanger" cmd /c "title TunarrBot-ChannelChanger && node channel-changer.js"

echo [INFO] Channel Changer starting in background window...
echo        Check Chrome window should open shortly

:: Wait and test Channel Changer
echo [INFO] Waiting 8 seconds for Channel Changer to initialize...
timeout /t 8 /nobreak >nul

echo [TEST] Testing Channel Changer health...
curl -s http://localhost:3001/health >nul 2>&1
if %errorlevel%==0 (
    echo [✓] Channel Changer is responding on port 3001
) else (
    echo [✗] Channel Changer not responding yet - continuing anyway
)

echo.
echo [STEP 2] Starting Discord Bot Service...
echo.

:: Start Discord Bot in a minimized window  
start /MIN "TunarrBot-DiscordBot" cmd /c "title TunarrBot-DiscordBot && node tunarr-bot.js"

echo [INFO] Discord Bot starting in background window...
echo [INFO] Waiting 5 seconds for Discord Bot to initialize...
timeout /t 5 /nobreak >nul

echo.
echo ============================================
echo [SUCCESS] TunarrBot System Launch Complete!
echo ============================================
echo.
echo [STATUS] Services running in background:
echo   ✓ Channel Changer Service (Port 3001)
echo   ✓ Discord Bot Service  
echo   ✓ Chrome Browser Window (for Discord streaming)
echo.
echo [WINDOWS] Check taskbar for these windows:
echo   - TunarrBot-ChannelChanger (minimized)
echo   - TunarrBot-DiscordBot (minimized)
echo   - Chrome (visible - for streaming)
echo.
echo [HEALTH CHECKS]
echo   Channel Changer: http://localhost:3001/health
echo   Discord: Check your Discord server for bot online status
echo.
echo [DISCORD COMMANDS] Available in your Discord server:
echo   /guide          - Show TV guide
echo   /channel [name] - Show specific channel info  
echo   /change [name]  - Change to channel
echo   /youtube [url]  - Play YouTube video
echo   /current        - Show what's playing
echo   /youtube-login  - Login to YouTube Premium
echo.
echo [LOGS] Individual service logs in:
echo   Channel Changer: Check TunarrBot-ChannelChanger window
echo   Discord Bot: Check TunarrBot-DiscordBot window
echo.
echo ============================================

:monitor_loop
echo.
echo [MONITOR] System Status Check - %time%
echo ----------------------------------------

:: Check Channel Changer
curl -s http://localhost:3001/health >nul 2>&1
if %errorlevel%==0 (
    echo [✓] Channel Changer: ONLINE
) else (
    echo [✗] Channel Changer: OFFLINE
)

:: Check if processes are running
tasklist /FI "WINDOWTITLE eq TunarrBot-ChannelChanger" >nul 2>&1
if %errorlevel%==0 (
    echo [✓] Channel Changer Process: RUNNING
) else (
    echo [✗] Channel Changer Process: NOT FOUND
)

tasklist /FI "WINDOWTITLE eq TunarrBot-DiscordBot" >nul 2>&1
if %errorlevel%==0 (
    echo [✓] Discord Bot Process: RUNNING
) else (
    echo [✗] Discord Bot Process: NOT FOUND
)

echo.
echo [CONTROLS] 
echo   Press Ctrl+C to stop monitoring (services will continue)
echo   Type 'stop' + Enter to stop all services
echo   Type 'restart' + Enter to restart all services
echo   Type 'health' + Enter to run health check now
echo.

:: Wait for user input or timeout
set /p user_input="[COMMAND] Enter command (or wait 30s for auto-check): " || set user_input=continue

if /i "%user_input%"=="stop" goto :stop_services
if /i "%user_input%"=="restart" goto :restart_services  
if /i "%user_input%"=="health" goto :monitor_loop
if /i "%user_input%"=="exit" goto :end

:: Auto-check every 30 seconds
timeout /t 30 /nobreak >nul
goto :monitor_loop

:stop_services
echo.
echo [SHUTDOWN] Stopping TunarrBot services...
echo.
taskkill /FI "WINDOWTITLE eq TunarrBot-ChannelChanger" /F >nul 2>&1
taskkill /FI "WINDOWTITLE eq TunarrBot-DiscordBot" /F >nul 2>&1
echo [INFO] Services stopped.
echo [INFO] Chrome window may still be open for manual use.
goto :end

:restart_services
echo.
echo [RESTART] Restarting TunarrBot services...
echo.
call :stop_services
timeout /t 3 /nobreak >nul
start /MIN "TunarrBot-ChannelChanger" cmd /c "title TunarrBot-ChannelChanger && node channel-changer.js"
timeout /t 5 /nobreak >nul
start /MIN "TunarrBot-DiscordBot" cmd /c "title TunarrBot-DiscordBot && node tunarr-bot.js"
echo [INFO] Services restarted.
goto :monitor_loop

:error_bot
echo [ERROR] tunarr-bot.js not found in C:\tunarr-bot
pause
goto :end

:error_changer  
echo [ERROR] channel-changer.js not found in C:\tunarr-bot
pause
goto :end

:error_env
echo [ERROR] .env file not found!
echo Please create .env file with your Discord bot configuration.
pause
goto :end

:error_config
echo [ERROR] config.js file not found!
pause
goto :end

:end
echo.
echo [EXIT] TunarrBot launcher closing...
echo       Services may still be running in background.
echo.
pause