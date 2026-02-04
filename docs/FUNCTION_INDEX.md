# FUNCTION_INDEX.md - Searchable Function Catalog

> **Purpose**: Quick reference for all functions in tunarr-bot with line numbers, parameters, return types, and descriptions.

**Last Updated**: 2026-02-02
**Version**: 1.0.0

---

## Table of Contents

1. [tunarr-bot.js Functions](#tunarr-botjs-functions)
2. [channel-changer.js Functions](#channel-changerjs-functions)
3. [logger.js Functions](#loggerjs-functions)
4. [Quick Lookups](#quick-lookups)

---

## tunarr-bot.js Functions

### Constructor and Initialization

#### `constructor()`
- **Line**: 14
- **Parameters**: None
- **Returns**: TunarrDiscordBot instance
- **Description**: Initializes Discord client, state tracking, logger, event handlers, and command registration
- **Key Properties Initialized**:
  - `client`: Discord.js Client instance
  - `currentChannelId`: Currently tracked channel (or null)
  - `isOnYouTube`: Boolean flag for YouTube mode
  - `youtubeVideoInfo`: YouTube video metadata object
  - `lastAnnouncedProgramId/Title`: Track last announcement
  - `logger`: Logger instance for discord-bot service

---

### Event Handlers

#### `setupEventHandlers()`
- **Line**: 46
- **Parameters**: None
- **Returns**: void
- **Description**: Sets up Discord client event listeners (ready, interactionCreate)
- **Events**:
  - `ready`: Bot connected and ready
  - `interactionCreate`: Slash command received

---

### Permission System

#### `hasPermission(interaction)`
- **Line**: 163
- **Parameters**:
  - `interaction` (Discord Interaction): The interaction object to check
- **Returns**: Boolean (true if permitted, false otherwise)
- **Description**: Checks if user has permission to use bot based on channel, role, and user restrictions
- **Permission Checks**:
  1. Skip if `config.features.enablePermissionChecking` is false
  2. Check allowed channels
  3. Check user whitelist
  4. Check required roles
- **Logging**: DEBUG level logs for all checks

---

### Command Registration

#### `registerCommands()`
- **Line**: 193
- **Parameters**: None
- **Returns**: Promise<void>
- **Description**: Registers all slash commands with Discord API
- **Commands Registered**:
  - `/guide [page]`: Show TV guide
  - `/channel <name>`: Show channel details
  - `/change <channel>`: Change to channel
  - `/youtube <url>`: Play YouTube video
  - `/youtube-login`: Navigate to YouTube login
  - `/youtube-subtitles <action>`: Control subtitles
  - `/fix-browser`: Fix frozen browser
  - `/browser-health`: Check browser health
  - `/permissions`: Show permissions
  - `/current`: Show currently playing
  - `/set-current <channel>`: Manually set current channel

---

### API Integration Methods

#### `fetchChannels()`
- **Line**: 352
- **Parameters**: None
- **Returns**: Promise<Array> - Array of channel objects
- **Description**: Fetches all channels from Tunarr API
- **Endpoint**: `GET ${config.tunarr.baseUrl}/api/channels`
- **Error Handling**: Returns empty array on error

#### `fetchProgramsForChannel(channelId)`
- **Line**: 361
- **Parameters**:
  - `channelId` (String): Channel ID
- **Returns**: Promise<Array> - Array of program objects
- **Description**: Fetches program lineup for a specific channel
- **Endpoint**: `GET ${config.tunarr.baseUrl}/api/channels/${channelId}/programs`
- **Error Handling**: Returns empty array on error

#### `fetchYouTubeVideoInfo()`
- **Line**: 371
- **Parameters**: None
- **Returns**: Promise<Object|null> - YouTube video info or null
- **Description**: Fetches current YouTube video information from channel-changer service
- **Endpoint**: `GET ${config.channelChanger.url}/youtube-info`
- **Response**: `{ title, channel, url, video: { duration, currentTime, paused }, viewCount, uploadDate, description }`

#### `checkBrowserHealth()`
- **Line**: 395
- **Parameters**: None
- **Returns**: Promise<Object> - `{ frozen: Boolean, lastCheck: String }`
- **Description**: Checks if browser is frozen or unresponsive
- **Endpoint**: `GET ${config.channelChanger.url}/browser-health`
- **Timeout**: 5 seconds

#### `recoverBrowser()`
- **Line**: 423
- **Parameters**: None
- **Returns**: Promise<Boolean> - Success indicator
- **Description**: Attempts to recover frozen browser
- **Endpoint**: `POST ${config.channelChanger.url}/browser-restart`
- **Timeout**: 30 seconds

#### `fetchTMDBImage(programTitle, programType = 'movie', programYear = null)`
- **Line**: 449
- **Parameters**:
  - `programTitle` (String): Program title to search
  - `programType` (String): 'movie' or 'tv' (default: 'movie')
  - `programYear` (Number|null): Release year for better matching
- **Returns**: Promise<String|null> - Image URL or null
- **Description**: Searches TMDB for program poster image
- **API**: `GET https://api.themoviedb.org/3/search/multi`
- **Features**:
  - Cleans TV show titles (removes episode info)
  - Year-based matching for better results
  - Returns w500 poster size
- **Config Checks**:
  - Returns null if `config.tmdb.enabled` is false
  - Returns null if API key not configured

---

### Program Lineup Calculations

#### `getCurrentAndNextPrograms(channelId)`
- **Line**: 477
- **Parameters**:
  - `channelId` (String): Channel ID
- **Returns**: Promise<Object> - `{ current: Object|null, next: Object|null }`
- **Description**: Calculates current and next programs with time remaining and other metadata
- **Strategy**:
  1. Attempt to fetch from Tunarr API lineup endpoint
  2. Fall back to manual calculation if API fails
- **Current Program Properties**:
  - `title`, `summary`, `rating`, `date`, `type`
  - `duration` (milliseconds)
  - `startTime`, `endTime` (Unix timestamps)
  - `timeLeft` (minutes)
- **Next Program Properties**:
  - Same as current, plus:
  - `startsIn` (minutes until start)

#### `manuallyCalculateCurrentNext(channelId)`
- **Line**: 602
- **Parameters**:
  - `channelId` (String): Channel ID
- **Returns**: Promise<Object> - `{ current: Object|null, next: Object|null }`
- **Description**: Fallback method to manually calculate current/next programs from full program list
- **Logic**:
  1. Fetch all programs for channel
  2. Calculate each program's start time based on duration
  3. Find program containing current time
  4. Identify next program in sequence

---

### Utility Methods

#### `formatProgramTitle(program)`
- **Line**: 618
- **Parameters**:
  - `program` (Object): Program object
- **Returns**: String - Formatted title
- **Description**: Formats program title with episode info for TV shows
- **Format**:
  - Movies: "Movie Title"
  - TV Shows: "Show Title - Episode Title"

#### `formatDuration(ms)`
- **Line**: 628
- **Parameters**:
  - `ms` (Number): Duration in milliseconds
- **Returns**: String - Formatted duration
- **Description**: Converts milliseconds to human-readable format
- **Format**: "1h 30m" or "45m"

#### `formatTime(timestamp)`
- **Line**: 635
- **Parameters**:
  - `timestamp` (Number): Unix timestamp
- **Returns**: String - Formatted time
- **Description**: Converts Unix timestamp to localized time string
- **Format**: Uses `config.behavior.locale` (default: "en-US")
- **Output Example**: "3:30 PM"

#### `formatYouTubeDuration(seconds)`
- **Line**: 644
- **Parameters**:
  - `seconds` (Number|String): Duration in seconds or "HH:MM:SS" string
- **Returns**: String - Formatted duration
- **Description**: Converts YouTube duration to human-readable format
- **Handles**: Both numeric seconds and ISO duration strings

#### `isValidYouTubeUrl(url)`
- **Line**: 662
- **Parameters**:
  - `url` (String): URL to validate
- **Returns**: Boolean - True if valid YouTube URL
- **Description**: Validates YouTube URL against whitelist of allowed domains
- **Allowed Domains**: From `config.youtube.allowedDomains`

---

### Command Handlers - Guide

#### `handleGuideCompactView(interaction)`
- **Line**: 798
- **Parameters**:
  - `interaction` (Discord Interaction): Slash command interaction
- **Returns**: Promise<void>
- **Description**: Shows compact TV guide with all channels and current programs
- **Features**:
  - Fetches all channels
  - Displays current program title only (no details)
  - Paginated (max 25 channels due to Discord embed limit)
  - Sorted by channel number
  - TMDB posters for channels
- **Response**: Discord embed with fields for each channel

#### `handleGuidePagedView(interaction, page)`
- **Line**: 904
- **Parameters**:
  - `interaction` (Discord Interaction): Slash command interaction
  - `page` (String): Page number (channel number or name)
- **Returns**: Promise<void>
- **Description**: Shows detailed guide for single channel
- **Features**:
  - Full current program details
  - Next program information
  - TMDB posters (current as thumbnail, next as large image)
  - Duration, time remaining, summary
  - Rating and year
- **Search**: Supports channel number, name, or ID

---

### Command Handlers - Channel

#### `handleChannelCommand(interaction)`
- **Line**: 999
- **Parameters**:
  - `interaction` (Discord Interaction): Slash command interaction
- **Returns**: Promise<void>
- **Description**: Shows detailed information for a specific channel
- **Features**:
  - Search by channel name, number, or ID
  - Current and next program details
  - TMDB poster integration
  - Time calculations
- **Response**: Discord embed with full channel info

#### `handleChangeCommand(interaction)`
- **Line**: 1129
- **Parameters**:
  - `interaction` (Discord Interaction): Slash command interaction
- **Returns**: Promise<void>
- **Description**: Changes to a different channel via browser automation
- **Process**:
  1. Search for channel
  2. Update internal state (`currentChannelId`, `isOnYouTube = false`)
  3. Call channel-changer service
  4. Post announcement to Discord
  5. Update Discord response
- **Error Handling**: Browser recovery on failure

---

### Command Handlers - YouTube

#### `handleYouTubeCommand(interaction)`
- **Line**: 1346
- **Parameters**:
  - `interaction` (Discord Interaction): Slash command interaction
- **Returns**: Promise<void>
- **Description**: Navigates to YouTube video
- **Process**:
  1. Validate YouTube URL
  2. Update internal state (`isOnYouTube = true`)
  3. Call channel-changer navigate-youtube endpoint
  4. Show YouTube video info
- **Validation**: Checks URL against allowed domains

#### `handleYouTubeSubtitlesCommand(interaction)`
- **Line**: 1442
- **Parameters**:
  - `interaction` (Discord Interaction): Slash command interaction
- **Returns**: Promise<void>
- **Description**: Controls YouTube subtitle/captions
- **Actions**: toggle, enable, disable, status, reset
- **Features**:
  - Session-based preference tracking
  - Overrides config defaults
  - Visual feedback on success/failure

#### `handleYouTubeLoginCommand(interaction)`
- **Line**: 1748
- **Parameters**:
  - `interaction` (Discord Interaction): Slash command interaction
- **Returns**: Promise<void>
- **Description**: Navigates to YouTube login page for Premium account
- **Purpose**: Save YouTube Premium session for ad-free playback
- **Instructions**: Guides user through login process

---

### Command Handlers - Browser

#### `handleFixBrowserCommand(interaction)`
- **Line**: 1522
- **Parameters**:
  - `interaction` (Discord Interaction): Slash command interaction
- **Returns**: Promise<void>
- **Description**: Attempts to fix frozen or unresponsive browser
- **Process**:
  1. Check browser health
  2. Attempt recovery if frozen
  3. Report success/failure
- **Recovery Methods**: Window resize, focus restoration, keyboard wake-up

#### `handleBrowserHealthCommand(interaction)`
- **Line**: 1595
- **Parameters**:
  - `interaction` (Discord Interaction): Slash command interaction
- **Returns**: Promise<void>
- **Description**: Shows browser health status and diagnostics
- **Info Displayed**:
  - Connection status
  - Current URL
  - Time since last activity
  - Frozen status
  - Recovery options

---

### Command Handlers - Info

#### `handlePermissionsCommand(interaction)`
- **Line**: 1728
- **Parameters**:
  - `interaction` (Discord Interaction): Slash command interaction
- **Returns**: Promise<void>
- **Description**: Shows user permissions and bot settings
- **Info Displayed**:
  - User access status (allowed/denied)
  - Current channel
  - User roles
  - Required roles
  - Allowed channels
  - Feature flags

#### `handleCurrentCommand(interaction)`
- **Line**: 1808
- **Parameters**:
  - `interaction` (Discord Interaction): Slash command interaction
- **Returns**: Promise<void>
- **Description**: Shows currently playing content
- **Modes**:
  - **YouTube Mode**: Video title, channel, duration, current time, views, upload date
  - **Tunarr Mode**: Current program, next program, time remaining, TMDB posters
- **Fallback**: Handles case when no channel is tracked

#### `handleSetCurrentCommand(interaction)`
- **Line**: 2040
- **Parameters**:
  - `interaction` (Discord Interaction): Slash command interaction
- **Returns**: Promise<void>
- **Description**: Manually sets current channel without changing browser
- **Purpose**: Recovery tool for when state is out of sync
- **Updates**: `currentChannelId`, `isOnYouTube`, `youtubeVideoInfo`

---

### Announcement System

#### `startAnnouncementMonitoring()`
- **Line**: 2078
- **Parameters**: None
- **Returns**: void
- **Description**: Starts interval-based program change monitoring
- **Interval**: From `config.announcements.checkInterval` (default: 60 seconds)
- **Behavior**:
  - Checks immediately on startup if channel is set
  - Then checks at regular intervals
  - Only checks when not on YouTube

#### `checkForProgramChange()`
- **Line**: 2094
- **Parameters**: None
- **Returns**: Promise<void>
- **Description**: Checks if program has changed and posts announcement if so
- **Logic**:
  1. Fetch current program
  2. Compare with last announced program ID and title
  3. If different, update tracking and post announcement
- **Tracking**: Uses `lastAnnouncedProgramId` and `lastAnnouncedProgramTitle`

#### `postChannelChangeAnnouncement(channel, user, current, next)`
- **Line**: 2121
- **Parameters**:
  - `channel` (Object): Channel object
  - `user` (Discord User): User who changed the channel
  - `current` (Object): Current program
  - `next` (Object): Next program
- **Returns**: Promise<void>
- **Description**: Posts announcement when channel is changed
- **Channel**: From `config.announcements.channelChangeChannel`
- **Features**:
  - Shows new channel name
  - Current program details
  - User attribution (optional via config)
  - TMDB poster

#### `postNowPlayingAnnouncement(current)`
- **Line**: 2179
- **Parameters**:
  - `current` (Object): Current program
- **Returns**: Promise<void>
- **Description**: Posts announcement when program changes automatically
- **Channel**: From `config.announcements.nowPlayingChannel`
- **Features**:
  - Full program details
  - Duration and time info
  - TMDB poster
  - Optional summary (via config)

---

### Auto-Reload System

#### `startAutoReload()`
- **Line**: 2246
- **Parameters**: None
- **Returns**: void
- **Description**: Starts interval-based automatic channel reload
- **Purpose**: Prevents Discord streaming timeouts on long sessions
- **Interval**: From `config.autoReload.interval` (default: 24 hours)

#### `performAutoReload()`
- **Line**: 2259
- **Parameters**: None
- **Returns**: Promise<void>
- **Description**: Executes automatic channel reload
- **Conditions**:
  - Only reloads if `currentChannelId` is set
  - Only reloads if not on YouTube
  - Optional: Only during active programs (`config.autoReload.onlyDuringPrograms`)
- **Process**:
  1. Check conditions
  2. Fetch current channel
  3. Call channel-changer to reload
  4. Update `lastReloadTime`
  5. Optional: Post announcement

#### `postAutoReloadAnnouncement(channel)`
- **Line**: 2308
- **Parameters**:
  - `channel` (Object): Channel that was reloaded
- **Returns**: Promise<void>
- **Description**: Posts announcement when auto-reload occurs
- **Enabled**: Only if `config.autoReload.announceReload` is true

---

## channel-changer.js Functions

### Constructor and Initialization

#### `constructor()`
- **Line**: 44
- **Parameters**: None
- **Returns**: ChannelChanger instance
- **Description**: Initializes Express app, logger, and sets up endpoints
- **Key Properties**:
  - `app`: Express application
  - `browser`, `page`: Puppeteer instances (null until initialized)
  - `currentUrl`: Current page URL
  - `isOnYouTube`: Boolean YouTube mode flag
  - `youtubeVideoInfo`: Video metadata
  - `sessionSubtitlePreference`: User subtitle override (null/true/false)
  - `logger`: Logger instance for channel-changer service

---

### Express Endpoints

#### `setupExpress()`
- **Line**: 66
- **Parameters**: None
- **Returns**: void
- **Description**: Sets up all Express routes and middleware
- **Endpoints**:
  - `GET /health`: Health check
  - `POST /change-channel`: Change Tunarr channel
  - `POST /navigate-youtube`: Navigate to YouTube
  - `POST /youtube-subtitles`: Control subtitles
  - `POST /youtube-login`: Navigate to login
  - `POST /browser-restart`: Restart browser
  - `GET /browser-health`: Check health
  - `GET /youtube-status`: Check YouTube mode
  - `GET /youtube-info`: Get video info
  - `GET /debug`: Debug information

---

### Browser Lifecycle

#### `initializeBrowser()`
- **Line**: 383
- **Parameters**: None
- **Returns**: Promise<Boolean> - Success indicator
- **Description**: Launches Chromium browser with Discord streaming configuration
- **Features**:
  - Persistent user profile (saves YouTube login)
  - App mode (no browser chrome)
  - Audio autoplay enabled
  - Page error handlers
  - HTTP response logging
  - Auto-dismiss dialogs
- **Profile Location**: `./chrome-profile/${config.chrome.profileName}`

#### `checkForBrowserFreeze()`
- **Line**: 487
- **Parameters**: None
- **Returns**: Promise<Boolean> - True if frozen
- **Description**: Checks if browser is frozen or unresponsive
- **Method**: Attempts page.evaluate() with 5-second timeout
- **Used By**: Called after YouTube navigation to detect freezes

#### `attemptEnhancedBrowserRecovery()`
- **Line**: 510
- **Parameters**: None
- **Returns**: Promise<Boolean> - Success indicator
- **Description**: Multi-step browser recovery process
- **Steps**:
  1. Window resize (trigger reflow)
  2. Focus restoration (activate window)
  3. Keyboard wake-up (spacebar press)
- **Progressive**: Tries each step, reports success if any works

---

### YouTube Subtitle Management

#### `handleYouTubeSubtitles(action)`
- **Line**: 677
- **Parameters**:
  - `action` (String): 'toggle', 'enable', 'disable', 'status', 'reset'
- **Returns**: Promise<Object> - `{ success: Boolean, message: String, ...details }`
- **Description**: Main entry point for subtitle control
- **Primary Method**: Keyboard shortcut (C key)
- **Fallback**: Button click method

#### `checkYouTubeSubtitleVisibility()`
- **Line**: 617
- **Parameters**: None
- **Returns**: Promise<Boolean> - True if subtitles visible
- **Description**: Detects current subtitle state
- **Method**: Searches for visible subtitle text elements in player
- **Handles**: Shadow DOM, multiple selector patterns

#### `findYouTubeSubtitleButton()`
- **Line**: 717
- **Parameters**: None
- **Returns**: Promise<ElementHandle|null> - CC button element or null
- **Description**: Locates subtitle toggle button in YouTube player
- **Searches**: Shadow DOM, multiple button selectors

#### `enableYouTubeSubtitles()`
- **Line**: 798
- **Parameters**: None
- **Returns**: Promise<Boolean> - Success indicator
- **Description**: Enables YouTube subtitles/captions
- **Method**:
  1. Check current state
  2. Use keyboard shortcut (C key) if disabled
  3. Verify subtitles enabled
- **Updates**: `sessionSubtitlePreference = true`

#### `disableYouTubeSubtitles()`
- **Line**: 865
- **Parameters**: None
- **Returns**: Promise<Boolean> - Success indicator
- **Description**: Disables YouTube subtitles/captions
- **Method**: Same as enable, but only toggles if currently enabled
- **Updates**: `sessionSubtitlePreference = false`

#### `toggleYouTubeSubtitles()`
- **Line**: 910
- **Parameters**: None
- **Returns**: Promise<Boolean> - Success indicator
- **Description**: Toggles subtitles on/off regardless of current state
- **Method**: Keyboard shortcut (C key)

#### `checkYouTubeSubtitleStatus()`
- **Line**: 940
- **Parameters**: None
- **Returns**: Promise<Object> - `{ visible: Boolean }`
- **Description**: Checks current subtitle visibility state
- **Used By**: Called by status action and for verification

#### `resetSubtitlePreference()`
- **Line**: 965
- **Parameters**: None
- **Returns**: Promise<void>
- **Description**: Resets session subtitle preference to config defaults
- **Updates**: `sessionSubtitlePreference = null`

---

### YouTube Navigation and Setup

#### `navigateToYouTubeWithRecovery(url)`
- **Line**: 1002
- **Parameters**:
  - `url` (String): YouTube video URL
- **Returns**: Promise<Boolean> - Success indicator
- **Description**: Wrapper for navigateToYouTube with freeze detection
- **Process**:
  1. Call navigateToYouTube()
  2. Check for browser freeze
  3. Trigger recovery if frozen
  4. Return success status

#### `navigateToYouTube(url)`
- **Line**: 1032
- **Parameters**:
  - `url` (String): YouTube video URL
- **Returns**: Promise<Boolean> - Success indicator
- **Description**: Main YouTube navigation flow
- **Process**:
  1. Check browser initialized
  2. Modify URL (start from beginning if configured)
  3. Navigate to URL
  4. Wait for video element
  5. Manage subtitles based on preferences
  6. Prevent membership popups
  7. Attempt fullscreen
  8. Verify playback
- **State Updates**: Sets `isOnYouTube = true`, stores video info

#### `seekVideoToBeginning()`
- **Line**: 1166
- **Parameters**: None
- **Returns**: Promise<void>
- **Description**: Forces YouTube video to start at 0:00
- **Config**: Only if `config.youtube.alwaysStartFromBeginning` is true
- **Method**: Sets video.currentTime = 0 in page context

#### `waitForYouTubeVideo()`
- **Line**: 1192
- **Parameters**: None
- **Returns**: Promise<void>
- **Description**: Waits for YouTube video element to be ready
- **Timeout**: 10 seconds
- **Checks**: Video element present, readyState >= 2

#### `preventMembershipPopups()`
- **Line**: 1224
- **Parameters**: None
- **Returns**: Promise<void>
- **Description**: Blocks YouTube membership popups and dialogs
- **Methods**:
  - CSS injection to hide popups
  - Direct element removal
  - MutationObserver for dynamic popups
- **Config**: Uses `config.youtube.blockMembershipPopups` and `aggressivePopupBlocking`

#### `extractYouTubeVideoInfo()`
- **Line**: 1346
- **Parameters**: None
- **Returns**: Promise<Object> - Video metadata object
- **Description**: Extracts video information from YouTube page
- **Returns**: `{ title, channel, url, video: { duration, currentTime, paused }, viewCount, uploadDate, description }`
- **Method**: Page evaluation with multiple selector attempts

---

### Fullscreen Implementation - YouTube

#### `attemptFullscreenApproaches()`
- **Line**: 1520
- **Parameters**: None
- **Returns**: Promise<Boolean> - Success indicator
- **Description**: Tries multiple fullscreen methods in order of reliability
- **Approaches** (in order):
  1. YouTube fullscreen button click
  2. YouTube video double-click
  3. Direct fullscreen API
  4. Mouse event simulation
  5. User gesture method

#### `attemptBrowserFullscreen()`
- **Line**: 1560
- **Parameters**: None
- **Returns**: Promise<Boolean> - Success indicator
- **Description**: Attempts browser-level fullscreen (F11)
- **Method**: Keyboard press simulation
- **Note**: Not true fullscreen, but works as fallback

#### `clearYouTubeOverlays()`
- **Line**: 1593
- **Parameters**: None
- **Returns**: Promise<void>
- **Description**: Removes YouTube cursor overlays and preview thumbnails
- **Methods**:
  - CSS injection to hide elements
  - Mouse movement to trigger and clear overlays
  - Targets: cursor, preview thumbnails, chapter markers

#### `hideYouTubeControls()`
- **Line**: 1648
- **Parameters**: None
- **Returns**: Promise<void>
- **Description**: Hides YouTube player controls for clean streaming
- **Hides**:
  - Player controls
  - End screen recommendations
  - Info cards
  - Watermarks
  - Gradient overlays
- **Activates**: Theater mode for larger player

#### `attemptYouTubeDoubleClick()`
- **Line**: 1792
- **Parameters**: None
- **Returns**: Promise<Boolean> - Success indicator
- **Description**: Double-clicks video center to trigger fullscreen
- **Method**: Simulated mouse double-click on video element
- **Verification**: Checks fullscreen state after click

#### `attemptYouTubeFullscreenButton()`
- **Line**: 1838
- **Parameters**: None
- **Returns**: Promise<Boolean> - Success indicator
- **Description**: Finds and clicks YouTube fullscreen button
- **Selectors**: Multiple patterns to find button
- **Checks**: Button visibility and enabled state
- **Verification**: Checks fullscreen state after click

#### `ensureYouTubePlaybackResumed()`
- **Line**: 1927
- **Parameters**: None
- **Returns**: Promise<void>
- **Description**: Ensures video playback is resumed after fullscreen
- **Methods** (in order):
  1. Direct video.play() call
  2. Click play button
  3. Spacebar press
- **Handles**: Play promise rejections

---

### YouTube Login

#### `navigateToYouTubeLogin()`
- **Line**: 2023
- **Parameters**: None
- **Returns**: Promise<Boolean> - Success indicator
- **Description**: Navigates to YouTube login page
- **Purpose**: Allow user to login with Premium account
- **URL**: https://www.youtube.com/account
- **Instructions**: Logged for user to follow

#### `checkYouTubeLoginStatus()`
- **Line**: 2053
- **Parameters**: None
- **Returns**: Promise<Boolean> - True if logged in
- **Description**: Checks if user is logged in to YouTube
- **Method**: Looks for account avatar element in page

---

### Channel Changing (Tunarr)

#### `changeChannel(url)`
- **Line**: 2097
- **Parameters**:
  - `url` (String): Tunarr channel watch URL
- **Returns**: Promise<Boolean> - Success indicator
- **Description**: Main channel change flow for Tunarr channels
- **Process**:
  1. Check browser initialized
  2. Navigate to channel URL
  3. Handle "Leave site?" dialog
  4. Wait for video element
  5. Attempt fullscreen
  6. Run post-fullscreen sequence
  7. Recovery on failure
- **State Updates**: Sets `isOnYouTube = false`, clears YouTube video info

#### `handleLeaveDialog()`
- **Line**: 2164
- **Parameters**: None
- **Returns**: Promise<void>
- **Description**: Auto-dismisses browser "Leave site?" confirmation dialog
- **Method**: Listens for dialog event, auto-accepts

#### `waitForVideoReady()`
- **Line**: 2183
- **Parameters**: None
- **Returns**: Promise<void>
- **Description**: Waits for Tunarr video element to be ready and playing
- **Checks**: Video element present, playing state
- **Timeout**: 10 seconds

---

### Debug and Diagnostics

#### `getVideoDebugInfo()`
- **Line**: 2212
- **Parameters**: None
- **Returns**: Promise<Object> - Video debug information
- **Description**: Extracts detailed video element state for debugging
- **Returns**: `{ networkState, readyState, error, currentTime, duration, paused, src }`
- **Used By**: Debug endpoint, error logging

---

### Fullscreen Implementation - Tunarr

#### `attemptTunarrFullscreenApproaches()`
- **Line**: 2269
- **Parameters**: None
- **Returns**: Promise<Boolean> - Success indicator
- **Description**: Tries multiple fullscreen methods for Tunarr videos
- **Approaches**: Same 5 methods as YouTube fullscreen

#### `runPostFullscreenSequence()`
- **Line**: 2308
- **Parameters**: None
- **Returns**: Promise<void>
- **Description**: Post-fullscreen cleanup and optimization
- **Steps**:
  1. Resume playback
  2. Hide controls
  3. Wait for stabilization

#### `attemptEnhancedDoubleClick()`
- **Line**: 2333
- **Parameters**: None
- **Returns**: Promise<Boolean> - Success indicator
- **Description**: Enhanced double-click with video element targeting
- **Method**: Centers click on video element

#### `attemptSmartDoubleClick()`
- **Line**: 2364
- **Parameters**: None
- **Returns**: Promise<Boolean> - Success indicator
- **Description**: Smart double-click with timing optimizations
- **Features**: Precise click timing, position calculation

#### `attemptUserGestureFullscreen()`
- **Line**: 2402
- **Parameters**: None
- **Returns**: Promise<Boolean> - Success indicator
- **Description**: Simulates user gesture for fullscreen API
- **Method**: Detailed user interaction simulation

#### `attemptFullscreenButtonClick()`
- **Line**: 2469
- **Parameters**: None
- **Returns**: Promise<Boolean> - Success indicator
- **Description**: Finds and clicks native fullscreen button
- **Searches**: Multiple selector patterns

#### `attemptDirectFullscreenAPI()`
- **Line**: 2516
- **Parameters**: None
- **Returns**: Promise<Boolean> - Success indicator
- **Description**: Direct fullscreen API call on video or document element
- **Methods**: video.requestFullscreen(), document.documentElement.requestFullscreen()

#### `attemptMouseEventFullscreen()`
- **Line**: 2552
- **Parameters**: None
- **Returns**: Promise<Boolean> - Success indicator
- **Description**: Simulates detailed mouse events for fullscreen
- **Features**: Full MouseEvent properties, bubbling

#### `ensureVideoPlaybackResumed()`
- **Line**: 2609
- **Parameters**: None
- **Returns**: Promise<void>
- **Description**: Ensures Tunarr video playback is resumed
- **Methods**: Same as YouTube version

#### `hideVideoControls()`
- **Line**: 2643
- **Parameters**: None
- **Returns**: Promise<void>
- **Description**: Hides Tunarr video controls for clean fullscreen
- **Method**: CSS injection

---

### Cleanup and Startup

#### `gracefulShutdown()`
- **Line**: 2715
- **Parameters**: None
- **Returns**: Promise<void>
- **Description**: Gracefully closes browser and cleans up resources
- **Triggers**: SIGTERM, SIGINT signals

#### `start()`
- **Line**: 2747
- **Parameters**: None
- **Returns**: void
- **Description**: Starts Express server and initializes browser
- **Port**: 3001 (from PORT constant)
- **Auto-start**: Initializes browser after 1 second delay

---

## logger.js Functions

### Constructor

#### `constructor(serviceName, options = {})`
- **Line**: 57
- **Parameters**:
  - `serviceName` (String): Name of the service (e.g., 'discord-bot', 'channel-changer')
  - `options` (Object): Configuration options
    - `detailed` (Boolean): Enable DEBUG/VERBOSE logs
    - `logLevel` (String): Log level override (defaults to LOG_LEVEL env var)
    - `logDir` (String): Custom log directory
    - `retentionDays` (Number): Days to retain logs (default: 30)
    - `consoleOutput` (Boolean): Enable console output (default: true)
    - `fileOutput` (Boolean): Enable file output (default: true)
- **Returns**: Logger instance
- **Description**: Creates a new logger instance for a service

---

### Core Logging Methods

#### `error(message, error = null, context = {})`
- **Line**: 244
- **Parameters**:
  - `message` (String): Error message
  - `error` (Error): Error object (optional)
  - `context` (Object): Additional context (optional)
- **Returns**: Promise<void>
- **Description**: Logs ERROR level message with stack trace
- **Always Logged**: Yes (ERROR is always logged regardless of level)

#### `warn(message, context = {})`
- **Line**: 260
- **Parameters**:
  - `message` (String): Warning message
  - `context` (Object): Additional context (optional)
- **Returns**: Promise<void>
- **Description**: Logs WARN level message
- **Logged When**: Log level >= WARN

#### `info(message, context = {})`
- **Line**: 270
- **Parameters**:
  - `message` (String): Info message
  - `context` (Object): Additional context (optional)
- **Returns**: Promise<void>
- **Description**: Logs INFO level message for normal operations
- **Logged When**: Log level >= INFO (recommended for production)

#### `debug(message, context = {})`
- **Line**: 280
- **Parameters**:
  - `message` (String): Debug message
  - `context` (Object): Additional context (optional)
- **Returns**: Promise<void>
- **Description**: Logs DEBUG level message for detailed flow
- **Logged When**: Log level >= DEBUG AND enableDetailedLogging = true

#### `verbose(message, context = {})`
- **Line**: 290
- **Parameters**:
  - `message` (String): Verbose message
  - `context` (Object): Additional context (optional)
- **Returns**: Promise<void>
- **Description**: Logs VERBOSE level message for high-frequency events
- **Logged When**: Log level >= VERBOSE AND enableDetailedLogging = true

---

### Specialized Logging Methods

#### `command(commandName, user, args = {}, context = {})`
- **Line**: 307
- **Parameters**:
  - `commandName` (String): Command name (e.g., '/guide', '/change')
  - `user` (Object|String): Discord user object or user tag
  - `args` (Object): Command arguments
  - `context` (Object): Additional context (optional)
- **Returns**: Promise<void>
- **Description**: Logs Discord command execution
- **Level**: INFO
- **Context**: Includes command, user, userId, args

#### `announce(type, success, details = {}, context = {})`
- **Line**: 323
- **Parameters**:
  - `type` (String): Announcement type (e.g., 'channel-change', 'now-playing')
  - `success` (Boolean): Success indicator
  - `details` (Object): Announcement details
  - `context` (Object): Additional context (optional)
- **Returns**: Promise<void>
- **Description**: Logs announcement events
- **Level**: INFO (success) or WARN (failure)
- **Context**: Includes type, success, details

#### `monitor(data = {}, context = {})`
- **Line**: 342
- **Parameters**:
  - `data` (Object): Monitor data (e.g., currentChannel, isOnYouTube)
  - `context` (Object): Additional context (optional)
- **Returns**: Promise<void>
- **Description**: Logs background monitor checks
- **Level**: VERBOSE
- **Use Case**: Called every 60 seconds for program change monitoring

#### `apiRequest(method, url, requestData = null, context = {})`
- **Line**: 355
- **Parameters**:
  - `method` (String): HTTP method (GET, POST, etc.)
  - `url` (String): API endpoint URL
  - `requestData` (Object): Request payload (optional)
  - `context` (Object): Additional context (optional)
- **Returns**: Promise<void>
- **Description**: Logs API requests
- **Level**: DEBUG
- **Context**: Includes method, url, requestData

#### `apiResponse(method, url, statusCode, responseData = null, context = {})`
- **Line**: 371
- **Parameters**:
  - `method` (String): HTTP method
  - `url` (String): API endpoint URL
  - `statusCode` (Number): Response status code
  - `responseData` (Object): Response payload (optional)
  - `context` (Object): Additional context (optional)
- **Returns**: Promise<void>
- **Description**: Logs API responses
- **Level**: DEBUG (2xx/3xx) or WARN (4xx/5xx)
- **Context**: Includes method, url, statusCode, responseData

#### `permission(granted, user, reason = null, context = {})`
- **Line**: 388
- **Parameters**:
  - `granted` (Boolean): Whether permission was granted
  - `user` (Object|String): User object or tag
  - `reason` (String): Reason for denial (if applicable)
  - `context` (Object): Additional context (optional)
- **Returns**: Promise<void>
- **Description**: Logs permission check events
- **Level**: DEBUG (granted) or WARN (denied)
- **Context**: Includes granted, user, reason

---

### Utility Methods

#### `getLogFilePath()`
- **Line**: 412
- **Parameters**: None
- **Returns**: String|null - Current log file path
- **Description**: Returns the current log file path

#### `getLogDirectory()`
- **Line**: 419
- **Parameters**: None
- **Returns**: String - Log directory path
- **Description**: Returns the log directory path

#### `isDetailedLoggingEnabled()`
- **Line**: 426
- **Parameters**: None
- **Returns**: Boolean - True if detailed logging is enabled
- **Description**: Checks if DEBUG/VERBOSE logging is enabled

#### `setDetailedLogging(enabled)`
- **Line**: 433
- **Parameters**:
  - `enabled` (Boolean): Enable or disable detailed logging
- **Returns**: void
- **Description**: Updates detailed logging setting at runtime

#### `getLogLevel()`
- **Line**: 442
- **Parameters**: None
- **Returns**: String - Log level name (ERROR, WARN, INFO, DEBUG, VERBOSE)
- **Description**: Returns the current log level name

---

## Quick Lookups

### By Category

#### Command Handlers (Discord)
- `/guide` - `handleGuideCompactView()` - tunarr-bot.js:798
- `/guide [page]` - `handleGuidePagedView()` - tunarr-bot.js:904
- `/channel` - `handleChannelCommand()` - tunarr-bot.js:999
- `/change` - `handleChangeCommand()` - tunarr-bot.js:1129
- `/youtube` - `handleYouTubeCommand()` - tunarr-bot.js:1346
- `/youtube-subtitles` - `handleYouTubeSubtitlesCommand()` - tunarr-bot.js:1442
- `/youtube-login` - `handleYouTubeLoginCommand()` - tunarr-bot.js:1748
- `/fix-browser` - `handleFixBrowserCommand()` - tunarr-bot.js:1522
- `/browser-health` - `handleBrowserHealthCommand()` - tunarr-bot.js:1595
- `/permissions` - `handlePermissionsCommand()` - tunarr-bot.js:1728
- `/current` - `handleCurrentCommand()` - tunarr-bot.js:1808
- `/set-current` - `handleSetCurrentCommand()` - tunarr-bot.js:2040

#### API Integration
- Tunarr channels - `fetchChannels()` - tunarr-bot.js:352
- Tunarr programs - `fetchProgramsForChannel()` - tunarr-bot.js:361
- YouTube info - `fetchYouTubeVideoInfo()` - tunarr-bot.js:371
- Browser health - `checkBrowserHealth()` - tunarr-bot.js:395
- Browser recovery - `recoverBrowser()` - tunarr-bot.js:423
- TMDB images - `fetchTMDBImage()` - tunarr-bot.js:449

#### Formatting & Utilities
- Format program title - `formatProgramTitle()` - tunarr-bot.js:618
- Format duration - `formatDuration()` - tunarr-bot.js:628
- Format time - `formatTime()` - tunarr-bot.js:635
- Format YouTube duration - `formatYouTubeDuration()` - tunarr-bot.js:644
- Validate YouTube URL - `isValidYouTubeUrl()` - tunarr-bot.js:662

#### Browser Automation - Navigation
- Initialize browser - `initializeBrowser()` - channel-changer.js:383
- Navigate to YouTube - `navigateToYouTube()` - channel-changer.js:1032
- Navigate to login - `navigateToYouTubeLogin()` - channel-changer.js:2023
- Change channel - `changeChannel()` - channel-changer.js:2097

#### Browser Automation - Fullscreen
- YouTube fullscreen attempts - `attemptFullscreenApproaches()` - channel-changer.js:1520
- YouTube button click - `attemptYouTubeFullscreenButton()` - channel-changer.js:1838
- YouTube double-click - `attemptYouTubeDoubleClick()` - channel-changer.js:1792
- Tunarr fullscreen attempts - `attemptTunarrFullscreenApproaches()` - channel-changer.js:2269
- Direct fullscreen API - `attemptDirectFullscreenAPI()` - channel-changer.js:2516

#### Browser Automation - Subtitles
- Handle subtitles - `handleYouTubeSubtitles()` - channel-changer.js:677
- Enable subtitles - `enableYouTubeSubtitles()` - channel-changer.js:798
- Disable subtitles - `disableYouTubeSubtitles()` - channel-changer.js:865
- Toggle subtitles - `toggleYouTubeSubtitles()` - channel-changer.js:910
- Check subtitle status - `checkYouTubeSubtitleStatus()` - channel-changer.js:940
- Find subtitle button - `findYouTubeSubtitleButton()` - channel-changer.js:717

#### Announcement System
- Start monitoring - `startAnnouncementMonitoring()` - tunarr-bot.js:2078
- Check program change - `checkForProgramChange()` - tunarr-bot.js:2094
- Post channel change - `postChannelChangeAnnouncement()` - tunarr-bot.js:2121
- Post now playing - `postNowPlayingAnnouncement()` - tunarr-bot.js:2179

#### Logging (Logger Module)
- Error logging - `logger.error()` - logger.js:244
- Warning logging - `logger.warn()` - logger.js:260
- Info logging - `logger.info()` - logger.js:270
- Debug logging - `logger.debug()` - logger.js:280
- Verbose logging - `logger.verbose()` - logger.js:290
- Command logging - `logger.command()` - logger.js:307
- Announcement logging - `logger.announce()` - logger.js:323

---

### By Complexity

#### Simple (< 50 lines)
- `formatProgramTitle()` - tunarr-bot.js:618
- `formatDuration()` - tunarr-bot.js:628
- `formatTime()` - tunarr-bot.js:635
- `isValidYouTubeUrl()` - tunarr-bot.js:662
- `handleLeaveDialog()` - channel-changer.js:2164
- All logger methods - logger.js

#### Medium (50-150 lines)
- `fetchTMDBImage()` - tunarr-bot.js:449
- `handleChannelCommand()` - tunarr-bot.js:999
- `handlePermissionsCommand()` - tunarr-bot.js:1728
- `seekVideoToBeginning()` - channel-changer.js:1166
- `waitForVideoReady()` - channel-changer.js:2183

#### Complex (> 150 lines)
- `navigateToYouTube()` - channel-changer.js:1032 (112 lines, multiple steps)
- `handleCurrentCommand()` - tunarr-bot.js:1808 (230 lines, two modes)
- `preventMembershipPopups()` - channel-changer.js:1224 (118 lines, aggressive blocking)
- `initializeBrowser()` - channel-changer.js:383 (94 lines, configuration)

---

### By Dependency

#### Independent (No Dependencies)
- All formatting functions
- `isValidYouTubeUrl()`
- `hasPermission()`
- Logger methods

#### Depends on Tunarr API
- `fetchChannels()`
- `fetchProgramsForChannel()`
- `getCurrentAndNextPrograms()`
- `manuallyCalculateCurrentNext()`

#### Depends on Channel Changer Service
- `fetchYouTubeVideoInfo()`
- `checkBrowserHealth()`
- `recoverBrowser()`
- All `/youtube-*` command handlers
- `handleChangeCommand()`

#### Depends on TMDB API
- `fetchTMDBImage()`

#### Depends on Discord API
- All command handlers
- All announcement functions
- `postChannelChangeAnnouncement()`
- `postNowPlayingAnnouncement()`

---

**Last Updated**: 2026-02-02
**Maintainer**: AI-Assisted Development
**Version**: 1.0.0
