# Setup Guide

## Prerequisites

### System Requirements
- **Operating System**: Windows 11 (tested) or Windows 10, Linux, or macOS
- **Node.js**: Version 18.0.0 or higher
- **Network Access**: Machine must be able to reach Tunarr server on LAN
- **Memory**: At least 512MB RAM available for the bot and browser automation

### External Services
- **Tunarr Server**: Must be running and accessible via HTTP API
- **Discord Server**: Admin access to create and configure bot
- **TMDB Account**: Optional but recommended for movie/TV show posters

## Installation Steps

### 1. Install Node.js
Download and install Node.js 18+ from [nodejs.org](https://nodejs.org/)

Verify installation:
```bash
node --version
npm --version
```

### 2. Download Project Files
Extract the bot files to a directory, for example:
```
C:\TunarrBot\
```

### 3. Install Dependencies
Navigate to the project directory and install required npm packages:

```bash
cd C:\TunarrBot
npm install
```

**Core Dependencies Installed**:
- `discord.js` - Discord API integration and slash commands
- `axios` - HTTP client for API requests (Tunarr, TMDB)
- `dotenv` - Environment variable management
- `puppeteer` - Browser automation for channel changing
- `express` - Web server for channel changer API

### 4. Discord Bot Setup

#### Create Discord Application
1. Go to [Discord Developer Portal](https://discord.com/developers/applications)
2. Click "New Application" and give it a name (e.g., "Tunarr Bot")
3. Go to "Bot" section and click "Add Bot"
4. **Save the Bot Token** - you'll need this for `.env`
5. Under "Privileged Gateway Intents", enable:
   - Server Members Intent
   - Message Content Intent

#### Add Bot to Server
1. Go to "OAuth2" → "URL Generator"
2. Select scopes: `bot` and `applications.commands`
3. Select permissions: `Send Messages`, `Use Slash Commands`, `Embed Links`
4. Use generated URL to invite bot to your Discord server
5. **Note your Guild ID** (Server ID) - right-click server name → "Copy Server ID"

### 5. Get TMDB API Key (Optional)
1. Create account at [themoviedb.org](https://www.themoviedb.org/)
2. Go to Settings → API → Create API Key
3. Choose "Developer" and fill out the form
4. **Save the API Key** for `.env` configuration

### 6. Environment Configuration

Create a `.env` file in the project root directory:

> **Note:** Avoid installing in `C:\Program Files\` — it’s write‑protected and untested. Use a normal folder like `C:\tunarr-bot\` or your user profile.

```env
# Discord Configuration (Required)
DISCORD_TOKEN=your_bot_token_here
DISCORD_CLIENT_ID=your_application_client_id
GUILD_ID=your_discord_server_id

# Tunarr Server Configuration (Required)
TUNARR_BASE_URL=http://192.168.1.100:8000
CHANNEL_CHANGER_URL=http://localhost:3001
CHANNEL_CHANGER_BIND_HOST=127.0.0.1
CHANNEL_CHANGER_API_KEY=

# TMDB Configuration (Optional)
TMDB_API_KEY=your_tmdb_api_key_here

# Logging
LOG_LEVEL=info
```

**Configuration Notes**:
- Replace `192.168.1.100:8000` with your actual Tunarr server IP and port
- If Tunarr is on the same machine, use `http://localhost:8000`
- CHANNEL_CHANGER_BIND_HOST controls which interface the Channel Changer listens on (recommended: `127.0.0.1`)
- CHANNEL_CHANGER_API_KEY is optional but recommended to lock down channel changer endpoints
- TMDB_API_KEY is optional but highly recommended for poster images

### 7. Update config.js Settings

Edit `config.js` to match your setup:

```javascript
// Permission Settings - Update these for your Discord server
permissions: {
    allowedChannels: ['tv-remote'], // Your Discord channel name(s)
    allowedRoles: [], // Leave empty for no role restriction
    allowedUsers: [], // Leave empty for no user restriction
    ephemeralResponses: true // true = private responses, false = public
},

// TMDB Settings
tmdb: {
    enabled: true, // Set to false if you don't have TMDB API key
    showNextPoster: true // Show "Up Next" program posters
}
```

## Running the Bot

### Method 1: Direct Node.js
```bash
node tunarr-bot.js
```

### Method 2: Using Batch File (Windows)
Double-click `Start-TunarrBot.bat` or run:
```batch
Start-TunarrBot.bat
```

### Method 3: npm Scripts
```bash
npm start
```

## Verification Steps

### 1. Check Bot Status
When started successfully, you should see:
```
Bot is ready! Logged in as YourBotName#1234
Started refreshing application (/) commands.
Successfully reloaded application (/) commands.
```

### 2. Test Discord Commands
In your Discord server, try:
- `/guide` - Should show TV guide with current programs
- `/permissions` - Should show your access level
- `/channel 1` - Should show details for channel 1

### 3. Test Channel Changing (Optional)
- Start the channel changer service first (if using automation)
- Try `/change 2` - Should attempt to change to channel 2

## Troubleshooting

### Common Issues

**"Bot is not responding"**
- Check Discord token in `.env` file
- Verify bot has proper permissions in Discord server
- Ensure bot is online in Discord

**"Failed to fetch channels from Tunarr"**
- Verify Tunarr server is running
- Check `TUNARR_BASE_URL` in `.env` file
- Test API manually: `http://your-tunarr-server:8000/api/channels`

**"No TMDB image found"**
- Verify `TMDB_API_KEY` in `.env` file
- Check if TMDB is enabled in `config.js`
- Bot will fall back to channel icons if TMDB fails

**"Permission denied" errors**
- Check `allowedChannels` in `config.js`
- Verify you're using commands in the correct Discord channel
- Use `/permissions` command to check your access

### Network Configuration

**Firewall Settings**:
- Ensure Windows Firewall allows Node.js
- Tunarr server port (usually 8000) must be accessible
- Channel changer port (3001) needs to be available

**Port Usage**:
- **3001**: Channel changer service (if using automation)
- **8000**: Tunarr server (typical, may vary)

## Optional Features

### Channel Changing Automation
To enable automated channel changing:
1. Ensure Puppeteer is installed (included in npm install)
2. Start channel changer service: `node channel-changer.js`
3. Set `enableChannelChanging: true` in `config.js`

### TMDB Poster Integration
To enable movie/TV show posters:
1. Get TMDB API key (see step 5 above)
2. Add key to `.env` file
3. Set `tmdb.enabled: true` in `config.js`

## Development Notes

### File Structure
```
TunarrBot/
├── tunarr-bot.js           # Main bot application
├── channel-changer.js      # Browser automation service
├── config.js               # Configuration settings
├── .env                    # Environment variables (create this)
├── .env.example           # Template for environment variables
├── package.json           # npm dependencies and scripts
├── CHANGELOG.md           # Version history
├── ARCHITECTURE.md        # Technical documentation
├── SETUP.md              # This file
└── Start-TunarrBot.bat   # Windows launcher script
```

### Adding New Features
- Bot commands are defined in the `registerCommands()` method
- Command handlers are in the `setupEventHandlers()` method
- Configuration options are centralized in `config.js`
- All sensitive data goes in `.env` file

This setup follows modern Node.js development practices and makes the project easy to understand, modify, and troubleshoot.
