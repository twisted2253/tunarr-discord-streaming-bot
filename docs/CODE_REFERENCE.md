# CODE_REFERENCE.md - Navigation Guide for AI Agents

> **Purpose**: Help AI agents and developers quickly navigate the tunarr-bot codebase by providing exact line numbers, descriptions, and context for all major sections.

**Last Updated**: 2026-02-02
**Version**: 1.0.0

---

## Table of Contents

1. [Quick Navigation](#quick-navigation)
2. [File Overview](#file-overview)
3. [Common Code Patterns](#common-code-patterns)
4. [Debugging Checklist](#debugging-checklist)
5. [Testing Locations](#testing-locations)

---

## Quick Navigation

### Discord Bot (tunarr-bot.js)
- **Discord Commands**: Lines 82-137
- **Command Handlers**: Lines 680-2030
- **API Integration**: Lines 310-473
- **Announcements**: Lines 2075-2241
- **Auto-Reload**: Lines 2243-2306
- **Permission System**: Lines 163-191
- **TMDB Integration**: Lines 446-514

### Browser Automation (channel-changer.js)
- **Express Endpoints**: Lines 66-365
- **Browser Initialization**: Lines 367-474
- **YouTube Navigation**: Lines 1012-1121
- **Channel Changing**: Lines 2087-2141
- **Fullscreen Methods**: Lines 1520-1574, 2269-2626
- **Subtitle Management**: Lines 593-1010

### Configuration (config.js)
- **Discord Settings**: Lines 6-10
- **Tunarr Server**: Lines 12-17
- **YouTube Settings**: Lines 25-47
- **Playback Timing**: Lines 49-62
- **Permissions**: Lines 76-89
- **Announcements**: Lines 139-156
- **Logging**: Lines 131-145

---

## File Overview

### tunarr-bot.js (2,303 lines)
**Purpose**: Discord bot for controlling Tunarr TV and YouTube playback

#### Major Sections:

**1. Imports and Setup (Lines 1-11)**
- Discord.js imports
- Axios for HTTP requests
- Config and Logger initialization

**2. Main Bot Class (Lines 13-41)**
- Constructor (Lines 14-41): Initializes Discord client, state tracking, logger
- State Properties:
  - `currentChannelId`: Currently watched channel
  - `isOnYouTube`: Boolean flag for YouTube mode
  - `youtubeVideoInfo`: YouTube video metadata
  - `lastAnnouncedProgramId/Title`: Announcement tracking

**3. Event Handlers (Lines 46-160)**
- `setupEventHandlers()` (Lines 46-160): Discord bot lifecycle events
  - `ready` event (Lines 47-67): Bot startup, initialize monitoring
  - `interactionCreate` (Lines 69-160): Handle slash commands
- Permission checking (Lines 72-79): Gate all commands
- Command routing (Lines 82-137): Switch statement for all commands
- Error handling (Lines 138-160): Catch and log command errors

**4. Permission System (Lines 163-191)**
- `hasPermission()` (Lines 163-191): Check user/channel/role permissions
  - Channel restrictions
  - User whitelist
  - Role requirements
- Detailed logging for denied permissions (DEBUG level)

**5. Command Registration (Lines 193-350)**
- `registerCommands()` (Lines 193-350): Register all slash commands with Discord
  - 11 total commands: /guide, /channel, /change, /youtube, /youtube-login, /youtube-subtitles, /fix-browser, /browser-health, /permissions, /current, /set-current
  - Command definitions with options and descriptions

**6. API Integration Methods (Lines 310-473)**
- `fetchChannels()` (Lines 352-359): Get all Tunarr channels
- `fetchProgramsForChannel()` (Lines 361-369): Get channel program lineup
- `fetchYouTubeVideoInfo()` (Lines 371-393): Get YouTube video metadata from channel-changer
- `checkBrowserHealth()` (Lines 395-421): Check if browser is frozen
- `recoverBrowser()` (Lines 423-439): Attempt browser recovery
- `fetchTMDBImage()` (Lines 449-514): Fetch movie/show posters from TMDB API
  - Year-based matching
  - Search query cleanup
  - Poster URL construction

**7. Program Lineup Calculations (Lines 516-660)**
- `getCurrentAndNextPrograms()` (Lines 477-664): Calculate current and next programs
  - Attempts to fetch from Tunarr API first
  - Falls back to manual calculation if API fails
  - Returns: `{ current, next }` objects with time calculations

**8. Utility Methods (Lines 670-776)**
- `formatProgramTitle()` (Lines 618-625): Format program name (movie title or TV show with episode)
- `formatDuration()` (Lines 628-633): Convert milliseconds to "Xh Ym" format
- `formatTime()` (Lines 635-642): Convert Unix timestamp to localized time string
- `formatYouTubeDuration()` (Lines 644-660): Convert YouTube duration to human-readable
- `isValidYouTubeUrl()` (Lines 662-677): Validate YouTube URLs against whitelist

**9. Command Handlers - Guide Commands (Lines 680-1040)**
- `handleGuideCompactView()` (Lines 798-902): Show compact guide (all channels, minimal info)
  - Uses embed with fields for each channel
  - Shows current program title only
  - Paginated (max 25 channels per page due to Discord limit)
- `handleGuidePagedView()` (Lines 904-1040): Show detailed guide for single channel
  - Full program details with duration, time remaining
  - TMDB posters for current and next programs
  - Summary and metadata

**10. Command Handlers - Channel Commands (Lines 999-1344)**
- `handleChannelCommand()` (Lines 999-1168): Show detailed info for specific channel
  - Search by name or number
  - Current and next program details
  - TMDB poster integration
  - Duration and time calculations
- `handleChangeCommand()` (Lines 1129-1344): Change to a different channel
  - Calls channel-changer service
  - Posts announcement to Discord
  - Updates currentChannelId state
  - Handles browser automation errors

**11. Command Handlers - YouTube Commands (Lines 1346-1780)**
- `handleYouTubeCommand()` (Lines 1346-1404): Navigate to YouTube video
  - URL validation
  - Browser navigation via channel-changer
  - Updates isOnYouTube state
  - YouTube video info display
- `handleYouTubeSubtitlesCommand()` (Lines 1442-1520): Toggle/enable/disable captions
  - Three actions: toggle, enable, disable
  - Calls channel-changer subtitle API
  - Session-based subtitle preferences
- `handleYouTubeLoginCommand()` (Lines 1748-1780): Navigate to YouTube login page
  - Allows saving YouTube Premium session
  - Instructs user to login in browser

**12. Command Handlers - Browser Commands (Lines 1522-1746)**
- `handleFixBrowserCommand()` (Lines 1522-1593): Attempt to fix frozen browser
  - Calls channel-changer recovery endpoint
  - Provides feedback on success/failure
- `handleBrowserHealthCommand()` (Lines 1595-1726): Check browser health status
  - Shows browser connection status
  - Current URL and state
  - Time since last activity
  - Recovery options

**13. Command Handlers - Info Commands (Lines 1728-2073)**
- `handlePermissionsCommand()` (Lines 1728-1778): Show user permissions and bot settings
  - User access status
  - Required roles/channels
  - Feature flags
- `handleCurrentCommand()` (Lines 1808-2038): Show currently playing content
  - YouTube mode: Show video info with duration, views, upload date
  - Tunarr mode: Show current program with details
  - Handles case when no channel is tracked
- `handleSetCurrentCommand()` (Lines 2040-2073): Manually set current channel
  - Allows setting channel without actually changing browser
  - Useful for recovery scenarios

**14. Announcement System (Lines 2075-2241)**
- `startAnnouncementMonitoring()` (Lines 2078-2092): Initialize program change monitoring
  - Checks every 60 seconds (configurable)
  - Only runs when not on YouTube
- `checkForProgramChange()` (Lines 2094-2119): Check if program has changed
  - Compares program ID and title with last announced
  - Triggers announcement if changed
- `postChannelChangeAnnouncement()` (Lines 2121-2177): Post channel change announcement
  - Shows new channel and current program
  - Includes user who changed the channel
  - TMDB poster integration
- `postNowPlayingAnnouncement()` (Lines 2179-2241): Post program change announcement
  - Automatic announcement when program changes
  - Full program details
  - TMDB poster

**15. Auto-Reload System (Lines 2243-2306)**
- `startAutoReload()` (Lines 2246-2257): Initialize automatic channel reload
  - Prevents Discord streaming timeouts
  - Default: 24 hour interval
- `performAutoReload()` (Lines 2259-2306): Execute channel reload
  - Only reloads Tunarr channels (not YouTube)
  - Optional: only during active programs
  - Calls channel-changer to reload current channel
  - Optional announcement of reload
- `postAutoReloadAnnouncement()` (Lines 2308-2336): Post reload notification

**16. Initialization and Startup (Lines 2338-2356)**
- Create bot instance
- Login to Discord
- Handle process signals for graceful shutdown

---

### channel-changer.js (2,806 lines)
**Purpose**: Puppeteer-based browser automation service for channel changing and YouTube playback

#### Major Sections:

**1. Configuration and Imports (Lines 1-42)**
- Express, Puppeteer, CORS
- Config loading with defaults
- YouTube domain whitelist
- Logger initialization

**2. ChannelChanger Class Setup (Lines 43-65)**
- Constructor (Lines 44-65): Initialize Express app, browser state, logger
- Properties:
  - `browser`, `page`: Puppeteer instances
  - `currentUrl`: Current page URL
  - `isOnYouTube`: YouTube mode flag
  - `youtubeVideoInfo`: Video metadata
  - `sessionSubtitlePreference`: User subtitle preference override

**3. Express API Endpoints (Lines 66-365)**
- `/health` (GET, Lines 71-81): Health check with status, logs, current state
- `/change-channel` (POST, Lines 84-144): Change Tunarr channel
  - Immediate response to Discord
  - Async channel change processing
  - Browser recovery on failure
- `/navigate-youtube` (POST, Lines 147-161): Navigate to YouTube video
  - URL validation
  - Async navigation with recovery
- `/youtube-subtitles` (POST, Lines 163-218): Control YouTube captions
  - Actions: toggle, enable, disable, status, reset
  - Session preference tracking
- `/youtube-login` (POST, Lines 220-246): Navigate to YouTube login
  - For Premium account login
- `/browser-restart` (POST, Lines 248-363): Restart browser
  - Closes and reinitializes Puppeteer
  - Reconnects to page
- `/browser-health` (GET, Lines 283-301): Check browser freeze status
- `/youtube-status` (GET, Lines 303-320): Check if on YouTube
- `/youtube-info` (GET, Lines 322-338): Get current YouTube video info
- `/debug` (GET, Lines 340-365): Debug endpoint with full state

**4. Browser Lifecycle (Lines 367-596)**
- `initializeBrowser()` (Lines 383-477): Launch Chromium with persistent session
  - Chrome profile for login persistence
  - App mode (no browser chrome)
  - Page event handlers (errors, responses)
  - Audio playback permissions
- `checkForBrowserFreeze()` (Lines 487-505): Detect frozen browser
  - Checks page responsiveness
  - 5-second timeout
- `attemptEnhancedBrowserRecovery()` (Lines 510-596): Multi-step recovery
  - Window resize
  - Focus restoration
  - Keyboard wake-up (spacebar)
  - Progressive approach

**5. YouTube Subtitle Management (Lines 598-1010)**
- `handleYouTubeSubtitles()` (Lines 677-715): Keyboard shortcut method (C key)
  - Primary subtitle toggle method
  - Fast and reliable
- `checkYouTubeSubtitleVisibility()` (Lines 617-672): Detect subtitle state
  - Checks for visible subtitle elements
  - Shadow DOM search
  - Multiple selector patterns
- `findYouTubeSubtitleButton()` (Lines 717-758): Find CC button in player
  - Shadow DOM traversal
  - Multiple selector attempts
- `enableYouTubeSubtitles()` (Lines 798-869): Enable captions
  - Keyboard method (C key)
  - Button fallback
  - Verification
- `disableYouTubeSubtitles()` (Lines 865-934): Disable captions
  - Check current state
  - Toggle if enabled
  - Verification
- `toggleYouTubeSubtitles()` (Lines 910-987): Toggle captions on/off
- `checkYouTubeSubtitleStatus()` (Lines 940-963): Check subtitle state
- `resetSubtitlePreference()` (Lines 965-984): Clear session preference

**6. YouTube Navigation and Setup (Lines 1012-1477)**
- `navigateToYouTubeWithRecovery()` (Lines 1002-1011): Navigate with freeze detection
  - Checks for browser freeze after navigation
  - Triggers recovery if needed
- `navigateToYouTube()` (Lines 1032-1144): Main YouTube navigation flow
  - URL modification (start from beginning)
  - Browser initialization check
  - Video element waiting
  - Subtitle management
  - Membership popup prevention
  - Fullscreen attempts
  - Final verification
- `seekVideoToBeginning()` (Lines 1166-1189): Force video to start at 0:00
  - Config-based (alwaysStartFromBeginning)
- `waitForYouTubeVideo()` (Lines 1192-1207): Wait for video element to be ready
- `preventMembershipPopups()` (Lines 1224-1342): Block YouTube membership dialogs
  - Aggressive popup blocking
  - CSS injection
  - Element removal
  - MutationObserver for dynamic popups
- `extractYouTubeVideoInfo()` (Lines 1346-1475): Extract video metadata
  - Title, channel, duration, current time
  - View count, upload date
  - Description

**7. Fullscreen Implementation - YouTube (Lines 1477-2017)**
- `attemptFullscreenApproaches()` (Lines 1520-1557): Try all fullscreen methods
  - 5 different approaches
  - Ranked by reliability
  - Returns immediately on first success
- `attemptBrowserFullscreen()` (Lines 1560-1577): F11 fullscreen
  - Browser-level fullscreen
  - Keyboard shortcut (F11)
- `clearYouTubeOverlays()` (Lines 1593-1644): Remove cursor and preview overlays
  - CSS injection to hide elements
  - Mouse move to trigger and clear
- `hideYouTubeControls()` (Lines 1648-1768): Hide player controls for clean streaming
  - CSS injection
  - Hides recommendations, cards, watermarks
  - Theater mode activation
- `attemptYouTubeDoubleClick()` (Lines 1792-1833): Double-click for fullscreen
  - Click center of video element
  - Verify fullscreen state
- `attemptYouTubeFullscreenButton()` (Lines 1838-1918): Find and click fullscreen button
  - Multiple selector patterns
  - Visibility check
  - Click and verify
- `ensureYouTubePlaybackResumed()` (Lines 1927-2017): Resume video after fullscreen
  - Check paused state
  - Multiple resume methods
  - Play button click fallback
  - Spacebar press fallback

**8. YouTube Login (Lines 2019-2085)**
- `navigateToYouTubeLogin()` (Lines 2023-2051): Navigate to login page
  - Opens YouTube login URL
  - Waits for page load
  - Instructions for user
- `checkYouTubeLoginStatus()` (Lines 2053-2085): Check if logged in
  - Looks for account avatar
  - Determines Premium status

**9. Channel Changing (Lines 2087-2261)**
- `changeChannel()` (Lines 2097-2146): Main channel change flow
  - Browser initialization check
  - Navigate to Tunarr channel URL
  - Leave dialog handling
  - Video ready check
  - Fullscreen attempts
  - Post-fullscreen sequence
  - Recovery on failure
- `handleLeaveDialog()` (Lines 2164-2178): Dismiss "Leave site?" popup
  - Auto-accept dialog
  - Logged for debugging
- `waitForVideoReady()` (Lines 2183-2207): Wait for video to be ready
  - Check for video element
  - Verify playing state
  - 10-second timeout

**10. Debug and Diagnostics (Lines 2209-2260)**
- `getVideoDebugInfo()` (Lines 2212-2260): Extract video element debug info
  - Network state
  - Ready state
  - Error state
  - Current time, duration
  - Paused/playing status

**11. Fullscreen Implementation - Tunarr (Lines 2261-2713)**
- `attemptTunarrFullscreenApproaches()` (Lines 2269-2305): Try fullscreen for Tunarr videos
  - Similar to YouTube approaches
  - 5 different methods
- `runPostFullscreenSequence()` (Lines 2308-2329): Clean up after fullscreen
  - Resume playback
  - Hide controls
  - Logged for debugging
- `attemptEnhancedDoubleClick()` (Lines 2333-2362): Enhanced double-click
  - Multiple click attempts
  - Center of video element
- `attemptSmartDoubleClick()` (Lines 2364-2400): Smart double-click with timing
- `attemptUserGestureFullscreen()` (Lines 2402-2467): User gesture method
  - Simulates user interaction
- `attemptFullscreenButtonClick()` (Lines 2469-2514): Click fullscreen button
  - Multiple selectors
  - Shadow DOM search
- `attemptDirectFullscreenAPI()` (Lines 2516-2550): Direct fullscreen API call
  - document.documentElement.requestFullscreen()
- `attemptMouseEventFullscreen()` (Lines 2552-2588): Mouse event simulation
  - Detailed event properties
- `ensureVideoPlaybackResumed()` (Lines 2609-2639): Resume Tunarr video
  - Similar to YouTube method
- `hideVideoControls()` (Lines 2643-2681): Hide Tunarr video controls
  - CSS injection
  - Clean fullscreen appearance

**12. Cleanup and Shutdown (Lines 2715-2783)**
- `gracefulShutdown()` (Lines 2715-2746): Clean browser shutdown
  - Close browser gracefully
  - Save state
- `start()` (Lines 2747-2778): Start Express server
  - Log startup info
  - Auto-initialize browser after 1 second
  - Handle SIGTERM for graceful shutdown

---

### config.js (164 lines)
**Purpose**: Centralized configuration for bot behavior, timing, and features

#### Configuration Sections:

**1. Discord Configuration (Lines 6-10)**
- Bot token, client ID, guild ID
- Loaded from environment variables

**2. Tunarr Server (Lines 12-17)**
- Base URL for Tunarr API
- Web path for browser URLs

**3. Channel Changer Service (Lines 19-23)**
- Service URL (default: localhost:3001)
- Request timeout (30 seconds)

**4. YouTube Configuration (Lines 25-47)**
- Allowed domains whitelist
- Video playback settings (autoplay, quality, subtitles)
- Start from beginning option
- Membership popup blocking
- Premium account email

**5. Video Playback Timing (Lines 49-62)**
- Buffer wait times (Tunarr: 15s, YouTube: 3s)
- Fullscreen delays
- Control hide delays
- Post-fullscreen stabilization

**6. TMDB Configuration (Lines 64-69)**
- API key for movie/show posters
- Enable/disable flag
- Show next program poster flag

**7. Chrome Browser (Lines 71-74)**
- Custom profile name for persistent session

**8. Permission Settings (Lines 76-89)**
- Allowed Discord channels
- Required roles
- User whitelist
- Ephemeral responses flag

**9. Bot Behavior (Lines 91-129)**
- Guide display formatting
- Channel limits
- Text truncation lengths
- Locale for time formatting
- Error messages
- Embed colors

**10. Feature Flags (Lines 131-137)**
- Enable/disable major features
- enableDetailedLogging flag (used by logger)

**11. Logging Configuration (Lines 139-145)**
- Log level (error, warn, info, debug, verbose)
- Retention days for old logs
- Separate log files per service

**12. Announcement Settings (Lines 147-156)**
- Enable/disable announcement types
- Discord channel IDs for announcements
- Check interval (60 seconds)
- Announcement formatting options

**13. Auto-Reload Settings (Lines 158-164)**
- Enable/disable auto-reload
- Reload interval (24 hours)
- Announce reload flag
- Only during programs flag

---

## Common Code Patterns

### 1. Command Handler Pattern
**Location**: tunarr-bot.js, Lines 82-137

All Discord commands follow this pattern:
```javascript
case 'command-name':
    await this.logger.command('/command-name', interaction.user, { ...args });
    await this.handleCommandMethod(interaction);
    break;
```

Key points:
- Log command with user and args
- Call dedicated handler method
- Use try/catch for error handling
- Always respond to interaction (reply or editReply)

### 2. API Call Pattern
**Location**: tunarr-bot.js, Lines 352-369

All Tunarr API calls follow this pattern:
```javascript
try {
    const response = await axios.get(`${config.tunarr.baseUrl}/api/endpoint`);
    return response.data;
} catch (error) {
    await this.logger.error('Error fetching data', error);
    return defaultValue;
}
```

Key points:
- Use axios for HTTP requests
- Config-based base URL
- Log errors with context
- Return sensible defaults on failure

### 3. Browser Automation Pattern
**Location**: channel-changer.js, Lines 2097-2146

All browser automations follow this pattern:
```javascript
async navigateToSomething() {
    await this.logger.info('🎯 Starting operation...');

    // Check browser initialized
    if (!this.browser) {
        await this.logger.warn('Browser not connected, initializing...');
        await this.initializeBrowser();
    }

    // Navigate
    await this.page.goto(url, { waitUntil: 'domcontentloaded' });

    // Wait for element
    await this.page.waitForSelector('selector', { timeout: 10000 });

    // Perform action
    await this.page.evaluate(() => { /* action */ });

    await this.logger.info('✅ Operation complete');
    return true;
}
```

Key points:
- Check browser state first
- Use emojis in log messages for readability
- Wrap in try/catch
- Return boolean success indicator

### 4. Permission Checking Pattern
**Location**: tunarr-bot.js, Lines 72-79

All commands check permissions before execution:
```javascript
if (!this.hasPermission(interaction)) {
    await this.logger.permission(false, interaction.user, 'Permission denied', {
        channel: interaction.channel.name,
        command: interaction.commandName
    });
    await interaction.reply({
        content: '❌ You don\'t have permission...',
        flags: 64 // EPHEMERAL
    });
    return;
}
```

Key points:
- Check before any command processing
- Log denials with context
- Use ephemeral responses for errors
- Provide clear error message

### 5. Discord Embed Pattern
**Location**: tunarr-bot.js, Lines 920-1030

All Discord embeds follow this pattern:
```javascript
const embed = new EmbedBuilder()
    .setTitle('📺 Title')
    .setDescription('Description text')
    .setColor(config.behavior.colors.info)
    .setTimestamp()
    .addFields(
        { name: 'Field Name', value: 'Field Value', inline: false }
    )
    .setThumbnail(imageUrl) // Small image
    .setImage(imageUrl); // Large image

await interaction.reply({ embeds: [embed] });
```

Key points:
- Use EmbedBuilder from discord.js
- Set color based on message type
- Add timestamp for context
- Use thumbnail for small images (channel icons)
- Use image for large images (posters)
- Max 25 fields per embed

### 6. Announcement Pattern
**Location**: tunarr-bot.js, Lines 2121-2241

All announcements follow this pattern:
```javascript
async postAnnouncement(data) {
    if (!config.announcements?.enableXxxAnnouncements) return;
    if (!config.announcements?.xxxChannel) return;

    try {
        const announceChannel = await this.client.channels.fetch(channelId);
        if (!announceChannel) return;

        const embed = new EmbedBuilder()... // Build embed

        await announceChannel.send({ embeds: [embed] });
        await this.logger.announce('type', true, details);
    } catch (error) {
        await this.logger.announce('type', false, details);
        await this.logger.error('Error posting announcement', error);
    }
}
```

Key points:
- Check if announcements enabled
- Check if channel configured
- Fetch channel dynamically
- Log announcement success/failure
- Use logger.announce() for structured logging

---

## Debugging Checklist

### Problem: Bot Not Responding to Commands

1. **Check Discord connection** (tunarr-bot.js:48)
   - Look for "Enhanced TunarrBot ready!" log message
   - Verify bot is online in Discord server

2. **Check permissions** (tunarr-bot.js:163-191)
   - Review `config.permissions.allowedChannels`
   - Check `config.permissions.allowedUsers`
   - Check `config.permissions.allowedRoles`
   - Look for "Permission denied" in logs

3. **Check command registration** (tunarr-bot.js:338-343)
   - Look for "Successfully reloaded application (/) commands" log
   - Verify guild ID is correct in config

### Problem: Channel Change Not Working

1. **Check channel-changer service** (channel-changer.js:2749)
   - Verify service is running on port 3001
   - Check `/health` endpoint: http://localhost:3001/health

2. **Check browser state** (channel-changer.js:283-301)
   - Check `/browser-health` endpoint
   - Look for "Browser appears frozen" warnings in logs

3. **Check URL format** (tunarr-bot.js:1209)
   - Verify channel exists in Tunarr
   - Check URL construction: `${baseUrl}/web/channels/${channelId}/watch`

4. **Check logs** (logs/discord-bot/ and logs/channel-changer/)
   - Look for "Channel change" messages
   - Check for Puppeteer errors
   - Look for timeout errors

### Problem: YouTube Navigation Failing

1. **Check URL validation** (tunarr-bot.js:662-677)
   - Verify URL is in allowed domains list
   - Check for typos in URL

2. **Check browser automation** (channel-changer.js:1032-1144)
   - Look for "YouTube navigation" logs
   - Check for "Video element waiting" timeout
   - Look for "Fullscreen" success/failure

3. **Check subtitle preferences** (channel-changer.js:1074-1084)
   - Verify config.youtube.enableSubtitles setting
   - Check session preference overrides

### Problem: Announcements Not Posting

1. **Check announcement config** (config.js:147-156)
   - Verify `enableChannelChangeAnnouncements` is true
   - Verify `enableNowPlayingAnnouncements` is true
   - Check channel IDs are correct

2. **Check monitoring** (tunarr-bot.js:2078-2092)
   - Look for "Starting announcement monitoring" log
   - Verify interval is running (default: 60 seconds)
   - Check if `currentChannelId` is set

3. **Check program change detection** (tunarr-bot.js:2094-2119)
   - Look for "Program changed!" logs
   - Verify program IDs are different
   - Check API responses from Tunarr

### Problem: TMDB Posters Not Showing

1. **Check TMDB configuration** (config.js:64-69)
   - Verify `config.tmdb.enabled` is true
   - Verify `TMDB_API_KEY` is set in .env
   - Check API key is valid

2. **Check API calls** (tunarr-bot.js:449-514)
   - Look for "Searching TMDB for:" logs
   - Check for "Found TMDB image:" success logs
   - Look for "No TMDB image found" warnings
   - Check for "TMDB API error" errors

3. **Check title matching** (tunarr-bot.js:465-469)
   - TV shows: Check title format "Show Name - Episode Name"
   - Movies: Check title matches TMDB database
   - Year matching: Verify year is provided and correct

### Problem: Logging Not Working

1. **Check logger initialization** (tunarr-bot.js:43-49)
   - Look for logger instantiation in constructor
   - Verify config.logging.logLevel is set
   - Check config.features.enableDetailedLogging

2. **Check log files** (logs/discord-bot/ and logs/channel-changer/)
   - Verify directories exist
   - Check file permissions
   - Look for recent log files with timestamps
   - Check file sizes (should be growing)

3. **Check log level** (logger.js:68-70)
   - ERROR: Only errors logged
   - WARN: Errors and warnings
   - INFO: Normal operations (recommended for production)
   - DEBUG: Detailed flow (requires enableDetailedLogging=true)
   - VERBOSE: High-frequency events (requires enableDetailedLogging=true)

4. **Check console output**
   - All logs also output to console with colors
   - Look for emoji indicators: ❌ (ERROR), ⚠️ (WARN), ℹ️ (INFO), 🔍 (DEBUG), 📝 (VERBOSE)

---

## Testing Locations

### Manual Testing Commands

**Test Basic Bot Functionality**:
1. `/permissions` - Check if bot responds and shows permissions
2. `/guide` - Test compact guide display
3. `/guide 1` - Test detailed guide display
4. `/current` - Test current program display

**Test Channel Operations**:
1. `/channel Comedy` - Test channel search and display
2. `/change 1` - Test channel changing (use actual channel number)
3. Check #tv-announce channel for announcement
4. Wait 60 seconds, verify announcement monitoring logs

**Test YouTube Integration**:
1. `/youtube https://www.youtube.com/watch?v=dQw4w9WgXcQ` - Test navigation
2. `/youtube-subtitles toggle` - Test subtitle controls
3. `/youtube-subtitles enable` - Test enable
4. `/youtube-subtitles disable` - Test disable
5. `/current` - Should show YouTube video info

**Test Browser Recovery**:
1. Let browser sit idle for 10+ minutes
2. `/browser-health` - Check health status
3. `/fix-browser` - Test recovery
4. `/change 1` - Verify channel change works after recovery

**Test Permissions**:
1. Try commands from non-allowed channel (should fail)
2. Try commands as non-allowed user (should fail)
3. Try commands as allowed user in allowed channel (should succeed)

### Log File Testing

**Verify Log Files Created**:
- Check `C:\tunarr-bot\logs\discord-bot\` for tunarr-bot logs
- Check `C:\tunarr-bot\logs\channel-changer\` for channel-changer logs
- Verify log file naming: `[service]_YYYY-MM-DD_HH-mm-ss.log`
- Check log file headers include timestamp and log level

**Verify Log Levels**:
1. Set `LOG_LEVEL=info` in .env
2. Run bot, check logs contain INFO, WARN, ERROR (no DEBUG/VERBOSE)
3. Set `LOG_LEVEL=debug` and `enableDetailedLogging=true`
4. Run bot, check logs now contain DEBUG messages
5. Verify VERBOSE logs only appear for high-frequency events (monitor checks)

**Verify Log Retention**:
1. Create old log files with dates > 30 days ago
2. Restart bot
3. Verify old files are deleted automatically
4. Check for "Deleted old log file" messages

### API Endpoint Testing

**Test Channel Changer Endpoints**:
```bash
# Health check
curl http://localhost:3001/health

# Browser health
curl http://localhost:3001/browser-health

# YouTube status
curl http://localhost:3001/youtube-status

# YouTube info (when on YouTube)
curl http://localhost:3001/youtube-info

# Debug info
curl http://localhost:3001/debug

# Change channel
curl -X POST http://localhost:3001/change-channel \
  -H "Content-Type: application/json" \
  -d '{"channelId":"abc123","url":"http://localhost:8000/web/channels/abc123/watch"}'

# Navigate to YouTube
curl -X POST http://localhost:3001/navigate-youtube \
  -H "Content-Type: application/json" \
  -d '{"url":"https://www.youtube.com/watch?v=dQw4w9WgXcQ"}'
```

### Automated Testing Suggestions

**Unit Tests** (not currently implemented):
- Permission checking logic
- Time formatting functions
- Duration calculations
- URL validation
- TMDB title parsing

**Integration Tests** (not currently implemented):
- Discord command handling end-to-end
- Channel changer API responses
- Browser automation workflows
- Announcement posting

**End-to-End Tests** (not currently implemented):
- Full user workflow: /change -> announcement -> /current
- YouTube workflow: /youtube -> /youtube-subtitles -> /current
- Recovery workflow: freeze browser -> /fix-browser -> /change

---

## Common Modifications

### Adding a New Discord Command

1. **Define command** (tunarr-bot.js:193-350)
   - Add to `commands` array in `registerCommands()`
   - Use SlashCommandBuilder
   - Add options if needed

2. **Add case to switch** (tunarr-bot.js:82-137)
   - Add new case for command name
   - Log command with logger.command()
   - Call handler method

3. **Create handler method** (tunarr-bot.js:680-2073)
   - Name: `handleXxxCommand(interaction)`
   - Defer reply if long operation
   - Build embed response
   - Handle errors
   - Log with appropriate level

### Adding a New Configuration Option

1. **Add to config.js** (config.js)
   - Choose appropriate section
   - Use environment variable if sensitive
   - Provide default value
   - Add comment explaining purpose

2. **Update SETUP.md** (docs/SETUP.md)
   - Document new setting
   - Explain purpose and values
   - Provide example

3. **Use in code**
   - Reference via `config.section.property`
   - Handle missing values gracefully
   - Log when using non-default values

### Modifying Browser Automation

1. **Update timing** (config.js:49-62)
   - Adjust wait times in `config.playback`
   - Test with different video types
   - Document reasons for changes

2. **Add new automation step** (channel-changer.js)
   - Add method following browser automation pattern
   - Use async/await
   - Log each step with emojis
   - Return boolean success
   - Handle timeouts gracefully

3. **Test thoroughly**
   - Test with Tunarr videos
   - Test with YouTube videos
   - Test with different video lengths
   - Test recovery scenarios

---

## File Locations Quick Reference

- **Main Bot**: `C:\tunarr-bot\tunarr-bot.js`
- **Channel Changer**: `C:\tunarr-bot\channel-changer.js`
- **Configuration**: `C:\tunarr-bot\config.js`
- **Logger**: `C:\tunarr-bot\logger.js`
- **Discord Bot Logs**: `C:\tunarr-bot\logs\discord-bot\`
- **Channel Changer Logs**: `C:\tunarr-bot\logs\channel-changer\`
- **Documentation**: `C:\tunarr-bot\docs\`
- **Environment Variables**: `C:\tunarr-bot\.env`

---

## Related Documentation

- **README.md**: Overview, features, and quick start
- **SETUP.md**: Detailed installation and configuration guide
- **ARCHITECTURE.md**: System design and component interaction
- **API.md**: Discord command reference and API documentation
- **TROUBLESHOOTING.md**: Common issues and solutions
- **FUNCTION_INDEX.md**: Searchable function catalog
- **CHANGELOG.md**: Version history and changes

---

**Last Updated**: 2026-02-02
**Maintainer**: AI-Assisted Development
**Version**: 1.0.0
