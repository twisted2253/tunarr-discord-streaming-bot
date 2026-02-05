# Changelog
All notable changes to the Tunarr Discord Bot project.

## [0.1.2] - 2026-02-04

### Security Hardening
- **Channel Changer binds to localhost** - Express server now listens on `127.0.0.1` by default instead of all interfaces, preventing external network access
- **Optional API key authentication** - New `CHANNEL_CHANGER_API_KEY` environment variable to require authentication for Channel Changer endpoints (health check excluded)
- **CORS restricted to localhost** - Channel Changer now only accepts requests from `localhost` and `127.0.0.1` origins instead of all origins
- **Chrome remote debugging locked to localhost** - Added `--remote-debugging-address=127.0.0.1` to prevent remote access to Chrome DevTools Protocol
- **API key forwarded from Discord bot** - All axios calls from `tunarr-bot.js` to Channel Changer include `x-api-key` header when configured

### Usability
- **Portable launch scripts** - All batch files (`Start-TunarrBot.bat`, `Start-TunarrBot-Simple.bat`) now use `%~dp0` instead of hardcoded `C:\tunarr-bot` path
- **Removed "kill all Chrome" behavior** - `Start-TunarrBot.bat` and `Stop-TunarrBot.bat` no longer force-close all Chrome processes on the system

### Project
- **Added LICENSE** - ISC license added (matches package.json)
- **Fixed package.json main** - Corrected `"main"` from `"index.js"` to `"tunarr-bot.js"`
- **Security documentation** - Added security notes section to README.md
- **New environment variables documented** - `CHANNEL_CHANGER_BIND_HOST` and `CHANNEL_CHANGER_API_KEY` added to `.env.template`, README.md, and SETUP.md
- **Version bump** - Updated version references in package.json, tunarr-bot.js header, and README.md

## [0.1.1] - 2026-02-04

### Fixed
- **Critical Program Detection Bug (Issue #1)** - Fixed incorrect program detection and timing calculations
  - **Root cause**: Used stale `channel.startTime` (days old) for timing calculations, resulting in wildly incorrect program times
  - **Previous symptoms**:
    - "Time Left: 0 minutes" when program just started
    - Wrong start/end times (off by hours)
    - "Up Next" showing wrong program
    - Bot showing different program than Tunarr web GUI
  - **Solution**: Migrated to Guide API with accurate timestamps
    - Primary: `/api/guide/channels/{id}?dateFrom=...&dateTo=...` for precise start/stop times
    - Fallback: `/api/guide/channels?dateFrom=...&dateTo=...` when single-channel endpoint unavailable
    - Emergency fallback: `/api/channels/{id}/now_playing` with approximate timing
  - **Key code changes** (tunarr-bot.js):
    - Added `fetchGuideChannelPrograms()` to fetch timed guide data
    - Added `getProgramWindow()` + `findCurrentAndNextFromGuide()` to compute time windows
    - Refactored `getCurrentAndNextPrograms()` to prioritize guide data over stale channel timing
  - **Impact**:
    - Current program detection now matches Tunarr web GUI exactly
    - Start/end times accurate to the second
    - "Time left" calculations correct (no more negative/zero values)
    - "Up Next" program detection accurate
    - Program change announcements post at correct times

- **Program Change Detection** - Improved responsiveness and reliability
  - Enhanced program matching logic to handle API response format correctly
  - Fixed parsing of Tunarr API programs response (result array)
  - Improved program change detection for more reliable announcements
  - Better handling of edge cases during program transitions

## [0.1.0] - 2026-02-02

### Added
- **Comprehensive Logging System** - Production-ready logging infrastructure
  - `logger.js` module - Centralized logging utility with 5 log levels (ERROR, WARN, INFO, DEBUG, VERBOSE)
  - File-based logging with automatic daily rotation and 30-day retention
  - Dual output: colored console logs + structured file logs with timestamps
  - Separate log folders for discord-bot and channel-changer services
  - Level filtering based on `LOG_LEVEL` environment variable
  - Verbosity control via `config.features.enableDetailedLogging` flag
  - Structured context objects for rich logging with JSON-formatted metadata
  - Specialized logging methods: `logger.command()`, `logger.announce()`, `logger.monitor()`, `logger.apiRequest()`, `logger.apiResponse()`, `logger.permission()`

- **AI-Friendly Documentation** - Comprehensive navigation guides for developers and AI agents
  - `docs/CODE_REFERENCE.md` - Complete code navigation guide with line numbers, debugging checklists, and testing procedures
  - `docs/FUNCTION_INDEX.md` - Searchable function catalog with signatures, parameters, return types, and quick lookups
  - Documentation organized by category, complexity, and dependency for easy navigation
  - Common code patterns and examples for consistent development
  - Testing locations and manual testing procedures

- **Organized Documentation Structure** - Better file organization
  - Moved `API.md`, `ARCHITECTURE.md`, `SETUP.md`, `TROUBLESHOOTING.md` to `docs/` folder
  - Kept `README.md` and `CHANGELOG.md` in root following best practices
  - Created dedicated documentation directory for better organization

### Enhanced
- **Discord Bot (tunarr-bot.js)** - Comprehensive logging integration
  - All 87 console.log statements replaced with appropriate logger methods
  - Command execution logging with user context (user tag, user ID, command arguments)
  - API request/response logging at DEBUG level with full context
  - Error logging with complete stack traces and structured context
  - Permission checking logged with detailed denial reasons at DEBUG/WARN levels
  - Announcement logging with success/failure tracking via `logger.announce()`
  - Background monitor logging with VERBOSE level for high-frequency checks (60-second interval)
  - TMDB API integration logging at DEBUG level

- **Channel Changer Service (channel-changer.js)** - Shared logger integration
  - Removed custom logging code, migrated to shared logger module
  - All browser automation steps logged with appropriate levels
  - Maintained emoji-based log formatting for readability
  - Fixed syntax errors in page.evaluate() contexts (browser-side code)
  - Health endpoints updated to return logger file paths
  - Startup logs with service information and endpoint URLs

### Configuration
- **Logging Settings** - New configuration section in config.js
  - `logging.enabled` - Master toggle for logging system (default: true)
  - `logging.logLevel` - Log level control: error, warn, info, debug, verbose (default: 'info')
  - `logging.retentionDays` - Automatic log cleanup after N days (default: 30)
  - `logging.separateFiles` - Use separate log folders per service (default: true)
  - Works in conjunction with `features.enableDetailedLogging` for DEBUG/VERBOSE logs

### Technical
- **Log Levels and Usage**
  - **ERROR**: Exceptions, failures, critical issues (always logged)
  - **WARN**: Unexpected but handled situations, timeouts, missing data (logged at WARN level and above)
  - **INFO**: Important events, commands, program changes, announcements (recommended for production)
  - **DEBUG**: Detailed flow, API responses, state changes (requires enableDetailedLogging=true)
  - **VERBOSE**: High-frequency events like monitor checks every 60 seconds (requires enableDetailedLogging=true)

- **Log File Management**
  - Automatic log rotation with timestamp-based file names
  - Daily rotation based on date change detection
  - Automatic cleanup of logs older than retention period
  - Concurrent write support from multiple services
  - Log directory: `C:\tunarr-bot\logs\{service-name}\`
  - Log format: `{service}_{YYYY-MM-DD_HH-mm-ss}.log`

- **Performance Optimizations**
  - Async logging to prevent blocking operations
  - Graceful initialization without blocking constructor
  - Console output with emoji indicators and ANSI colors for readability
  - File output with structured JSON-formatted context objects

### Changed
- **Console Output** - Cleaner, more structured logging
  - Emoji indicators for log levels: ❌ (ERROR), ⚠️ (WARN), ℹ️ (INFO), 🔍 (DEBUG), 📝 (VERBOSE)
  - ANSI color-coded console output: red (ERROR), yellow (WARN), cyan (INFO), magenta (DEBUG), gray (VERBOSE)
  - Structured format: `[EMOJI] [LEVEL] [service] message | key=value, key2=value2`
  - No more raw console.log statements in production code

- **Error Reporting** - More detailed and actionable
  - Full stack traces included in error logs
  - Structured context with relevant debugging information
  - Command failures logged with user, command, and arguments
  - API failures logged with method, URL, status code, and response data

### Fixed
- **Channel Changer Service** - Syntax errors in browser automation
  - Fixed `await this.logger` calls inside `page.evaluate()` browser contexts (lines 631, 657, 746, 1293, 1309, 1333, 1635, 1759, 1944, 1963, 1981, 2454, 2537)
  - Replaced with `console.log()` for browser-side logging (logger doesn't exist in browser context)
  - Fixed non-async function `forceYouTubeStartFromBeginning()` with await calls (line 1154, 1158)
  - Service now starts successfully and launches Puppeteer browser

### Migration Notes
- **Upgrading from 0.0.9**: Logging is automatic, but you can customize behavior:
  - Set `LOG_LEVEL=info` in `.env` for production (default)
  - Set `LOG_LEVEL=debug` and `enableDetailedLogging=true` for development
  - Set `LOG_LEVEL=verbose` for troubleshooting high-frequency events
  - Logs automatically saved to `logs/discord-bot/` and `logs/channel-changer/`
  - Old logs automatically cleaned up after 30 days

### Documentation Updates
- All documentation moved to organized `docs/` folder
- New AI-friendly documentation with exact line numbers
- Function catalog with searchable index
- Debugging checklists and testing procedures
- Common code patterns and examples

## [0.0.9] - 2025-08-15

### Added
- **Paginated TV Guide System** - Improved channel browsing experience
  - `/guide` now shows compact view of all channels (channel list format)
  - `/guide [page]` shows detailed view with 25 channels per page (e.g., `/guide 1`, `/guide 2`)
  - Page navigation with clear indicators showing current page and total pages
  - Detailed view includes current/next programs, time remaining, and TMDB posters
  - Automatic page calculation and validation for large channel lists

### Fixed
- **Discord Response Timeout Issue** - Resolved channel change command timeouts
  - Increased channel changer service timeout from 5 seconds to 30 seconds
  - Enhanced error handling with specific error messages for different failure types
  - Added detailed diagnostics for service connectivity issues (ECONNREFUSED, ETIMEDOUT, 5xx errors)
  - Improved user feedback when channel changer service is not responding
  - Channel changes now respond immediately in Discord while processing asynchronously

### Enhanced
- **Error Reporting** - Better troubleshooting information
  - Specific error codes and messages for different automation failures
  - Manual URL fallback when automation fails
  - Service health status indicators in error messages

## [0.0.8] - 2025-07-04

### Added
- **Performance Configuration** - Full timing customization system
  - `config.js` integration with fallback defaults for all timing values
  - Configurable buffer waits for Tunarr (15s) and YouTube (3s) videos
  - Adjustable fullscreen delays, playback resumption timing, and control hiding delays
  - Post-fullscreen stabilization periods for optimal streaming experience

- **Enhanced YouTube Experience** - Professional-grade YouTube automation
  - `forceYouTubeStartFromBeginning()` - URL modification to force videos to start at 0:00
  - `ensureVideoStartsFromBeginning()` - Programmatic seeking for consistent playback
  - `enableYouTubeSubtitles()` - Automatic captions/subtitles activation with keyboard shortcuts
  - Improved video information extraction with robust selector system and text cleaning
  - `/youtube-status` endpoint for checking YouTube login status

- **YouTube Login Management** - Streamlined Premium account access
  - `/youtube-login` command in Discord bot for easy Premium account access
  - Enhanced login status checking with avatar/sign-in button detection
  - Clear user instructions for manual login process with benefits explanation
  - Session persistence across browser restarts

### Enhanced
- **Optimized Performance** - Faster, more reliable automation
  - `optimizedPostFullscreenSequence()` - Streamlined post-fullscreen process with configurable timing
  - `enhancedDoubleClickTunarr()` - Tunarr-specific optimization with reduced delays
  - Configurable timing throughout all automation processes
  - Reduced wait times while maintaining reliability

- **YouTube Information Display** - Rich, clean video details
  - Enhanced video info extraction with multiple selector fallbacks
  - Text cleaning and length limiting for professional appearance
  - Description, view count, and upload date display in `/current` command
  - Improved error handling for missing or malformed video data
  - YouTube favicon thumbnail for brand consistency

### Technical
- **Configuration System** - Flexible timing and feature control
  - Dynamic config loading with graceful fallback to defaults
  - Separate timing values for Tunarr vs YouTube content
  - Feature flags for YouTube-specific behaviors (start from beginning, subtitles)
  - Centralized timing configuration for maintainability

- **Error Handling & Logging** - Robust operation and debugging
  - Enhanced logging throughout YouTube automation process
  - Graceful handling of missing config files
  - Improved error recovery in video information extraction
  - Better debugging information for timing and performance analysis

### Changed
- **Video Controls Management** - Less aggressive, more reliable control hiding
  - Smoother transitions with CSS opacity animations
  - Reduced interference with video playback
  - Configurable delays for control hiding to prevent flickering

- **Fullscreen Sequence** - Optimized timing for better success rates
  - Faster double-click operations with minimal delays
  - Configurable post-fullscreen stabilization
  - Improved coordination between playback resumption and control hiding

### Configuration
- **New Config Options** - Full control over automation timing
  - `playback.tunarrBufferWait` - Tunarr video buffer time (default: 15000ms)
  - `playback.youtubeBufferWait` - YouTube video buffer time (default: 3000ms)
  - `playback.fullscreenDelay` - Delay before fullscreen attempts (default: 500ms)
  - `playback.resumePlaybackDelay` - Post-fullscreen playback delay (default: 1000ms)
  - `playback.controlsHideDelay` - Control hiding delay (default: 2000ms)
  - `playback.postFullscreenStabilization` - Stabilization wait time (default: 3000ms)
  - `youtube.alwaysStartFromBeginning` - Force videos to start at 0:00 (default: true)
  - `youtube.enableSubtitles` - Auto-enable captions (default: true)

## [0.0.7] - 2025-07-04

### Added
- **YouTube Integration** - Complete YouTube video playback support
  - `/youtube [URL]` command - Play any YouTube video on the stream
  - YouTube URL validation with domain whitelist for security
  - `fetchYouTubeVideoInfo()` method - Extracts video title, channel, duration, and metadata
  - `formatYouTubeDuration()` method - Smart time formatting for video durations
  - YouTube state tracking separate from regular channel state

### Enhanced
- **Channel Changer Service** - Major YouTube automation capabilities
  - `/navigate-youtube` endpoint - Handles YouTube video navigation
  - `/youtube-login` endpoint - Assists with YouTube Premium account login
  - `/youtube-info` endpoint - Provides real-time video information
  - YouTube-specific fullscreen methods with multiple fallback approaches
  - Persistent Chrome profile for maintaining YouTube login sessions
  - Enhanced video control hiding for clean streaming experience

### YouTube Features
- **Smart Fullscreen Detection** - Prioritizes true fullscreen over theater mode
  - Browser fullscreen (F11) support as backup option
  - YouTube-specific control hiding for professional streaming appearance
  - Automatic playback resumption after fullscreen transitions
  - Theater mode fallback when fullscreen unavailable

- **Video Information Display** - Rich YouTube video details in `/current` command
  - Video title, channel name, duration, and current playback time
  - View count and upload date when available
  - Playing/paused status indication
  - YouTube-branded embed appearance with red color scheme

### Configuration
- **YouTube Settings** - New configuration section in config.js
  - `youtube.allowedDomains` - Security whitelist for valid YouTube domains
  - `youtube.premiumAccount` - Reference for login account
  - `playback.youtubeBufferWait` - Configurable buffer timing for YouTube videos
  - `features.enableYouTubeIntegration` - Master toggle for YouTube functionality
  - `colors.youtube` - YouTube red branding for embeds

### Technical
- **State Management** - Intelligent switching between channel and YouTube modes
  - Channel changes automatically reset YouTube state
  - YouTube navigation clears current channel tracking
  - Proper state isolation between different content types
- **Browser Persistence** - Chrome user profile preservation for login sessions
- **Enhanced Error Handling** - YouTube-specific error messages and fallback behaviors

### Changed
- **`/current` command** - Now detects and displays YouTube video information when active
- **`/change` command** - Resets YouTube state when switching to regular channels
- **Guide instructions** - Updated to mention YouTube command availability
- **Permissions display** - Shows YouTube integration status in `/permissions` command

## [0.0.6] - 2025-07-04

### Added
- **TMDB API Integration** - Full integration with The Movie Database for movie/show posters
  - `fetchTMDBImage()` method - Searches TMDB for program artwork using title and year
  - Automatic poster display for current programs (as thumbnails)
  - Optional poster display for "Up Next" programs (as main images)
  - Year-based matching for more accurate search results
  - Intelligent fallback system: TMDB poster → channel icon → no image

### Enhanced
- **Visual Experience** - Significantly improved embed appearance
  - Movie/TV show posters now display in `/channel` and `/current` commands
  - Channel icons used as fallback thumbnails when TMDB images unavailable
  - Guide command shows random channel icon for visual appeal
  - Professional appearance with real artwork instead of text-only embeds

### Configuration
- **TMDB Settings** - New configuration options in config.js
  - `tmdb.apiKey` - TMDB API key configuration
  - `tmdb.enabled` - Toggle TMDB integration on/off
  - `tmdb.showNextPoster` - Control whether "Up Next" program posters display as main images
  - Graceful degradation when TMDB is disabled or API key missing

### Technical
- **Error Handling** - Robust TMDB API error handling with automatic fallbacks
- **Performance** - 5-second timeout on TMDB requests to prevent delays
- **Search Logic** - Smart title cleaning for TV episodes (removes episode info for better matches)
- **Image Hierarchy** - Proper positioning of thumbnails vs main images in Discord embeds

## [0.0.5] - 2025-07-02

### Added
- **`/current` command** - Shows what channel is currently being watched (perfect for fullscreen viewing)
- **Channel tracking** - Bot remembers the last channel changed to via `/change` command
- **Better code organization** - Clear section headers and improved structure for maintainability
- **Enhanced guide instructions** - Now shows all three commands: `/channel`, `/change`, and `/current`

### Changed
- **Guide instructions** - Added `/current` command to help text
- **Code structure** - Reorganized into clearly defined sections with descriptive headers
- **Constructor** - Added `currentChannelId` property to track active channel

### Technical
- Channel state tracking in `this.currentChannelId`
- Full program details in `/current` command including progress, synopsis, and next program
- Better separation of concerns with organized code sections

## [0.0.4] - 2025-07-02

### Added
- **Elapsed/total time format** - Shows progress like `(24:35/126:48)` instead of "X min left"
- **`formatTimeElapsed()` method** - Smart formatting (H:MM:SS for >1hr, M:SS for <1hr)
- **Guide instructions** - Added help text: "Use `/channel #` for more details!" and "Use `/change #` to change the channel!"

### Changed
- **Progress display** - Better context showing how far into program you are
- **Time precision** - Down to the second accuracy instead of just minutes

### Improved
- **User guidance** - Clear instructions visible in guide for command discovery

## [0.0.3] - 2025-07-02

### Added
- **Condensed guide format** - Clean, minimal display without excessive emojis
- **Channel name in header** - Moved from inline to field name for better organization

### Removed
- Synopsis/summaries from guide (kept in `/channel` command for details)
- Excessive emojis (kept only 📺)
- "Live API" text from title and footer
- Rating display from guide (moved to `/channel` for details)

### Changed
- **Guide display** - Much cleaner "(X min left)" format
- **Information hierarchy** - Guide for quick scan, `/channel` for full details

## [0.0.2] - 2025-07-01

### Added
- **Live API integration** - Using `/api/channels/all/lineups` and `/api/channels/{id}/lineup` endpoints
- **`getCurrentAndNextPrograms()` method** - Real-time program data from Tunarr API
- **TV episode formatting** - Shows "Series - Episode" instead of just episode title
- **Next program information** - Both current AND upcoming programs displayed
- **Fallback system** - Manual calculation backup when API fails
- **Enhanced channel command** - Full current and next program details with summaries

### Changed
- **Timing accuracy** - Fixed major timing issues using live API data
- **Guide title** - Added "Now & Up Next" and "Live API" indicators
- **Program display** - Current + next program information throughout

### Fixed
- **Timing calculation** - Was off by hours, now accurate to the minute
- **Next program detection** - Now works correctly with API data
- **Program duration** - Corrected calculations using real timestamps

### Technical
- `formatProgramTitle()` method for smart title formatting
- `getCurrentAndNextProgramsManual()` fallback method
- Error handling and API failure recovery

## [0.0.1] - 2025-07-01

### Added
- **Initial Discord bot** with `/guide`, `/channel`, `/change`, `/permissions` commands
- **Browser automation** for channel changing via external automation script
- **Permission system** with role/channel restrictions and `/permissions` command
- **Manual timing calculation** - Calculates current program based on channel startTime and duration
- **Logging system** with error handling
- **Configuration system** - Flexible config file for all settings

### Features
- Basic TV guide showing current programs
- Channel-specific program information
- Automated channel changing (when automation script available)
- Role and channel-based access control
- Windows batch file launcher for easy deployment

### Known Issues
- Timing can be inaccurate due to manual calculation only
- No "next program" information available
- Guide format can be overwhelming with too much information