# Architecture Overview

## System Components

### Discord Bot (`tunarr-bot.js`)
**Purpose**: Discord slash command interface for Tunarr control

**Dependencies**: 
- `discord.js` - Discord API integration
- `axios` - HTTP requests to Tunarr and TMDB APIs

**Key Functions**:
- `handleGuideCommandEnhanced()` - Fetches and displays TV guide with live data
- `getCurrentAndNextPrograms()` - Gets current/next program timing from API
- `handleChannelCommand()` - Shows detailed channel information with posters
- `handleChangeCommand()` - Triggers channel changes with automation
- `handleCurrentCommand()` - Shows currently tracked channel details
- `fetchTMDBImage()` - Retrieves movie/TV show artwork from TMDB

**Features**:
- Live program data integration
- TMDB poster integration
- Channel state tracking
- Permission-based access control
- Comprehensive error handling

### Channel Changer Service (`channel-changer.js`)
**Purpose**: Browser automation for seamless channel switching

**Dependencies**: 
- `puppeteer` - Headless Chrome automation
- `express` - HTTP API server

**Configuration**:
- **Port**: 3001 (configurable)
- **Timeout**: 5000ms for requests

**Key Features**:
- Headless Chrome automation
- Multiple fullscreen approaches
- Auto-dismiss browser dialogs
- Comprehensive logging
- Health check endpoints

### Configuration System (`config.js`)
**Purpose**: Centralized settings management with environment variable support

**Configuration Sections**:
- **Discord Integration**: Bot tokens, client IDs, guild settings
- **Tunarr Server**: Base URLs, API endpoints, web paths
- **TMDB Integration**: API keys, poster settings, fallback behavior
- **Permission System**: Role/channel restrictions, user whitelist
- **Feature Flags**: Toggle functionality on/off
- **Behavior Settings**: UI customization, text limits, localization

### Environment Configuration (`.env`)
**Purpose**: Secure credential storage

**Required Variables**:
```env
DISCORD_TOKEN=your_bot_token
DISCORD_CLIENT_ID=your_client_id
GUILD_ID=your_server_id
TUNARR_BASE_URL=http://your.tunarr.server:8000
TMDB_API_KEY=your_tmdb_api_key
```

## Data Flow

### Channel Changing Process
1. User sends `/change` command in Discord
2. Bot validates permissions and finds matching channel
3. Bot fetches current program information from Tunarr API
4. Bot sends HTTP request to channel-changer service
5. Channel-changer opens Tunarr URL in headless browser
6. Browser automation attempts fullscreen mode
7. Bot tracks new channel as current and responds with details

### Program Information Flow
1. Bot fetches live program data from Tunarr API
2. For visual enhancement, bot queries TMDB for artwork
3. Bot combines program data with poster images
4. Formatted response sent to Discord with embedded content

### Permission Validation Flow
1. Check if feature is enabled in configuration
2. Validate user is in allowed Discord channel
3. Check user roles against permitted roles list
4. Verify user ID against whitelist (if configured)
5. Grant or deny access based on all criteria

## API Endpoints Used

### Tunarr API
- `GET /api/channels` - List all available channels
- `GET /api/channels/{id}/lineup` - Get channel programs with precise timing
- `GET /api/channels/all/lineups` - Get all channel lineups (preferred for guide)
- `GET /api/channels/{id}/programs` - Get channel program list (fallback)
- `GET /api/channels/{id}` - Get individual channel details

### TMDB API (The Movie Database)
- `GET /search/multi` - Search for movies and TV shows
- **Image URLs**: `https://image.tmdb.org/t/p/w500/{poster_path}`
- **Features**: Year-based matching, fallback handling, 5-second timeout

### Channel Changer API
- `POST /change-channel` - Change to specified channel with automation
- `GET /health` - Service health check and status
- `GET /debug` - Debug information and browser state

## Component Interaction Diagram

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Discord User  │    │   Tunarr Bot     │    │  Tunarr Server  │
└─────────────────┘    └──────────────────┘    └─────────────────┘
         │                       │                       │
         │ /guide command        │                       │
         ├──────────────────────►│                       │
         │                       │ GET /api/channels/    │
         │                       │ all/lineups          │
         │                       ├──────────────────────►│
         │                       │                       │
         │                       │ ◄──────────────────────┤
         │                       │ (program data)        │
         │ ◄──────────────────────┤                       │
         │ (TV guide embed)      │                       │
         │                       │                       │
         │ /change 5 command     │                       │
         ├──────────────────────►│                       │
         │                       │                       │
         │                       ▼                       │
         │              ┌──────────────────┐             │
         │              │ Channel Changer  │             │
         │              │    Service       │             │
         │              └──────────────────┘             │
         │                       │                       │
         │                       │ Open browser &        │
         │                       │ navigate to URL       │
         │                       ├──────────────────────►│
         │                       │                       │
         │ ◄──────────────────────┤                       │
         │ (success message)     │                       │
```

## Security Considerations

### Permission System
- **Channel Restrictions**: Bot only responds in specified Discord channels
- **Role-Based Access**: Users must have required Discord roles
- **User Whitelist**: Optional individual user access control
- **Ephemeral Responses**: Private responses to prevent channel spam

### API Security
- **Environment Variables**: Sensitive tokens stored in `.env` file
- **Request Validation**: Input sanitization and validation
- **Error Handling**: Graceful failure without exposing internals
- **Timeout Protection**: Prevents hanging requests to external APIs

## Performance Optimizations

### Caching Strategy
- **Program Data**: Fresh API calls for accurate timing
- **TMDB Images**: Browser caching handles poster storage
- **Channel State**: In-memory tracking of current channel

### Error Resilience
- **API Fallbacks**: Manual calculation when live API fails
- **Image Fallbacks**: Channel icons when TMDB unavailable
- **Graceful Degradation**: Core functionality works without optional features