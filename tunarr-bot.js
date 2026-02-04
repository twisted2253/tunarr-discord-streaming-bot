// ============================================================================
// TUNARR DISCORD BOT - VERSION 0.0.9 - 2025-08-15 - ENHANCED EDITION
// ============================================================================
// IMPORTS AND DEPENDENCIES
// ============================================================================
const { Client, GatewayIntentBits, EmbedBuilder, SlashCommandBuilder, REST, Routes } = require('discord.js');
const axios = require('axios');
const config = require('./config');
const Logger = require('./logger');

// ============================================================================
// MAIN BOT CLASS
// ============================================================================
class TunarrDiscordBot {
    constructor() {
        this.client = new Client({
            intents: [
                GatewayIntentBits.Guilds,
                GatewayIntentBits.GuildMessages,
                GatewayIntentBits.MessageContent
            ]
        });
        
        // Track the current channel being watched
        this.currentChannelId = config.tunarr.defaultChannel || null;

        // YouTube state tracking
        this.isOnYouTube = false;
        this.youtubeVideoInfo = null;

        // Announcement tracking
        this.lastAnnouncedProgramId = null;
        this.lastAnnouncedProgramTitle = null;
        this.announcementInterval = null;

        // Auto-reload tracking
        this.autoReloadInterval = null;
        this.lastReloadTime = null;

        // Initialize logger
        this.logger = new Logger('discord-bot', {
            detailed: config.features.enableDetailedLogging,
            logLevel: config.logging.logLevel,
            retentionDays: config.logging.retentionDays
        });

        this.setupEventHandlers();
        this.registerCommands();
    }

    // ========================================================================
    // EVENT HANDLERS SETUP
    // ========================================================================
    setupEventHandlers() {
        this.client.once('ready', () => {
            this.logger.info(`Enhanced TunarrBot v0.0.9 ready! Logged in as ${this.client.user.tag}`);

            // Start announcement monitoring if enabled
            if (config.announcements?.enableNowPlayingAnnouncements) {
                this.startAnnouncementMonitoring();
            }

            // Start auto-reload if enabled
            if (config.autoReload?.enabled) {
                this.startAutoReload();
            }
        });

        this.client.on('interactionCreate', async interaction => {
            if (!interaction.isChatInputCommand()) return;

            // Check permissions before processing any command
            if (!this.hasPermission(interaction)) {
                await this.logger.permission(false, interaction.user, 'Permission denied', {
                    channel: interaction.channel.name,
                    command: interaction.commandName
                });
                await interaction.reply({
                    content: '❌ You don\'t have permission to use this bot, or you\'re in the wrong channel!',
                    flags: 64 // EPHEMERAL
                });
                return;
            }

            try {
                switch (interaction.commandName) {
                    case 'guide':
                        const page = interaction.options.getString('page');
                        await this.logger.command('/guide', interaction.user, { page });
                        if (page) {
                            await this.handleGuidePagedView(interaction, page);
                        } else {
                            await this.handleGuideCompactView(interaction);
                        }
                        break;
                    case 'channel':
                        await this.logger.command('/channel', interaction.user, { name: interaction.options.getString('name') });
                        await this.handleChannelCommand(interaction);
                        break;
                    case 'change':
                        await this.logger.command('/change', interaction.user, { channel: interaction.options.getString('channel') });
                        await this.handleChangeCommand(interaction);
                        break;
                    case 'youtube':
                        await this.logger.command('/youtube', interaction.user, { url: interaction.options.getString('url') });
                        await this.handleYouTubeCommand(interaction);
                        break;
                    case 'youtube-login':
                        await this.logger.command('/youtube-login', interaction.user);
                        await this.handleYouTubeLoginCommand(interaction);
                        break;
                    case 'youtube-subtitles':
                        await this.logger.command('/youtube-subtitles', interaction.user, { action: interaction.options.getString('action') });
                        await this.handleYouTubeSubtitlesCommand(interaction);
                        break;
                    case 'fix-browser':
                        await this.logger.command('/fix-browser', interaction.user);
                        await this.handleFixBrowserCommand(interaction);
                        break;
                    case 'browser-health':
                        await this.logger.command('/browser-health', interaction.user);
                        await this.handleBrowserHealthCommand(interaction);
                        break;
                    case 'permissions':
                        await this.logger.command('/permissions', interaction.user);
                        await this.handlePermissionsCommand(interaction);
                        break;
                    case 'current':
                        await this.logger.command('/current', interaction.user, {
                            currentChannelId: this.currentChannelId,
                            isOnYouTube: this.isOnYouTube
                        });
                        await this.handleCurrentCommand(interaction);
                        break;
                    case 'set-current':
                        await this.logger.command('/set-current', interaction.user, { channel: interaction.options.getString('channel') });
                        await this.handleSetCurrentCommand(interaction);
                        break;
                    default:
                        await this.logger.warn(`Unknown command: ${interaction.commandName}`, { user: interaction.user.tag });
                }
            } catch (error) {
                await this.logger.error('Error handling command', error, {
                    command: interaction.commandName,
                    user: interaction.user.tag
                });

                try {
                    if (interaction.deferred && !interaction.replied) {
                        await interaction.editReply('❌ An error occurred while processing the command.');
                    } else if (!interaction.replied) {
                        await interaction.reply({
                            content: '❌ An error occurred while processing the command.',
                            flags: 64 // EPHEMERAL
                        });
                    }
                } catch (replyError) {
                    await this.logger.error('Failed to send error message to user', replyError);
                }
            }
        });
    }

    // ========================================================================
    // PERMISSION CHECKING
    // ========================================================================
    hasPermission(interaction) {
        // Skip permission checking if disabled
        if (!config.features.enablePermissionChecking) {
            this.logger.debug('Permission checking disabled, granting access', {
                user: interaction.user.tag
            });
            return true;
        }

        // Check if command is in allowed channel
        const channelName = interaction.channel.name;
        const isInAllowedChannel = config.permissions.allowedChannels.length === 0 ||
                                 config.permissions.allowedChannels.includes(channelName);

        if (!isInAllowedChannel) {
            this.logger.debug('Permission denied: wrong channel', {
                user: interaction.user.tag,
                channel: channelName,
                allowedChannels: config.permissions.allowedChannels
            });
            return false;
        }

        // If specific users are specified, check user ID
        if (config.permissions.allowedUsers.length > 0) {
            const allowed = config.permissions.allowedUsers.includes(interaction.user.id);
            if (!allowed) {
                this.logger.debug('Permission denied: user not whitelisted', {
                    user: interaction.user.tag,
                    userId: interaction.user.id
                });
            }
            return allowed;
        }

        // If specific roles are specified, check user roles
        if (config.permissions.allowedRoles.length > 0) {
            const userRoles = interaction.member.roles.cache.map(role => role.name);
            const allowed = config.permissions.allowedRoles.some(roleName => userRoles.includes(roleName));
            if (!allowed) {
                this.logger.debug('Permission denied: missing required role', {
                    user: interaction.user.tag,
                    userRoles,
                    requiredRoles: config.permissions.allowedRoles
                });
            }
            return allowed;
        }

        // If no restrictions specified, allow everyone in allowed channels
        this.logger.debug('Permission granted', { user: interaction.user.tag });
        return true;
    }

    // ========================================================================
    // YOUTUBE URL VALIDATION
    // ========================================================================
    isValidYouTubeUrl(url) {
        try {
            const urlObj = new URL(url);
            const allowedDomains = config.youtube?.allowedDomains || [
                'youtube.com',
                'www.youtube.com',
                'm.youtube.com',
                'youtu.be',
                'youtube-nocookie.com'
            ];
            
            return allowedDomains.some(domain => 
                urlObj.hostname === domain || urlObj.hostname.endsWith('.' + domain)
            );
        } catch (error) {
            return false;
        }
    }

    // ========================================================================
    // COMMAND REGISTRATION
    // ========================================================================
    async registerCommands() {
        const commands = [
            new SlashCommandBuilder()
                .setName('guide')
                .setDescription('Show the TV guide for all channels')
                .addStringOption(option =>
                    option.setName('page')
                        .setDescription('Page number for detailed view (1, 2, 3...) or leave empty for compact list')
                        .setRequired(false)),
            
            new SlashCommandBuilder()
                .setName('channel')
                .setDescription('Show what\'s currently playing on a specific channel')
                .addStringOption(option =>
                    option.setName('name')
                        .setDescription('Channel name or number')
                        .setRequired(true)),
            
            new SlashCommandBuilder()
                .setName('change')
                .setDescription('Change to a different channel on the stream')
                .addStringOption(option =>
                    option.setName('channel')
                        .setDescription('Channel ID or name to switch to')
                        .setRequired(true)),

            new SlashCommandBuilder()
                .setName('youtube')
                .setDescription('Play a YouTube video on the stream')
                .addStringOption(option =>
                    option.setName('url')
                        .setDescription('YouTube video URL (youtube.com, youtu.be, etc.)')
                        .setRequired(true)),
                        
            new SlashCommandBuilder()
                .setName('youtube-subtitles')
                .setDescription('Control YouTube video subtitles/captions')
                .addStringOption(option =>
                    option.setName('action')
                        .setDescription('Subtitle action to perform')
                        .setRequired(true)
                        .addChoices(
                            { name: 'Turn ON subtitles', value: 'on' },
                            { name: 'Turn OFF subtitles', value: 'off' },
                            { name: 'Toggle subtitles', value: 'toggle' },
                            { name: 'Check status', value: 'status' },
                            { name: 'Reset session preferences', value: 'reset' }
                        )),    

            new SlashCommandBuilder()
                .setName('fix-browser')
                .setDescription('Attempt to fix browser freezing or responsiveness issues')
                .addStringOption(option =>
                    option.setName('method')
                        .setDescription('Recovery method to try')
                        .setRequired(false)
                        .addChoices(
                            { name: 'Auto Recovery (recommended)', value: 'auto' },
                            { name: 'Window Resize', value: 'resize' },
                            { name: 'Focus & Wake', value: 'focus' },
                            { name: 'Full Recovery', value: 'full' },
                            { name: 'Force Restart Browser', value: 'restart' }
                        )),

            new SlashCommandBuilder()
                .setName('browser-health')
                .setDescription('Check the health and status of the browser automation'),

            new SlashCommandBuilder()
                .setName('youtube-login')
                .setDescription('Login to YouTube Premium account for ad-free viewing'),

            new SlashCommandBuilder()
                .setName('permissions')
                .setDescription('Check your permissions and bot settings'),

            new SlashCommandBuilder()
                .setName('current')
                .setDescription('Show what channel or YouTube video is currently being watched'),

            new SlashCommandBuilder()
                .setName('set-current')
                .setDescription('Manually set the current channel for tracking (debug)')
                .addStringOption(option =>
                    option.setName('channel')
                        .setDescription('Channel number or name to track')
                        .setRequired(true))
        ].map(command => command.toJSON());

        const rest = new REST({ version: '10' }).setToken(config.discord.token);

        try {
            await this.logger.info('Started refreshing application (/) commands');
            await rest.put(
                Routes.applicationGuildCommands(config.discord.clientId, config.discord.guildId),
                { body: commands }
            );
            await this.logger.info('Successfully reloaded application (/) commands', { count: commands.length });
        } catch (error) {
            await this.logger.error('Error registering commands', error);
        }
    }

    // ========================================================================
    // API DATA FETCHING METHODS
    // ========================================================================
    async fetchChannels() {
        try {
            const response = await axios.get(`${config.tunarr.baseUrl}/api/channels`);
            return response.data;
        } catch (error) {
            await this.logger.error('Error fetching channels', error);
            throw new Error('Failed to fetch channels from Tunarr');
        }
    }

    async fetchChannelPrograms(channelId) {
        try {
            const response = await axios.get(`${config.tunarr.baseUrl}/api/channels/${channelId}/programs`);
            return response.data;
        } catch (error) {
            await this.logger.error(`Error fetching programs for channel ${channelId}`, error);
            throw new Error(`Failed to fetch programs for channel ${channelId}`);
        }
    }

    // ========================================================================
    // YOUTUBE INTEGRATION METHODS
    // ========================================================================
    async fetchYouTubeVideoInfo() {
        try {
            const response = await axios.get(`${config.channelChanger.url}/youtube-info`, {
                timeout: config.channelChanger.timeout
            });
            
            if (response.data.isOnYouTube) {
                this.isOnYouTube = true;
                this.youtubeVideoInfo = response.data.videoInfo;
                return response.data.videoInfo;
            } else {
                this.isOnYouTube = false;
                this.youtubeVideoInfo = null;
                return null;
            }
        } catch (error) {
            await this.logger.error('Error fetching YouTube info', error);
            return null;
        }
    }

    formatYouTubeDuration(seconds) {
        if (!seconds || isNaN(seconds)) return 'Unknown';
        
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = Math.floor(seconds % 60);
        
        if (hours > 0) {
            return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
        } else {
            return `${minutes}:${secs.toString().padStart(2, '0')}`;
        }
    }

    // ========================================================================
    // BROWSER HEALTH AND RECOVERY METHODS
    // ========================================================================
    async checkBrowserHealth() {
        try {
            const response = await axios.get(`${config.channelChanger.url}/browser-health`, {
                timeout: 10000 // 10 second timeout for health check
            });
            return response.data;
        } catch (error) {
            await this.logger.error('Browser health check failed', error);
            return {
                healthy: false,
                error: error.message,
                responsive: false
            };
        }
    }

    async attemptBrowserRecovery(method = 'auto') {
        try {
            const response = await axios.post(`${config.channelChanger.url}/browser-recovery`, {
                method: method
            }, {
                timeout: 30000 // 30 second timeout for recovery
            });
            return response.data;
        } catch (error) {
            await this.logger.error('Browser recovery failed', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    // ========================================================================
    // TMDB API INTEGRATION
    // ========================================================================
    normalizeTitle(title) {
        return (title || '')
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, ' ')
            .trim();
    }

    async fetchTMDBImage(programTitle, programType = 'movie', programYear = null, programMeta = null) {
        try {
            const apiKey = config.tmdb?.apiKey || process.env.TMDB_API_KEY;
            const enabled = config.tmdb?.enabled !== false; // Default to true if not specified
            
            if (!enabled) {
                await this.logger.debug('TMDB integration disabled in config');
                return null;
            }

            if (!apiKey) {
                await this.logger.debug('TMDB API key not configured, skipping image fetch');
                return null;
            }

            const subtype = programMeta?.subtype || programMeta?.type || programType || '';
            const inferredShowTitle = programMeta?.grandparent?.title || programMeta?.showTitle || null;
            const isTv = Boolean(inferredShowTitle) ||
                (typeof subtype === 'string' && subtype.toLowerCase() === 'episode');

            // Clean up the title for search (remove episode info for TV shows)
            let searchTitle = inferredShowTitle || programTitle;
            if (!inferredShowTitle && programTitle.includes(' - ')) {
                // For TV shows like "Black Mirror - San Junipero", use just "Black Mirror"
                searchTitle = programTitle.split(' - ')[0];
            }

            const baseUrl = 'https://api.themoviedb.org/3';
            const searchType = isTv ? 'tv' : 'movie';
            let searchUrl = `${baseUrl}/search/${searchType}?api_key=${apiKey}&query=${encodeURIComponent(searchTitle)}`;

            // Add year for movies only (TV year often mismatches episode air dates)
            if (!isTv && programYear) {
                searchUrl += `&year=${programYear}`;
                await this.logger.debug(`Searching TMDB ${searchType} for: ${searchTitle} (${programYear})`);
            } else {
                await this.logger.debug(`Searching TMDB ${searchType} for: ${searchTitle}`);
            }
            
            const response = await axios.get(searchUrl, { timeout: 5000 });
            
            if (response.data.results && response.data.results.length > 0) {
                let bestMatch = response.data.results[0];

                // Prefer exact title match (case/spacing-insensitive)
                const normalizedSearch = this.normalizeTitle(searchTitle);
                const exactMatches = response.data.results.filter(result => {
                    const candidateTitle = result.name || result.title || '';
                    return this.normalizeTitle(candidateTitle) === normalizedSearch;
                });

                if (exactMatches.length > 0) {
                    bestMatch = exactMatches[0];
                    await this.logger.debug(`Found exact title match for ${searchTitle}`);
                } else if (!isTv && programYear) {
                    // If we have a year for movies, try to find a better match
                    const yearMatches = response.data.results.filter(result => {
                        const releaseYear = result.release_date ? new Date(result.release_date).getFullYear() : null;
                        return releaseYear === parseInt(programYear);
                    });
                    
                    if (yearMatches.length > 0) {
                        bestMatch = yearMatches[0];
                        await this.logger.debug(`Found year-matched result for ${searchTitle} (${programYear})`);
                    }
                }
                
                if (bestMatch.poster_path) {
                    const imageUrl = `https://image.tmdb.org/t/p/w500${bestMatch.poster_path}`;
                    await this.logger.debug(`Found TMDB image: ${imageUrl}`);
                    return imageUrl;
                }
            }

            await this.logger.debug(`No TMDB image found for: ${searchTitle}${programYear ? ` (${programYear})` : ''}`);
            return null;
        } catch (error) {
            await this.logger.error('TMDB API error', new Error(error.message));
            return null;
        }
    }

    // ========================================================================
    // PROGRAM LINEUP AND TIMING METHODS
    // ========================================================================
    coerceTimestamp(value) {
        if (value === null || value === undefined) return null;
        if (value instanceof Date) return value.getTime();
        if (typeof value === 'number' && !isNaN(value)) return value;
        if (typeof value === 'string') {
            const parsed = Date.parse(value);
            return isNaN(parsed) ? null : parsed;
        }
        return null;
    }

    getProgramWindow(program) {
        const start = this.coerceTimestamp(program.start ?? program.startTime ?? program.startAt);
        const stop = this.coerceTimestamp(program.stop ?? program.stopTime ?? program.endTime ?? program.endAt);

        if (start !== null && stop !== null) {
            return { start, stop };
        }

        const duration = typeof program.duration === 'number' ? program.duration : null;
        if (start !== null && duration) {
            return { start, stop: start + duration };
        }
        if (stop !== null && duration) {
            return { start: stop - duration, stop };
        }

        return null;
    }

    extractGuideChannelData(guideData, channelId) {
        if (!guideData) return null;

        if (Array.isArray(guideData)) {
            return guideData.find(c => c && (c.id === channelId || c.number?.toString?.() === channelId));
        }

        if (guideData.programs && Array.isArray(guideData.programs)) {
            return guideData;
        }

        const channels = Object.values(guideData).filter(c => c && typeof c === 'object');
        return channels.find(c => c.id === channelId || c.number?.toString?.() === channelId);
    }

    async fetchGuideChannelPrograms(channelId, nowMs, windowMs) {
        const dateFrom = new Date(nowMs - windowMs).toISOString();
        const dateTo = new Date(nowMs + windowMs).toISOString();

        // Try channel-specific guide endpoint first
        try {
            const response = await axios.get(`${config.tunarr.baseUrl}/api/guide/channels/${channelId}`, {
                params: { dateFrom, dateTo },
                timeout: 10000
            });
            const channelData = this.extractGuideChannelData(response.data, channelId);
            if (channelData && Array.isArray(channelData.programs)) {
                return channelData;
            }
        } catch (error) {
            await this.logger.debug(`Guide channel endpoint failed, falling back to full guide: ${error.message}`);
        }

        // Fallback to full guide endpoint
        const response = await axios.get(`${config.tunarr.baseUrl}/api/guide/channels`, {
            params: { dateFrom, dateTo },
            timeout: 10000
        });
        return this.extractGuideChannelData(response.data, channelId);
    }

    findCurrentAndNextFromGuide(programs, nowMs) {
        for (let i = 0; i < programs.length; i++) {
            const window = this.getProgramWindow(programs[i]);
            if (!window) continue;

            if (nowMs >= window.start && nowMs < window.stop) {
                return {
                    currentProgram: programs[i],
                    nextProgram: programs[i + 1] || null,
                    currentWindow: window
                };
            }
        }

        return { currentProgram: null, nextProgram: null, currentWindow: null };
    }

    async getCurrentAndNextPrograms(channelId) {
        try {
            await this.logger.info(`Getting current program for channel ${channelId}`);

            // Use the now_playing endpoint to get the ACTUAL current program
            const nowPlayingResponse = await axios.get(`${config.tunarr.baseUrl}/api/channels/${channelId}/now_playing`, { timeout: 5000 });
            const nowPlaying = nowPlayingResponse.data;

            if (!nowPlaying || !nowPlaying.id) {
                await this.logger.warn(`No current program from now_playing endpoint for channel ${channelId}`);
                return await this.getCurrentAndNextProgramsManual(channelId);
            }

            await this.logger.info(`Now playing: ${nowPlaying.title} (${nowPlaying.id})`);

            const now = Date.now();

            // Use guide API to get accurate start/stop times
            const durationMs = Number(nowPlaying.duration) || 0;
            const bufferMs = 5 * 60 * 1000;
            const minWindowMs = 60 * 60 * 1000;
            const maxWindowMs = 24 * 60 * 60 * 1000;
            const windowMs = Math.min(Math.max(durationMs + bufferMs, minWindowMs), maxWindowMs);

            const guideChannel = await this.fetchGuideChannelPrograms(channelId, now, windowMs);
            const guidePrograms = guideChannel?.programs || [];

            if (guidePrograms.length > 0) {
                const { currentProgram, nextProgram, currentWindow } = this.findCurrentAndNextFromGuide(guidePrograms, now);

                if (currentProgram && currentWindow) {
                    const programStartTime = currentWindow.start;
                    const programEndTime = currentWindow.stop;
                    const actualTimeLeft = Math.max(0, Math.floor((programEndTime - now) / 60000));

                    const mergedDuration = Number(nowPlaying.duration) || currentProgram.duration || (programEndTime - programStartTime);
                    const mergedCurrent = {
                        ...currentProgram,
                        ...nowPlaying,
                        duration: mergedDuration
                    };

                    let nextStart = programEndTime;
                    let nextEnd = programEndTime + (nextProgram?.duration || 0);
                    if (nextProgram) {
                        const nextWindow = this.getProgramWindow(nextProgram);
                        if (nextWindow) {
                            nextStart = nextWindow.start;
                            nextEnd = nextWindow.stop;
                        }
                    }

                    const result = {
                        current: {
                            ...mergedCurrent,
                            timeLeft: actualTimeLeft,
                            isPaused: mergedCurrent.isPaused || false,
                            startTime: new Date(programStartTime),
                            endTime: new Date(programEndTime),
                            start: programStartTime,
                            stop: programEndTime
                        },
                        next: nextProgram ? {
                            ...nextProgram,
                            startsIn: Math.max(0, Math.floor((nextStart - now) / 60000)),
                            startTime: new Date(nextStart),
                            endTime: new Date(nextEnd),
                            start: nextStart,
                            stop: nextEnd
                        } : null
                    };

                    await this.logger.info(`Current: ${this.formatProgramTitle(mergedCurrent)} (${Math.floor(mergedCurrent.duration/60000)}min), Next: ${nextProgram ? this.formatProgramTitle(nextProgram) : 'None'}`);
                    return result;
                }
            }

            await this.logger.warn(`Guide data did not include current program timing for channel ${channelId}, falling back to approximate timing`);

            // Fallback: use programs list to find next program, approximate timing from now
            const programsResponse = await this.fetchChannelPrograms(channelId);
            let programs = [];
            if (programsResponse && typeof programsResponse === 'object') {
                if (Array.isArray(programsResponse)) {
                    programs = programsResponse;
                } else if (programsResponse.result && Array.isArray(programsResponse.result)) {
                    programs = programsResponse.result;
                } else if (programsResponse.programs && Array.isArray(programsResponse.programs)) {
                    programs = programsResponse.programs;
                }
            }

            const currentDuration = Number(nowPlaying.duration) || 0;
            const approxEndTime = now + currentDuration;
            const approxTimeLeft = Math.max(0, Math.floor((approxEndTime - now) / 60000));

            let currentProgramIndex = -1;
            if (programs.length > 0) {
                currentProgramIndex = programs.findIndex(p => {
                    const titleMatch = p.title === nowPlaying.title;
                    const durationMatch = Math.abs((p.duration || 0) - currentDuration) < 1000;
                    return titleMatch && durationMatch;
                });

                if (currentProgramIndex === -1) {
                    currentProgramIndex = programs.findIndex(p => p.title === nowPlaying.title);
                }
            }

            const nextProgram = currentProgramIndex >= 0 ? (programs[currentProgramIndex + 1] || programs[0]) : null;

            return {
                current: {
                    ...nowPlaying,
                    timeLeft: approxTimeLeft,
                    isPaused: nowPlaying.isPaused || false,
                    startTime: new Date(now),
                    endTime: new Date(approxEndTime),
                    start: now,
                    stop: approxEndTime
                },
                next: nextProgram ? {
                    ...nextProgram,
                    startsIn: approxTimeLeft,
                    startTime: new Date(approxEndTime),
                    endTime: new Date(approxEndTime + (nextProgram.duration || 0)),
                    start: approxEndTime,
                    stop: approxEndTime + (nextProgram.duration || 0)
                } : null
            };

        } catch (error) {
            await this.logger.error(`Error fetching lineup for channel ${channelId}`, error);
            await this.logger.debug('Falling back to manual calculation...');
            return await this.getCurrentAndNextProgramsManual(channelId);
        }
    }

    async getCurrentAndNextProgramsManual(channelId) {
        try {
            const [channelInfo, programs] = await Promise.all([
                axios.get(`${config.tunarr.baseUrl}/api/channels/${channelId}`),
                this.fetchChannelPrograms(channelId)
            ]);

            const channel = channelInfo.data;
            const startTime = new Date(channel.startTime).getTime();
            const currentTime = Date.now();
            
            let elapsedMs = (currentTime - startTime) % channel.duration;
            if (elapsedMs < 0) elapsedMs += channel.duration;
            
            let accumulatedTime = 0;
            let currentProgramIndex = -1;
            
            for (let i = 0; i < programs.length; i++) {
                const program = programs[i];
                if (elapsedMs >= accumulatedTime && elapsedMs < accumulatedTime + program.duration) {
                    currentProgramIndex = i;
                    break;
                }
                accumulatedTime += program.duration;
            }
            
            if (currentProgramIndex === -1) {
                return { current: null, next: null };
            }
            
            const currentProgram = programs[currentProgramIndex];
            const nextProgram = programs[currentProgramIndex + 1] || programs[0];
            
            const programStartTime = accumulatedTime;
            const timeIntoCurrentProgram = elapsedMs - programStartTime;
            const timeLeftInCurrent = currentProgram.duration - timeIntoCurrentProgram;
            
            const result = {
                current: {
                    ...currentProgram,
                    startTime: new Date(startTime + programStartTime),
                    endTime: new Date(startTime + programStartTime + currentProgram.duration),
                    timeLeft: Math.floor(timeLeftInCurrent / 1000 / 60)
                },
                next: nextProgram ? {
                    ...nextProgram,
                    startsIn: Math.floor(timeLeftInCurrent / 1000 / 60),
                    startTime: new Date(startTime + programStartTime + currentProgram.duration)
                } : null
            };
            
            return result;
        } catch (error) {
            await this.logger.error(`Error in manual calculation for channel ${channelId}`, error);
            return { current: null, next: null };
        }
    }

    async getCurrentProgram(channelId) {
        const result = await this.getCurrentAndNextPrograms(channelId);
        return result.current;
    }

    // ========================================================================
    // UTILITY AND FORMATTING METHODS
    // ========================================================================
    formatDuration(milliseconds) {
        const totalMinutes = Math.floor(milliseconds / 1000 / 60);
        const hours = Math.floor(totalMinutes / 60);
        const minutes = totalMinutes % 60;
        return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
    }

    formatTime(timestamp) {
        return new Date(timestamp).toLocaleTimeString(config.behavior.locale || 'en-US', {
            hour: '2-digit',
            minute: '2-digit',
            timeZoneName: 'short'
        });
    }

    formatTimeElapsed(milliseconds) {
        const totalSeconds = Math.floor(milliseconds / 1000);
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const seconds = totalSeconds % 60;
        
        if (hours > 0) {
            return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        } else {
            return `${minutes}:${seconds.toString().padStart(2, '0')}`;
        }
    }

    truncateText(text, maxLength = null) {
        const defaultLength = config.behavior.defaultTruncateLength || 100;
        const length = maxLength || defaultLength;
        if (text.length <= length) return text;
        return text.substring(0, length - 3) + '...';
    }

    formatProgramTitle(program) {
        if (program.subtype === 'episode' || program.type === 'episode') {
            const showTitle = program.grandparent?.title || program.showTitle || '';
            const episodeTitle = program.title || '';
            
            if (showTitle && episodeTitle && showTitle !== episodeTitle) {
                return `${showTitle} - ${episodeTitle}`;
            }
        }
        
        return program.title || 'Unknown';
    }

    // ========================================================================
    // COMMAND HANDLERS
    // ========================================================================

    // ---- GUIDE COMMAND ----
    async handleGuideCommandEnhanced(interaction) {
        await interaction.deferReply({
            flags: config.permissions.ephemeralResponses ? 64 : 0
        });

        try {
            // Use new Tunarr 1.1.6+ guide API with date parameters
            const now = new Date();
            const dateFrom = new Date(now.getTime() - 60 * 60 * 1000).toISOString(); // 1 hour ago
            const dateTo = new Date(now.getTime() + 2 * 60 * 60 * 1000).toISOString(); // 2 hours from now

            const response = await axios.get(`${config.tunarr.baseUrl}/api/guide/channels`, {
                params: { dateFrom, dateTo }
            });
            const channelsObject = response.data;

            // Convert object to array of channels
            const channelsData = Object.values(channelsObject);

            if (!channelsData || channelsData.length === 0) {
                await interaction.editReply('❌ No channels found.');
                return;
            }

            const embed = new EmbedBuilder()
                .setTitle(config.behavior.guideTitle || '📺 Tunarr TV Guide - Now & Up Next')
                .setDescription(config.behavior.guideInstructions || '💡 **Use `/channel #` for more details!**\n💡 **Use `/change #` to change the channel!**\n💡 **Use `/current` to see what\'s currently playing!**\n💡 **Use `/youtube [URL]` to play YouTube videos!**')
                .setColor(config.behavior.colors.info)
                .setTimestamp();

            // Ensure we don't exceed Discord's limits (25 fields max per embed)
            const maxChannelsInGuide = Math.min(config.behavior.maxChannelsInGuide || 25, 25);
            const channelsToShow = channelsData.slice(0, maxChannelsInGuide);
            const nowMs = Date.now();
            
            for (const channelData of channelsToShow) {
                const programs = channelData.programs || [];
                let channelInfo = '';
                
                let currentProgram = null;
                let nextProgram = null;
                
                for (let i = 0; i < programs.length; i++) {
                    const program = programs[i];

                    if (program.start && program.stop) {
                        const startTime = program.start;
                        const stopTime = program.stop;

                        if (nowMs >= startTime && nowMs < stopTime) {
                            currentProgram = program;
                            nextProgram = programs[i + 1] || null;
                            break;
                        }
                    }
                }

                if (currentProgram) {
                    const elapsed = nowMs - currentProgram.start;
                    const total = currentProgram.stop - currentProgram.start;
                    const programTitle = this.formatProgramTitle(currentProgram);
                    
                    const elapsedFormatted = this.formatTimeElapsed(elapsed);
                    const totalFormatted = this.formatTimeElapsed(total);
                    
                    channelInfo = `${programTitle} (${elapsedFormatted}/${totalFormatted})`;

                    if (nextProgram) {
                        const nextStartTime = this.formatTime(nextProgram.start);
                        const nextTitle = this.formatProgramTitle(nextProgram);
                        channelInfo += `\n*Up Next:* (${nextStartTime}) ${nextTitle}`;
                    }
                } else {
                    channelInfo = `${programs.length} programs scheduled`;
                }

                // Ensure field values don't exceed Discord's 1024 character limit
                const fieldName = `#${channelData.number} ${channelData.name}`;
                const fieldValue = channelInfo.length > 1024 ? channelInfo.substring(0, 1021) + '...' : channelInfo;
                
                embed.addFields({
                    name: fieldName.length > 256 ? fieldName.substring(0, 253) + '...' : fieldName,
                    value: fieldValue || 'No information available',
                    inline: false
                });
            }

            // Set a rotating thumbnail from channels with icons (for visual appeal)
            const channelsWithIcons = channelsToShow.filter(c => c.icon && c.icon.path);
            if (channelsWithIcons.length > 0) {
                const randomChannel = channelsWithIcons[Math.floor(Math.random() * channelsWithIcons.length)];
                embed.setThumbnail(randomChannel.icon.path);
            }

            const totalChannels = channelsData.length;
            const showingChannels = channelsToShow.length;
            
            if (totalChannels > showingChannels) {
                embed.setFooter({ 
                    text: config.behavior.guideFooterPartial?.replace('{showing}', showingChannels).replace('{total}', totalChannels) ||
                          `Showing ${showingChannels} of ${totalChannels} channels`
                });
            } else {
                embed.setFooter({ 
                    text: config.behavior.guideFooterAll?.replace('{total}', totalChannels) ||
                          `All ${totalChannels} channels`
                });
            }

            await interaction.editReply({ embeds: [embed] });
        } catch (error) {
            await this.logger.error('Enhanced guide command error', error);
            await interaction.editReply('❌ Failed to fetch TV guide. Please check if Tunarr is running.');
        }
    }

    // ---- GUIDE COMPACT VIEW (ALL CHANNELS LIST) ----
    async handleGuideCompactView(interaction) {
        await interaction.deferReply({ 
            flags: config.permissions.ephemeralResponses ? 64 : 0 
        });

        try {
            // Use simpler API call for just channels (faster)
            const response = await axios.get(`${config.tunarr.baseUrl}/api/channels`, {
                timeout: 5000 // 5 second timeout
            });
            const channelsData = response.data;
            
            if (!channelsData || channelsData.length === 0) {
                await interaction.editReply('❌ No channels found.');
                return;
            }

            const embed = new EmbedBuilder()
                .setTitle('📺 Tunarr Channel List')
                .setDescription('💡 **Use `/guide [page]` for detailed view with program info**\n💡 **Example: `/guide 1` shows what\'s playing on channels 1-25**')
                .setColor(config.behavior.colors.info)
                .setTimestamp();

            const totalChannels = channelsData.length;
            const channelsPerPage = 25;
            const totalPages = Math.ceil(totalChannels / channelsPerPage);

            // Group channels by page and create sections
            for (let page = 1; page <= totalPages; page++) {
                const startIndex = (page - 1) * channelsPerPage;
                const endIndex = Math.min(startIndex + channelsPerPage, totalChannels);
                const pageChannels = channelsData.slice(startIndex, endIndex);
                
                let channelList = '';
                for (const channel of pageChannels) {
                    channelList += `**${channel.number}** ${channel.name}\n`;
                }
                
                // Remove trailing newline
                channelList = channelList.trim();
                
                embed.addFields({
                    name: `Page ${page} Channels (${startIndex + 1}-${endIndex}) [use /guide ${page} to see what's playing]`,
                    value: channelList || 'No channels',
                    inline: false
                });
            }

            embed.setFooter({ 
                text: `${totalChannels} total channels across ${totalPages} pages`
            });

            // Set a rotating thumbnail from channels with icons
            const channelsWithIcons = channelsData.filter(c => c.icon && c.icon.path);
            if (channelsWithIcons.length > 0) {
                const randomChannel = channelsWithIcons[Math.floor(Math.random() * channelsWithIcons.length)];
                embed.setThumbnail(randomChannel.icon.path);
            }

            await interaction.editReply({ embeds: [embed] });
        } catch (error) {
            await this.logger.error('Compact guide command error', error);
            if (interaction.deferred && !interaction.replied) {
                try {
                    await interaction.editReply('❌ Failed to fetch channel list. Please check if Tunarr is running.');
                } catch (replyError) {
                    await this.logger.error('Failed to send error reply', replyError);
                }
            }
        }
    }

    // ---- GUIDE PAGED VIEW (DETAILED 25 CHANNELS PER PAGE) ----
    async handleGuidePagedView(interaction, pageInput) {
        await interaction.deferReply({
            flags: config.permissions.ephemeralResponses ? 64 : 0
        });

        try {
            const page = parseInt(pageInput);
            if (isNaN(page) || page < 1) {
                await interaction.editReply('❌ Invalid page number. Please use a number like `/guide 1`, `/guide 2`, etc.');
                return;
            }

            // Use new Tunarr 1.1.6+ guide API with date parameters
            const now = new Date();
            const dateFrom = new Date(now.getTime() - 60 * 60 * 1000).toISOString(); // 1 hour ago
            const dateTo = new Date(now.getTime() + 2 * 60 * 60 * 1000).toISOString(); // 2 hours from now

            const response = await axios.get(`${config.tunarr.baseUrl}/api/guide/channels`, {
                params: { dateFrom, dateTo }
            });
            const channelsObject = response.data;

            // Convert object to array of channels
            const channelsData = Object.values(channelsObject);

            if (!channelsData || channelsData.length === 0) {
                await interaction.editReply('❌ No channels found.');
                return;
            }

            const channelsPerPage = 25;
            const totalChannels = channelsData.length;
            const totalPages = Math.ceil(totalChannels / channelsPerPage);
            
            if (page > totalPages) {
                await interaction.editReply(`Page ${page} doesn't exist. There are only ${totalPages} pages of channels.`);
                return;
            }

            const startIndex = (page - 1) * channelsPerPage;
            const endIndex = Math.min(startIndex + channelsPerPage, totalChannels);
            const channelsToShow = channelsData.slice(startIndex, endIndex);

            const embed = new EmbedBuilder()
                .setTitle(`📺 Tunarr TV Guide - Page ${page}/${totalPages}`)
                .setDescription(`📊 **Showing channels ${startIndex + 1}-${endIndex} of ${totalChannels}**\n💡 **Use \`/guide\` for compact list | \`/guide [page]\` for other pages**`)
                .setColor(config.behavior.colors.info)
                .setTimestamp();

            const nowMs = Date.now();
            
            for (const channelData of channelsToShow) {
                const programs = channelData.programs || [];
                let channelInfo = '';
                
                let currentProgram = null;
                let nextProgram = null;
                
                for (let i = 0; i < programs.length; i++) {
                    const program = programs[i];

                    if (program.start && program.stop) {
                        const startTime = program.start;
                        const stopTime = program.stop;

                        if (nowMs >= startTime && nowMs < stopTime) {
                            currentProgram = program;
                            nextProgram = programs[i + 1] || null;
                            break;
                        }
                    }
                }

                if (currentProgram) {
                    const elapsed = nowMs - currentProgram.start;
                    const total = currentProgram.stop - currentProgram.start;
                    const programTitle = this.formatProgramTitle(currentProgram);
                    
                    const elapsedFormatted = this.formatTimeElapsed(elapsed);
                    const totalFormatted = this.formatTimeElapsed(total);
                    
                    channelInfo = `${programTitle} (${elapsedFormatted}/${totalFormatted})`;

                    if (nextProgram) {
                        const nextStartTime = this.formatTime(nextProgram.start);
                        const nextTitle = this.formatProgramTitle(nextProgram);
                        channelInfo += `\n*Up Next:* (${nextStartTime}) ${nextTitle}`;
                    }
                } else {
                    channelInfo = `${programs.length} programs scheduled`;
                }

                // Ensure field values don't exceed Discord's 1024 character limit
                const fieldName = `#${channelData.number} ${channelData.name}`;
                const fieldValue = channelInfo.length > 1024 ? channelInfo.substring(0, 1021) + '...' : channelInfo;
                
                embed.addFields({
                    name: fieldName.length > 256 ? fieldName.substring(0, 253) + '...' : fieldName,
                    value: fieldValue || 'No information available',
                    inline: false
                });
            }

            // Set a rotating thumbnail from channels with icons
            const channelsWithIcons = channelsToShow.filter(c => c.icon && c.icon.path);
            if (channelsWithIcons.length > 0) {
                const randomChannel = channelsWithIcons[Math.floor(Math.random() * channelsWithIcons.length)];
                embed.setThumbnail(randomChannel.icon.path);
            }

            embed.setFooter({ 
                text: `Page ${page}/${totalPages} | ${channelsToShow.length} channels shown | Total: ${totalChannels} channels`
            });

            await interaction.editReply({ embeds: [embed] });
        } catch (error) {
            await this.logger.error('Paged guide command error', error);
            if (interaction.deferred && !interaction.replied) {
                try {
                    await interaction.editReply('❌ Failed to fetch TV guide. Please check if Tunarr is running.');
                } catch (replyError) {
                    await this.logger.error('Failed to send error reply', replyError);
                }
            }
        }
    }

    // ---- CHANNEL COMMAND ----
    async handleChannelCommand(interaction) {
        await interaction.deferReply({ 
            flags: config.permissions.ephemeralResponses ? 64 : 0 
        });

        const channelInput = interaction.options.getString('name');
        
        try {
            const channels = await this.fetchChannels();
            const channel = channels.find(c => 
                c.name.toLowerCase().includes(channelInput.toLowerCase()) || 
                c.number.toString() === channelInput
            );

            if (!channel) {
                await interaction.editReply(`❌ Channel "${channelInput}" not found.`);
                return;
            }

            const { current, next } = await this.getCurrentAndNextPrograms(channel.id);
            
            const embed = new EmbedBuilder()
                .setTitle(`📺 ${channel.name} (Channel ${channel.number})`)
                .setColor(config.behavior.colors.info)
                .setTimestamp();

            if (current) {
                embed.setDescription(`🎬 **NOW PLAYING: ${this.formatProgramTitle(current)}**`);

                if (current.summary) {
                    embed.addFields({
                        name: '📊 Summary', 
                        value: current.summary.substring(0, config.behavior.maxSummaryLength), 
                        inline: false 
                    });
                }
                
                const currentDetails = [];
                if (current.rating) currentDetails.push(`**Rating:** ${current.rating}`);
                if (current.date) currentDetails.push(`**Year:** ${new Date(current.date).getFullYear()}`);
                currentDetails.push(`**Duration:** ${this.formatDuration(current.duration)}`);
                currentDetails.push(`**Time Left:** ${current.timeLeft} minutes`);
                
                const startTime = this.formatTime(current.startTime);
                const endTime = this.formatTime(current.endTime);
                currentDetails.push(`**Time:** ${startTime} - ${endTime}`);
                
                embed.addFields({
                    name: '📊 Current Program Details',
                    value: currentDetails.join('\n'),
                    inline: false
                });

                if (next) {
                    const nextStartTime = this.formatTime(next.startTime);
                    embed.addFields({
                        name: `🔜 UP NEXT: ${this.formatProgramTitle(next)}`, 
                        value: `**Starts at:** ${nextStartTime} (in ${next.startsIn} minutes)`, 
                        inline: false 
                    });
                    
                    if (next.summary) {
                        embed.addFields({
                            name: '📊 Next Program Summary', 
                            value: next.summary.substring(0, config.behavior.maxSummaryLength), 
                            inline: false 
                        });
                    }
                    
                    const nextDetails = [];
                    if (next.rating) nextDetails.push(`**Rating:** ${next.rating}`);
                    if (next.date) nextDetails.push(`**Year:** ${new Date(next.date).getFullYear()}`);
                    if (next.duration) nextDetails.push(`**Duration:** ${this.formatDuration(next.duration)}`);
                    
                    if (nextDetails.length > 0) {
                        embed.addFields({
                            name: '📊 Next Program Details', 
                            value: nextDetails.join('\n'), 
                            inline: false 
                        });
                    }
                    
                    // Try to get "Up Next" poster for main image (larger, at bottom)
                    if (config.tmdb?.showNextPoster !== false) { // Default to true
                        const nextYear = next.date ? new Date(next.date).getFullYear() : null;
                        const nextTmdbImage = await this.fetchTMDBImage(this.formatProgramTitle(next), next.type, nextYear, next);
                        if (nextTmdbImage) {
                            embed.setImage(nextTmdbImage);
                            await this.logger.debug(`Using TMDB poster for next program: ${this.formatProgramTitle(next)}`);
                        }
                    }
                }
            } else {
                embed.setDescription(`📊 *Channel has ${channel.programCount} programs*`);
                embed.addFields({
                    name: '📊 Total Duration', 
                    value: this.formatDuration(channel.duration), 
                    inline: true 
                });
            }

            // Try to get movie/show poster from TMDB for current program (thumbnail), fallback to channel icon
            if (current) {
                const programYear = current.date ? new Date(current.date).getFullYear() : null;
                const tmdbImage = await this.fetchTMDBImage(this.formatProgramTitle(current), current.type, programYear, current);
                if (tmdbImage) {
                    embed.setThumbnail(tmdbImage);
                    await this.logger.debug(`Using TMDB poster for: ${this.formatProgramTitle(current)}`);
                } else if (channel.icon && channel.icon.path) {
                    await this.logger.debug(`Using channel icon for ${channel.name}: ${channel.icon.path}`);
                    embed.setThumbnail(channel.icon.path);
                } else {
                    await this.logger.debug(`No thumbnail available for ${channel.name}`);
                }
            } else {
                // No current program, use channel icon if available
                if (channel.icon && channel.icon.path) {
                    await this.logger.debug(`Using channel icon for ${channel.name}: ${channel.icon.path}`);
                    embed.setThumbnail(channel.icon.path);
                }
            }

            await interaction.editReply({ embeds: [embed] });
        } catch (error) {
            await this.logger.error('Channel command error', error);
            await interaction.editReply('❌ Failed to fetch channel information.');
        }
    }

    // ---- CHANGE COMMAND ----
    async handleChangeCommand(interaction) {
        await interaction.deferReply({ 
            flags: config.permissions.ephemeralResponses ? 64 : 0 
        });

        if (!config.features.enableChannelChanging) {
            await interaction.editReply('⚠️ Channel changing is currently disabled.');
            return;
        }

        const channelInput = interaction.options.getString('channel');
        
        try {
            const channels = await this.fetchChannels();
            const channel = channels.find(c => 
                c.name.toLowerCase().includes(channelInput.toLowerCase()) || 
                c.number.toString() === channelInput ||
                c.id === channelInput
            );

            if (!channel) {
                await interaction.editReply(`❌ Channel "${channelInput}" not found.`);
                return;
            }

            const { current, next } = await this.getCurrentAndNextPrograms(channel.id);
            const changeUrl = `${config.tunarr.baseUrl}${config.tunarr.webPath}/${channel.id}/watch?noAutoPlay=false`;
            
            try {
                await axios.post(`${config.channelChanger.url}/change-channel`, {
                    channelId: channel.id,
                    url: changeUrl
                }, { timeout: config.channelChanger.timeout });
                
                // Track the current channel and reset YouTube state
                this.currentChannelId = channel.id;
                this.isOnYouTube = false;
                this.youtubeVideoInfo = null;
                await this.logger.info(`Channel changed to: ${channel.name} (${channel.id})`);
                
                // Create rich embed response (like /channel command)
                const embed = new EmbedBuilder()
                    .setTitle(`✅ Changed to ${channel.name} (Channel ${channel.number})`)
                    .setDescription(`Changed by ${interaction.user.tag}`)
                    .setColor(config.behavior.colors.success || 0x00FF00)
                    .setTimestamp();

                if (current) {
                    embed.setDescription(`🎬 **NOW PLAYING: ${this.formatProgramTitle(current)}**\nChanged by ${interaction.user.tag}`);

                    if (current.summary) {
                        embed.addFields({
                            name: '📊 Summary',
                            value: current.summary.substring(0, config.behavior.maxSummaryLength),
                            inline: false
                        });
                    }

                    const currentDetails = [];
                    if (current.rating) currentDetails.push(`**Rating:** ${current.rating}`);
                    if (current.date) currentDetails.push(`**Year:** ${new Date(current.date).getFullYear()}`);
                    currentDetails.push(`**Duration:** ${this.formatDuration(current.duration)}`);
                    currentDetails.push(`**Time Left:** ${current.timeLeft} minutes`);

                    const startTime = this.formatTime(current.startTime);
                    const endTime = this.formatTime(current.endTime);
                    currentDetails.push(`**Time:** ${startTime} - ${endTime}`);

                    embed.addFields({
                        name: '📊 Current Program Details',
                        value: currentDetails.join('\n'),
                        inline: false
                    });

                    if (next) {
                        const nextStartTime = this.formatTime(next.startTime);
                        embed.addFields({
                            name: `🔜 UP NEXT: ${this.formatProgramTitle(next)}`,
                            value: `**Starts at:** ${nextStartTime} (in ${next.startsIn} minutes)`,
                            inline: false
                        });

                        if (next.summary) {
                            embed.addFields({
                                name: '📊 Next Program Summary',
                                value: next.summary.substring(0, config.behavior.maxSummaryLength),
                                inline: false
                            });
                        }

                        const nextDetails = [];
                        if (next.rating) nextDetails.push(`**Rating:** ${next.rating}`);
                        if (next.date) nextDetails.push(`**Year:** ${new Date(next.date).getFullYear()}`);
                        if (next.duration) nextDetails.push(`**Duration:** ${this.formatDuration(next.duration)}`);

                        if (nextDetails.length > 0) {
                            embed.addFields({
                                name: '📊 Next Program Details',
                                value: nextDetails.join('\n'),
                                inline: false
                            });
                        }

                        // Try to get "Up Next" poster for main image
                        if (config.tmdb?.showNextPoster !== false) {
                            const nextYear = next.date ? new Date(next.date).getFullYear() : null;
                            const nextTmdbImage = await this.fetchTMDBImage(this.formatProgramTitle(next), next.type, nextYear, next);
                            if (nextTmdbImage) {
                                embed.setImage(nextTmdbImage);
                            }
                        }
                    }
                } else {
                    embed.setDescription(`📊 Channel has ${channel.programCount} programs\nChanged by ${interaction.user.tag}`);
                    embed.addFields({
                        name: '📊 Total Duration',
                        value: this.formatDuration(channel.duration),
                        inline: true
                    });
                }

                // Try to get current program poster for thumbnail
                if (current) {
                    const programYear = current.date ? new Date(current.date).getFullYear() : null;
                    const tmdbImage = await this.fetchTMDBImage(this.formatProgramTitle(current), current.type, programYear, current);
                    if (tmdbImage) {
                        embed.setThumbnail(tmdbImage);
                    } else if (channel.icon && channel.icon.path) {
                        embed.setThumbnail(channel.icon.path);
                    }
                } else {
                    if (channel.icon && channel.icon.path) {
                        embed.setThumbnail(channel.icon.path);
                    }
                }

                await interaction.editReply({ embeds: [embed] });

                // Post channel change announcement
                await this.postChannelChangeAnnouncement(channel, interaction.user, current, next);

                // Update announcement tracking for this new program
                if (current) {
                    this.lastAnnouncedProgramId = current.id || current.uniqueId;
                    this.lastAnnouncedProgramTitle = this.formatProgramTitle(current);
                }
            } catch (automationError) {
                await this.logger.error('Channel change automation failed', automationError);
                
                // Provide specific error messages based on error type
                let errorMessage = `❌ Found channel **${channel.name}**, but failed to change it automatically.`;

                if (automationError.code === 'ECONNREFUSED') {
                    errorMessage += `\n⚠️ **Channel Changer service not running.** Please start the service and try again.`;
                } else if (automationError.code === 'ETIMEDOUT') {
                    errorMessage += `\n⚠️ **Request timed out.** The service may be busy - try again in a moment.`;
                } else if (automationError.response && automationError.response.status >= 500) {
                    errorMessage += `\n⚠️ **Service error.** The channel changer encountered an internal error.`;
                } else {
                    errorMessage += `\n❌ **Error:** ${automationError.message}`;
                }

                errorMessage += `\n\n🔗 **Manual URL:** \`${changeUrl}\``;
                
                await interaction.editReply(errorMessage);
            }

        } catch (error) {
            await this.logger.error('Change command error', error);
            await interaction.editReply('❌ Failed to process channel change request.');
        }
    }

    // ---- YOUTUBE COMMAND ----
    async handleYouTubeCommand(interaction) {
        await interaction.deferReply({ 
            flags: config.permissions.ephemeralResponses ? 64 : 0 
        });

        if (!config.features.enableYouTubeIntegration) {
            await interaction.editReply('⚠️ YouTube integration is currently disabled.');
            return;
        }

        const youtubeUrl = interaction.options.getString('url');
        
        // Validate YouTube URL
        if (!this.isValidYouTubeUrl(youtubeUrl)) {
            const errorMessage = config.behavior.messages?.invalidYouTubeUrl || 
                'Invalid YouTube URL. Please use a valid YouTube link.';
            await interaction.editReply(errorMessage);
            return;
        }

        try {
            // Send YouTube navigation request
            await axios.post(`${config.channelChanger.url}/navigate-youtube`, {
                url: youtubeUrl
            }, { timeout: config.channelChanger.timeout });
            
            // Update bot state
            this.currentChannelId = null; // Clear current channel
            this.isOnYouTube = true;
            
            // Wait a moment for video info to be extracted
            await new Promise(resolve => setTimeout(resolve, 3000));
            
            // Try to get video info
            const videoInfo = await this.fetchYouTubeVideoInfo();
            
            let responseMessage = `✅ **YouTube Video Loaded!**`;

            if (videoInfo && videoInfo.title) {
                responseMessage += `\n🎬 **${videoInfo.title}**`;
                if (videoInfo.channel) {
                    responseMessage += `\n👤 Channel: **${videoInfo.channel}**`;
                }
                if (videoInfo.video && videoInfo.video.duration) {
                    const duration = this.formatYouTubeDuration(videoInfo.video.duration);
                    responseMessage += `\n⏱️ Duration: **${duration}**`;
                }
            } else {
                responseMessage += `\n🔗 URL: ${youtubeUrl}`;
            }

            responseMessage += `\n\n📺 Video should now be playing in fullscreen on the stream!`;
            responseMessage += `\n💡 Use \`/youtube-subtitles toggle\` to control captions`;
            
            await interaction.editReply(responseMessage);
            
        } catch (error) {
            await this.logger.error('YouTube command error', error);
            const errorMessage = config.behavior.messages?.youTubeNavigationFailed ||
                '❌ Failed to navigate to YouTube video.';
            await interaction.editReply(`${errorMessage} Error: ${error.message}`);
        }
    }

    // ---- YOUTUBE SUBTITLES COMMAND ----    
    async handleYouTubeSubtitlesCommand(interaction) {
        await interaction.deferReply({ 
            flags: config.permissions.ephemeralResponses ? 64 : 0 
        });

        if (!config.features.enableYouTubeIntegration) {
            await interaction.editReply('⚠️ YouTube integration is currently disabled.');
            return;
        }

        const action = interaction.options.getString('action');
        
        try {
            // Check if we're currently on YouTube
            const youtubeInfo = await this.fetchYouTubeVideoInfo();
            
            if (!this.isOnYouTube || !youtubeInfo) {
                await interaction.editReply('⚠️ **Not currently watching a YouTube video!**\n\n💡 Use `/youtube [URL]` to play a video first.');
                return;
            }

            // Send subtitle control request to Channel Changer
            const response = await axios.post(`${config.channelChanger.url}/youtube-subtitles`, {
                action: action
            }, { timeout: config.channelChanger.timeout });

            if (response.data.success) {
                let responseMessage = '';
                const data = response.data;
                
                switch (action) {
                    case 'on':
                        responseMessage = `🔊 **Subtitles Enabled!**\n\n`;
                        if (data.wasAlreadyOn) {
                            responseMessage += `✅ Subtitles were already enabled`;
                        } else {
                            responseMessage += `✅ Subtitles have been turned on`;
                        }
                        if (data.method) {
                            responseMessage += `\nMethod used: ${data.method}`;
                        }
                        break;

                    case 'off':
                        responseMessage = `🔇 **Subtitles Disabled!**\n\n`;
                        if (data.wasAlreadyOff) {
                            responseMessage += `✅ Subtitles were already disabled`;
                        } else {
                            responseMessage += `✅ Subtitles have been turned off`;
                        }
                        if (data.method) {
                            responseMessage += `\nMethod used: ${data.method}`;
                        }
                        break;

                    case 'toggle':
                        responseMessage = `🔄 **Subtitles Toggled!**\n\n`;
                        if (data.currentState === 'enabled') {
                            responseMessage += `🔊 Subtitles are now **ON**`;
                        } else {
                            responseMessage += `🔇 Subtitles are now **OFF**`;
                        }
                        if (data.method) {
                            responseMessage += `\nMethod used: ${data.method}`;
                        }
                        break;

                    case 'status':
                        responseMessage = `📊 **Subtitle Status**\n\n`;
                        const state = data.currentState || 'unknown';
                        const isVisible = data.actuallyVisible ? 'Visible on screen' : 'Not visible';
                        responseMessage += `Current State: **${state.toUpperCase()}**\n`;
                        responseMessage += `Actually Visible: ${isVisible}\n`;
                        if (data.availableLanguages && data.availableLanguages.length > 0) {
                            responseMessage += `Available Languages: ${data.availableLanguages.join(', ')}`;
                        } else {
                            responseMessage += `Available Languages: Auto-detect`;
                        }
                        if (data.method) {
                            responseMessage += `\nDetection method: ${data.method}`;
                        }
                        break;

                    case 'reset':
                        responseMessage = `✅ **Session Preferences Reset!**\n\n`;
                        responseMessage += `🔄 Subtitle preferences cleared - using config defaults for future videos`;
                        break;
                }
                
                // Add video context
                if (youtubeInfo && youtubeInfo.title) {
                    responseMessage += `\n\n🎬 **Video:** ${youtubeInfo.title}`;
                    if (youtubeInfo.channel) {
                        responseMessage += `\n👤 **Channel:** ${youtubeInfo.channel}`;
                    }
                }
                
                await interaction.editReply(responseMessage);
                
            } else {
                let errorMessage = `❌ **Subtitle control failed:** ${response.data.error || 'Unknown error'}`;
                if (response.data.fallbackAttempted) {
                    errorMessage += `\n⚠️ Fallback methods were attempted but also failed.`;
                }
                await interaction.editReply(errorMessage);
            }
            
        } catch (error) {
            await this.logger.error('YouTube subtitles command error', error);
            
            if (error.code === 'ECONNREFUSED') {
                await interaction.editReply('❌ **Channel Changer service not responding.** Make sure TunarrBot services are running.');
            } else if (error.response && error.response.status === 500) {
                await interaction.editReply('⚠️ **Browser may be frozen.** Try `/fix-browser` to recover, then retry subtitle control.');
            } else {
                await interaction.editReply(`**Error controlling subtitles:** ${error.message}\nTry \`/fix-browser\` if the browser seems unresponsive.`);
            }
        }
    }

    // ---- NEW: FIX BROWSER COMMAND ----
    async handleFixBrowserCommand(interaction) {
        await interaction.deferReply({ 
            flags: config.permissions.ephemeralResponses ? 64 : 0 
        });

        if (!config.features.enableYouTubeIntegration) {
            await interaction.editReply('⚠️ Browser automation is currently disabled.');
            return;
        }

        const method = interaction.options.getString('method') || 'auto';
        
        try {
            // First check browser health
            const healthCheck = await this.checkBrowserHealth();
            
            let responseMessage = `🔧 **Browser Recovery Initiated**\n\n`;
            responseMessage += `📊 **Health Check:**\n`;
            responseMessage += `- Responsive: ${healthCheck.responsive ? '✅ Yes' : '❌ No'}\n`;
            responseMessage += `- Healthy: ${healthCheck.healthy ? '✅ Yes' : '❌ No'}\n`;

            if (healthCheck.healthy && healthCheck.responsive) {
                responseMessage += `\n✅ **Browser appears to be working normally!**\n`;
                responseMessage += `💡 If you're still experiencing issues, try a different recovery method.`;
                await interaction.editReply(responseMessage);
                return;
            }

            responseMessage += `\n🔧 **Attempting recovery using method: ${method}**\n`;

            // Attempt recovery
            const recoveryResult = await this.attemptBrowserRecovery(method);

            if (recoveryResult.success) {
                responseMessage += `\n✅ **Recovery Successful!**\n`;
                responseMessage += `📋 **Actions taken:**\n`;
                if (recoveryResult.actionsPerformed) {
                    recoveryResult.actionsPerformed.forEach(action => {
                        responseMessage += `- ${action}\n`;
                    });
                }

                responseMessage += `\n✅ **Browser should now be responsive!**`;
                if (recoveryResult.recommendation) {
                    responseMessage += `\n💡 **Recommendation:** ${recoveryResult.recommendation}`;
                }
            } else {
                responseMessage += `\n❌ **Recovery Failed**\n`;
                responseMessage += `⚠️ **Error:** ${recoveryResult.error}\n\n`;
                responseMessage += `💡 **Manual steps to try:**\n`;
                responseMessage += `1. Look at the Chrome browser window\n`;
                responseMessage += `2. Try clicking on the window to focus it\n`;
                responseMessage += `3. Try resizing the window by dragging corners\n`;
                responseMessage += `4. Use \`/fix-browser restart\` for a fresh browser instance\n`;
                responseMessage += `5. Restart the channel-changer service if all else fails`;
            }
            
            await interaction.editReply(responseMessage);
            
        } catch (error) {
            await this.logger.error('Fix browser command error', error);
            
            let errorMessage = `❌ **Browser recovery failed:**\n`;
            if (error.code === 'ECONNREFUSED') {
                errorMessage += `⚠️ **Channel Changer service not responding.**\n\n`;
                errorMessage += `💡 **Steps to resolve:**\n`;
                errorMessage += `1. Check if the channel-changer service is running\n`;
                errorMessage += `2. Restart the service if needed\n`;
                errorMessage += `3. Verify the service URL in config.js`;
            } else {
                errorMessage += `⚠️ **${error.message}**\n\n`;
                errorMessage += `💡 Try restarting the channel-changer service manually.`;
            }
            
            await interaction.editReply(errorMessage);
        }
    }

    // ---- NEW: BROWSER HEALTH COMMAND ----
    async handleBrowserHealthCommand(interaction) {
        await interaction.deferReply({ 
            flags: config.permissions.ephemeralResponses ? 64 : 0 
        });

        if (!config.features.enableYouTubeIntegration) {
            await interaction.editReply('⚠️ Browser automation is currently disabled.');
            return;
        }

        try {
            const healthData = await this.checkBrowserHealth();
            
            const embed = new EmbedBuilder()
                .setTitle('📊 Browser Health Report')
                .setColor(healthData.healthy ? config.behavior.colors.success : config.behavior.colors.error)
                .setTimestamp();

            let description = `**Overall Status: ${healthData.healthy ? '✅ Healthy' : '❌ Unhealthy'}**\n\n`;

            // Basic health indicators
            const indicators = [
                `**Responsive:** ${healthData.responsive ? '✅ Yes' : '❌ No'}`,
                `**Connected:** ${healthData.connected !== false ? '✅ Yes' : '❌ No'}`,
                `**Page Loaded:** ${healthData.pageLoaded !== false ? '✅ Yes' : '❌ No'}`
            ];

            description += indicators.join('\n');
            embed.setDescription(description);

            // Browser details if available
            if (healthData.browserInfo) {
                const browserDetails = [];
                if (healthData.browserInfo.version) browserDetails.push(`**Version:** ${healthData.browserInfo.version}`);
                if (healthData.browserInfo.userAgent) browserDetails.push(`**User Agent:** ${healthData.browserInfo.userAgent.substring(0, 50)}...`);
                if (healthData.browserInfo.viewport) browserDetails.push(`**Viewport:** ${healthData.browserInfo.viewport.width}x${healthData.browserInfo.viewport.height}`);
                
                if (browserDetails.length > 0) {
                    embed.addFields({
                        name: '🌐 Browser Information',
                        value: browserDetails.join('\n'),
                        inline: false
                    });
                }
            }

            // Current page info
            if (healthData.currentPage) {
                const pageDetails = [];
                if (healthData.currentPage.url) pageDetails.push(`🔗 **URL:** ${healthData.currentPage.url.substring(0, 100)}...`);
                if (healthData.currentPage.title) pageDetails.push(`📄 **Title:** ${healthData.currentPage.title}`);
                if (healthData.currentPage.isYouTube !== undefined) pageDetails.push(`📺 **YouTube:** ${healthData.currentPage.isYouTube ? 'Yes' : 'No'}`);

                if (pageDetails.length > 0) {
                    embed.addFields({
                        name: '📄 Current Page',
                        value: pageDetails.join('\n'),
                        inline: false
                    });
                }
            }

            // Performance metrics if available
            if (healthData.performance) {
                const perfDetails = [];
                if (healthData.performance.responseTime) perfDetails.push(`⚡ **Response Time:** ${healthData.performance.responseTime}ms`);
                if (healthData.performance.memoryUsage) perfDetails.push(`💾 **Memory Usage:** ${healthData.performance.memoryUsage}MB`);
                if (healthData.performance.lastActivity) perfDetails.push(`🕐 **Last Activity:** ${new Date(healthData.performance.lastActivity).toLocaleString()}`);

                if (perfDetails.length > 0) {
                    embed.addFields({
                        name: '⚡ Performance Metrics',
                        value: perfDetails.join('\n'),
                        inline: false
                    });
                }
            }

            // Issues and recommendations
            if (healthData.issues && healthData.issues.length > 0) {
                embed.addFields({
                    name: '⚠️ Detected Issues',
                    value: healthData.issues.map(issue => `• ${issue}`).join('\n'),
                    inline: false
                });
            }

            if (healthData.recommendations && healthData.recommendations.length > 0) {
                embed.addFields({
                    name: '💡 Recommendations',
                    value: healthData.recommendations.map(rec => `• ${rec}`).join('\n'),
                    inline: false
                });
            }

            // Error details if unhealthy
            if (!healthData.healthy && healthData.error) {
                embed.addFields({
                    name: '❌ Error Details',
                    value: healthData.error,
                    inline: false
                });
            }

            // Add action buttons context
            let footerText = '💡 Use /fix-browser if issues detected';
            if (!healthData.healthy) {
                footerText = '⚠️ Browser needs attention - use /fix-browser to recover';
            }
            embed.setFooter({ text: footerText });

            await interaction.editReply({ embeds: [embed] });

        } catch (error) {
            await this.logger.error('Browser health command error', error);

            const embed = new EmbedBuilder()
                .setTitle('❌ Browser Health Report')
                .setDescription('⚠️ **Unable to check browser health**')
                .setColor(config.behavior.colors.error)
                .addFields({
                    name: '❌ Connection Error',
                    value: error.code === 'ECONNREFUSED' ?
                        'Channel Changer service is not responding. Make sure it\'s running.' :
                        `Error: ${error.message}`,
                    inline: false
                })
                .setFooter({ text: 'Check channel-changer service status' })
                .setTimestamp();

            await interaction.editReply({ embeds: [embed] });
        }
    }

    // ---- YOUTUBE LOGIN COMMAND ----
    async handleYouTubeLoginCommand(interaction) {
        await interaction.deferReply({ 
            flags: config.permissions.ephemeralResponses ? 64 : 0 
        });

        if (!config.features.enableYouTubeIntegration) {
            await interaction.editReply('⚠️ YouTube integration is currently disabled.');
            return;
        }

        try {
            // Send YouTube login navigation request
            await axios.post(`${config.channelChanger.url}/youtube-login`, {}, { 
                timeout: config.channelChanger.timeout 
            });
            
            let responseMessage = `✅ **YouTube Login Page Loaded!**\n\n`;
            responseMessage += `📋 **Instructions:**\n`;
            responseMessage += `1. Look at the Chrome browser window\n`;
            responseMessage += `2. Manually log in to your YouTube Premium account\n`;
            responseMessage += `3. Complete any 2FA if required\n`;
            responseMessage += `4. Your login will be saved automatically\n`;
            responseMessage += `5. Use \`/youtube [URL]\` commands normally after login\n\n`;
            responseMessage += `✨ **Benefits after login:**\n`;
            responseMessage += `- No ads during video playback\n`;
            responseMessage += `- Access to premium features\n`;
            responseMessage += `- Better video quality options\n\n`;
            responseMessage += `💡 **Note:** Login is saved between sessions!`;

            await interaction.editReply(responseMessage);

        } catch (error) {
            await this.logger.error('YouTube login command error', error);
            await interaction.editReply(`❌ Failed to load YouTube login page. Error: ${error.message}`);
        }
    }

    // ---- PERMISSIONS COMMAND ----
    async handlePermissionsCommand(interaction) {
        const hasAccess = this.hasPermission(interaction);
        const userRoles = interaction.member.roles.cache.map(role => role.name).join(', ') || 'None';
        
        const embed = new EmbedBuilder()
            .setTitle('⚙️ Bot Permissions & Settings')
            .setColor(hasAccess ? config.behavior.colors.success : config.behavior.colors.error)
            .addFields(
                { name: '🔐 Your Access', value: hasAccess ? '✅ Allowed' : '❌ Denied', inline: true },
                { name: '📺 Current Channel', value: `#${interaction.channel.name}`, inline: true },
                { name: '👁️ Responses', value: config.permissions.ephemeralResponses ? 'Private' : 'Public', inline: true },
                { name: '👤 Your Roles', value: userRoles, inline: false },
                { name: '📺 Allowed Channels', value: config.permissions.allowedChannels.length > 0 ? config.permissions.allowedChannels.join(', ') : 'Any', inline: true },
                { name: '👥 Required Roles', value: config.permissions.allowedRoles.length > 0 ? config.permissions.allowedRoles.join(', ') : 'None', inline: true },
                { name: '✅ Whitelisted Users', value: config.permissions.allowedUsers.length > 0 ? `${config.permissions.allowedUsers.length} users` : 'None', inline: true },
                { name: '⚙️ Features', value: `📺 Channel Changing: ${config.features.enableChannelChanging ? '✅ Enabled' : '❌ Disabled'}\n🎬 YouTube: ${config.features.enableYouTubeIntegration ? '✅ Enabled' : '❌ Disabled'}\n🔧 Browser Recovery: ${config.features.enableYouTubeIntegration ? '✅ Enabled' : '❌ Disabled'}`, inline: false }
            );

        await interaction.reply({ 
            embeds: [embed], 
            flags: 64 // Always ephemeral for permissions
        });
    }

    // ---- CURRENT COMMAND ----
    async handleCurrentCommand(interaction) {
        await this.logger.debug('handleCurrentCommand called');

        try {
            await interaction.deferReply({
                flags: config.permissions.ephemeralResponses ? 64 : 0
            });
            await this.logger.debug('Deferred reply sent');

            // Check if we're currently on YouTube
            const youtubeInfo = await this.fetchYouTubeVideoInfo();

            if (this.isOnYouTube && youtubeInfo) {
                await this.logger.debug('Currently on YouTube, showing video info');
                
                const embed = new EmbedBuilder()
                    .setTitle('🎬 Currently Watching - YouTube')
                    .setColor(config.behavior.colors.youtube)
                    .setTimestamp();

                let description = `📺 **${youtubeInfo.title || 'Unknown Video'}**`;
                if (youtubeInfo.channel && youtubeInfo.channel !== 'Unknown Channel') {
                    description += `\n👤 **Channel:** ${youtubeInfo.channel}`;
                }

                embed.setDescription(description);

                // Add video details in a clean format
                const videoDetails = [];
                if (youtubeInfo.video) {
                    if (youtubeInfo.video.duration) {
                        const duration = this.formatYouTubeDuration(youtubeInfo.video.duration);
                        videoDetails.push(`**Duration:** ${duration}`);
                    }
                    if (youtubeInfo.video.currentTime !== undefined) {
                        const currentTime = this.formatYouTubeDuration(youtubeInfo.video.currentTime);
                        videoDetails.push(`**Current Time:** ${currentTime}`);
                    }
                    if (youtubeInfo.video.paused !== undefined) {
                        videoDetails.push(`**Status:** ${youtubeInfo.video.paused ? 'Paused' : 'Playing'}`);
                    }
                }

                // Add clean view count and upload date
                if (youtubeInfo.viewCount && !youtubeInfo.viewCount.includes('undefined')) {
                    videoDetails.push(`**Views:** ${youtubeInfo.viewCount}`);
                }
                if (youtubeInfo.uploadDate && youtubeInfo.uploadDate.length < 50) { // Only if reasonable length
                    videoDetails.push(`**Uploaded:** ${youtubeInfo.uploadDate}`);
                }

                if (videoDetails.length > 0) {
                    embed.addFields({
                        name: '📊 Video Details',
                        value: videoDetails.join('\n'),
                        inline: false
                    });
                }

                // Add description if available and clean
                if (youtubeInfo.description && youtubeInfo.description.length > 10 && youtubeInfo.description.length < 200) {
                    embed.addFields({
                        name: '📝 Description',
                        value: youtubeInfo.description,
                        inline: false
                    });
                }

                if (youtubeInfo.url) {
                    embed.addFields({
                        name: '🔗 Video URL',
                        value: youtubeInfo.url,
                        inline: false
                    });
                }

                // Add helpful footer
                embed.setFooter({
                    text: '💡 Use /youtube-subtitles toggle for captions • /fix-browser if unresponsive'
                });

                // Set YouTube logo as thumbnail
                embed.setThumbnail('https://www.youtube.com/s/desktop/12345678/img/favicon_144x144.png');

                await interaction.editReply({ embeds: [embed] });
                return;
            }

            // Not on YouTube, check for regular channel
            if (!this.currentChannelId) {
                await this.logger.debug('No current channel tracked');
                const noChannelMessage = config.behavior.messages?.noCurrentChannel ||
                    '❌ No current channel is being tracked. Use `/change #` to switch to a channel first!';
                await interaction.editReply(noChannelMessage);
                return;
            }

            await this.logger.debug(`Looking for channel ID: ${this.currentChannelId}`);
            const channels = await this.fetchChannels();
            const channel = channels.find(c => c.id === this.currentChannelId);

            if (!channel) {
                await this.logger.debug('Current channel not found in channel list');
                const channelNotFoundMessage = config.behavior.messages?.currentChannelNotFound ||
                    '❌ Current channel not found. It may have been deleted.';
                await interaction.editReply(channelNotFoundMessage);
                return;
            }

            await this.logger.debug(`Found channel: ${channel.name} (${channel.number})`);
            const { current, next } = await this.getCurrentAndNextPrograms(channel.id);

            // Use the same structure as /channel command
            const embed = new EmbedBuilder()
                .setTitle(`📺 ${channel.name} (Channel ${channel.number}) - Currently Watching`)
                .setColor(config.behavior.colors.info)
                .setTimestamp();

            if (current) {
                await this.logger.debug(`Current program: ${current.title}`);
                embed.setDescription(`🎬 **NOW PLAYING: ${this.formatProgramTitle(current)}**`);

                if (current.summary) {
                    embed.addFields({
                        name: '📊 Summary', 
                        value: current.summary.substring(0, config.behavior.maxSummaryLength), 
                        inline: false 
                    });
                }
                
                const currentDetails = [];
                if (current.rating) currentDetails.push(`**Rating:** ${current.rating}`);
                if (current.date) currentDetails.push(`**Year:** ${new Date(current.date).getFullYear()}`);
                currentDetails.push(`**Duration:** ${this.formatDuration(current.duration)}`);
                currentDetails.push(`**Time Left:** ${current.timeLeft} minutes`);
                
                const startTime = this.formatTime(current.startTime);
                const endTime = this.formatTime(current.endTime);
                currentDetails.push(`**Time:** ${startTime} - ${endTime}`);
                
                embed.addFields({
                    name: '📊 Current Program Details',
                    value: currentDetails.join('\n'),
                    inline: false
                });

                if (next) {
                    const nextStartTime = this.formatTime(next.startTime);
                    embed.addFields({
                        name: `🔜 UP NEXT: ${this.formatProgramTitle(next)}`, 
                        value: `**Starts at:** ${nextStartTime} (in ${next.startsIn} minutes)`, 
                        inline: false 
                    });
                    
                    if (next.summary) {
                        embed.addFields({
                            name: '📊 Next Program Summary', 
                            value: next.summary.substring(0, config.behavior.maxSummaryLength), 
                            inline: false 
                        });
                    }
                    
                    const nextDetails = [];
                    if (next.rating) nextDetails.push(`**Rating:** ${next.rating}`);
                    if (next.date) nextDetails.push(`**Year:** ${new Date(next.date).getFullYear()}`);
                    if (next.duration) nextDetails.push(`**Duration:** ${this.formatDuration(next.duration)}`);
                    
                    if (nextDetails.length > 0) {
                        embed.addFields({
                            name: '📊 Next Program Details', 
                            value: nextDetails.join('\n'), 
                            inline: false 
                        });
                    }
                    
                    // Try to get "Up Next" poster for main image (larger, at bottom)
                    if (config.tmdb?.showNextPoster !== false) { // Default to true
                        const nextYear = next.date ? new Date(next.date).getFullYear() : null;
                        const nextTmdbImage = await this.fetchTMDBImage(this.formatProgramTitle(next), next.type, nextYear, next);
                        if (nextTmdbImage) {
                            embed.setImage(nextTmdbImage);
                            await this.logger.debug(`Using TMDB poster for next program: ${this.formatProgramTitle(next)}`);
                        }
                    }
                }
            } else {
                await this.logger.debug('No current program found');
                embed.setDescription(`📊 *Channel has ${channel.programCount} programs*`);
                embed.addFields({
                    name: '📊 Total Duration',
                    value: this.formatDuration(channel.duration),
                    inline: true
                });
            }

            // Try to get movie/show poster from TMDB for current program (thumbnail), fallback to channel icon
            if (current) {
                const programYear = current.date ? new Date(current.date).getFullYear() : null;
                const tmdbImage = await this.fetchTMDBImage(this.formatProgramTitle(current), current.type, programYear, current);
                if (tmdbImage) {
                    embed.setThumbnail(tmdbImage);
                    await this.logger.debug(`Using TMDB poster for: ${this.formatProgramTitle(current)}`);
                } else if (channel.icon && channel.icon.path) {
                    await this.logger.debug(`Using channel icon for ${channel.name}: ${channel.icon.path}`);
                    embed.setThumbnail(channel.icon.path);
                } else {
                    await this.logger.debug(`No thumbnail available for ${channel.name}`);
                }
            } else {
                // No current program, use channel icon if available
                if (channel.icon && channel.icon.path) {
                    await this.logger.debug(`Using channel icon for ${channel.name}: ${channel.icon.path}`);
                    embed.setThumbnail(channel.icon.path);
                }
            }

            await this.logger.debug('Sending embed response');
            await interaction.editReply({ embeds: [embed] });
            await this.logger.debug('Response sent successfully');
            
        } catch (error) {
            await this.logger.error('Current command error', error);
            const errorMessage = config.behavior.messages?.currentCommandError ||
                '❌ Failed to fetch current channel information.';

            try {
                await interaction.editReply(errorMessage);
            } catch (replyError) {
                await this.logger.error('Failed to send error message', replyError);
            }
        }
    }

    // ---- SET CURRENT COMMAND (DEBUG) ----
    async handleSetCurrentCommand(interaction) {
        try {
            await interaction.deferReply({ 
                flags: config.permissions.ephemeralResponses ? 64 : 0 
            });

            const channelInput = interaction.options.getString('channel');
            const channels = await this.fetchChannels();
            
            const channel = channels.find(c => 
                c.name.toLowerCase().includes(channelInput.toLowerCase()) || 
                c.number.toString() === channelInput ||
                c.id === channelInput
            );

            if (!channel) {
                await interaction.editReply(`❌ Channel "${channelInput}" not found.`);
                return;
            }

            this.currentChannelId = channel.id;
            this.isOnYouTube = false;
            this.youtubeVideoInfo = null;
            await this.logger.info(`Manually set current channel to: ${channel.name} (${channel.id})`);

            await interaction.editReply(`Set current channel to **${channel.name}** (Channel ${channel.number})\nNow you can use \`/current\` to see what's playing!`);

        } catch (error) {
            await this.logger.error('Set-current command error', error);
            await interaction.editReply('❌ Failed to set current channel.');
        }
    }

    // ========================================================================
    // ANNOUNCEMENT SYSTEM
    // ========================================================================
    startAnnouncementMonitoring() {
        this.logger.info(`Starting announcement monitoring (interval: ${config.announcements.checkInterval}ms)`);

        // Check immediately on startup if we have a current channel
        if (this.currentChannelId) {
            this.checkForProgramChange();
        }

        // Then check at regular intervals
        this.announcementInterval = setInterval(async () => {
            if (this.currentChannelId && !this.isOnYouTube) {
                await this.checkForProgramChange();
            }
        }, config.announcements.checkInterval);
    }

    async checkForProgramChange() {
        try {
            await this.logger.debug(`Checking for program change on channel ${this.currentChannelId}`);
            const { current } = await this.getCurrentAndNextPrograms(this.currentChannelId);

            if (!current) {
                await this.logger.debug('No current program found during monitor check');
                return;
            }

            // Use unique ID if available, otherwise use title
            const programId = current.id || current.uniqueId;
            const programTitle = this.formatProgramTitle(current);

            await this.logger.debug(`Current: "${programTitle}" (ID: ${programId}) | Last: "${this.lastAnnouncedProgramTitle}" (ID: ${this.lastAnnouncedProgramId})`);

            // Check if this is a different program than last announced
            // Use OR - if either ID or title changed, it's a new program
            const hasChanged = (programId && this.lastAnnouncedProgramId !== programId) ||
                               (programTitle && this.lastAnnouncedProgramTitle !== programTitle);

            if (hasChanged) {
                await this.logger.info(`Program changed! New: ${programTitle} (ID: ${programId})`);
                this.lastAnnouncedProgramId = programId;
                this.lastAnnouncedProgramTitle = programTitle;

                // Post announcement
                await this.postNowPlayingAnnouncement(current);
            } else {
                await this.logger.debug('No program change detected');
            }
        } catch (error) {
            await this.logger.error('Error checking for program change', error);
        }
    }

    async postChannelChangeAnnouncement(channel, user, current, next) {
        if (!config.announcements?.enableChannelChangeAnnouncements) return;
        if (!config.announcements?.channelChangeChannel) return;

        try {
            const announceChannel = await this.client.channels.fetch(config.announcements.channelChangeChannel);
            if (!announceChannel) return;

            const embed = new EmbedBuilder()
                .setTitle(`📺 Channel Changed to ${channel.name}`)
                .setColor(config.behavior.colors.success || 0x00FF00)
                .setTimestamp();

            if (config.announcements.includeUsername && user) {
                embed.setFooter({ text: `Changed by ${user.tag}` });
            }

            if (current) {
                embed.setDescription(`🎬 **NOW PLAYING: ${this.formatProgramTitle(current)}**`);

                const currentDetails = [];
                if (current.rating) currentDetails.push(`**Rating:** ${current.rating}`);
                if (current.date) currentDetails.push(`**Year:** ${new Date(current.date).getFullYear()}`);
                currentDetails.push(`**Duration:** ${this.formatDuration(current.duration)}`);
                currentDetails.push(`**Time Left:** ${current.timeLeft} minutes`);

                embed.addFields({
                    name: '📊 Details',
                    value: currentDetails.join('\n'),
                    inline: false
                });

                if (next) {
                    const nextStartTime = this.formatTime(next.startTime);
                    embed.addFields({
                        name: `🔜 Up Next`,
                        value: `**${this.formatProgramTitle(next)}**\nStarts at ${nextStartTime} (in ${next.startsIn} minutes)`,
                        inline: false
                    });
                }

                // Add poster if enabled
                if (config.announcements.includePoster) {
                    const programYear = current.date ? new Date(current.date).getFullYear() : null;
                    const tmdbImage = await this.fetchTMDBImage(this.formatProgramTitle(current), current.type, programYear, current);
                    if (tmdbImage) {
                        embed.setThumbnail(tmdbImage);
                    } else if (channel.icon && channel.icon.path) {
                        embed.setThumbnail(channel.icon.path);
                    }
                }
            }

            await announceChannel.send({ embeds: [embed] });
        } catch (error) {
            await this.logger.error('Error posting channel change announcement', error);
        }
    }

    async postNowPlayingAnnouncement(current) {
        if (!config.announcements?.enableNowPlayingAnnouncements) return;
        if (!config.announcements?.nowPlayingChannel) return;

        try {
            const announceChannel = await this.client.channels.fetch(config.announcements.nowPlayingChannel);
            if (!announceChannel) return;

            // Get channel info
            const channels = await this.fetchChannels();
            const channel = channels.find(c => c.id === this.currentChannelId);
            if (!channel) return;

            const embed = new EmbedBuilder()
                .setTitle(`📺 Now Playing on ${channel.name}`)
                .setDescription(`🎬 **${this.formatProgramTitle(current)}**`)
                .setColor(config.behavior.colors.info)
                .setTimestamp();

            // Add summary if enabled
            if (config.announcements.includeSummary && current.summary) {
                embed.addFields({
                    name: '📊 Summary',
                    value: current.summary.substring(0, 500),
                    inline: false
                });
            }

            // Add details
            const details = [];
            if (current.rating) details.push(`**Rating:** ${current.rating}`);
            if (current.date) details.push(`**Year:** ${new Date(current.date).getFullYear()}`);
            details.push(`**Duration:** ${this.formatDuration(current.duration)}`);
            if (current.timeLeft) details.push(`**Time Left:** ${current.timeLeft} minutes`);

            const startTime = this.formatTime(current.startTime);
            const endTime = this.formatTime(current.endTime);
            details.push(`**Time:** ${startTime} - ${endTime}`);

            embed.addFields({
                name: '📊 Details',
                value: details.join('\n'),
                inline: false
            });

            // Add poster if enabled
            if (config.announcements.includePoster) {
                const programYear = current.date ? new Date(current.date).getFullYear() : null;
                const tmdbImage = await this.fetchTMDBImage(this.formatProgramTitle(current), current.type, programYear, current);
                if (tmdbImage) {
                    embed.setThumbnail(tmdbImage);
                } else if (channel.icon && channel.icon.path) {
                    embed.setThumbnail(channel.icon.path);
                }
            }

            await announceChannel.send({ embeds: [embed] });
            await this.logger.announce('now-playing', true, {
                program: this.formatProgramTitle(current),
                channel: config.announcements.nowPlayingChannel
            });
        } catch (error) {
            await this.logger.announce('now-playing', false, {
                program: current ? this.formatProgramTitle(current) : 'unknown'
            });
            await this.logger.error('Error posting now playing announcement', error);
        }
    }

    // ========================================================================
    // AUTO-RELOAD SYSTEM (prevent Discord streaming timeouts)
    // ========================================================================
    startAutoReload() {
        const intervalHours = config.autoReload.interval / (60 * 60 * 1000);
        this.logger.info(`Starting auto-reload (interval: ${intervalHours} hours)`);

        // Set initial reload time
        this.lastReloadTime = Date.now();

        // Set up interval
        this.autoReloadInterval = setInterval(async () => {
            await this.performAutoReload();
        }, config.autoReload.interval);
    }

    async performAutoReload() {
        try {
            // Only reload if we're watching a Tunarr channel (not YouTube)
            if (!this.currentChannelId || this.isOnYouTube) {
                await this.logger.verbose('Auto-reload skipped: No Tunarr channel currently active');
                return;
            }

            await this.logger.info(`Auto-reload triggered for channel ${this.currentChannelId}`);

            // Get channel info
            const channels = await this.fetchChannels();
            const channel = channels.find(c => c.id === this.currentChannelId);

            if (!channel) {
                await this.logger.warn('Auto-reload failed: Channel not found');
                return;
            }

            // If onlyDuringPrograms is enabled, check if something is actually playing
            if (config.autoReload.onlyDuringPrograms) {
                const { current } = await this.getCurrentAndNextPrograms(channel.id);
                if (!current) {
                    await this.logger.verbose('Auto-reload skipped: No program currently playing');
                    return;
                }
            }

            // Perform the reload by calling the channel changer
            const changeUrl = `${config.tunarr.baseUrl}${config.tunarr.webPath}/${channel.id}/watch?noAutoPlay=false`;

            await axios.post(`${config.channelChanger.url}/change-channel`, {
                channelId: channel.id,
                url: changeUrl
            }, { timeout: config.channelChanger.timeout });

            this.lastReloadTime = Date.now();
            await this.logger.info(`Auto-reload successful: Refreshed ${channel.name} at ${new Date().toLocaleString()}`);

            // Optionally announce the reload
            if (config.autoReload.announceReload) {
                await this.postAutoReloadAnnouncement(channel);
            }

        } catch (error) {
            await this.logger.error('Auto-reload failed', error);
        }
    }

    async postAutoReloadAnnouncement(channel) {
        if (!config.announcements?.nowPlayingChannel) return;

        try {
            const announceChannel = await this.client.channels.fetch(config.announcements.nowPlayingChannel);
            if (!announceChannel) return;

            const embed = new EmbedBuilder()
                .setTitle('🔄 Auto-Reload')
                .setDescription(`Refreshed **${channel.name}** to prevent streaming timeout`)
                .setColor(config.behavior.colors.info)
                .setTimestamp()
                .setFooter({ text: 'Automatic 24-hour refresh' });

            if (channel.icon && channel.icon.path) {
                embed.setThumbnail(channel.icon.path);
            }

            await announceChannel.send({ embeds: [embed] });
        } catch (error) {
            await this.logger.error('Error posting auto-reload announcement', error);
        }
    }

    // ========================================================================
    // BOT INITIALIZATION AND STARTUP
    // ========================================================================
    start() {
        this.client.login(config.discord.token);
    }
}

// ============================================================================
// APPLICATION ENTRY POINT
// ============================================================================
const bot = new TunarrDiscordBot();
bot.start();

// Graceful shutdown handlers
const gracefulShutdown = async (signal) => {
    console.log(`\n🛑 Received ${signal}, shutting down gracefully...`);
    try {
        if (bot.client) {
            console.log('👋 Disconnecting from Discord...');
            await bot.client.destroy();
            console.log('✅ Disconnected successfully');
        }
    } catch (error) {
        console.error('Error during shutdown:', error);
    }
    process.exit(0);
};

// Handle various termination signals
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));  // Ctrl+C
process.on('SIGHUP', () => gracefulShutdown('SIGHUP'));  // Terminal close

// Windows-specific: Handle console close
if (process.platform === 'win32') {
    const readline = require('readline');
    readline.createInterface({
        input: process.stdin,
        output: process.stdout
    }).on('SIGINT', () => gracefulShutdown('SIGINT'));
}

module.exports = TunarrDiscordBot;
