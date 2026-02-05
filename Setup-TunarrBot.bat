@echo off
title TunarrBot Community Setup
color 0A

echo ============================================
echo       TunarrBot Community Setup
echo ============================================
echo.
echo Welcome to TunarrBot! This script will help you
echo set up the bot for your Tunarr server.
echo.

:: Change to the bot directory
cd /d "%~dp0"

echo [STEP 1] Checking Prerequisites...
echo ----------------------------------------

:: Check if Node.js is installed
node --version >nul 2>&1
if %errorlevel%==0 (
    echo ✅ Node.js is installed
    for /f "tokens=*" %%i in ('node --version') do echo    Version: %%i
) else (
    echo ❌ Node.js is NOT installed
    echo.
    echo Please install Node.js from: https://nodejs.org
    echo Then run this setup script again.
    pause
    exit /b 1
)

:: Check if npm is available
npm --version >nul 2>&1
if %errorlevel%==0 (
    echo ✅ NPM is available
) else (
    echo ❌ NPM is NOT available
    pause
    exit /b 1
)

echo.
echo [STEP 2] Installing Dependencies...
echo ----------------------------------------
echo Installing required Node.js packages...
echo This may take a few minutes...
echo.

npm install
if %errorlevel%==0 (
    echo ✅ Dependencies installed successfully
) else (
    echo ❌ Failed to install dependencies
    echo Please check your internet connection and try again.
    pause
    exit /b 1
)

echo.
echo [STEP 3] Configuration Setup...
echo ----------------------------------------

:: Check if .env exists
if exist ".env" (
    echo ✅ .env file already exists
    echo    You can edit it manually if needed
) else (
    echo ℹ️  Creating .env file from template...
    if exist ".env.template" (
        copy ".env.template" ".env" >nul
        echo ✅ .env file created from template
        echo ⚠️  IMPORTANT: You MUST edit .env with your settings!
    ) else (
        echo ❌ .env.template not found
        echo    Creating basic .env file...
        (
            echo # TunarrBot Configuration
            echo DISCORD_TOKEN=your_discord_bot_token_here
            echo DISCORD_CLIENT_ID=your_discord_application_id_here
            echo GUILD_ID=your_discord_server_id_here
            echo TUNARR_BASE_URL=http://localhost:8000
            echo CHANNEL_CHANGER_URL=http://localhost:3001
            echo CHANNEL_CHANGER_BIND_HOST=127.0.0.1
            echo CHANNEL_CHANGER_API_KEY=
            echo YOUTUBE_PREMIUM_EMAIL=your-email@gmail.com
            echo TMDB_API_KEY=your_tmdb_api_key_here
        ) > .env
        echo ✅ Basic .env file created
    )
)

:: Create directories
echo.
echo [STEP 4] Creating Directories...
echo ----------------------------------------

if not exist "logs" (
    mkdir logs
    echo ✅ Created logs\ directory
) else (
    echo ✅ logs\ directory already exists
)

if not exist "chrome-profile-data" (
    mkdir chrome-profile-data
    echo ✅ Created chrome-profile-data\ directory
) else (
    echo ✅ chrome-profile-data\ directory already exists
)

echo.
echo ============================================
echo [SETUP COMPLETE] Next Steps:
echo ============================================
echo.
echo ✅ TunarrBot is now installed!
echo.
echo 🔧 REQUIRED: Configure your bot:
echo    1. Edit the .env file with your settings:
echo       - Discord bot token and IDs
echo       - Your Tunarr server URL
echo       - (Optional) YouTube Premium email
echo       - (Optional) TMDB API key
echo.
echo 📚 SETUP GUIDES:
echo    Discord Bot: https://discord.com/developers/applications
echo    TMDB API: https://www.themoviedb.org/settings/api
echo.
echo 🚀 TO START THE BOT:
echo    Run: Start-TunarrBot-Simple.bat
echo.
echo 💡 CONFIGURATION FILES:
echo    .env        = Your personal settings (keep private!)
echo    config.js   = Bot behavior settings (safe to share)
echo.

:menu
echo ============================================
echo [QUICK ACTIONS]
echo ============================================
echo   1. Open .env file for editing
echo   2. Test bot configuration  
echo   3. Start TunarrBot now
echo   4. Show file locations
echo   5. Exit setup
echo.
set /p choice="Choose action (1-5): "

if "%choice%"=="1" goto :edit_env
if "%choice%"=="2" goto :test_config
if "%choice%"=="3" goto :start_bot
if "%choice%"=="4" goto :show_files
if "%choice%"=="5" goto :end
echo Invalid choice, try again.
goto :menu

:edit_env
echo.
echo [OPENING .env FILE]
if exist ".env" (
    notepad .env
) else (
    echo .env file not found!
)
goto :menu

:test_config
echo.
echo [TESTING CONFIGURATION]
echo Checking .env file...
if exist ".env" (
    findstr /c:"DISCORD_TOKEN=your_discord_bot_token_here" .env >nul
    if %errorlevel%==0 (
        echo ⚠️  Discord token not configured
    ) else (
        echo ✅ Discord token appears to be set
    )
    
    findstr /c:"TUNARR_BASE_URL" .env >nul
    if %errorlevel%==0 (
        echo ✅ Tunarr URL is configured
    ) else (
        echo ⚠️  Tunarr URL not found
    )
) else (
    echo ❌ .env file not found
)
goto :menu

:start_bot
echo.
echo [STARTING TUNARRBOT]
if exist "Start-TunarrBot-Simple.bat" (
    echo Launching TunarrBot...
    call "Start-TunarrBot-Simple.bat"
) else (
    echo Start-TunarrBot-Simple.bat not found!
    echo You can start manually with: node tunarr-bot.js
)
goto :menu

:show_files
echo.
echo [FILE LOCATIONS]
echo Configuration: %cd%\.env
echo Bot Code: %cd%\tunarr-bot.js
echo Channel Changer: %cd%\channel-changer.js
echo Launcher: %cd%\Start-TunarrBot-Simple.bat
echo Logs: %cd%\logs\
echo Browser Data: %cd%\chrome-profile-data\
goto :menu

:end
echo.
echo ============================================
echo Setup complete! Enjoy using TunarrBot! 🎉
echo.
echo For support, check the project documentation
echo or community forums.
echo ============================================
pause
