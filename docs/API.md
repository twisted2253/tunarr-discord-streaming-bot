# API Reference

## Official Tunarr API Documentation

For complete and up-to-date Tunarr API documentation, refer to:
**https://tunarr.com/api-docs.html#latest/tag/channels**

This document provides quick reference for the specific endpoints used by the Discord bot.

## Tunarr Server APIs (External Dependencies)

These are the Tunarr server endpoints that the Discord bot calls to get channel and program information.

### Get All Channels

**Endpoint**: `GET /api/channels`

**Purpose**: Retrieve list of all available channels

**Used in**: `/guide` and `/channel` commands

```http
GET http://192.168.1.100:8000/api/channels
```

**Response**: Array of channel objects

**Example Response**:
```json
[
  {
    "id": "channel-uuid-1",
    "number": 1,
    "name": "Movies",
    "programCount": 150,
    "duration": 86400000,
    "icon": {
      "path": "http://example.com/icon.png"
    }
  }
]
```

### Get Guide Channel Programs (Primary - v0.1.1+)

**Endpoint**: `GET /api/guide/channels/{channelId}?dateFrom={timestamp}&dateTo={timestamp}`

**Purpose**: Get programs with precise start/stop timestamps from EPG guide

**Used in**: Current program detection, accurate timing calculations (PRIMARY METHOD as of v0.1.1)

**Note**: This endpoint replaced `/api/channels/{channelId}/lineup` due to more reliable timestamp data

```http
GET http://192.168.1.100:8000/api/guide/channels/abc-123-def?dateFrom=1704063600000&dateTo=1704150000000
```

**Response**: Array of programs with accurate start/stop timestamps

**Example Response**:
```json
[
  {
    "title": "The Matrix",
    "start": 1704067200000,
    "stop": 1704074400000,
    "duration": 7200000,
    "type": "movie",
    "rating": "R",
    "date": "1999-03-31T00:00:00.000Z",
    "summary": "A computer hacker learns about the true nature of reality..."
  }
]
```

### Get All Guide Channels (Fallback for Guide API)

**Endpoint**: `GET /api/guide/channels?dateFrom={timestamp}&dateTo={timestamp}`

**Purpose**: Get all channels with guide programs in time window

**Used in**: Fallback when single-channel guide endpoint unavailable

```http
GET http://192.168.1.100:8000/api/guide/channels?dateFrom=1704063600000&dateTo=1704150000000
```

**Response**: Object with channel IDs as keys, program arrays as values

### Get Current Playing Program (Emergency Fallback)

**Endpoint**: `GET /api/channels/{channelId}/now_playing`

**Purpose**: Get currently playing program metadata

**Used in**: Emergency fallback when guide API unavailable

```http
GET http://192.168.1.100:8000/api/channels/abc-123-def/now_playing
```

**Response**: Current program object with metadata

**Example Response**:
```json
{
  "title": "The Matrix",
  "duration": 7200000,
  "type": "movie",
  "rating": "R",
  "date": "1999-03-31T00:00:00.000Z",
  "summary": "A computer hacker learns about the true nature of reality..."
}
```

**Note**: This endpoint does NOT include start/stop timestamps, so timing must be approximated

### Get Channel Lineup (Deprecated)

**Endpoint**: `GET /api/channels/{channelId}/lineup`

**Status**: ⚠️ DEPRECATED - May return unreliable data in some Tunarr configurations

**Purpose**: Get programs with precise start/stop timestamps

**Replaced by**: `/api/guide/channels/{channelId}` (v0.1.1+)

```http
GET http://192.168.1.100:8000/api/channels/abc-123-def/lineup
```

**Response**: Programs with live timing data

**Example Response**:
```json
{
  "programs": [
    {
      "title": "The Matrix",
      "start": 1704067200000,
      "stop": 1704074400000,
      "duration": 7200000,
      "type": "movie",
      "rating": "R",
      "date": "1999-03-31T00:00:00.000Z",
      "summary": "A computer hacker learns about the true nature of reality..."
    }
  ]
}
```

### Get All Channel Lineups

**Endpoint**: `GET /api/channels/all/lineups`

**Purpose**: Get all channels with current program information

**Used in**: Enhanced `/guide` command

```http
GET http://192.168.1.100:8000/api/channels/all/lineups
```

**Response**: All channels with current programs

**Example Response**:
```json
[
  {
    "id": "channel-uuid-1",
    "number": 1,
    "name": "Movies",
    "programs": [
      {
        "title": "The Matrix",
        "start": 1704067200000,
        "stop": 1704074400000,
        "duration": 7200000
      }
    ]
  }
]
```

### Get Channel Programs (Fallback)

**Endpoint**: `GET /api/channels/{channelId}/programs`

**Purpose**: Get channel program list (used as fallback for manual calculations)

**Used in**: Manual timing calculations when lineup API fails

```http
GET http://192.168.1.100:8000/api/channels/abc-123-def/programs
```

### Get Individual Channel Details

**Endpoint**: `GET /api/channels/{channelId}`

**Purpose**: Get detailed information about a specific channel

**Used in**: Fallback calculations, channel information display

```http
GET http://192.168.1.100:8000/api/channels/abc-123-def
```

## Channel Changer Service APIs (Internal Service)

These are the APIs provided by the `channel-changer.js` service for browser automation.

### Change Channel

**Endpoint**: `POST /change-channel`

**Purpose**: Automate channel changing via browser control

**Used in**: `/change` command

```http
POST http://localhost:3001/change-channel
Content-Type: application/json

{
  "channelId": "channel-uuid-123",
  "url": "http://192.168.1.100:8000/web/channels/channel-uuid-123/watch?noAutoPlay=false"
}
```

**Response**:
```json
{
  "success": true,
  "message": "Channel changed successfully",
  "channelId": "channel-uuid-123",
  "timestamp": 1704067200000
}
```

### Health Check

**Endpoint**: `GET /health`

**Purpose**: Check if channel changer service is running

```http
GET http://localhost:3001/health
```

**Response**:
```json
{
  "status": "healthy",
  "uptime": 3600,
  "browser": "chrome",
  "version": "1.0.0"
}
```

### Debug Information

**Endpoint**: `GET /debug`

**Purpose**: Get debugging information about browser state

```http
GET http://localhost:3001/debug
```

**Response**:
```json
{
  "browserOpen": true,
  "currentUrl": "http://192.168.1.100:8000/web/channels/...",
  "lastChange": 1704067200000,
  "errors": []
}
```

## TMDB API Integration

The bot integrates with The Movie Database (TMDB) for poster artwork.

### Search for Movies/TV Shows

**Endpoint**: `GET /search/multi`

**Purpose**: Find movie or TV show information and poster images

**Used in**: `/channel`, `/current` commands for poster display

```http
GET https://api.themoviedb.org/3/search/multi?api_key=YOUR_API_KEY&query=The%20Matrix
```

**Response**:
```json
{
  "results": [
    {
      "id": 603,
      "title": "The Matrix",
      "poster_path": "/f89U3ADr1oiB1s9GkdPOEpXUk5H.jpg",
      "release_date": "1999-03-30"
    }
  ]
}
```

**Poster URL Format**: `https://image.tmdb.org/t/p/w500{poster_path}`

## Data Models

### Channel Object Structure
```javascript
{
  id: "string",           // Unique channel identifier
  number: "number",       // Channel number (1, 2, 3...)
  name: "string",         // Channel display name
  programCount: "number", // Total programs in channel
  duration: "number",     // Total channel duration in milliseconds
  icon: {                 // Optional channel icon
    path: "string"        // URL to channel icon image
  }
}
```

### Program Object Structure
```javascript
{
  title: "string",        // Program title
  start: "number",        // Start timestamp (milliseconds)
  stop: "number",         // End timestamp (milliseconds)
  duration: "number",     // Duration in milliseconds
  type: "string",         // "movie", "episode", etc.
  subtype: "string",      // More specific type information
  rating: "string",       // Content rating (PG, R, etc.)
  date: "string",         // Release date (ISO format)
  summary: "string",      // Program description
  grandparent: {          // For TV episodes
    title: "string"       // Show title
  }
}
```

## Error Handling

### Common HTTP Status Codes

- **200 OK**: Request successful
- **404 Not Found**: Channel or resource not found
- **500 Internal Server Error**: Tunarr server error
- **503 Service Unavailable**: Service temporarily unavailable

### Bot Error Responses

The bot implements graceful fallbacks:

1. **API Failure**: Falls back to manual calculations
2. **TMDB Unavailable**: Uses channel icons instead of posters
3. **Channel Changer Down**: Provides manual URL for channel changing
4. **Invalid Channels**: Clear error messages to user

### Rate Limiting

- **TMDB API**: 40 requests per 10 seconds
- **Tunarr API**: No official limits, but bot implements 5-second timeouts
- **Channel Changer**: No limits on internal service

## Testing API Endpoints

### Manual Testing

Test Tunarr API directly in browser:
```
http://192.168.1.100:8000/api/channels
http://192.168.1.100:8000/api/channels/all/lineups
```

Test Channel Changer service:
```
http://localhost:3001/health
```

### Programmatic Testing

```javascript
// Test basic Tunarr connection
const axios = require('axios');

async function testTunarrAPI() {
  try {
    const response = await axios.get('http://192.168.1.100:8000/api/channels');
    console.log(`Found ${response.data.length} channels`);
  } catch (error) {
    console.error('Tunarr API test failed:', error.message);
  }
}

testTunarrAPI();
```

This API documentation provides everything needed to understand and work with the bot's external dependencies and internal services.