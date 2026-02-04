// ============================================================================
// LOGGER.JS - Centralized Logging Utility for Tunarr Bot
// ============================================================================
// VERSION: 1.0.0
// CREATED: 2026-02-02
//
// FEATURES:
// - 5 log levels: ERROR, WARN, INFO, DEBUG, VERBOSE
// - Level filtering based on LOG_LEVEL environment variable
// - Verbosity control via enableDetailedLogging flag
// - Dual output: console + file
// - Daily log rotation with automatic cleanup
// - Retention policy (default: 30 days)
// - Specialized methods for commands, announcements, and monitoring
// - Structured context objects for rich logging
// ============================================================================

const fs = require('fs').promises;
const path = require('path');

// ============================================================================
// LOG LEVELS
// ============================================================================
const LOG_LEVELS = {
    ERROR: 0,
    WARN: 1,
    INFO: 2,
    DEBUG: 3,
    VERBOSE: 4
};

const LEVEL_NAMES = ['ERROR', 'WARN', 'INFO', 'DEBUG', 'VERBOSE'];
const LEVEL_COLORS = {
    ERROR: '\x1b[31m',   // Red
    WARN: '\x1b[33m',    // Yellow
    INFO: '\x1b[36m',    // Cyan
    DEBUG: '\x1b[35m',   // Magenta
    VERBOSE: '\x1b[90m'  // Gray
};
const RESET_COLOR = '\x1b[0m';

const LEVEL_EMOJIS = {
    ERROR: '❌',
    WARN: '⚠️',
    INFO: 'ℹ️',
    DEBUG: '🔍',
    VERBOSE: '📝'
};

// ============================================================================
// LOGGER CLASS
// ============================================================================
class Logger {
    /**
     * Creates a new Logger instance
     * @param {string} serviceName - Name of the service (e.g., 'discord-bot', 'channel-changer')
     * @param {object} options - Logger configuration options
     * @param {boolean} options.detailed - Enable detailed/verbose logging (from config.features.enableDetailedLogging)
     * @param {string} options.logLevel - Log level override (defaults to process.env.LOG_LEVEL or 'info')
     * @param {string} options.logDir - Custom log directory (defaults to 'logs/<serviceName>')
     * @param {number} options.retentionDays - Number of days to retain logs (default: 30)
     * @param {boolean} options.consoleOutput - Enable console output (default: true)
     * @param {boolean} options.fileOutput - Enable file output (default: true)
     */
    constructor(serviceName, options = {}) {
        this.serviceName = serviceName;
        this.detailedLogging = options.detailed !== undefined ? options.detailed : false;

        // Determine log level
        const envLevel = (options.logLevel || process.env.LOG_LEVEL || 'info').toLowerCase();
        this.logLevel = LOG_LEVELS[envLevel.toUpperCase()] !== undefined
            ? LOG_LEVELS[envLevel.toUpperCase()]
            : LOG_LEVELS.INFO;

        // Configuration
        this.logDir = options.logDir || path.join(process.cwd(), 'logs', serviceName);
        this.retentionDays = options.retentionDays || 30;
        this.consoleOutput = options.consoleOutput !== undefined ? options.consoleOutput : true;
        this.fileOutput = options.fileOutput !== undefined ? options.fileOutput : true;

        // State
        this.currentLogFile = null;
        this.currentLogDate = null;
        this.initPromise = null;

        // Initialize asynchronously (don't block constructor)
        if (this.fileOutput) {
            this.initPromise = this._initialize();
        }
    }

    /**
     * Initialize logging system (async)
     * @private
     */
    async _initialize() {
        try {
            // Create log directory
            await fs.mkdir(this.logDir, { recursive: true });

            // Set up initial log file
            await this._rotateLogFile();

            // Clean up old logs
            await this._cleanupOldLogs();

            return true;
        } catch (error) {
            console.error(`[Logger] Failed to initialize logging for ${this.serviceName}:`, error);
            return false;
        }
    }

    /**
     * Rotate log file (create new file for new day)
     * @private
     */
    async _rotateLogFile() {
        const now = new Date();
        const dateStr = now.toISOString().split('T')[0]; // YYYY-MM-DD

        // Check if we need a new log file
        if (this.currentLogDate !== dateStr) {
            const timestamp = now.toISOString().replace(/[:.]/g, '-').replace('T', '_').split('.')[0];
            this.currentLogFile = path.join(this.logDir, `${this.serviceName}_${timestamp}.log`);
            this.currentLogDate = dateStr;

            // Write header to new log file
            const header = `${'='.repeat(80)}\n` +
                          `${this.serviceName.toUpperCase()} LOG FILE\n` +
                          `Started: ${now.toISOString()}\n` +
                          `Log Level: ${LEVEL_NAMES[this.logLevel]}\n` +
                          `Detailed Logging: ${this.detailedLogging ? 'ENABLED' : 'DISABLED'}\n` +
                          `${'='.repeat(80)}\n\n`;

            try {
                await fs.appendFile(this.currentLogFile, header);
            } catch (error) {
                console.error(`[Logger] Failed to write log file header:`, error);
            }
        }
    }

    /**
     * Clean up old log files based on retention policy
     * @private
     */
    async _cleanupOldLogs() {
        try {
            const files = await fs.readdir(this.logDir);
            const now = Date.now();
            const retentionMs = this.retentionDays * 24 * 60 * 60 * 1000;

            for (const file of files) {
                if (file.startsWith(this.serviceName) && file.endsWith('.log')) {
                    const filePath = path.join(this.logDir, file);
                    const stats = await fs.stat(filePath);
                    const age = now - stats.mtime.getTime();

                    if (age > retentionMs) {
                        await fs.unlink(filePath);
                        console.log(`[Logger] Deleted old log file: ${file} (${Math.floor(age / (24 * 60 * 60 * 1000))} days old)`);
                    }
                }
            }
        } catch (error) {
            console.error(`[Logger] Failed to clean up old logs:`, error);
        }
    }

    /**
     * Write log entry
     * @private
     */
    async _writeLog(level, message, context = null) {
        // Check if level should be logged
        if (level > this.logLevel) {
            return; // Skip this log entry
        }

        // Check if this is a detailed log (DEBUG/VERBOSE) and detailed logging is disabled
        if ((level === LOG_LEVELS.DEBUG || level === LOG_LEVELS.VERBOSE) && !this.detailedLogging) {
            return; // Skip detailed logs when detailed logging is disabled
        }

        const timestamp = new Date().toISOString();
        const levelName = LEVEL_NAMES[level];

        // Format context if present
        let contextStr = '';
        if (context && Object.keys(context).length > 0) {
            contextStr = ' | ' + Object.entries(context)
                .map(([key, value]) => `${key}=${JSON.stringify(value)}`)
                .join(', ');
        }

        // Console output
        if (this.consoleOutput) {
            const color = LEVEL_COLORS[levelName];
            const emoji = LEVEL_EMOJIS[levelName];
            console.log(`${emoji} ${color}[${levelName}]${RESET_COLOR} [${this.serviceName}] ${message}${contextStr}`);
        }

        // File output
        if (this.fileOutput) {
            // Wait for initialization if needed
            if (this.initPromise) {
                await this.initPromise;
            }

            // Rotate log file if needed (daily rotation)
            await this._rotateLogFile();

            const logLine = `[${timestamp}] [${levelName}] [${this.serviceName}] ${message}${contextStr}\n`;

            try {
                await fs.appendFile(this.currentLogFile, logLine);
            } catch (error) {
                console.error(`[Logger] Failed to write to log file:`, error);
            }
        }
    }

    // ========================================================================
    // CORE LOGGING METHODS
    // ========================================================================

    /**
     * Log an ERROR level message
     * @param {string} message - Log message
     * @param {Error} error - Error object (optional)
     * @param {object} context - Additional context (optional)
     */
    async error(message, error = null, context = {}) {
        const fullContext = { ...context };

        if (error) {
            fullContext.error = error.message;
            fullContext.stack = error.stack;
        }

        await this._writeLog(LOG_LEVELS.ERROR, message, fullContext);
    }

    /**
     * Log a WARN level message
     * @param {string} message - Log message
     * @param {object} context - Additional context (optional)
     */
    async warn(message, context = {}) {
        await this._writeLog(LOG_LEVELS.WARN, message, context);
    }

    /**
     * Log an INFO level message
     * @param {string} message - Log message
     * @param {object} context - Additional context (optional)
     */
    async info(message, context = {}) {
        await this._writeLog(LOG_LEVELS.INFO, message, context);
    }

    /**
     * Log a DEBUG level message (only if enableDetailedLogging is true)
     * @param {string} message - Log message
     * @param {object} context - Additional context (optional)
     */
    async debug(message, context = {}) {
        await this._writeLog(LOG_LEVELS.DEBUG, message, context);
    }

    /**
     * Log a VERBOSE level message (only if enableDetailedLogging is true)
     * @param {string} message - Log message
     * @param {object} context - Additional context (optional)
     */
    async verbose(message, context = {}) {
        await this._writeLog(LOG_LEVELS.VERBOSE, message, context);
    }

    // ========================================================================
    // SPECIALIZED LOGGING METHODS
    // ========================================================================

    /**
     * Log a Discord command execution
     * @param {string} commandName - Name of the command (e.g., '/guide', '/change')
     * @param {object} user - Discord user object or user tag string
     * @param {object} args - Command arguments
     * @param {object} context - Additional context (optional)
     */
    async command(commandName, user, args = {}, context = {}) {
        const userTag = typeof user === 'string' ? user : user.tag || user.username || 'Unknown';
        const userId = typeof user === 'string' ? null : user.id;

        const fullContext = {
            command: commandName,
            user: userTag,
            userId,
            args,
            ...context
        };

        await this._writeLog(LOG_LEVELS.INFO, `Command: ${commandName}`, fullContext);
    }

    /**
     * Log an announcement event
     * @param {string} type - Type of announcement (e.g., 'channel-change', 'now-playing')
     * @param {boolean} success - Whether announcement was successful
     * @param {object} details - Announcement details
     * @param {object} context - Additional context (optional)
     */
    async announce(type, success, details = {}, context = {}) {
        const fullContext = {
            type,
            success,
            ...details,
            ...context
        };

        const level = success ? LOG_LEVELS.INFO : LOG_LEVELS.WARN;
        const status = success ? 'SUCCESS' : 'FAILED';

        await this._writeLog(level, `Announcement [${type}]: ${status}`, fullContext);
    }

    /**
     * Log a background monitor check
     * @param {object} data - Monitor data (e.g., currentChannel, isOnYouTube)
     * @param {object} context - Additional context (optional)
     */
    async monitor(data = {}, context = {}) {
        const fullContext = {
            ...data,
            ...context
        };

        await this._writeLog(LOG_LEVELS.VERBOSE, 'Monitor check', fullContext);
    }

    /**
     * Log an API request
     * @param {string} method - HTTP method (GET, POST, etc.)
     * @param {string} url - API endpoint URL
     * @param {object} requestData - Request payload (optional)
     * @param {object} context - Additional context (optional)
     */
    async apiRequest(method, url, requestData = null, context = {}) {
        const fullContext = {
            method,
            url,
            requestData,
            ...context
        };

        await this._writeLog(LOG_LEVELS.DEBUG, `API Request: ${method} ${url}`, fullContext);
    }

    /**
     * Log an API response
     * @param {string} method - HTTP method
     * @param {string} url - API endpoint URL
     * @param {number} statusCode - Response status code
     * @param {object} responseData - Response payload (optional)
     * @param {object} context - Additional context (optional)
     */
    async apiResponse(method, url, statusCode, responseData = null, context = {}) {
        const fullContext = {
            method,
            url,
            statusCode,
            responseData,
            ...context
        };

        const level = statusCode >= 400 ? LOG_LEVELS.WARN : LOG_LEVELS.DEBUG;

        await this._writeLog(level, `API Response: ${method} ${url} [${statusCode}]`, fullContext);
    }

    /**
     * Log a permission check event
     * @param {boolean} granted - Whether permission was granted
     * @param {object} user - User object
     * @param {string} reason - Reason for denial (if applicable)
     * @param {object} context - Additional context (optional)
     */
    async permission(granted, user, reason = null, context = {}) {
        const userTag = typeof user === 'string' ? user : user.tag || user.username || 'Unknown';

        const fullContext = {
            granted,
            user: userTag,
            reason,
            ...context
        };

        const level = granted ? LOG_LEVELS.DEBUG : LOG_LEVELS.WARN;
        const status = granted ? 'GRANTED' : 'DENIED';

        await this._writeLog(level, `Permission ${status}`, fullContext);
    }

    // ========================================================================
    // UTILITY METHODS
    // ========================================================================

    /**
     * Get the current log file path
     * @returns {string|null} Current log file path
     */
    getLogFilePath() {
        return this.currentLogFile;
    }

    /**
     * Get the log directory path
     * @returns {string} Log directory path
     */
    getLogDirectory() {
        return this.logDir;
    }

    /**
     * Check if detailed logging is enabled
     * @returns {boolean} True if detailed logging is enabled
     */
    isDetailedLoggingEnabled() {
        return this.detailedLogging;
    }

    /**
     * Update detailed logging setting at runtime
     * @param {boolean} enabled - Enable or disable detailed logging
     */
    setDetailedLogging(enabled) {
        this.detailedLogging = enabled;
        this.info(`Detailed logging ${enabled ? 'ENABLED' : 'DISABLED'}`);
    }

    /**
     * Get current log level name
     * @returns {string} Log level name (ERROR, WARN, INFO, DEBUG, VERBOSE)
     */
    getLogLevel() {
        return LEVEL_NAMES[this.logLevel];
    }
}

// ============================================================================
// EXPORTS
// ============================================================================
module.exports = Logger;
