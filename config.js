// config.js - Bot Configuration Settings
require('dotenv').config();

module.exports = {
    // Discord Configuration (from .env file)
    discord: {
        token: process.env.DISCORD_TOKEN,
        clientId: process.env.DISCORD_CLIENT_ID,
        guildId: process.env.GUILD_ID
    },

    // Tunarr Server Configuration
    tunarr: {
        baseUrl: process.env.TUNARR_BASE_URL || 'http://localhost:8000',
        webPath: '/web/channels', // Path for browser URLs
        defaultChannel: null, // Optional: Set a default channel ID to track on startup
    },

    // Channel Changer Service Configuration
    channelChanger: {
        url: process.env.CHANNEL_CHANGER_URL || 'http://localhost:3001',
        timeout: 60000, // milliseconds - allow longer channel change operations
        bindHost: process.env.CHANNEL_CHANGER_BIND_HOST || '127.0.0.1',
        apiKey: process.env.CHANNEL_CHANGER_API_KEY || ''
    },

    // YouTube Configuration
    youtube: {
        // Allowed YouTube domains for security
        allowedDomains: [
            'youtube.com',
            'www.youtube.com',
            'm.youtube.com',
            'youtu.be',
            'youtube-nocookie.com'
        ],
        
        // YouTube-specific settings
		alwaysStartFromBeginning: true, // Force videos to start from 0:00 instead of resuming
        autoplay: true, // Enable autoplay for continuous viewing
		enableSubtitles: false, // Automatically turn on captions
        defaultQuality: 'auto', // Video quality preference
        hideRecommendations: true, // Try to hide YouTube recommendations for cleaner experience
		blockMembershipPopups: true, // Enable membership popup blocking
		aggressivePopupBlocking: true, // Use more aggressive blocking methods
        
        // Premium account info (from .env file)
        premiumAccount: process.env.YOUTUBE_PREMIUM_EMAIL || 'your-email@gmail.com' // <- NOW FROM .ENV
    },
	
	// Video Playback Configuration
    playback: {
        // Buffer wait times (in milliseconds)
        tunarrBufferWait: 15000, // How long to wait for Tunarr video to buffer before fullscreen (default: 15 seconds)
        youtubeBufferWait: 3000,  // How long to wait for YouTube video to buffer before fullscreen (default: 3 seconds)
        
        // Fullscreen timing adjustments
        fullscreenDelay: 500,     // Delay before attempting fullscreen (default: 0.5 seconds)
        resumePlaybackDelay: 1000, // Delay before resuming playback after fullscreen (default: 1 second)
        controlsHideDelay: 2000,  // Delay before hiding controls after fullscreen (default: 2 seconds)
        
        // Stability settings
        postFullscreenStabilization: 3000, // Time to wait after fullscreen for video to stabilize (default: 3 seconds)
    },

    // TMDB Configuration (for movie/show posters)
    tmdb: {
        apiKey: process.env.TMDB_API_KEY, 
        enabled: true, // Set to false to disable TMDB posters
        showNextPoster: false, // Set to false to only show current program poster
    },
	
    // Chrome Browser Configuration
    chrome: {
        profileName: process.env.CHROME_PROFILE_NAME || 'TunarrBot-Profile' // Custom profile name
    },

    // Permission Settings
    permissions: {
        // Channel restrictions (empty array = all channels allowed)
        allowedChannels: ['tv-remote'], // Only these channel names
        
        // Role restrictions (empty array = no role requirement)
        allowedRoles: [], // e.g., ['Movie Admin', 'DJ']
        
        // User whitelist (empty array = no user restriction)
        allowedUsers: [], // e.g., ['123456789012345678']
        
        // Make all responses private (ephemeral)
        ephemeralResponses: true
    },

    // Bot Behavior Settings
    behavior: {
        // Guide display settings
        guideTitle: '📺 Tunarr TV Guide - Now & Up Next',
        guideInstructions: '**Use `/guide [page]` for detailed view (e.g., `/guide 1`)**\n**Use `/channel #` for specific channel details!**\n**Use `/change #` to change the channel!**\n**Use `/current` to see what\'s currently playing!**',
        guideFooterPartial: 'Showing {showing} of {total} channels', // {showing} and {total} are replaced
        guideFooterAll: 'All {total} channels',
        
        // Maximum channels to show in /guide command (Discord embed limit is 25 fields)
        maxChannelsInGuide: 25,
        
        // Text length limits
        maxSummaryLength: 1000,
        maxChannelInfoLength: 100,
        defaultTruncateLength: 100,
        
        // Localization
        locale: 'en-US', // Used for time formatting
        
        // Error messages (configurable)
        messages: {
            noCurrentChannel: 'No current channel is being tracked. Use `/change #` to switch to a channel first!',
            currentChannelNotFound: 'Current channel not found. It may have been deleted.',
            noCurrentProgram: 'No current program information available.',
            currentCommandError: 'Failed to fetch current channel information.',
            invalidYouTubeUrl: 'Invalid YouTube URL. Please use a valid YouTube link.',
            youTubeNavigationFailed: 'Failed to navigate to YouTube video.',
            youTubeNotPlaying: 'No YouTube video is currently playing.',
        },
        
        // Embed colors
        colors: {
            success: 0x00FF00,
            error: 0xFF0000,
            info: 0x0099FF,
            warning: 0xFFAA00,
            youtube: 0xFF0000 // YouTube red
        }
    },

    // Feature flags
    features: {
        enableChannelChanging: true,
        enableDetailedLogging: true,
        enablePermissionChecking: true,
        enableYouTubeIntegration: true
    },

    // Logging Configuration
    logging: {
        enabled: true,                              // Enable logging system
        logLevel: process.env.LOG_LEVEL || 'info',  // Log level: error, warn, info, debug, verbose
        retentionDays: 30,                          // Days to retain log files before cleanup
        separateFiles: true                         // Use separate log folders for each service
    },

    // Announcement Settings
    announcements: {
        // Enable/disable announcement types
        enableChannelChangeAnnouncements: true, // Announce when someone uses /change
        enableNowPlayingAnnouncements: true,    // Announce when program changes

        // Discord channel IDs for announcements (from .env)
        channelChangeChannel: process.env.TV_ANNOUNCE_CHANNEL_ID, // Where to post channel change announcements
        nowPlayingChannel: process.env.TV_ANNOUNCE_CHANNEL_ID,    // Where to post now playing announcements

        // Check interval for program changes (in milliseconds)
        checkInterval: 15000, // 15 seconds (15000ms)

        // Announcement formatting
        includeUsername: true, // Include who changed the channel in announcements
        includePoster: true,   // Include program poster in now playing announcements
        includeSummary: false  // Include program summary in now playing announcements (can be verbose)
    },

    // Auto-Reload Settings (prevent Discord streaming timeouts)
    autoReload: {
        enabled: true,                           // Enable automatic channel reload
        interval: 24 * 60 * 60 * 1000,          // 24 hours in milliseconds (86400000ms)
        announceReload: false,                   // Post to announcements channel when auto-reloading
        onlyDuringPrograms: true                 // Only reload if a program is actually playing (safer)
    }
};
