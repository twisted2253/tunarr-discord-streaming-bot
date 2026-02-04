# Tunarr Discord Bot

A Discord bot that runs on a machine able to connect to your local Tunarr webGUI using Chrome with Puppeteer. You manually begin streaming the Chrome window on Discord, then issue commands to the bot in your Discord channel to view the guide, change channels, and more. Basically like having your own TV station running in Discord and using bot commands like a remote to look at the guide and change the channels! You can also have friends or other members of your Discord issue commands as well, making a fun little watch party that's *almost* hands-free.

> **Note**: This project is entirely vibe-coded by someone who works in IT but is not a professional developer. It's built through experimentation and community feedback in my free time. **You're free to fork, modify, and improve this project** - I don't "own" it and welcome any contributors who'd like to make additions or improvements! Pull requests and issues are encouraged.

## ✨ Features

- 📺 **Live TV Guide** - Real-time program listings for all channels (paginated for 25+ channels)
- 🎬 **Program Information** - Detailed current and upcoming show details
- 🖼️ **Movie & TV Posters** - Automatic artwork from The Movie Database (TMDB)
- 🔄 **Automated Channel Changing** - Browser automation for seamless channel switching
- ⏱️ **Progress Tracking** - Shows current program progress with precise timing
- 🔐 **Permission System** - Role and channel-based access control
- 👁️ **Current Channel Tracking** - Remembers last changed channel for quick status checks
- 🎥 **YouTube Integration** - `/youtube [URL]` command to play videos (⚠️ experimental - still ironing out Discord streaming issues; YouTube Premium recommended to avoid ads)

<img width="514" height="354" alt="image" src="https://github.com/user-attachments/assets/cea024e3-f621-4ca0-8c9b-cb85a747ff4e" />

<img width="578" height="460" alt="image" src="https://github.com/user-attachments/assets/7fa7372f-7320-4aa4-9e40-4448097b3459" />

<img width="538" height="646" alt="image" src="https://github.com/user-attachments/assets/cb98f327-25ed-4e9c-a7c5-59f3170d6c9a" />

<img width="480" height="312" alt="image" src="https://github.com/user-attachments/assets/833d52e6-954a-4148-a8a5-a2a0f2b7ed9e" />

<img width="1054" height="702" alt="image" src="https://github.com/user-attachments/assets/f4f33211-e242-466d-8d31-81975965bf6b" />

## ⚠️ Important Notes

**Tunarr Filler Content**: This bot was developed and tested **without using Tunarr's "filler" content feature** (commercials, bumpers, etc.). If you use filler content in your Tunarr channels, your mileage may vary (YMMV) - timing calculations and program detection may behave differently. Filler content support is planned for future testing and configuration.

## 🚀 Quick Start (Windows)

**Recommended Installation Directory**: `C:\tunarr-bot\`
> The included .bat launcher files are pre-configured for this path. If you install elsewhere, you'll need to edit the .bat files.

### Step 1: Download the Project from GitHub
1. On this GitHub page, click the green **"Code"** button in the upper-right corner
2. Click **"Download ZIP"** from the dropdown menu
3. Once downloaded, **extract all 17 files/folders** from the ZIP
4. Move the extracted contents to `C:\tunarr-bot\`
   - Your folder should now contain: `tunarr-bot.js`, `channel-changer.js`, `Setup-TunarrBot.bat`, etc.
   - ⚠️ If using a different directory, you'll need to manually edit the `.bat` files to update the path

### Step 2: Install Node.js
1. Download and install [Node.js](https://nodejs.org) (v18 or higher)
2. During installation, make sure "Add to PATH" is checked
3. Restart your computer after installation completes

### Step 3: Run Setup
Double-click **`Setup-TunarrBot.bat`** in the `C:\tunarr-bot\` folder, which will:
- ✅ Check that Node.js is installed
- ✅ Run `npm install` to download dependencies (~200MB, takes 2-5 minutes)
- ✅ Create your `.env` configuration file from template
- ✅ Create required directories (`logs/`, `chrome-profile-data/`)
- ✅ Open an interactive menu to edit settings

### Step 4: Configure Your Bot
When the setup menu appears, choose **Option 1** to edit `.env` and fill in:
- **DISCORD_TOKEN** - Your bot token from [Discord Developer Portal](https://discord.com/developers/applications)
- **DISCORD_CLIENT_ID** - Your application ID (same portal)
- **GUILD_ID** - Your Discord server ID ([How to get](https://support.discord.com/hc/en-us/articles/206346498))
- **TUNARR_BASE_URL** - Your Tunarr server (e.g., `http://192.168.1.100:8000`)
- **TMDB_API_KEY** - *(Optional)* For movie/TV posters from [TMDB](https://www.themoviedb.org/settings/api)

> 💡 **Don't have a Discord bot yet?** See our [detailed setup guide](docs/SETUP.md) for step-by-step Discord bot creation instructions.

### Step 5: Launch the Bot
Double-click **`Start-TunarrBot.bat`** to launch both services:
- 🌐 Channel Changer Service (runs in background, opens Chrome)
- 🤖 Discord Bot (main console window with live output)

The Chrome window that opens is what you'll **screen share on Discord** to your viewers!

### Step 6: Configure Chrome for Discord Streaming
**⚠️ IMPORTANT**: To avoid a black screen when streaming:
1. In the Chrome window that opened, go to: `chrome://settings/system`
2. **UN-CHECK** "Use graphics acceleration when available"
3. Restart Chrome (close and re-run `Start-TunarrBot.bat`)

Without this step, Discord viewers will see a black screen instead of your video!

### Optional: Advanced Monitoring
**`Start-TunarrBot-Simple.bat`** provides additional features:
- Health checks every 30 seconds
- Commands to stop/restart services
- Minimized windows for cleaner desktop
- Useful for troubleshooting or long-running streams

## 🎮 Discord Commands

| Command | Description | Example |
|---------|-------------|---------|
| `/guide` | Show compact list of ALL channels with page numbers (no program info due to Discord's 25 embed limit) | `/guide` |
| `/guide [page]` | Show detailed guide for specific page (25 channels per page) with current/next programs | `/guide 1` or `/guide 2` |
| `/channel <number>` | Show detailed info for a specific channel (current program, synopsis, what's next) | `/channel 5` or `/channel 290` |
| `/change <channel>` | Change to a different channel (automated) | `/change 3` |
| `/current` | Show what channel is currently being watched | `/current` |
| `/youtube <url>` | Play a YouTube video on the stream (⚠️ experimental) | `/youtube https://youtu.be/...` |
| `/youtube-login` | Instructions for logging into YouTube Premium | `/youtube-login` |
| `/permissions` | Check your access permissions and bot settings | `/permissions` |
| `/set-current <channel>` | Manually set current channel for tracking (debug) | `/set-current 5` |

**Note on `/guide` command:**
- `/guide` alone = Shows **all channels** in a compact list with page numbers (no program details)
- `/guide [#]` with a page number = Shows **detailed view** with up to 25 channels, including what's currently playing and what's up next
- Discord limits embeds to 25 fields, so channels are paginated for detailed views

## 🛠️ System Requirements

- **Operating System**: Windows (tested on Windows 11)
  - The included .bat launcher files are Windows-specific
  - Linux/macOS users can run manually with `node tunarr-bot.js` and `node channel-changer.js`
- **Node.js** 18.0.0 or higher ([Download](https://nodejs.org))
- **Tunarr Server** running and accessible on your local network
- **Discord Bot** created with proper permissions ([Setup Guide](https://discord.com/developers/applications))
- **Discord Desktop** for screen sharing the Chrome window to your server

## 📋 Dependencies

**Installation**: All dependencies are **automatically installed** when you run `Setup-TunarrBot.bat` (which runs `npm install` for you). You don't need to install anything manually except Node.js!

**Core Libraries** (auto-installed):
- `discord.js` - Discord API integration and slash commands
- `axios` - HTTP client for Tunarr and TMDB API requests
- `dotenv` - Environment variable management
- `puppeteer` - Browser automation for channel changing (~200MB download includes Chrome)
- `express` - Web server for channel changer API

**What happens during setup:**
1. `npm install` reads `package.json`
2. Downloads all libraries to `node_modules/` folder (~300MB total)
3. Takes 2-5 minutes depending on internet speed
4. Puppeteer downloads a bundled Chrome browser

## ⚙️ Advanced Configuration (`config.js`)

After completing the Quick Start, you can customize bot behavior by editing `config.js`. This file controls all bot features, permissions, and appearance.

### 🎨 Appearance (`config.behavior`)
- **locale** - Date/time formatting (default: `en-US`)
- **timezone** - Display timezone (default: `America/Los_Angeles`)
- **colors** - Embed colors for success, error, info, warnings, YouTube
- **dateFormat** - How dates appear in embeds
- **defaultTruncateLength** - Max length for descriptions before truncating

### 🔐 Permission System (`config.permissions`)
- **allowedChannels** - Restrict bot to specific Discord channels (array of IDs)
- **allowedRoles** - Require specific Discord roles for access (array of IDs)
- **allowedUsers** - Whitelist specific users by Discord ID (array of IDs)
- **ephemeralResponses** - Make bot replies private/ephemeral (true/false)
- **requireBothRoleAndChannel** - Must meet both role AND channel restrictions (default: false)

### 📢 Announcement System (`config.announcements`)
- **enableAnnouncements** - Auto-post when programs change (default: false)
- **checkInterval** - How often to check for program changes in milliseconds (60000ms = 1 minute)
- **programChangeChannel** - Discord channel ID where announcements post
- **channelChangeChannel** - Discord channel ID for manual channel changes
- **enableProgramChangeAnnouncements** - Auto-announce when programs change (default: false)
- **enableChannelChangeAnnouncements** - Announce when users change channels (default: false)
- **includeUsername** - Show who changed the channel (default: true)
- **includeThumbnail** - Show program posters in announcements (default: true)

### 📝 Logging System (`config.logging`)
- **enabled** - Master toggle for logging (default: true)
- **logLevel** - Filter log output: `error`, `warn`, `info`, `debug`, `verbose` (default: `info`)
- **retentionDays** - Auto-delete logs older than X days (default: 30)
- **separateFiles** - Use separate log folders per service (default: true)

### 🎬 TMDB Integration (`config.tmdb`)
- **apiKey** - Your TMDB API key from `.env`
- **enabled** - Enable/disable poster fetching (default: true)
- **showNextPoster** - Show "Up Next" program posters as main image (default: true)
- **timeout** - Max wait time for TMDB API requests in milliseconds (default: 5000)

### 🎥 YouTube Integration (`config.youtube`)
- **allowedDomains** - Whitelist of valid YouTube domains for security
- **premiumAccount** - Email reference for YouTube Premium account (from `.env`)
- **alwaysStartFromBeginning** - Force videos to start at 0:00 (default: true)
- **enableSubtitles** - Auto-enable captions when available (default: true)

### ⚙️ Playback & Timing (`config.playback`)
- **tunarrBufferWait** - Buffer time for Tunarr videos in milliseconds (default: 15000)
- **youtubeBufferWait** - Buffer time for YouTube videos in milliseconds (default: 3000)
- **fullscreenDelay** - Delay before fullscreen attempts (default: 500)
- **resumePlaybackDelay** - Post-fullscreen playback delay (default: 1000)
- **controlsHideDelay** - Control hiding delay (default: 2000)
- **postFullscreenStabilization** - Stabilization wait time (default: 3000)

### 🔧 Feature Flags (`config.features`)
- **enableDetailedLogging** - Show DEBUG and VERBOSE logs (default: false - only use for troubleshooting)
- **enableYouTubeIntegration** - Enable `/youtube` command (default: true)

> 💡 **Tip**: Open `config.js` in any text editor (Notepad, VS Code, etc.) to see all options with comments explaining each setting.

## 🏗️ Architecture

```
C:\tunarr-bot\
├── tunarr-bot.js                    # Main Discord bot application
├── channel-changer.js               # Browser automation service
├── logger.js                        # Centralized logging system
├── config.js                        # Configuration management
├── .env                             # Your secrets (create from template)
├── .env.template                    # Configuration template
├── package.json                     # npm dependencies and scripts
│
├── Setup-TunarrBot.bat              # 🛠️ Interactive setup wizard
├── Start-TunarrBot.bat              # 🚀 Primary launcher (use this!)
├── Start-TunarrBot-Simple.bat       # 📊 Advanced launcher with monitoring
│
├── docs\                            # Documentation folder
│   ├── SETUP.md                     # Detailed setup guide
│   ├── ARCHITECTURE.md              # Technical details
│   ├── API.md                       # API reference
│   ├── CODE_REFERENCE.md            # Code navigation guide
│   └── TROUBLESHOOTING.md           # Common issues
│
├── logs\                            # Log files (auto-created)
│   ├── discord-bot\                 # Bot logs with rotation
│   └── channel-changer\             # Browser automation logs
│
└── chrome-profile-data\             # Browser session data (auto-created)
```

### Component Overview
- **Discord Bot** (`tunarr-bot.js`) - Handles slash commands and Discord integration
- **Channel Changer** (`channel-changer.js`) - Puppeteer automation for channel switching
- **Logger** (`logger.js`) - File-based logging with 5 levels and daily rotation
- **Configuration** (`config.js`) - Centralized behavior settings
- **Environment** (`.env`) - Your personal secrets (Discord token, API keys, etc.)

### Batch File Launchers
- **Setup-TunarrBot.bat** - One-time setup: installs dependencies, creates config, interactive menu
- **Start-TunarrBot.bat** - Standard launcher: starts both services, shows bot output
- **Start-TunarrBot-Simple.bat** - Advanced: health monitoring, restart commands, minimized windows

## 🔧 Advanced Features

### TMDB Integration
- Automatically fetches movie and TV show posters
- Displays current program artwork as thumbnails
- Shows "Up Next" program posters as main images
- Intelligent fallback to channel icons when posters unavailable

### Permission System
- **Channel Restrictions** - Limit bot usage to specific Discord channels
- **Role Requirements** - Require specific Discord roles for access
- **User Whitelist** - Grant access to individual users
- **Private Responses** - Option for ephemeral (private) command responses

### Browser Automation
- Headless Chrome automation for channel changing
- Multiple fullscreen strategies for different browsers
- Auto-dismiss browser dialogs and popups
- Comprehensive error handling and logging

## 📖 Documentation

- **[Setup Guide](docs/SETUP.md)** - Complete installation and configuration instructions
- **[Architecture Details](docs/ARCHITECTURE.md)** - Technical overview and system design
- **[Tunarr API Reference](docs/API.md)** - Tunarr API endpoints to assist AI agent development
- **[Troubleshooting](docs/TROUBLESHOOTING.md)** - Common issues and solutions
- **[Code Reference](docs/CODE_REFERENCE.md)** - AI-friendly navigation guide with line numbers
- **[Function Index](docs/FUNCTION_INDEX.md)** - Searchable function catalog
- **[Changelog](CHANGELOG.md)** - Version history and feature updates

## 🐛 Common Issues

**Setup-TunarrBot.bat says "Node.js is NOT installed"**
- Download and install Node.js from https://nodejs.org
- Restart your computer after installation
- Run the setup script again

**Start-TunarrBot.bat shows errors about missing files**
- Make sure you're in `C:\tunarr-bot\` directory
- Run `Setup-TunarrBot.bat` first to install dependencies
- Check that `.env` file exists (setup creates it from template)

**Chrome window doesn't open**
- Check `logs\channel-changer\` for error messages
- Make sure port 3001 isn't already in use
- Try running `node channel-changer.js` manually to see errors

**Black screen when streaming Chrome window to Discord**
- ⚠️ **CRITICAL FIX**: Open Chrome Settings → System → **UN-CHECK** "Use graphics acceleration when available"
- Restart Chrome after changing this setting
- Without this fix, viewers will see a black video window instead of your stream
- This is a known Chrome/Discord compatibility issue

**Bot not responding to commands?**
- Check Discord token in `.env` is correct
- Verify bot has proper permissions in Discord server (Send Messages, Use Slash Commands)
- Ensure bot has been invited to your server with correct scopes

**No TV guide data?**
- Confirm `TUNARR_BASE_URL` in `.env` points to your Tunarr server
- Test manually: Open `http://your-tunarr-ip:8000/api/channels` in browser
- Make sure Tunarr server is running and accessible on your network

**Missing movie/TV posters?**
- Add `TMDB_API_KEY` to `.env` file (get free key from TMDB)
- Verify `tmdb.enabled: true` in `config.js`
- Bot automatically falls back to channel icons if TMDB unavailable

**Program announcements are late or wrong?**
- Verify your system clock is accurate
- Check Tunarr server time matches your local time
- Review `logs\discord-bot\` for timing calculation errors

**YouTube videos have ads/commercials?**
- The `/youtube` integration works best with a **YouTube Premium account**
- Log into YouTube Premium in the Chrome window using `/youtube-login` command
- Chrome will remember your session for future streams
- Without Premium, viewers will see ads which can interrupt the watch party experience

For more help, see [Troubleshooting Guide](docs/TROUBLESHOOTING.md) or check the log files in `logs\`

## 📝 Version

**Current Version**: 0.1.1 (2026-02-04)
- Fixed critical program detection bug (GitHub Issue #1) - now uses Guide API with accurate timestamps
- Program timing calculations now match Tunarr web GUI exactly (no more "Time Left: 0 minutes")
- "Up Next" program detection accurate and reliable
- Comprehensive logging system with file rotation and 5 log levels
- AI-friendly documentation with complete code navigation guides
- Enhanced error handling and structured logging throughout

See [CHANGELOG.md](CHANGELOG.md) for complete version history.

## 🤝 Contributing

This project welcomes contributions! Whether you're fixing bugs, adding features, improving documentation, or sharing ideas - all help is appreciated.

**Ways to contribute:**
- 🐛 **Report bugs** - Open an issue with details about what went wrong
- 💡 **Suggest features** - Share ideas for improvements or new commands
- 🔧 **Submit pull requests** - Fix issues or add features you'd like to see
- 📖 **Improve docs** - Help make setup easier for newcomers
- 🧪 **Test & provide feedback** - Try it out and report what works/doesn't work

**Development Philosophy:**
- This is a "vibe-coded" project built through experimentation
- No strict coding standards - if it works and helps users, it's good!
- AI-assisted development is encouraged (comprehensive docs included)
- Focus on practical features that make Discord watch parties better

**Fork it, modify it, make it yours!** This project is meant to be adapted to your needs. Share improvements back if you'd like, but you're free to run your own modified version.

## 🛠️ Development Info

This project follows modern Node.js practices:
- Environment-based configuration (`.env` + `config.js`)
- Comprehensive error handling and logging system
- Modular architecture (separate bot and automation services)
- AI-friendly documentation with line numbers and function catalogs

**Key Files:**
- `tunarr-bot.js` - Discord bot (slash commands, API integration)
- `channel-changer.js` - Puppeteer automation (browser control)
- `logger.js` - Centralized logging (5 levels, file rotation)
- `config.js` - All feature flags and customization options
