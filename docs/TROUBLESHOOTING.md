# Troubleshooting Guide

## Bot Issues

### "Bot doesn't respond to commands"

**Symptoms**: Type `/guide` but nothing happens

**Cause**: Usually permissions or token issues

**Fix**:
1. Check `.env` has correct `DISCORD_TOKEN`
2. Verify bot is in the `tv-remote` channel (or whatever you set in config)
3. Check console for errors like "Invalid token"
4. Ensure bot has proper permissions in Discord server
5. Try restarting the bot service

**Additional Debugging**:
```bash
# Check if bot is running
ps aux | grep node  # Linux/Mac
tasklist | findstr node  # Windows

# Check console output for errors
node tunarr-bot.js
```

### "You don't have permission to use this bot"

**Symptoms**: Bot responds but says no permission

**Fix**: 
1. Run `/permissions` to see your status
2. Make sure you're in the right Discord channel
3. Check if you need specific roles in `config.js`
4. Verify `allowedChannels` array in configuration
5. Check `allowedRoles` and `allowedUsers` settings

**Configuration Check**:
```javascript
// In config.js, verify these settings:
permissions: {
    allowedChannels: ['tv-remote'], // Your channel name here
    allowedRoles: [],               // Add required roles if needed
    allowedUsers: [],               // Add user IDs if needed
    ephemeralResponses: true
}
```

### "Command not found" or slash commands not working

**Symptoms**: Discord says command doesn't exist

**Cause**: Bot not properly registered or permissions missing

**Fix**:
1. Check console for "Successfully reloaded application (/) commands"
2. Verify `GUILD_ID` in `.env` matches your Discord server
3. Ensure bot has `applications.commands` scope
4. Wait up to 1 hour for Discord to update commands globally
5. Try re-inviting the bot with correct permissions

## Timing Issues

### "Time left is completely wrong"

**Status**: ✅ **FIXED IN v0.1.1** - Bot now uses Guide API for accurate timestamps

**Historical Issue** (v0.1.0 and earlier): Timing calculations could be wrong due to stale channel start times

**Current Behavior** (v0.1.1+):
- Bot uses `/api/guide/channels/{id}` for accurate program start/stop times
- Timing calculations match Tunarr web GUI exactly
- Automatic fallback chain: Guide API → now_playing API → manual calculation

**If you still experience timing issues**:
1. Check if Tunarr server time matches your system time
2. Verify Guide API is working: `http://192.168.1.100:8000/api/guide/channels`
3. Check console logs for API errors or fallback warnings
4. Ensure you're running v0.1.1 or later

**Manual API Test**:
```bash
# Test the Guide API endpoint (v0.1.1+)
curl "http://192.168.1.100:8000/api/guide/channels/CHANNEL_ID?dateFrom=$(date -d '1 hour ago' +%s)000&dateTo=$(date -d '1 hour' +%s)000"

# Check if timestamps make sense
node -e "console.log(new Date(1704067200000))"
```

### "Current program is wrong"

**Status**: ✅ **FIXED IN v0.1.1** - Program detection now matches Tunarr web GUI

**Historical Issue** (v0.1.0 and earlier): Could show wrong program due to stale timing data

**Current Behavior** (v0.1.1+):
- Bot uses Guide API with accurate start/stop timestamps
- Current program identified by matching current time to guide window
- Program detection matches Tunarr web GUI exactly

**If program detection is still wrong**:
1. Verify Tunarr Guide API is accessible: `http://192.168.1.100:8000/api/guide/channels`
2. Check console logs for "Using fallback: now_playing API" warnings
3. Ensure no Tunarr filler content is interfering (filler support experimental)
4. Check bot logs in `logs/discord-bot/` for detailed timing calculations

**Debugging Steps**:
```javascript
// Check what timing method is being used (look for these in logs):
// "Fetching guide data from Guide API" = PRIMARY (accurate)
// "Using fallback: now_playing API" = FALLBACK (approximate timing)
// "Using manual calculation" = LAST RESORT (may be inaccurate)
```

## Channel Changing Issues

### "Failed to change automatically"

**Symptoms**: Bot finds channel but can't switch

**Cause**: Channel-changer service not running or browser issues

**Fix**:
1. Check if `http://localhost:3001/health` responds
2. Make sure Chrome/Chromium is installed
3. Try restarting channel-changer service
4. Check logs for browser automation errors

**Service Check**:
```bash
# Test channel changer health
curl http://localhost:3001/health

# Start channel changer service
node channel-changer.js

# Check if Chrome is installed
chrome --version  # Linux/Mac
"C:\Program Files\Google\Chrome\Application\chrome.exe" --version  # Windows
```

### "Browser opens but doesn't go fullscreen"

**Symptoms**: Channel changes but video isn't fullscreen

**Cause**: Browser automation issues with fullscreen detection

**Fix**:
1. Try the `/change` command again (it tries multiple methods)
2. Manually double-click the video player
3. Check browser console for JavaScript errors
4. Update Chrome/Chromium to latest version

**Manual Debugging**:
```javascript
// In channel-changer.js, add debug logging:
console.log('Attempting fullscreen method 1...');
await page.evaluate(() => {
    const video = document.querySelector('video');
    if (video) video.requestFullscreen();
});
```

## Network and Connection Issues

### "Failed to fetch channels from Tunarr"

**Symptoms**: Bot can't connect to Tunarr server

**Fix**:
1. Verify Tunarr server is running and accessible
2. Check `TUNARR_BASE_URL` in `.env` file
3. Test API manually: `http://your-tunarr-server:8000/api/channels`
4. Check firewall settings on both machines
5. Verify network connectivity between bot and Tunarr

**Network Testing**:
```bash
# Test basic connectivity
ping 192.168.1.100

# Test specific port
telnet 192.168.1.100 8000

# Test API endpoint
curl http://192.168.1.100:8000/api/channels
```

### "TMDB API errors" or "No poster found"

**Symptoms**: Missing movie/TV show posters

**Fix**:
1. Verify `TMDB_API_KEY` in `.env` file
2. Check if TMDB integration is enabled in `config.js`
3. Test TMDB API manually with your key
4. Bot automatically falls back to channel icons

**TMDB Testing**:
```bash
# Test TMDB API manually
curl "https://api.themoviedb.org/3/search/multi?api_key=YOUR_KEY&query=Matrix"
```

## Installation Issues

### "Cannot find module discord.js"

**Symptoms**: Node.js can't find required dependencies

**Fix**: 
```bash
# Run npm install in the project folder
cd /path/to/tunarr-bot
npm install

# Check if package.json exists
ls -la package.json

# Clear npm cache if issues persist
npm cache clean --force
npm install
```

### "Port 3001 already in use"

**Symptoms**: Channel changer service won't start

**Fix**: 
```bash
# Kill existing process (Windows)
taskkill /f /im node.exe

# Kill existing process (Linux/Mac)
lsof -ti:3001 | xargs kill -9

# Or change port in config.js
channelChanger: {
    url: 'http://localhost:3002'  // Use different port
}
```

### "Permission denied" file access errors

**Symptoms**: Bot can't read/write files

**Fix**:
```bash
# Check file permissions (Linux/Mac)
ls -la .env config.js

# Fix permissions if needed
chmod 644 .env config.js

# On Windows, check if files are read-only
attrib .env config.js
```

## Performance Issues

### Bot responds slowly

**Symptoms**: Commands take a long time to respond

**Causes and Fixes**:
1. **Slow TMDB API**: Increase timeout or disable TMDB
2. **Network latency**: Check connection to Tunarr server
3. **Heavy browser automation**: Optimize Puppeteer settings
4. **Memory issues**: Restart bot service, check system resources

**Performance Monitoring**:
```javascript
// Add timing to commands
console.time('guide-command');
// ... command logic ...
console.timeEnd('guide-command');
```

### High memory usage

**Symptoms**: Bot uses excessive RAM

**Fix**:
1. Restart bot service regularly
2. Check for memory leaks in browser automation
3. Limit number of concurrent operations
4. Consider headless browser optimizations

## Getting Help

**When asking for help, include this information**:

1. **Command that failed**: Exact command you ran
2. **Error message**: Complete error from console
3. **Operating System**: Windows/Mac/Linux version
4. **Configuration**: Contents of your `config.js` (remove sensitive tokens)
5. **Environment**: Contents of `.env` (remove actual tokens/keys)
6. **Bot version**: Check `CHANGELOG.md` for current version
7. **Node.js version**: Output of `node --version`

**Useful debugging commands**:
```bash
# Check Node.js version
node --version

# Check npm version
npm --version

# Check bot configuration (without tokens)
node -e "const config = require('./config'); console.log(JSON.stringify(config, null, 2))"

# Test Tunarr connectivity
curl http://192.168.1.100:8000/api/channels | head

# Check Discord bot permissions
# Use /permissions command in Discord
```

**Log file locations**:
- **Windows**: `C:\TunarrBot\logs\` (if logging to file)
- **Linux/Mac**: `./logs/` in project directory
- **Console output**: Always check terminal/command prompt where bot is running

Remember: Most issues are configuration-related. Double-check your `.env` file and `config.js` settings first!