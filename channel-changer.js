const express = require('express');
const puppeteer = require('puppeteer');
const cors = require('cors');
const fs = require('fs').promises;
const path = require('path');
const os = require('os');
const Logger = require('./logger');

// Configuration
const PORT = 3001;
const DEFAULT_USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

// Load config for timing values and Tunarr URL
let config;
try {
    config = require('./config');
            } catch (error) {
    console.log('⚠️ Config.js not found, using default timing values');
    config = {
        tunarr: {
            baseUrl: process.env.TUNARR_BASE_URL || 'http://localhost:8000'
        },
        playback: {
            tunarrBufferWait: 15000,
            youtubeBufferWait: 3000,
            fullscreenDelay: 500,
            resumePlaybackDelay: 1000,
            controlsHideDelay: 2000,
            postFullscreenStabilization: 3000
        },
        youtube: {
            alwaysStartFromBeginning: true,
            enableSubtitles: true
        }
    };
}

// Get Tunarr URL from config (which loads from environment)
const TUNARR_BASE_URL = config.tunarr.baseUrl;

// YouTube domain whitelist
const YOUTUBE_DOMAINS = [
    'youtube.com',
    'www.youtube.com',
    'm.youtube.com',
    'youtu.be',
    'youtube-nocookie.com'
];

class ChannelChanger {
    constructor() {
        this.app = express();
        this.browser = null;
        this.page = null;
        this.currentUrl = null;
        this.isOnYouTube = false;
        this.youtubeVideoInfo = null;
        this.sessionSubtitlePreference = null; // null = use config, true/false = user override

        // Initialize logger
        this.logger = new Logger('channel-changer', {
            detailed: config.features?.enableDetailedLogging || false,
            logLevel: config.logging?.logLevel || 'info',
            retentionDays: config.logging?.retentionDays || 30
        });

        this.logger.info('📋 Channel Changer service initialized');

        this.setupExpress();
    }

    setupExpress() {
        const allowedOrigins = [
            'http://localhost',
            'http://127.0.0.1'
        ];
        this.app.use(cors({ origin: allowedOrigins }));
        this.app.use(express.json());

        const apiKey = config.channelChanger?.apiKey || process.env.CHANNEL_CHANGER_API_KEY;
        if (apiKey) {
            this.app.use((req, res, next) => {
                if (req.path === '/health') return next();

                const headerKey = req.get('x-api-key');
                const authHeader = req.get('authorization');
                const bearerKey = authHeader && authHeader.toLowerCase().startsWith('bearer ')
                    ? authHeader.slice(7)
                    : null;

                if (headerKey === apiKey || bearerKey === apiKey) {
                    return next();
                }

                return res.status(401).json({ error: 'Unauthorized' });
            });
        }
        
        // Health check endpoint
        this.app.get('/health', (req, res) => {
            res.json({ 
                status: 'running', 
                browser: this.browser ? 'connected' : 'disconnected',
                currentUrl: this.currentUrl,
                isOnYouTube: this.isOnYouTube,
                youtubeVideoInfo: this.youtubeVideoInfo,
                method: 'enhanced-puppeteer-v2',
                logFile: this.logger.getLogFilePath()
            });
        });

        // Change channel endpoint - waits for navigation result
        this.app.post('/change-channel', async (req, res) => {
            try {
                const { channelId, url } = req.body;
                
                if (!url) {
                    await this.logger.error(`Missing URL in change-channel request`);
                    return res.status(400).json({ error: 'URL is required' });
                }

                await this.logger.info(`🔄 Changing to channel: ${channelId}, URL: ${url}`);
                
                // Reset YouTube state when changing to regular channel
                this.isOnYouTube = false;
                this.youtubeVideoInfo = null;

                const success = await this.changeChannel(url);

                if (success) {
                    await this.logger.info(`Channel ${channelId} change completed successfully`);
                    return res.json({ 
                        success: true, 
                        message: `Changed to channel ${channelId}`,
                        logFile: this.logger.getLogFilePath()
                    });
                }

                await this.logger.warn(`Channel ${channelId} change failed`);
                return res.status(500).json({ 
                    success: false, 
                    error: `Failed to change to channel ${channelId}`,
                    logFile: this.logger.getLogFilePath()
                });

            } catch (error) {
                await this.logger.error(`Error in change-channel endpoint: ${error.message}`);
                res.status(500).json({ success: false, error: error.message });
            }
        });

        // Enhanced YouTube navigation endpoint
        this.app.post('/navigate-youtube', async (req, res) => {
            try {
                const { url } = req.body;
                
                if (!url) {
                    await this.logger.error(`Missing URL in navigate-youtube request`);
                    return res.status(400).json({ error: 'URL is required' });
                }

                // Validate YouTube URL
                if (!this.isValidYouTubeUrl(url)) {
                    await this.logger.error(`Invalid YouTube URL: ${url}`);
                    return res.status(400).json({ error: 'Invalid YouTube URL' });
                }

                await this.logger.error(`📺 Navigating to YouTube: ${url}`);
                
                // Respond immediately to Discord
                res.json({ 
                    success: true, 
                    message: `Navigating to YouTube video...`,
                    logFile: this.logger.getLogFilePath()
                });
                
                // Process YouTube navigation asynchronously WITH RECOVERY
                this.navigateToYouTubeWithRecovery(url).then(success => {
                    if (success) {
                        this.logger.info(`✅ YouTube navigation completed successfully`);
                    } else {
                        this.logger.warn(`⚠️ YouTube navigation had issues`);
                    }
                }).catch(error => {
                    this.logger.error(`❌ YouTube navigation failed: ${error.message}`);
                });
                
            } catch (error) {
                await this.logger.error(`Error in navigate-youtube endpoint: ${error.message}`);
                res.status(500).json({ success: false, error: error.message });
            }
        });

        // Enhanced YouTube subtitle control endpoint
        this.app.post('/youtube-subtitles', async (req, res) => {
            try {
                const { action } = req.body;
                
                if (!action) {
                    await this.logger.error(`Missing action in youtube-subtitles request`);
                    return res.status(400).json({ error: 'Action is required' });
                }

                if (!this.isOnYouTube) {
                    await this.logger.error(`YouTube subtitles requested but not on YouTube`);
                    return res.status(400).json({ error: 'Not currently on YouTube' });
                }

                await this.logger.info(`🎬 YouTube subtitle control: ${action}`);
                
                // Process subtitle control and wait for result
                const result = await this.handleYouTubeSubtitleControlEnhanced(action);
                
                if (result.success) {
                    await this.logger.info(`✅ YouTube subtitle ${action} completed: ${result.message}`);
                    res.json({
                        success: true,
                        action: result.action,
                        currentState: result.currentState || result.newState,
                        actuallyVisible: result.actuallyVisible,
                        actuallyWorked: result.actuallyWorked,
                        wasAlreadyOn: result.wasAlreadyOn,
                        wasAlreadyOff: result.wasAlreadyOff,
                        availableLanguages: result.availableLanguages,
                        method: result.method,
                        message: result.message,
                        debug: {
                            beforeState: result.beforeState,
                            afterState: result.afterState,
                            browserResponsive: true
                        }
                    });
                } else {
                    await this.logger.warn(`⚠️ YouTube subtitle ${action} failed: ${result.error}`);
                    res.status(400).json({
                        success: false,
                        error: result.error,
                        debug: {
                            browserResponsive: result.error !== 'Browser is frozen and recovery failed'
                        }
                    });
                }
                
            } catch (error) {
                await this.logger.error(`Error in youtube-subtitles endpoint: ${error.message}`);
                res.status(500).json({ success: false, error: error.message });
            }
        });

        // YouTube login helper endpoint
        this.app.post('/youtube-login', async (req, res) => {
            try {
                await this.logger.info('🔑 YouTube login request received');
                
                // Respond immediately
                res.json({ 
                    success: true, 
                    message: 'Navigating to YouTube login...',
                    logFile: this.logger.getLogFilePath()
                });
                
                // Process login navigation asynchronously
                this.navigateToYouTubeLogin().then(success => {
                    if (success) {
                        this.logger.info('✅ YouTube login page loaded successfully');
                    } else {
                        this.logger.warn('⚠️ YouTube login page load had issues');
                    }
                }).catch(error => {
                    this.logger.error(`❌ YouTube login navigation failed: ${error.message}`);
                });
                
            } catch (error) {
                await this.logger.error(`Error in youtube-login endpoint: ${error.message}`);
                res.status(500).json({ success: false, error: error.message });
            }
        });

        // Browser health check endpoint (NEW)
        this.app.get('/browser-health', async (req, res) => {
            try {
                if (!this.page) {
                    return res.json({ 
                        healthy: false, 
                        error: 'No browser page available',
                        canRestart: true
                    });
                }
                
                // Quick responsiveness test
                const startTime = Date.now();
                const responsive = await Promise.race([
                    this.page.evaluate(() => ({
                        readyState: document.readyState,
                        url: window.location.href,
                        timestamp: Date.now()
                    })),
                    new Promise(resolve => setTimeout(() => resolve(null), 3000))
                ]);
                const responseTime = Date.now() - startTime;
                
                if (responsive === null) {
                    // Browser is frozen
                    await this.logger.warn('❄️ Browser health check: FROZEN');
                    
                    // Attempt recovery
                    const recovered = await this.attemptBrowserRecoveryEnhanced();
                    
                    return res.json({
                        healthy: false,
                        frozen: true,
                        responseTime: responseTime,
                        recoveryAttempted: true,
                        recovered: recovered,
                        canRestart: true
                    });
                }
                
                res.json({
                    healthy: true,
                    responseTime: responseTime,
                    readyState: responsive.readyState,
                    url: responsive.url,
                    isOnYouTube: this.isOnYouTube,
                    currentChannelId: this.currentChannelId
                });
                
            } catch (error) {
                await this.logger.error(`Browser health check failed: ${error.message}`);
                res.json({
                    healthy: false,
                    error: error.message,
                    canRestart: true
                });
            }
        });

        // Get YouTube login status endpoint
        this.app.get('/youtube-status', async (req, res) => {
            try {
                const loginStatus = await this.checkYouTubeLoginStatus();
                res.json({
                    isOnYouTube: this.isOnYouTube,
                    loginStatus: loginStatus,
                    videoInfo: this.youtubeVideoInfo
                });
            } catch (error) {
                await this.logger.error(`Error getting YouTube status: ${error.message}`);
                res.status(500).json({ success: false, error: error.message });
            }
        });

        // Get YouTube video info endpoint
        this.app.get('/youtube-info', async (req, res) => {
            try {
                if (!this.isOnYouTube) {
                    return res.json({ isOnYouTube: false, message: 'Not currently on YouTube' });
                }

                const videoInfo = await this.getYouTubeVideoInfo();
                res.json({
                    isOnYouTube: true,
                    videoInfo: videoInfo
                });
            } catch (error) {
                await this.logger.error(`Error getting YouTube info: ${error.message}`);
                res.status(500).json({ success: false, error: error.message });
            }
        });

        // Get current channel info
        this.app.get('/current', (req, res) => {
            res.json({
                currentUrl: this.currentUrl,
                isOnYouTube: this.isOnYouTube,
                youtubeVideoInfo: this.youtubeVideoInfo,
                browser: this.browser ? 'connected' : 'disconnected',
                method: 'enhanced-puppeteer-v2',
                logFile: this.logger.getLogFilePath()
            });
        });

        // Force browser restart
        this.app.post('/restart-browser', async (req, res) => {
            try {
                await this.logger.info('🔄 Browser restart requested');
                await this.restartBrowser();
                res.json({ success: true, message: 'Browser restarted successfully' });
            } catch (error) {
                await this.logger.error(`Browser restart failed: ${error.message}`);
                res.status(500).json({ success: false, error: error.message });
            }
        });

        // Debug endpoint
        this.app.get('/debug', async (req, res) => {
            try {
                const debugInfo = await this.getDebugInfo();
                res.json(debugInfo);
            } catch (error) {
                res.status(500).json({ error: error.message });
            }
        });
    }

    // ========================================================================
    // ENHANCED BROWSER INITIALIZATION (with anti-freeze improvements)
    // ========================================================================

    async closeBrowserSafely() {
        if (!this.browser) return;
        try {
            await this.logger.info('🔒 Closing existing browser instance...');
            await this.browser.close();
        } catch (error) {
            await this.logger.error(`Error closing browser: ${error.message}`);
        } finally {
            this.browser = null;
            this.page = null;
        }
    }

    async configurePage(page) {
        this.page = page;
        this.currentUrl = await this.page.url();
        await this.page.setUserAgent(DEFAULT_USER_AGENT);

        try {
            await this.page.bringToFront();
        } catch (error) {
            await this.logger.debug(`Unable to bring page to front: ${error.message}`);
        }

        this.page.removeAllListeners('dialog');
        this.page.removeAllListeners('pageerror');
        this.page.removeAllListeners('response');
        this.page.removeAllListeners('framenavigated');

        this.page.on('dialog', async dialog => {
            await this.logger.info(`✅ Auto-dismissing dialog: ${dialog.message()}`);
            await dialog.accept();
        });
        
        this.page.on('pageerror', async (error) => {
            await this.logger.error(`Page error: ${error.message}`);
        });
        
        this.page.on('response', async (response) => {
            if (!response.ok()) {
                await this.logger.error(`HTTP ${response.status()}: ${response.url()}`);
            }
        });
        
        this.page.on('framenavigated', async (frame) => {
            if (frame === this.page.mainFrame()) {
                this.currentUrl = frame.url();
                await this.logger.debug(`🔗 Page navigated to: ${this.currentUrl}`);
            }
        });
    }

    async pickBestPage(pages) {
        if (!pages || pages.length === 0) return null;

        const livePages = pages.filter(p => p && !p.isClosed());
        if (livePages.length === 0) return null;

        // Prefer pages already on the Tunarr domain
        for (const page of livePages) {
            try {
                const url = page.url();
                if (url && url.startsWith(TUNARR_BASE_URL)) {
                    return page;
                }
            } catch (error) {
                continue;
            }
        }

        // Next best: any http(s) page (avoid chrome:// and extension pages)
        for (const page of livePages) {
            try {
                const url = page.url();
                if (url && (url.startsWith('http://') || url.startsWith('https://'))) {
                    return page;
                }
            } catch (error) {
                continue;
            }
        }

        return livePages[0];
    }

    async getFirstUsablePage() {
        if (!this.browser) return null;
        const pages = await this.browser.pages();
        return this.pickBestPage(pages);
    }

    async tryConnectToExistingBrowser() {
        const browserUrl = 'http://127.0.0.1:9222';
        try {
            const browser = await Promise.race([
                puppeteer.connect({ browserURL: browserUrl, defaultViewport: null }),
                new Promise((_, reject) => setTimeout(() => reject(new Error('connect timeout')), 1500))
            ]);

            const pages = await browser.pages();
            const bestPage = await this.pickBestPage(pages);

            if (!bestPage) {
                await browser.disconnect();
                return false;
            }

            this.browser = browser;
            await this.configurePage(bestPage);
            await this.logger.info(`Connected to existing Chrome on ${browserUrl} (${this.currentUrl})`);
            return true;
        } catch (error) {
            await this.logger.debug(`No existing Chrome to connect: ${error.message}`);
            return false;
        }
    }

    async ensureBrowserAndPage() {
        if (!this.browser || !this.browser.isConnected()) {
            await this.logger.warn('Browser not connected, initializing...');
            await this.initializeBrowser();
        }

        let needsNewPage = false;
        if (!this.page || this.page.isClosed()) {
            needsNewPage = true;
        } else {
            try {
                if (this.page.mainFrame()?.isDetached()) {
                    needsNewPage = true;
                }
            } catch (error) {
                needsNewPage = true;
            }
        }

        if (!needsNewPage) return;

        await this.logger.warn('Page is missing or detached, recreating...');

        try {
            const existingPage = await this.getFirstUsablePage();
            if (existingPage) {
                await this.configurePage(existingPage);
                return;
            }

            if (this.browser) {
                const newPage = await this.browser.newPage();
                await this.configurePage(newPage);
                return;
            }
        } catch (error) {
            await this.logger.warn(`Failed to reuse browser pages: ${error.message}`);
        }

        await this.closeBrowserSafely();
        await this.initializeBrowser();
    }

    isDetachedFrameError(error) {
        if (!error || !error.message) return false;
        const message = error.message.toLowerCase();
        return message.includes('detached frame') ||
               message.includes('execution context was destroyed') ||
               message.includes('target closed');
    }

    extractChannelIdFromUrl(url) {
        if (!url || typeof url !== 'string') return null;
        const match = url.match(/\/web\/channels\/([^/?#]+)/i);
        return match ? match[1] : null;
    }

    async initializeBrowser() {
        try {
            await this.logger.info('🚀 Initializing Chrome for Discord streaming (enhanced)...');

            if (this.browser) {
                await this.closeBrowserSafely();
            }

            // Try attaching to an existing Chrome (handles orphaned app windows)
            const connectedToExisting = await this.tryConnectToExistingBrowser();
            if (connectedToExisting) {
                return;
            }
            
            // Create persistent profile directory for login state
            const profilePath = path.join(__dirname, 'chrome-profile-data');
            
            // Ensure profile directory exists
            try {
                await fs.mkdir(profilePath, { recursive: true });
            } catch (error) {
                // Directory already exists, that's fine
            }
            
            const baseArgs = [
                '--start-maximized',
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-web-security',
                '--disable-features=VizDisplayCompositor',
                '--disable-beforeunload',
                '--autoplay-policy=no-user-gesture-required',
                '--allow-running-insecure-content',
                '--disable-blink-features=AutomationControlled',
                '--disable-infobars',
                '--disable-extensions-except',
                '--user-agent=' + DEFAULT_USER_AGENT,
                '--profile-directory=Default',
                '--disable-background-timer-throttling',
                '--disable-renderer-backgrounding', 
                '--disable-backgrounding-occluded-windows',
                '--override-plugin-power-saver-for-testing=never',
                '--disable-extensions-http-throttling',
                '--disable-ipc-flooding-protection',
                '--enable-features=NetworkService,NetworkServiceLogging',
                '--disable-hang-monitor',
                '--disable-prompt-on-repost',
                `--app=${TUNARR_BASE_URL}/web/guide`
            ];

            const buildArgs = (debugPort) => {
                const args = [...baseArgs];
                if (typeof debugPort === 'number') {
                    args.push(`--remote-debugging-port=${debugPort}`);
                    args.push('--remote-debugging-address=127.0.0.1');
                }
                return args;
            };

            const launchOptions = {
                headless: false,
                defaultViewport: null,
                userDataDir: profilePath,
                dumpio: true,
                args: buildArgs(9222)
            };

            try {
                this.browser = await puppeteer.launch(launchOptions);
            } catch (error) {
                await this.logger.warn(`Launch with persistent profile failed: ${error.message}`);
                // Fallback: temporary profile (avoids lock from orphaned Chrome)
                const fallbackProfile = path.join(os.tmpdir(), `tunarr-bot-profile-${Date.now()}`);
                await this.logger.warn(`Retrying with temporary profile: ${fallbackProfile}`);
                this.browser = await puppeteer.launch({
                    ...launchOptions,
                    userDataDir: fallbackProfile,
                    args: buildArgs(0)
                });
            }

            // Use existing app mode page or create new one
            const pages = await this.browser.pages();
            
            if (pages.length > 0) {
                const bestPage = await this.pickBestPage(pages);
                if (bestPage) {
                    await this.configurePage(bestPage);
                    await this.logger.info(`Connected to app mode window (${this.currentUrl})`);
                } else {
                    const newPage = await this.browser.newPage();
                    await this.configurePage(newPage);
                    await this.page.goto(`${TUNARR_BASE_URL}/web/guide`, { waitUntil: 'networkidle0' });
                    await this.logger.info('Created new page');
                }
            } else {
                const newPage = await this.browser.newPage();
                await this.configurePage(newPage);
                await this.page.goto(`${TUNARR_BASE_URL}/web/guide`, { waitUntil: 'networkidle0' });
                await this.logger.info('Created new page');
            }
            
            await this.logger.info('✅ Chrome ready for Discord streaming (enhanced)!');
            await this.logger.error(`📁 Profile saved to: ${profilePath}`);
            await this.logger.info('🔐 LOGIN DATA: This directory contains your YouTube login - DO NOT DELETE!');
            
        } catch (error) {
            await this.logger.error(`❌ Failed to initialize browser: ${error.message}`);
            throw error;
        }
    }

    // ========================================================================
    // ENHANCED BROWSER RECOVERY METHODS
    // ========================================================================

    async detectAndRecoverFromFreeze() {
        try {
            await this.logger.info('🔍 Checking for browser freeze...');
            
            // Try to execute a simple page operation with timeout
            const isResponsive = await Promise.race([
                this.page.evaluate(() => document.readyState),
                new Promise(resolve => setTimeout(() => resolve(false), 3000))
            ]);
            
            if (isResponsive === false) {
                await this.logger.warn('❄️ Browser appears frozen, attempting recovery...');
                return await this.attemptBrowserRecoveryEnhanced();
            }
            
            return true;
            
        } catch (error) {
            await this.logger.error(`Freeze detection failed: ${error.message}`);
            return await this.attemptBrowserRecoveryEnhanced();
        }
    }

    async attemptBrowserRecoveryEnhanced() {
        try {
            await this.logger.info('🔧 Attempting enhanced browser recovery...');
            
            // Method 1: Window resize (user reported this works)
            try {
                await this.logger.info('🔄 Attempting window resize recovery...');
                
                // Get current window bounds  
                const currentViewport = await this.page.viewport();
                if (currentViewport) {
                    // Resize slightly larger, then back
                    await this.page.setViewport({
                        width: currentViewport.width + 10,
                        height: currentViewport.height + 10
                    });
                    await this.sleep(500);
                    
                    // Restore original size
                    await this.page.setViewport(currentViewport);
                    await this.sleep(500);
                    
                    await this.logger.info('✅ Window resize recovery completed');
                }
            } catch (resizeError) {
                await this.logger.error(`Window resize failed: ${resizeError.message}`);
            }
            
            // Method 2: Focus restoration
            try {
                await this.logger.info('🎯 Attempting focus restoration...');
                
                // Click on video element to restore focus
                await this.page.evaluate(() => {
                    const video = document.querySelector('video');
                    if (video) {
                        video.focus();
                        video.click();
                        
                        // Dispatch focus events
                        const focusEvent = new FocusEvent('focus', { bubbles: true });
                        video.dispatchEvent(focusEvent);
                    }
                });
                
                await this.sleep(500);
                await this.logger.info('✅ Focus restoration completed');
                
            } catch (focusError) {
                await this.logger.error(`Focus restoration failed: ${focusError.message}`);
            }
            
            // Method 3: Keyboard interaction to "wake up" the browser
            try {
                await this.logger.info('⌨️ Attempting keyboard wake-up...');
                
                await this.page.keyboard.press('Escape');
                await this.sleep(200);
                await this.page.keyboard.press('Tab');
                await this.sleep(200);
                
                await this.logger.info('✅ Keyboard wake-up completed');
                
            } catch (keyError) {
                await this.logger.error(`Keyboard wake-up failed: ${keyError.message}`);
            }
            
            // Test if recovery worked
            const testResponsive = await Promise.race([
                this.page.evaluate(() => ({ 
                    ready: document.readyState,
                    time: Date.now(),
                    url: window.location.href 
                })),
                new Promise(resolve => setTimeout(() => resolve(null), 3000))
            ]);
            
            if (testResponsive && testResponsive.ready) {
                await this.logger.info('✅ Enhanced browser recovery successful!');
                return true;
            } else {
                await this.logger.error('❌ Enhanced recovery failed - browser may need manual intervention');
                return false;
            }
            
        } catch (error) {
            await this.logger.error(`Enhanced browser recovery failed: ${error.message}`);
            return false;
        }
    }

    // ========================================================================
    // RESEARCH-BASED SUBTITLE CONTROL (keyboard-first approach)
    // ========================================================================

    async areSubtitlesActuallyVisible() {
        try {
            return await this.page.evaluate(() => {
                // Primary detection: Look for actual subtitle text content
                const textSelectors = [
                    '.ytp-caption-window-container .ytp-caption-segment',
                    '.captions-text',
                    '.ytp-caption-segment', 
                    '.caption-window .caption-text',
                    '[class*="caption-segment"]',
                    '[class*="caption-text"]',
                    '.ytp-caption-window-bottom',
                    '.ytp-caption-window-rollup'
                ];
                
                // Check for visible text content
                for (const selector of textSelectors) {
                    const elements = document.querySelectorAll(selector);
                    for (const element of elements) {
                        if (element && 
                            element.offsetParent !== null && 
                            element.textContent && 
                            element.textContent.trim()) {
                            
                            const style = getComputedStyle(element);
                            if (style.display !== 'none' &&
                                style.visibility !== 'hidden' &&
                                style.opacity !== '0') {

                                console.log('Found visible subtitle text:', element.textContent.trim().substring(0, 50));
                                return true;
                            }
                        }
                    }
                }
                
                // Secondary detection: Check container visibility
                const containerSelectors = [
                    '.ytp-caption-window-container',
                    '.caption-window-container',
                    '.ytp-caption-window'
                ];
                
                for (const selector of containerSelectors) {
                    const container = document.querySelector(selector);
                    if (container && container.offsetParent !== null) {
                        const style = getComputedStyle(container);
                        if (style.display !== 'none' && 
                            style.visibility !== 'hidden' && 
                            style.opacity !== '0' &&
                            container.children.length > 0) {
                            
                            // Check if any child has text content
                            for (const child of container.children) {
                                if (child.textContent && child.textContent.trim()) {
                                    console.log('Found subtitle container with content');
                                    return true;
                                }
                            }
                        }
                    }
                }
                
                return false;
            });
            
        } catch (error) {
            await this.logger.error(`Subtitle visibility check failed: ${error.message}`);
            return false;
        }
    }

    async toggleYouTubeSubtitlesWithKeyboard() {
        try {
            await this.logger.info('🎹 Using YouTube keyboard shortcut (C key) for subtitles...');
            
            // Ensure video player has focus (critical for keyboard shortcuts)
            await this.page.evaluate(() => {
                const video = document.querySelector('video');
                if (video) {
                    video.focus();
                    video.click(); // Ensure player is active
                }
            });
            
            await this.sleep(500); // Brief pause for focus
            
            // Check current state before toggling
            const beforeState = await this.areSubtitlesActuallyVisible();
            
            // Use the 'C' key (confirmed by research as YouTube's official shortcut)
            await this.page.keyboard.press('c');
            await this.sleep(1500); // Wait for YouTube to process
            
            // Verify the change worked
            const afterState = await this.areSubtitlesActuallyVisible();
            
            await this.logger.error(`📊 Subtitle toggle: ${beforeState} → ${afterState}`);
            
            return {
                success: true,
                beforeState: beforeState,
                afterState: afterState,
                toggled: beforeState !== afterState
            };
            
        } catch (error) {
            await this.logger.error(`Keyboard subtitle toggle failed: ${error.message}`);
            return { success: false, error: error.message };
        }
    }

    async findSubtitleButtonWithShadowDOM() {
        try {
            return await this.page.evaluate(() => {
                // Standard selectors first
                const standardSelectors = [
                    'button.ytp-subtitles-button',
                    '.ytp-subtitles-button',
                    'button[aria-label*="subtitle" i]',
                    'button[aria-label*="caption" i]',
                    'button[title*="subtitle" i]',
                    'button[title*="caption" i]'
                ];
                
                for (const selector of standardSelectors) {
                    const button = document.querySelector(selector);
                    if (button && button.offsetParent !== null && !button.disabled) {
                        return { found: true, selector: selector, method: 'standard' };
                    }
                }
                
                // Shadow DOM search (based on research)
                try {
                    const shadowHosts = document.querySelectorAll('*');
                    for (const host of shadowHosts) {
                        if (host.shadowRoot) {
                            const shadowButton = host.shadowRoot.querySelector('button[aria-label*="subtitle" i], button[aria-label*="caption" i]');
                            if (shadowButton && shadowButton.offsetParent !== null && !shadowButton.disabled) {
                                return { found: true, selector: 'shadow-dom', method: 'shadow' };
                            }
                        }
                    }
                } catch (shadowError) {
                    console.log('Shadow DOM search failed:', shadowError);
                }

                return { found: false };
            });
            
        } catch (error) {
            await this.logger.error(`Shadow DOM button search failed: ${error.message}`);
            return { found: false };
        }
    }

    async handleYouTubeSubtitleControlEnhanced(action) {
        try {
            // First, check for browser freeze and recover if needed
            const isResponsive = await Promise.race([
                this.page.evaluate(() => 'responsive'),
                new Promise(resolve => setTimeout(() => resolve('frozen'), 2000))
            ]);
            
            if (isResponsive === 'frozen') {
                await this.logger.warn('❄️ Browser appears frozen, attempting recovery...');
                const recovered = await this.attemptBrowserRecoveryEnhanced();
                
                if (!recovered) {
                    return { success: false, error: 'Browser is frozen and recovery failed' };
                }
            }
            
            switch (action) {
                case 'on':
                    return await this.enableYouTubeSubtitlesEnhanced();
                case 'off':
                    return await this.disableYouTubeSubtitlesEnhanced();
                case 'toggle':
                    return await this.toggleYouTubeSubtitlesEnhanced();
                case 'status':
                    return await this.getYouTubeSubtitleStatusEnhanced();
                case 'reset':
                    return await this.resetSubtitlePreference();
                default:
                    return { success: false, error: `Unknown action: ${action}` };
            }
            
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    async enableYouTubeSubtitlesEnhanced() {
        try {
            await this.logger.info('🔊 User requested: Enable YouTube subtitles (enhanced method)');
            
            // Set session preference to remember for future videos
            this.sessionSubtitlePreference = true;
            
            // Check current state
            const beforeState = await this.areSubtitlesActuallyVisible();
            
            if (beforeState) {
                return {
                    success: true,
                    action: 'enabled',
                    wasAlreadyOn: true,
                    actuallyVisible: true,
                    message: 'Subtitles were already visible'
                };
            }
            
            // Use keyboard method (most reliable per research)
            const keyboardResult = await this.toggleYouTubeSubtitlesWithKeyboard();
            
            if (keyboardResult.success && keyboardResult.afterState) {
                return {
                    success: true,
                    action: 'enabled',
                    wasAlreadyOn: false,
                    method: 'keyboard',
                    actuallyWorked: true,
                    actuallyVisible: keyboardResult.afterState,
                    message: 'Subtitles enabled successfully using keyboard shortcut'
                };
            }
            
            // Fallback to button clicking with shadow DOM support
            const buttonInfo = await this.findSubtitleButtonWithShadowDOM();
            if (buttonInfo.found) {
                await this.page.evaluate(() => {
                    const button = document.querySelector('button.ytp-subtitles-button, .ytp-subtitles-button');
                    if (button) button.click();
                });
                
                await this.sleep(1500);
                const afterButtonClick = await this.areSubtitlesActuallyVisible();
                
                return {
                    success: true,
                    action: 'enabled',
                    wasAlreadyOn: false,
                    method: 'button',
                    actuallyWorked: afterButtonClick,
                    actuallyVisible: afterButtonClick,
                    message: afterButtonClick ? 'Subtitles enabled via button click' : 'Button clicked but subtitles may not be visible'
                };
            }
            
            return {
                success: false,
                error: 'Could not find subtitle controls or keyboard shortcut failed'
            };
            
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    async disableYouTubeSubtitlesEnhanced() {
        try {
            await this.logger.info('🔇 User requested: Disable YouTube subtitles (enhanced method)');
            
            // Set session preference to remember for future videos
            this.sessionSubtitlePreference = false;
            
            // Check current state
            const beforeState = await this.areSubtitlesActuallyVisible();
            
            if (!beforeState) {
                return {
                    success: true,
                    action: 'disabled',
                    wasAlreadyOff: true,
                    actuallyVisible: false,
                    message: 'Subtitles were already hidden'
                };
            }
            
            // Use keyboard method
            const keyboardResult = await this.toggleYouTubeSubtitlesWithKeyboard();
            
            if (keyboardResult.success && !keyboardResult.afterState) {
                return {
                    success: true,
                    action: 'disabled',
                    wasAlreadyOff: false,
                    method: 'keyboard',
                    actuallyWorked: true,
                    actuallyVisible: keyboardResult.afterState,
                    message: 'Subtitles disabled successfully using keyboard shortcut'
                };
            }
            
            return {
                success: false,
                error: 'Keyboard shortcut failed to disable subtitles'
            };
            
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    async toggleYouTubeSubtitlesEnhanced() {
        try {
            await this.logger.info('🔄 User requested: Toggle YouTube subtitles (enhanced method)');
            
            const currentState = await this.areSubtitlesActuallyVisible();
            const keyboardResult = await this.toggleYouTubeSubtitlesWithKeyboard();
            
            if (keyboardResult.success && keyboardResult.toggled) {
                return {
                    success: true,
                    action: 'toggled',
                    previousState: currentState ? 'enabled' : 'disabled',
                    newState: keyboardResult.afterState ? 'enabled' : 'disabled',
                    method: 'keyboard',
                    actuallyWorked: true,
                    actuallyVisible: keyboardResult.afterState,
                    message: `Subtitles toggled ${keyboardResult.afterState ? 'on' : 'off'} successfully`
                };
            }
            
            return {
                success: false,
                error: 'Toggle failed - keyboard shortcut did not change subtitle state'
            };
            
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    async getYouTubeSubtitleStatusEnhanced() {
        try {
            await this.logger.info('📊 Checking YouTube subtitle status (enhanced)...');
            
            // Check actual visibility first (most reliable)
            const actuallyVisible = await this.areSubtitlesActuallyVisible();
            
            // Check button state as secondary indicator
            const buttonInfo = await this.findSubtitleButtonWithShadowDOM();
            
            return {
                success: true,
                currentState: actuallyVisible ? 'enabled' : 'disabled',
                actuallyVisible: actuallyVisible,
                buttonFound: buttonInfo.found,
                buttonMethod: buttonInfo.method || 'none',
                sessionPreference: this.sessionSubtitlePreference,
                message: `Subtitles are currently ${actuallyVisible ? 'visible' : 'hidden'} on screen`
            };
            
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    async resetSubtitlePreference() {
        try {
            await this.logger.info('🔄 User requested: Reset subtitle preferences to config defaults');
            
            // Clear session preference
            this.sessionSubtitlePreference = null;
            
            const configDefault = config?.youtube?.enableSubtitles;
            let defaultState = 'config default';
            if (configDefault === true) defaultState = 'enabled by config';
            else if (configDefault === false) defaultState = 'disabled by config';
            else defaultState = 'YouTube defaults';
            
            return {
                success: true,
                action: 'reset',
                message: `Session preferences cleared - now using ${defaultState}`
            };
            
        } catch (error) {
            await this.logger.error(`Reset subtitle preference failed: ${error.message}`);
            return { success: false, error: error.message };
        }
    }

    // ========================================================================
    // ENHANCED YOUTUBE NAVIGATION WITH RECOVERY
    // ========================================================================

    async navigateToYouTubeWithRecovery(url) {
        try {
            // Call the existing navigation method
            const success = await this.navigateToYouTube(url);
            
            if (success) {
                // Check for freeze after navigation
                const recovered = await this.detectAndRecoverFromFreeze();
                
                if (!recovered) {
                    await this.logger.warn('⚠️ Browser may be frozen after YouTube navigation');
                    // Still return true since navigation technically succeeded
                }
            }
            
            return success;
            
        } catch (error) {
            await this.logger.error(`YouTube navigation with recovery failed: ${error.message}`);
            return false;
        }
    }

    // ========================================================================
    // YOUTUBE VALIDATION AND NAVIGATION METHODS
    // ========================================================================

    isValidYouTubeUrl(url) {
        try {
            const urlObj = new URL(url);
            return YOUTUBE_DOMAINS.some(domain => urlObj.hostname === domain || urlObj.hostname.endsWith('.' + domain));
        } catch (error) {
            return false;
        }
    }

    async navigateToYouTube(url) {
        try {
            // Ensure browser is connected
            if (!this.page) {
                await this.logger.info('Browser not connected, initializing...');
                await this.initializeBrowser();
                if (!this.page) {
                    throw new Error('Failed to connect to browser');
                }
            }
            
            // Force video to start from beginning by modifying URL (if enabled)
            let modifiedUrl = url;
            if (config?.youtube?.alwaysStartFromBeginning !== false) { // Default to true
                modifiedUrl = this.forceYouTubeStartFromBeginning(url);
            }
            await this.logger.error(`📺 Navigating to YouTube: ${modifiedUrl}`);
            
            // Navigate to YouTube
            await this.page.goto(modifiedUrl, { 
                waitUntil: 'domcontentloaded',
                timeout: 30000 
            });
            
            // Wait for video to load
            await this.waitForYouTubeVideoReady();
            
            // 🚫 Prevent membership popups
            if (config?.youtube?.blockMembershipPopups !== false) { // Default to true
                await this.preventYouTubeMembershipPopups();
            }
            
            // Double-check: programmatically seek to start if needed (if enabled)
            if (config?.youtube?.alwaysStartFromBeginning !== false) {
                await this.ensureVideoStartsFromBeginning();
            }
            
            // Handle subtitles/captions based on session preference or config
            const subtitlePreference = this.sessionSubtitlePreference !== null 
                ? this.sessionSubtitlePreference 
                : config?.youtube?.enableSubtitles;

            if (subtitlePreference === true) {
                // User wants captions enabled (from session override or config)
                await this.enableYouTubeSubtitlesEnhanced();
                if (this.sessionSubtitlePreference !== null) {
                    await this.logger.info('🔊 Using session preference: subtitles enabled');
                }
            } else if (subtitlePreference === false) {
                // User wants captions disabled (from session override or config)
                await this.logger.info('🔇 Subtitles disabled - will disable if YouTube auto-enables them');
                if (this.sessionSubtitlePreference !== null) {
                    await this.logger.info('🔇 Using session preference: subtitles disabled');
                }
            } else {
                // No preference specified - use YouTube defaults
                await this.logger.info('ℹ️ No subtitle preference specified - using YouTube defaults');
            }
            
            // Extract video information
            await this.extractYouTubeVideoInfo();
            
            // Try to fullscreen the video (prioritize true fullscreen over theater mode)
            const fullscreenSuccess = await this.attemptYouTubeFullscreen();
            
            // Handle subtitle preferences AFTER fullscreen (YouTube may auto-enable during fullscreen)
            if (subtitlePreference === false) {
                // User wants captions disabled (from session preference OR config) - ensure they're off after fullscreen
                await this.sleep(2000); // Wait for fullscreen transition to complete
                await this.disableYouTubeSubtitlesEnhanced();
                
                if (this.sessionSubtitlePreference !== null) {
                    await this.logger.info('🔇 Post-fullscreen: Using session preference to disable subtitles');
                } else {
                    await this.logger.info('🔇 Post-fullscreen: Using config setting to disable subtitles');
                }
            }
                    
            // Set YouTube state
            this.isOnYouTube = true;
            this.currentUrl = modifiedUrl;
            
            if (fullscreenSuccess) {
                // Hide cursor and controls for clean viewing
                await this.hideYouTubeControlsForStreaming();
                await this.logger.info(`✅ YouTube navigation complete! Large view: SUCCESS`);
            } else {
                await this.logger.info(`✅ YouTube navigation complete! Large view: FAILED (video still playable)`);
            }
            
            return true;
            
        } catch (error) {
            await this.logger.error(`❌ YouTube navigation failed: ${error.message}`);
            
            // Try to recover
            try {
                await this.logger.info('🔄 Attempting recovery...');
                await this.initializeBrowser();
                let recoveryUrl = url;
                if (config?.youtube?.alwaysStartFromBeginning !== false) {
                    recoveryUrl = this.forceYouTubeStartFromBeginning(url);
                }
                await this.page.goto(recoveryUrl, { waitUntil: 'domcontentloaded' });
                this.isOnYouTube = true;
                this.currentUrl = recoveryUrl;
                await this.logger.info('✅ Recovery successful');
                return true;
            } catch (recoveryError) {
                await this.logger.error(`❌ Recovery failed: ${recoveryError.message}`);
                return false;
            }
        }
    }

    forceYouTubeStartFromBeginning(url) {
        try {
            const urlObj = new URL(url);

            // Remove any existing time parameters
            urlObj.searchParams.delete('t');
            urlObj.searchParams.delete('start');

            // Add parameter to force start from beginning
            urlObj.searchParams.set('t', '0s');

            const modifiedUrl = urlObj.toString();
            this.logger.debug(`🔄 Modified URL to start from beginning: ${modifiedUrl}`);
            return modifiedUrl;

        } catch (error) {
            this.logger.debug(`URL modification failed, using original: ${error.message}`);
            return url;
        }
    }

    async ensureVideoStartsFromBeginning() {
        try {
            await this.logger.info('⏪ Ensuring video starts from beginning...');
            
            const seeked = await this.page.evaluate(() => {
                const video = document.querySelector('video');
                if (video && video.currentTime > 5) { // Only seek if we're more than 5 seconds in
                    video.currentTime = 0;
                    console.log('Seeked video to beginning:', video.currentTime);
                    return true;
                }
                return false;
            });
            
            if (seeked) {
                await this.logger.info('✅ Video seeked to beginning');
                await this.sleep(1000); // Brief pause after seeking
            } else {
                await this.logger.info('ℹ️ Video already at beginning');
            }
            
        } catch (error) {
            await this.logger.error(`Seek to beginning failed: ${error.message}`);
        }
    }

    async waitForYouTubeVideoReady() {
        try {
            await this.logger.info('⏳ Waiting for YouTube video element...');
            
            // Wait for YouTube video player
            await this.page.waitForSelector('video', { timeout: 15000 });
            
            await this.logger.info('📹 YouTube video found, waiting for ready state...');
            
            // Wait for video to be ready and potentially playing
            await this.page.waitForFunction(() => {
                const video = document.querySelector('video');
                return video && video.readyState >= 3; // HAVE_FUTURE_DATA
            }, { timeout: 15000 });
            
            await this.logger.info('✅ YouTube video ready');
            
            // Use configurable wait time for YouTube
            const bufferWait = config?.playback?.youtubeBufferWait || 3000;
            await this.logger.error(`⏱️ Waiting ${bufferWait}ms for YouTube video to stabilize...`);
            await this.sleep(bufferWait);
            
        } catch (error) {
            await this.logger.error(`YouTube video ready check failed: ${error.message}`);
            // Continue anyway, video might still work
        }
    }

    // ========================================================================
    // ALL OTHER EXISTING METHODS (YouTube info, fullscreen, etc.)
    // ========================================================================

    async preventYouTubeMembershipPopups() {
        try {
            await this.logger.info('🚫 Preventing YouTube membership popups...');
            
            // Inject CSS to hide membership-related elements
            await this.page.addStyleTag({
                content: `
                    /* Hide membership popups and related elements */
                    ytd-sponsorships-offer-renderer,
                    ytd-membership-offer-renderer,
                    ytd-popup-container[dialog][style-target="player"] ytd-sponsorships-offer-renderer,
                    [aria-label*="member" i]:not(video):not(audio),
                    [data-target-id*="membership"],
                    .membership-offer-dialog,
                    .ytp-paid-content-overlay,
                    ytd-button-renderer[is-paper-button][aria-label*="Join" i],
                    paper-button[aria-label*="Join" i],
                    
                    /* Hide "Join" buttons that appear on videos */
                    #sponsor-button,
                    ytd-button-renderer a[href*="/channel/"][aria-label*="Join"],
                    
                    /* Hide membership shelf/promotions */
                    ytd-membership-offer-renderer,
                    ytd-paid-content-overlay-renderer,
                    
                    /* Hide any popup containers with membership content */
                    ytd-popup-container:has(ytd-sponsorships-offer-renderer),
                    tp-yt-paper-dialog:has([class*="membership"]),
                    
                    /* Prevent membership cards in sidebar */
                    .ytd-compact-promoted-item-renderer[href*="membership"],
                    
                    /* Hide sponsor/member badges that might trigger popups */
                    #chat-badges yt-live-chat-author-badge-renderer[type="member"],
                    
                    /* Generic membership-related hiding */
                    [class*="membership" i]:not(video):not(audio),
                    [id*="membership" i]:not(video):not(audio) {
                        display: none !important;
                        visibility: hidden !important;
                        opacity: 0 !important;
                        pointer-events: none !important;
                        z-index: -1 !important;
                    }
                    
                    /* Prevent overlay dialogs from appearing */
                    ytd-popup-container[dialog][style-target="player"] {
                        display: none !important;
                    }
                `
            });
            
            // Set up automatic popup dismissal
            await this.page.evaluate(() => {
                // Function to dismiss any membership popups
                const dismissMembershipPopups = () => {
                    // Look for "No thanks" buttons
                    const dismissButtons = [
                        'button[aria-label*="No thanks" i]',
                        'button[aria-label*="Close" i]',
                        'button[aria-label*="Dismiss" i]',
                        '[role="button"][aria-label*="No thanks" i]',
                        '.ytd-popup-container button[aria-label="Close"]',
                        'tp-yt-paper-button[aria-label*="No thanks" i]',
                        'paper-button[aria-label*="No thanks" i]'
                    ];
                    
                    for (const selector of dismissButtons) {
                        const buttons = document.querySelectorAll(selector);
                        buttons.forEach(button => {
                            if (button && button.offsetParent !== null) {
                                console.log('Auto-dismissing membership popup:', selector);
                                button.click();
                            }
                        });
                    }
                    
                    // Remove membership elements directly
                    const membershipElements = document.querySelectorAll([
                        'ytd-sponsorships-offer-renderer',
                        'ytd-membership-offer-renderer',
                        '[data-target-id*="membership"]',
                        '.membership-offer-dialog'
                    ].join(', '));
                    
                    membershipElements.forEach(el => {
                        if (el && el.parentNode) {
                            console.log('Removing membership element:', el.tagName);
                            el.parentNode.removeChild(el);
                        }
                    });
                };
                
                // Run immediately
                dismissMembershipPopups();
                
                // Set up interval to catch future popups
                setInterval(dismissMembershipPopups, 2000);
                
                // Set up DOM observer for dynamic content
                const observer = new MutationObserver(() => {
                    dismissMembershipPopups();
                });
                
                observer.observe(document.body, {
                    childList: true,
                    subtree: true,
                    attributes: true,
                    attributeFilter: ['style', 'class', 'aria-hidden']
                });

                console.log('YouTube membership popup prevention activated');
            });
            
            await this.logger.info('✅ YouTube membership popup prevention activated');
            
        } catch (error) {
            await this.logger.error(`Membership popup prevention failed: ${error.message}`);
        }
    }

    async extractYouTubeVideoInfo() {
        try {
            await this.logger.info('🔍 Extracting YouTube video information...');
            
            const videoInfo = await this.page.evaluate(() => {
                // Function to clean text content
                const cleanText = (text) => {
                    if (!text) return '';
                    return text.trim().replace(/\s+/g, ' ').substring(0, 200); // Limit length and clean whitespace
                };
                
                // Get video title - try multiple selectors in order of preference
                let title = 'Unknown Video';
                const titleSelectors = [
                    'h1.ytd-video-primary-info-renderer .ytd-video-primary-info-renderer',
                    'h1.style-scope.ytd-video-primary-info-renderer',
                    'h1[class*="video-title"]',
                    'h1.title',
                    '.watch-main-col h1',
                    'meta[property="og:title"]'
                ];
                
                for (const selector of titleSelectors) {
                    const element = document.querySelector(selector);
                    if (element) {
                        const text = element.getAttribute('content') || element.textContent || element.innerText;
                        if (text && text.trim() && text.length > 3) {
                            title = cleanText(text);
                            break;
                        }
                    }
                }
                
                // Get channel name - try multiple selectors
                let channel = 'Unknown Channel';
                const channelSelectors = [
                    'ytd-channel-name .ytd-channel-name a',
                    '#owner-text a',
                    '.ytd-video-owner-renderer a',
                    '#channel-name .ytd-channel-name',
                    'a.yt-simple-endpoint.style-scope.yt-formatted-string'
                ];
                
                for (const selector of channelSelectors) {
                    const element = document.querySelector(selector);
                    if (element) {
                        const text = element.textContent || element.innerText;
                        if (text && text.trim() && text.length > 1) {
                            channel = cleanText(text);
                            break;
                        }
                    }
                }
                
                // Get video element info
                const video = document.querySelector('video');
                const videoData = video ? {
                    duration: video.duration || 0,
                    currentTime: video.currentTime || 0,
                    paused: video.paused || false,
                    readyState: video.readyState || 0
                } : null;
                
                // Get view count - try specific selectors
                let viewCount = null;
                const viewSelectors = [
                    '#info-text #count .view-count',
                    '.view-count',
                    '#count .ytd-video-view-count-renderer',
                    'span.view-count'
                ];
                
                for (const selector of viewSelectors) {
                    const element = document.querySelector(selector);
                    if (element) {
                        const text = element.textContent || element.innerText;
                        if (text && text.includes('view')) {
                            viewCount = cleanText(text);
                            break;
                        }
                    }
                }
                
                // Get upload date - try specific selectors
                let uploadDate = null;
                const dateSelectors = [
                    '#info-strings yt-formatted-string',
                    '.date',
                    '#upload-info .ytd-video-primary-info-renderer'
                ];
                
                for (const selector of dateSelectors) {
                    const element = document.querySelector(selector);
                    if (element) {
                        const text = element.textContent || element.innerText;
                        if (text && (text.includes('ago') || text.includes('Premiered') || text.includes('Published'))) {
                            uploadDate = cleanText(text);
                            break;
                        }
                    }
                }
                
                // Get video description (first few words only)
                let description = null;
                const descriptionElement = document.querySelector('#description .ytd-video-secondary-info-renderer, #meta-contents #description');
                if (descriptionElement) {
                    const text = descriptionElement.textContent || descriptionElement.innerText;
                    if (text && text.trim()) {
                        description = cleanText(text.substring(0, 150) + '...'); // First 150 chars only
                    }
                }
                
                return {
                    title: title,
                    channel: channel,
                    viewCount: viewCount,
                    uploadDate: uploadDate,
                    description: description,
                    url: window.location.href,
                    video: videoData,
                    extractedAt: new Date().toISOString()
                };
            });
            
            this.youtubeVideoInfo = videoInfo;
            await this.logger.error(`📺 Video info extracted: "${videoInfo.title}" by "${videoInfo.channel}"`);
            
            return videoInfo;
            
        } catch (error) {
            await this.logger.error(`Failed to extract YouTube video info: ${error.message}`);
            this.youtubeVideoInfo = {
                title: 'Unknown Video',
                channel: 'Unknown Channel',
                url: this.currentUrl,
                error: error.message,
                extractedAt: new Date().toISOString()
            };
            return this.youtubeVideoInfo;
        }
    }

    async getYouTubeVideoInfo() {
        if (!this.isOnYouTube) {
            return null;
        }

        // If we have cached info and it's recent (less than 30 seconds old), return it
        if (this.youtubeVideoInfo && this.youtubeVideoInfo.extractedAt) {
            const ageMs = Date.now() - new Date(this.youtubeVideoInfo.extractedAt).getTime();
            if (ageMs < 30000) { // 30 seconds
                return this.youtubeVideoInfo;
            }
        }

        // Extract fresh info
        return await this.extractYouTubeVideoInfo();
    }

    async attemptYouTubeFullscreen() {
        const approaches = [
            { name: 'YouTube Fullscreen Button', method: this.youtubeFullscreenButton.bind(this) },
            { name: 'YouTube Double-Click', method: this.youtubeDoubleClick.bind(this) },
            { name: 'Enhanced Double-Click', method: this.enhancedDoubleClick.bind(this) },
            { name: 'Direct Fullscreen API', method: this.directFullscreenAPI.bind(this) },
            { name: 'Browser Fullscreen (F11)', method: this.browserFullscreen.bind(this) },
            { name: 'YouTube Theater Mode', method: this.youtubeTheaterMode.bind(this) }
        ];

        // First, clear any cursor overlays
        await this.clearYouTubeCursorOverlays();

        for (const approach of approaches) {
            try {
                await this.logger.error(`🎯 Trying YouTube: ${approach.name}`);
                
                const success = await approach.method();
                
                if (success) {
                    // Check for true fullscreen first
                    const isFullscreen = await this.checkFullscreenStatus();
                    if (isFullscreen) {
                        await this.logger.info(`✅ ${approach.name} succeeded with TRUE FULLSCREEN!`);
                        return true;
                    }
                    
                    // For theater mode, accept it as a fallback only if other methods failed
                    if (approach.name === 'YouTube Theater Mode') {
                        await this.logger.info(`✅ ${approach.name} succeeded as fallback (not fullscreen)`);
                        return true;
                    }
                    
                    // For browser fullscreen, check window size
                    if (approach.name === 'Browser Fullscreen (F11)') {
                        const isBrowserFullscreen = await this.checkBrowserFullscreen();
                        if (isBrowserFullscreen) {
                            await this.logger.info(`✅ ${approach.name} succeeded with BROWSER FULLSCREEN!`);
                            return true;
                        }
                    }
                }
                
                await this.logger.error(`❌ ${approach.name} failed`);
                await this.sleep(1000);
                
            } catch (error) {
                await this.logger.error(`❌ ${approach.name} error: ${error.message}`);
            }
        }
        
        await this.logger.error('❌ All YouTube fullscreen approaches failed');
        return false;
    }

    async browserFullscreen() {
        try {
            await this.logger.info('🖥️ Attempting browser fullscreen (F11)...');
            
            // Press F11 to enter browser fullscreen mode
            await this.page.keyboard.press('F11');
            await this.sleep(3000); // Give time for fullscreen transition
            
            // Check if browser went fullscreen
            const isBrowserFullscreen = await this.checkBrowserFullscreen();
            if (isBrowserFullscreen) {
                await this.resumeYouTubePlayback();
                return true;
            }
            
            return false;
        } catch (error) {
            await this.logger.error(`Browser fullscreen failed: ${error.message}`);
            return false;
        }
    }

    async checkBrowserFullscreen() {
        try {
            return await this.page.evaluate(() => {
                // Check if browser is in fullscreen mode (window fills entire screen)
                return window.innerHeight === screen.height && window.innerWidth === screen.width;
            });
        } catch (error) {
            return false;
        }
    }

    async clearYouTubeCursorOverlays() {
        try {
            await this.logger.info('🧹 Clearing YouTube cursor overlays and previews...');
            
            // Move mouse to a neutral area (top-left corner) to clear any hover states
            await this.page.mouse.move(10, 10);
            await this.sleep(500);
            
            // Clear any seek previews or hover overlays via JavaScript
            await this.page.evaluate(() => {
                // Remove YouTube seek preview overlays
                const overlays = document.querySelectorAll([
                    '.ytp-tooltip',
                    '.ytp-preview',
                    '.ytp-storyboard-framepreview',
                    '.ytp-progress-bar-hover',
                    '.ytp-scrubber-hover',
                    '[class*="preview"]',
                    '[class*="tooltip"]',
                    '[class*="hover"]'
                ].join(', '));
                
                overlays.forEach(overlay => {
                    if (overlay && overlay.style) {
                        overlay.style.display = 'none';
                        overlay.style.opacity = '0';
                        overlay.style.visibility = 'hidden';
                    }
                });
                
                // Clear any active hover states
                const video = document.querySelector('video');
                if (video) {
                    // Remove focus to clear any control overlays
                    video.blur();
                    
                    // Dispatch mouse leave event to clear hover states
                    const mouseLeaveEvent = new MouseEvent('mouseleave', {
                        bubbles: true,
                        cancelable: true,
                        view: window
                    });
                    video.dispatchEvent(mouseLeaveEvent);
                }

                console.log('Cleared YouTube overlays and hover states');
            });
            
            await this.logger.info('✅ YouTube overlays cleared');
            
        } catch (error) {
            await this.logger.error(`Clear overlays failed: ${error.message}`);
        }
    }

    async hideYouTubeControlsForStreaming() {
        try {
            await this.logger.info('🎬 Hiding YouTube controls for clean streaming...');
            
            // Move mouse to corner to hide controls
            await this.page.mouse.move(5, 5);
            await this.sleep(1000);
            
            // Inject CSS to hide YouTube controls more aggressively
            await this.page.evaluate(() => {
                const style = document.createElement('style');
            style.textContent = `
                /* Hide YouTube video controls but PRESERVE subtitles */
                .ytp-chrome-bottom,
                .ytp-chrome-top,
                .ytp-gradient-bottom,
                .ytp-gradient-top,
                .ytp-progress-bar-container,
                .ytp-title,
                .ytp-show-cards-title,
                .ytp-watermark,
                .ytp-chrome-controls,
                .ytp-cards-teaser,
                .ytp-pause-overlay,
                .ytp-tooltip,
                .ytp-preview,
                .ytp-endscreen-element,
                .ytp-ce-element,
                .html5-endscreen,
                .ytp-suggested-action,
                .ytp-upnext,
                .ytp-cards-button,
                .ytp-overflow-button {
                    opacity: 0 !important;
                    visibility: hidden !important;
                    display: none !important;
                    pointer-events: none !important;
                }
                
                /* IMPORTANT: Keep subtitles visible! */
                .ytp-caption-window-container,
                .ytp-caption-segment,
                .captions-text,
                .ytp-caption-window-bottom,
                .ytp-caption-window-rollup,
                [class*="caption-window"],
                [class*="caption-text"],
                [class*="caption-segment"] {
                    opacity: 1 !important;
                    visibility: visible !important;
                    display: block !important;
                    pointer-events: auto !important;
                    z-index: 9999 !important;
                }
                
                /* Hide video overlays and annotations but NOT captions */
                .video-annotations,
                .iv-drawer,
                .annotation,
                .ytp-ad-overlay-container,
                .ytp-ad-text,
                .ytp-ad-button,
                .ytp-subscribe-card,
                .ytp-videowall-still,
                .ytp-suggestion-set {
                    display: none !important;
                }
                
                /* Make video fill the space */
                video {
                    object-fit: contain !important;
                }
                
                /* Hide cursor when over video (for streaming) */
                .html5-video-player video {
                    cursor: none !important;
                }
                
                /* Hide any remaining UI elements in fullscreen but NOT captions */
                .html5-video-player.ytp-fullscreen .ytp-chrome-bottom,
                .html5-video-player.ytp-fullscreen .ytp-chrome-top {
                    display: none !important;
                }
            `;
                document.head.appendChild(style);
                
                // Also manually hide elements (but preserve subtitles)
                const elementsToHide = document.querySelectorAll(`
                    .ytp-chrome-bottom,
                    .ytp-chrome-top,
                    .ytp-watermark,
                    .ytp-title,
                    .ytp-pause-overlay,
                    .ytp-endscreen-element,
                    .annotation,
                    .ytp-cards-button
                `);

                elementsToHide.forEach(el => {
                    if (el) {
                        // Don't hide if it's a subtitle element
                        const isSubtitleElement = el.closest('.ytp-caption-window-container') || 
                                                 el.classList.contains('ytp-caption-segment') ||
                                                 el.classList.contains('captions-text') ||
                                                 el.className.includes('caption');
                        
                        if (!isSubtitleElement) {
                            el.style.display = 'none';
                            el.style.opacity = '0';
                            el.style.visibility = 'hidden';
                        }
                    }
                });

                console.log('Applied YouTube streaming CSS and hid UI elements');
            });
            
            await this.logger.info('✅ YouTube controls hidden for clean streaming');
            
        } catch (error) {
            await this.logger.error(`Hide YouTube controls failed: ${error.message}`);
        }
    }

    async youtubeTheaterMode() {
        try {
            // Try theater mode first (better than fullscreen for streaming)
            const theaterButton = await this.page.$('button.ytp-size-button');
            if (theaterButton) {
                await theaterButton.click();
                await this.sleep(1000);
                
                // Ensure video resumes after theater mode
                await this.resumeYouTubePlayback();
                
                await this.logger.info('✅ YouTube theater mode activated');
                return true;
            }
            return false;
        } catch (error) {
            return false;
        }
    }

    async youtubeDoubleClick() {
        try {
            await this.logger.info('🎯 Attempting YouTube video double-click for fullscreen...');
            
            // Clear any overlays first
            await this.clearYouTubeCursorOverlays();
            
            const video = await this.page.$('video');
            if (video) {
                const box = await video.boundingBox();
                if (box) {
                    // Click in the center of the video area (avoiding controls)
                    const centerX = box.x + box.width / 2;
                    const centerY = box.y + box.height / 2 - 50; // Slightly higher to avoid progress bar
                    
                    await this.logger.error(`🖱️ Double-clicking video at: ${centerX}, ${centerY}`);
                    
                    // Move to position first to clear any hover states
                    await this.page.mouse.move(centerX, centerY);
                    await this.sleep(200);
                    
                    // Perform double-click
                    await this.page.mouse.click(centerX, centerY, { clickCount: 2, delay: 100 });
                    await this.sleep(2500);
                    
                    // Check if fullscreen worked
                    const isFullscreen = await this.checkFullscreenStatus();
                    if (isFullscreen) {
                        await this.logger.info('🎉 Double-click fullscreen successful!');
                        
                        // Aggressively resume YouTube playback
                        await this.resumeYouTubePlayback();
                        
                        return true;
                    } else {
                        await this.logger.warn('⚠️ Double-click did not trigger fullscreen');
                    }
                }
            }
            return false;
        } catch (error) {
            await this.logger.error(`YouTube double-click failed: ${error.message}`);
            return false;
        }
    }

    async youtubeFullscreenButton() {
        try {
            await this.logger.info('🎯 Looking for YouTube fullscreen button...');
            
            // First, ensure video controls are visible by hovering over video
            const video = await this.page.$('video');
            if (video) {
                await video.hover();
                await this.sleep(1000); // Wait for controls to appear
            }
            
            // YouTube fullscreen button selectors (in order of preference)
            const fullscreenSelectors = [
                'button.ytp-fullscreen-button',
                '.ytp-fullscreen-button',
                'button[aria-label="Fullscreen"]',
                'button[aria-label="Fullscreen (f)"]', 
                'button[title="Fullscreen"]',
                'button[title="Fullscreen (f)"]',
                'button[aria-label*="fullscreen" i]',
                'button[title*="fullscreen" i]',
                '.ytp-button[aria-label*="fullscreen" i]'
            ];

            for (const selector of fullscreenSelectors) {
                try {
                    await this.logger.debug(`🔍 Trying selector: ${selector}`);
                    
                    const button = await this.page.$(selector);
                    if (button) {
                        const isVisible = await button.isIntersectingViewport();
                        const isEnabled = await this.page.evaluate(btn => {
                            return btn && !btn.disabled && btn.offsetParent !== null;
                        }, button);
                        
                        if (isVisible && isEnabled) {
                            await this.logger.info(`✅ Found fullscreen button: ${selector}`);
                            
                            // Click the button
                            await button.click();
                            await this.sleep(2000);
                            
                            // Check if we actually went fullscreen
                            const isFullscreen = await this.checkFullscreenStatus();
                            if (isFullscreen) {
                                await this.logger.info('🎉 Successfully entered fullscreen!');
                                
                                // Aggressively resume YouTube playback after fullscreen
                                await this.resumeYouTubePlayback();
                                
                                return true;
                            } else {
                                await this.logger.warn('⚠️ Button clicked but not in fullscreen yet');
                            }
                        } else {
                            await this.logger.error(`❌ Button found but not visible/enabled: ${selector}`);
                        }
                    }
                } catch (e) {
                    await this.logger.error(`❌ Error with selector ${selector}: ${e.message}`);
                    continue;
                }
            }
            
            // If no button found, try keyboard shortcut
            await this.logger.info('🎹 Trying fullscreen keyboard shortcut (F key)...');
            await this.page.keyboard.press('f');
            await this.sleep(2000);
            
            const isFullscreen = await this.checkFullscreenStatus();
            if (isFullscreen) {
                await this.logger.info('🎉 Keyboard shortcut worked!');
                await this.resumeYouTubePlayback();
                return true;
            }
            
            await this.logger.error('❌ No fullscreen button found or working');
            return false;
            
        } catch (error) {
            await this.logger.error(`YouTube fullscreen button method failed: ${error.message}`);
            return false;
        }
    }

    // ========================================================================
    // YOUTUBE-SPECIFIC PLAYBACK RESUMPTION
    // ========================================================================

    async resumeYouTubePlayback() {
        try {
            await this.logger.info('▶️ Ensuring YouTube video playback is resumed...');
            
            // Multiple attempts with different methods
            const resumed = await this.page.evaluate(() => {
                const video = document.querySelector('video');
                if (!video) return false;
                
                let resumed = false;
                
                // Method 1: Direct video.play()
                if (video.paused) {
                    try {
                        const playPromise = video.play();
                        if (playPromise !== undefined) {
                            playPromise.catch(e => this.logger.debug('Play promise failed:', { error: e.message }));
                        }
                        resumed = true;
                    } catch (e) {
                        console.log('Direct play failed:', e);
                    }
                }
                
                // Method 2: Click the YouTube play button if video is still paused
                setTimeout(() => {
                    if (video.paused) {
                        // Try to find and click YouTube's play button
                        const playButtons = [
                            '.ytp-play-button',
                            'button[aria-label*="play" i]',
                            'button[title*="play" i]',
                            '.ytp-large-play-button'
                        ];
                        
                        for (const selector of playButtons) {
                            const playBtn = document.querySelector(selector);
                            if (playBtn && playBtn.style.display !== 'none') {
                                playBtn.click();
                                console.log('Clicked YouTube play button:', selector);
                                break;
                            }
                        }
                    }
                }, 500);
                
                // Method 3: Trigger spacebar keypress (YouTube play/pause shortcut)
                setTimeout(() => {
                    if (video.paused) {
                        const spaceEvent = new KeyboardEvent('keydown', {
                            key: ' ',
                            code: 'Space',
                            keyCode: 32,
                            which: 32,
                            bubbles: true
                        });
                        document.dispatchEvent(spaceEvent);
                        console.log('Sent spacebar keypress');
                    }
                }, 1000);
                
                return resumed;
            });
            
            // Wait a moment and check if playback resumed
            await this.sleep(1500);
            
            const isPlaying = await this.page.evaluate(() => {
                const video = document.querySelector('video');
                return video && !video.paused;
            });
            
            if (isPlaying) {
                await this.logger.info('✅ YouTube video playback resumed successfully');
            } else {
                await this.logger.warn('⚠️ YouTube video may still be paused - manual play may be needed');
                
                // Final attempt: Click center of video to resume
                try {
                    const video = await this.page.$('video');
                    if (video) {
                        await video.click();
                        await this.logger.info('🎯 Clicked video center as final resume attempt');
                    }
                } catch (e) {
                    await this.logger.info('Final click attempt failed');
                }
            }
            
        } catch (error) {
            await this.logger.error(`YouTube resume playback failed: ${error.message}`);
        }
    }

    async navigateToYouTubeLogin() {
        try {
            // Ensure browser is connected
            if (!this.page) {
                await this.logger.info('Browser not connected, initializing...');
                await this.initializeBrowser();
                if (!this.page) {
                    throw new Error('Failed to connect to browser');
                }
            }

            await this.logger.info('🔑 Navigating to YouTube login page...');
            
            // Navigate to YouTube login
            await this.page.goto('https://accounts.google.com/signin/v2/identifier?service=youtube', { 
                waitUntil: 'domcontentloaded',
                timeout: 30000 
            });

            // Wait for login page to load
            await this.sleep(3000);
            
            await this.logger.info('✅ YouTube login page loaded!');
            await this.logger.error(`👤 Please manually log in to YouTube Premium`);
            await this.logger.info('🔄 After login, the session will be saved automatically');
            await this.logger.info('📺 Then use /youtube commands normally');
            
            return true;
            
        } catch (error) {
            await this.logger.error(`❌ YouTube login navigation failed: ${error.message}`);
            return false;
        }
    }

    async checkYouTubeLoginStatus() {
        try {
            if (!this.page) return { loggedIn: false, error: 'No browser page' };
            
            // Navigate to YouTube and check if we're logged in
            await this.page.goto('https://www.youtube.com', { waitUntil: 'domcontentloaded' });
            await this.sleep(2000);
            
            const loginStatus = await this.page.evaluate(() => {
                // Check for avatar button (indicates logged in)
                const avatarButton = document.querySelector('button#avatar-btn, #avatar-btn, [aria-label*="account" i]');
                const signInButton = document.querySelector('a[aria-label*="sign in" i], ytd-button-renderer a[href*="accounts.google.com"]');
                
                return {
                    loggedIn: !!avatarButton && !signInButton,
                    hasAvatar: !!avatarButton,
                    hasSignIn: !!signInButton,
                    url: window.location.href
                };
            });
            
            if (loginStatus.loggedIn) {
                await this.logger.info('✅ YouTube login detected - Premium features available!');
            } else {
                await this.logger.warn('⚠️ YouTube login not detected - use /youtube-login to log in');
            }
            
            return loginStatus;
            
        } catch (error) {
            await this.logger.error(`Error checking YouTube login status: ${error.message}`);
            return { loggedIn: false, error: error.message };
        }
    }

    // ========================================================================
    // EXISTING TUNARR METHODS (keeping all the original functionality)
    // ========================================================================

    async changeChannel(newUrl) {
        try {
            await this.ensureBrowserAndPage();
            if (!this.page) {
                throw new Error('Failed to connect to browser');
            }

            await this.logger.info(`Navigating to: ${newUrl}`);

            try {
                await this.page.goto(newUrl, { 
                    waitUntil: 'domcontentloaded',
                    timeout: 30000 
                });
            } catch (error) {
                if (this.isDetachedFrameError(error)) {
                    await this.logger.warn('Detached frame detected during navigation, retrying with a fresh page...');
                    await this.ensureBrowserAndPage();
                    await this.page.goto(newUrl, { 
                        waitUntil: 'domcontentloaded',
                        timeout: 30000 
                    });
                } else {
                    throw error;
                }
            }

            // Verify navigation landed on the expected channel
            const expectedChannelId = this.extractChannelIdFromUrl(newUrl);
            const navigatedUrl = this.page.url();
            if (expectedChannelId && !navigatedUrl.includes(expectedChannelId)) {
                await this.logger.warn(`Navigation may not have switched channels. Expected ${expectedChannelId}, current URL: ${navigatedUrl}`);
                await this.page.bringToFront();
                await this.page.goto(newUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
                const retryUrl = this.page.url();
                if (!retryUrl.includes(expectedChannelId)) {
                    throw new Error(`Navigation did not switch to channel ${expectedChannelId}`);
                }
            }

            // Handle "Leave site?" popup automatically
            await this.handleLeaveDialog();
            
            // Wait for video to load and be ready
            await this.waitForVideoReady();
            
            // Run comprehensive debugging
            await this.debugVideoState();
            
            // Try multiple fullscreen approaches
            const fullscreenSuccess = await this.attemptFullscreen();
            
            this.currentUrl = newUrl;
            await this.logger.info(`Channel change complete! Fullscreen: ${fullscreenSuccess ? 'SUCCESS' : 'FAILED'}`);
            
            return true;
            
        } catch (error) {
            await this.logger.error(`Channel change failed: ${error.message}`);
            
            // Try to recover
            try {
                await this.logger.info('Attempting recovery...');
                await this.initializeBrowser();
                await this.ensureBrowserAndPage();
                await this.page.goto(newUrl, { waitUntil: 'domcontentloaded' });
                this.currentUrl = newUrl;
                await this.logger.info('Recovery successful');
                return true;
            } catch (recoveryError) {
                await this.logger.error(`Recovery failed: ${recoveryError.message}`);
                return false;
            }
        }
    }

    async handleLeaveDialog() {
        try {
            await this.sleep(500); // Brief wait for popup
            
            const leaveSelectors = [
                'button:has-text("Leave")',
                'button[data-testid*="leave"]',
                'button:contains("Leave")',
                '.leave-button',
                'button[aria-label*="leave" i]'
            ];

            let popupDismissed = false;
            for (const selector of leaveSelectors) {
                try {
                    await this.page.waitForSelector(selector, { timeout: 1000 });
                    await this.page.click(selector);
                    await this.logger.info('Auto-dismissed "Leave site?" popup');
                    await this.sleep(1000);
                    popupDismissed = true;
                    break;
                } catch (e) {
                    continue;
                }
            }

            if (!popupDismissed) {
                await this.logger.info('No leave dialog found or already dismissed');
            }
        } catch (error) {
            await this.logger.error(`Leave dialog handling failed: ${error.message}`);
        }
    }

    async waitForVideoReady() {
        try {
            await this.logger.info('⏳ Waiting for video element...');
            await this.page.waitForSelector('video', { timeout: 10000 });
            
            await this.logger.info('📹 Video found, waiting for ready state...');
            
            // Wait for video to be ready and playing
            await this.page.waitForFunction(() => {
                const video = document.querySelector('video');
                return video && 
                       video.readyState >= 3 && // HAVE_FUTURE_DATA
                       video.currentTime > 0 &&  // Actually playing
                       !video.paused;
            }, { timeout: 15000 });
            
            await this.logger.info('✅ Video ready and playing');
            
            // Use configurable wait time for Tunarr video buffering
            const bufferWait = config?.playback?.tunarrBufferWait || 15000;
            await this.logger.error(`⏱️ Waiting ${bufferWait}ms for Tunarr video to buffer before fullscreen attempt...`);
            await this.sleep(bufferWait);
            
        } catch (error) {
            await this.logger.error(`Video ready check failed: ${error.message}`);
            // Continue anyway, video might still work
        }
    }

    async debugVideoState() {
        try {
            await this.logger.info('🔍 Running video state debug...');
            
            const videoInfo = await this.page.evaluate(() => {
                const video = document.querySelector('video');
                if (!video) return { found: false };
                
                return {
                    found: true,
                    readyState: video.readyState,
                    paused: video.paused,
                    currentTime: video.currentTime,
                    duration: video.duration,
                    videoWidth: video.videoWidth,
                    videoHeight: video.videoHeight,
                    clientWidth: video.clientWidth,
                    clientHeight: video.clientHeight,
                    hasFocus: document.activeElement === video,
                    canPlay: !video.error,
                    src: video.src || video.currentSrc,
                    controls: video.controls,
                    autoplay: video.autoplay
                };
            });
            
            await this.logger.error(`Video state: ${JSON.stringify(videoInfo, null, 2)}`);
            
            // Check fullscreen capabilities
            const fullscreenInfo = await this.page.evaluate(() => {
                const video = document.querySelector('video');
                return {
                    documentFullscreenEnabled: document.fullscreenEnabled,
                    videoFullscreenMethods: video ? {
                        requestFullscreen: typeof video.requestFullscreen === 'function',
                        webkitRequestFullscreen: typeof video.webkitRequestFullscreen === 'function',
                        mozRequestFullScreen: typeof video.mozRequestFullScreen === 'function',
                        msRequestFullscreen: typeof video.msRequestFullscreen === 'function'
                    } : null,
                    currentFullscreenElement: document.fullscreenElement?.tagName || null,
                    windowSize: { width: window.innerWidth, height: window.innerHeight },
                    screenSize: { width: screen.width, height: screen.height }
                };
            });
            
            await this.logger.error(`Fullscreen capabilities: ${JSON.stringify(fullscreenInfo, null, 2)}`);
            
        } catch (error) {
            await this.logger.error(`Debug failed: ${error.message}`);
        }
    }

    async attemptFullscreen() {
        const approaches = [
            { name: 'Enhanced Double-Click', method: this.enhancedDoubleClickTunarr.bind(this) },
            { name: 'User Gesture Simulation', method: this.userGestureFullscreen.bind(this) },
            { name: 'Button Click', method: this.clickFullscreenButton.bind(this) },
            { name: 'JavaScript API', method: this.directFullscreenAPI.bind(this) },
            { name: 'Mouse Events', method: this.mouseEventFullscreen.bind(this) }
        ];

        // Use configurable delay before attempting fullscreen
        const fullscreenDelay = config?.playback?.fullscreenDelay || 500;
        await this.logger.error(`⏱️ Waiting ${fullscreenDelay}ms before fullscreen attempt...`);
        await this.sleep(fullscreenDelay);

        for (const approach of approaches) {
            try {
                await this.logger.error(`🎯 Trying: ${approach.name}`);
                
                const success = await approach.method();
                
                if (success) {
                    const isFullscreen = await this.checkFullscreenStatus();
                    if (isFullscreen) {
                        await this.logger.info(`✅ ${approach.name} succeeded!`);
                        
                        // Optimized post-fullscreen sequence
                        await this.optimizedPostFullscreenSequence();
                        
                        return true;
                    }
                }
                
                await this.logger.error(`❌ ${approach.name} failed`);
                await this.sleep(800); // Shorter pause between attempts
                
            } catch (error) {
                await this.logger.error(`❌ ${approach.name} error: ${error.message}`);
            }
        }
        
        await this.logger.error('❌ All fullscreen approaches failed');
        return false;
    }

    async optimizedPostFullscreenSequence() {
        try {
            await this.logger.info('🔧 Running optimized post-fullscreen sequence...');
            
            // Step 1: Quick playback resume (no delay)
            await this.resumePlayback();
            
            // Step 2: Brief stabilization wait (configurable)
            const stabilizationWait = config?.playback?.postFullscreenStabilization || 3000;
            await this.logger.error(`⏱️ Stabilization wait: ${stabilizationWait}ms`);
            await this.sleep(stabilizationWait);
            
            // Step 3: Hide controls with delay (configurable)
            const controlsDelay = config?.playback?.controlsHideDelay || 2000;
            setTimeout(async () => {
                await this.hideVideoControls();
            }, controlsDelay);
            
            await this.logger.info('✅ Post-fullscreen sequence completed');
            
        } catch (error) {
            await this.logger.error(`Post-fullscreen sequence error: ${error.message}`);
        }
    }

    async enhancedDoubleClickTunarr() {
        try {
            await this.logger.info('🎯 Enhanced double-click for Tunarr (optimized)...');
            
            // Quick focus without long delays
            await this.page.focus('video');
            await this.sleep(200); // Minimal delay
            
            // Get video center coordinates
            const videoElement = await this.page.$('video');
            const box = await videoElement.boundingBox();
            
            if (box) {
                const centerX = box.x + box.width / 2;
                const centerY = box.y + box.height / 2;
                
                await this.logger.error(`🖱️ Quick double-click at: ${centerX}, ${centerY}`);
                
                // Fast double-click with minimal delay
                await this.page.mouse.click(centerX, centerY, { clickCount: 2, delay: 30 });
                
                // Quick check for fullscreen (shorter wait)
                await this.sleep(1500);
                return await this.checkFullscreenStatus();
            }
            
            return false;
        } catch (error) {
            await this.logger.error(`Enhanced double-click failed: ${error.message}`);
            return false;
        }
    }

    async enhancedDoubleClick() {
        try {
            // Focus and hover on video
            await this.page.hover('video');
            await this.sleep(300); // Reduced delay
            await this.page.focus('video');
            await this.sleep(300); // Reduced delay
            
            // Get video center coordinates
            const videoElement = await this.page.$('video');
            const box = await videoElement.boundingBox();
            
            if (box) {
                const centerX = box.x + box.width / 2;
                const centerY = box.y + box.height / 2;
                
                await this.logger.error(`Double-clicking at center: ${centerX}, ${centerY}`);
                
                // Try multiple double-click approaches
                await this.page.mouse.click(centerX, centerY, { clickCount: 2, delay: 50 });
                await this.sleep(1500); // Reduced delay
                
                // Resume playback if paused (use appropriate method based on context)
                if (this.isOnYouTube) {
                    await this.resumeYouTubePlayback();
                } else {
                    await this.resumePlayback();
                }
                
                return await this.checkFullscreenStatus();
            }
            
            return false;
        } catch (error) {
            await this.logger.error(`Enhanced double-click failed: ${error.message}`);
            return false;
        }
    }

    async userGestureFullscreen() {
        try {
            // Create a real user gesture by dispatching proper events
            const success = await this.page.evaluate(() => {
                const video = document.querySelector('video');
                if (!video) return false;
                
                // Focus the video first
                video.focus();
                
                // Create a synchronized double-click event that triggers fullscreen
                const rect = video.getBoundingClientRect();
                const centerX = rect.left + rect.width / 2;
                const centerY = rect.top + rect.height / 2;
                
                // Create mouse events with proper coordinates
                const createMouseEvent = (type, detail = 1) => {
                    return new MouseEvent(type, {
                        bubbles: true,
                        cancelable: true,
                        view: window,
                        detail: detail,
                        screenX: centerX,
                        screenY: centerY,
                        clientX: centerX,
                        clientY: centerY,
                        button: 0,
                        buttons: 1
                    });
                };
                
                // Dispatch the sequence synchronously
                video.dispatchEvent(createMouseEvent('mousedown', 1));
                video.dispatchEvent(createMouseEvent('mouseup', 1));
                video.dispatchEvent(createMouseEvent('click', 1));
                
                // Immediate second click
                video.dispatchEvent(createMouseEvent('mousedown', 2));
                video.dispatchEvent(createMouseEvent('mouseup', 2));
                video.dispatchEvent(createMouseEvent('click', 2));
                video.dispatchEvent(createMouseEvent('dblclick', 2));
                
                // Also try direct fullscreen in the same event context
                try {
                    if (video.requestFullscreen) {
                        video.requestFullscreen();
                    } else if (video.webkitRequestFullscreen) {
                        video.webkitRequestFullscreen();
                    } else if (video.mozRequestFullScreen) {
                        video.mozRequestFullScreen();
                    }
                } catch (e) {
                    console.log('Direct fullscreen failed:', e);
                }

                return true;
            });
            
            await this.sleep(1000);
            return success;
            
        } catch (error) {
            await this.logger.error(`User gesture fullscreen failed: ${error.message}`);
            return false;
        }
    }

    async clickFullscreenButton() {
        try {
            // Move mouse to video to show controls
            await this.page.hover('video');
            await this.sleep(1500);
            
            const fullscreenSelectors = [
                '.vjs-fullscreen-control',
                'button[title*="fullscreen" i]',
                'button[aria-label*="fullscreen" i]',
                'button[aria-label*="full screen" i]',
                'button[data-testid*="fullscreen"]',
                'button[class*="fullscreen"]',
                'button:has(svg[viewBox="0 0 24 24"])',
                'button[title="Fullscreen"]',
                'button[aria-label="Fullscreen"]'
            ];

            for (const selector of fullscreenSelectors) {
                try {
                    const button = await this.page.$(selector);
                    if (button) {
                        const isVisible = await button.isIntersectingViewport();
                        if (isVisible) {
                            await this.logger.error(`Found fullscreen button: ${selector}`);
                            await button.click();
                            await this.sleep(2000);
                            
                            // Resume playback if paused
                            await this.resumePlayback();
                            
                            return true;
                        }
                    }
                } catch (e) {
                    continue;
                }
            }
            
            await this.logger.info('No fullscreen button found');
            return false;
        } catch (error) {
            await this.logger.error(`Fullscreen button click failed: ${error.message}`);
            return false;
        }
    }

    async directFullscreenAPI() {
        try {
            const success = await this.page.evaluate(() => {
                const video = document.querySelector('video');
                if (!video) return false;
                
                // Try all fullscreen methods
                const methods = [
                    'requestFullscreen',
                    'webkitRequestFullscreen',
                    'mozRequestFullScreen',
                    'msRequestFullscreen'
                ];
                
                for (const method of methods) {
                    try {
                        if (typeof video[method] === 'function') {
                            video[method]();
                            return true;
                        }
                    } catch (e) {
                        console.log(`${method} failed:`, e);
                    }
                }

                return false;
            });
            
            await this.sleep(1000);
            return success;
        } catch (error) {
            await this.logger.error(`Direct fullscreen API failed: ${error.message}`);
            return false;
        }
    }

    async mouseEventFullscreen() {
        try {
            const video = await this.page.$('video');
            if (!video) return false;
            
            const box = await video.boundingBox();
            if (!box) return false;
            
            const centerX = box.x + box.width / 2;
            const centerY = box.y + box.height / 2;
            
            // Precise mouse event simulation
            await this.page.mouse.move(centerX, centerY);
            await this.page.mouse.down();
            await this.sleep(50);
            await this.page.mouse.up();
            await this.sleep(100);
            await this.page.mouse.down();
            await this.sleep(50);
            await this.page.mouse.up();
            
            await this.sleep(2000);
            
            // Resume playback if paused (use appropriate method based on context)
            if (this.isOnYouTube) {
                await this.resumeYouTubePlayback();
            } else {
                await this.resumePlayback();
            }
            
            return await this.checkFullscreenStatus();
            
        } catch (error) {
            await this.logger.error(`Mouse event fullscreen failed: ${error.message}`);
            return false;
        }
    }

    async checkFullscreenStatus() {
        try {
            return await this.page.evaluate(() => {
                return !!(
                    document.fullscreenElement ||
                    document.webkitFullscreenElement ||
                    document.mozFullScreenElement ||
                    document.msFullscreenElement ||
                    (window.innerHeight === screen.height && window.innerWidth === screen.width)
                );
            });
        } catch (error) {
            return false;
        }
    }

    async resumePlayback() {
        try {
            await this.logger.info('▶️ Ensuring video playback is resumed...');
            
            const resumed = await this.page.evaluate(() => {
                const video = document.querySelector('video');
                if (video && video.paused) {
                    const playPromise = video.play();
                    // Handle play promise if it exists
                    if (playPromise !== undefined) {
                        playPromise.catch(e => this.logger.debug('Play promise failed:', { error: e.message }));
                    }
                    return true;
                }
                return false;
            });
            
            if (resumed) {
                await this.logger.info('✅ Video playback resumed');
            } else {
                await this.logger.info('ℹ️ Video was already playing');
            }
            
            // Use configurable delay for resume
            const resumeDelay = config?.playback?.resumePlaybackDelay || 1000;
            if (resumeDelay > 0) {
                await this.sleep(resumeDelay);
            }
            
        } catch (error) {
            await this.logger.error(`Resume playback failed: ${error.message}`);
        }
    }

    async hideVideoControls() {
        try {
            await this.logger.info('🎬 Hiding video controls for clean fullscreen...');
            
            // Move mouse away from video to hide controls (quicker movement)
            await this.page.mouse.move(50, 50); // Top-left corner
            await this.sleep(200); // Reduced delay
            
            // Also try to programmatically hide controls
            await this.page.evaluate(() => {
                const video = document.querySelector('video');
                if (video) {
                    // Try to remove controls attribute
                    video.removeAttribute('controls');
                    
                    // Hide any control overlays via CSS (less aggressive)
                    const style = document.createElement('style');
                    style.textContent = `
                        video::-webkit-media-controls-panel,
                        video::-webkit-media-controls-current-time-display,
                        video::-webkit-media-controls-time-remaining-display {
                            opacity: 0 !important;
                            transition: opacity 0.3s ease !important;
                        }
                        
                        .video-js .vjs-control-bar,
                        .vjs-control-bar {
                            opacity: 0 !important;
                            transition: opacity 0.3s ease !important;
                        }
                    `;
                    document.head.appendChild(style);
                }
            });
            
            await this.logger.info('✅ Video controls hidden');
            
        } catch (error) {
            await this.logger.error(`Hide controls failed: ${error.message}`);
        }
    }

    async getDebugInfo() {
        try {
            await this.ensureBrowserAndPage();
            if (!this.page) {
                return { error: 'Page not available' };
            }
            
            const debugInfo = await this.page.evaluate(() => {
                const video = document.querySelector('video');
                return {
                    url: window.location.href,
                    title: document.title,
                    video: video ? {
                        src: video.src || video.currentSrc,
                        readyState: video.readyState,
                        paused: video.paused,
                        currentTime: video.currentTime,
                        duration: video.duration,
                        width: video.videoWidth,
                        height: video.videoHeight
                    } : null,
                    fullscreen: {
                        enabled: document.fullscreenEnabled,
                        element: document.fullscreenElement?.tagName || null
                    },
                    timestamp: new Date().toISOString()
                };
            });
            
            // Add YouTube-specific info if applicable
            if (this.isOnYouTube) {
                debugInfo.youtube = {
                    isOnYouTube: this.isOnYouTube,
                    videoInfo: this.youtubeVideoInfo,
                    sessionSubtitlePreference: this.sessionSubtitlePreference
                };
            }
            
            return debugInfo;
        } catch (error) {
            return { error: error.message };
        }
    }

    async restartBrowser() {
        try {
            if (this.browser) {
                await this.browser.close();
            }
        } catch (error) {
            await this.logger.error(`Error closing browser: ${error.message}`);
        }
        
        // Reset YouTube state
        this.isOnYouTube = false;
        this.youtubeVideoInfo = null;
        this.sessionSubtitlePreference = null;
        
        await this.initializeBrowser();
    }

    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    async start() {
        const bindHost = config.channelChanger?.bindHost || '127.0.0.1';
        this.app.listen(PORT, bindHost, () => {
            this.logger.info(`🎬 Enhanced Channel Changer v2 running on ${bindHost}:${PORT}`);
            this.logger.info(`📊 Health check: http://localhost:${PORT}/health`);
            this.logger.info(`🔍 Debug info: http://localhost:${PORT}/debug`);
            this.logger.info(`🏥 Browser health: http://localhost:${PORT}/browser-health`);
            this.logger.info(`📋 Logs: ${this.logger.getLogFilePath()}`);
            this.logger.info('');
            this.logger.info('🎬 Starting Chrome for Discord streaming...');
            this.logger.info('📺 Use Discord to stream the Chrome window that opens');
            this.logger.info('🎮 Then use /change commands in Discord to control channels');
            this.logger.info('📺 Or use /youtube commands to play YouTube videos');
            this.logger.info('🎬 Use /youtube-subtitles commands to control captions');
            this.logger.info('🔧 Use /fix-browser if you experience freezing issues');
            this.logger.info('');
        });

        // Auto-start browser
        setTimeout(() => {
            this.initializeBrowser();
        }, 1000);

        // Graceful shutdown handlers
        const gracefulShutdown = async (signal) => {
            await this.logger.info(`\n🛑 Received ${signal}, shutting down gracefully...`);
            try {
                if (this.browser) {
                    await this.logger.info('🔒 Closing browser...');
                    await this.browser.close();
                    await this.logger.info('✅ Browser closed successfully');
                }
            } catch (error) {
                await this.logger.error('Error during browser shutdown', error);
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
    }
}

// Start the service
const changer = new ChannelChanger();
changer.start();

module.exports = { ChannelChanger };
