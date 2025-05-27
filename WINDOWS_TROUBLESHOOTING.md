# Windows Troubleshooting Guide

## FFmpeg ENOENT Spawn Error

If you're experiencing an `ENOENT spawn error` for ffmpeg on Windows, this guide will help you resolve the issue.

### Common Causes

1. **Cross-platform Build Issue**: Building for Windows from macOS/Linux without the correct Windows binary
2. **Missing FFmpeg Binary**: The ffmpeg.exe file wasn't properly packaged with the application
3. **Antivirus Interference**: Windows Defender or other antivirus software is blocking the executable
4. **Permission Issues**: The binary doesn't have proper execution permissions

### Solutions

#### 1. Use Correct Build Commands (RECOMMENDED)

The application now includes platform-specific build commands that automatically download the correct ffmpeg binary for each platform:

```bash
# For Windows (downloads Windows ffmpeg.exe)
npm run dist:win

# For macOS (downloads macOS ffmpeg)
npm run dist:mac

# For Linux (downloads Linux ffmpeg)
npm run dist:linux
```

**Important**: These commands remove `node_modules` and reinstall dependencies with the correct platform environment variables. This ensures the right ffmpeg binary is downloaded for each target platform.

#### 2. Cross-Platform Building

When building for multiple platforms from a single machine:

```bash
# Build all platforms sequentially
npm run release
```

This will build for macOS, Windows, and Linux in sequence, ensuring each gets the correct binary.

#### 3. Testing FFmpeg Installation

Before building, you can test if ffmpeg is working correctly:

```bash
npm run test-ffmpeg
```

This will show:
- Platform and architecture
- FFmpeg path
- Whether the binary exists and can be executed

#### 4. Antivirus Software

If you still get ENOENT errors after using the correct build commands:

**Windows Defender:**
1. Open Windows Security (Windows Defender)
2. Go to "Virus & threat protection"
3. Click "Manage settings" under "Virus & threat protection settings"
4. Add an exclusion for the application folder or the specific ffmpeg.exe file

**Other Antivirus Software:**
- Add the application installation directory to your antivirus whitelist
- Temporarily disable real-time protection to test if this resolves the issue

#### 5. Manual FFmpeg Installation (Fallback)

If the bundled ffmpeg doesn't work, you can install ffmpeg system-wide:

1. Download ffmpeg from https://ffmpeg.org/download.html#build-windows
2. Extract to a folder (e.g., `C:\ffmpeg`)
3. Add the `bin` folder to your system PATH
4. Set the environment variable `FFMPEG_BIN` to point to the ffmpeg.exe location

### Development vs Production

**Development Mode:**
- Uses `ffmpeg-static` npm package
- Should work out of the box on the development platform
- Test with: `npm run test-ffmpeg`

**Production Mode (Packaged App):**
- Uses bundled ffmpeg.exe from resources
- Requires correct build process for cross-platform compatibility

### Building for Windows from macOS/Linux

The key insight is that `ffmpeg-static` downloads platform-specific binaries during installation. When you install on macOS, you only get the macOS binary. To build for Windows, you need to:

1. Remove `node_modules`
2. Reinstall with Windows environment variables
3. Build the Windows package

This is automatically handled by the `npm run dist:win` command.

### Debug Information

The application logs detailed information about ffmpeg paths and errors. Check the console output for:

- `[Main] FFmpeg path: ...`
- `[Main] Platform: win32`
- `[Main] FFmpeg exists: true/false`
- `[Main] Resources directory contents: ...`

### Package Configuration

The current `package.json` configuration:

```json
{
  "scripts": {
    "dist:win": "rm -rf node_modules && npm_config_platform=win32 npm_config_arch=x64 npm install && electron-builder --win --x64 --publish always"
  },
  "build": {
    "extraResources": [
      ".env",
      {
        "from": "node_modules/ffmpeg-static/ffmpeg*",
        "to": "ffmpeg-static/"
      }
    ]
  }
}
```

## Audio Capture Issues (No Audio Data Received)

### New in v1.0.25: Enhanced Windows Audio Support

The application now includes comprehensive Windows audio troubleshooting with automatic fallback mechanisms:

#### Automatic Fixes Applied:
- **Enhanced device detection** with multiple fallback options
- **Improved timing** between Deepgram connection and FFmpeg startup
- **Better error handling** with specific Windows guidance
- **Automatic fallback devices** when primary device fails
- **Enhanced FFmpeg arguments** for Windows DirectShow compatibility

#### If You Still Get "No Audio Data Received" Error:

1. **Check Microphone Privacy Settings:**
   - Open Windows Settings > Privacy & Security > Microphone
   - Enable "Allow apps to access your microphone"
   - Enable "Allow desktop apps to access your microphone"
   - Ensure the toggle is ON for microphone access

2. **Verify Microphone Device:**
   - Open Windows Settings > System > Sound
   - Check that your microphone is working and set as default
   - Test recording with Windows Voice Recorder app first
   - Ensure microphone level is adequate (not muted or too low)

3. **Try Running as Administrator:**
   - Right-click the application
   - Select "Run as administrator"
   - This helps with device access permissions

4. **Update Audio Drivers:**
   - Open Device Manager
   - Expand "Audio inputs and outputs"
   - Right-click your microphone device
   - Select "Update driver"

5. **Check for Conflicting Applications:**
   - Close other apps that might be using the microphone
   - Examples: Zoom, Teams, Discord, OBS, etc.
   - Some apps can lock exclusive access to the microphone

6. **Windows Defender/Antivirus:**
   - Add the application folder to your antivirus exclusions
   - Temporarily disable real-time protection to test
   - Check if the ffmpeg.exe process is being blocked

#### New Diagnostic Features:

The application now provides detailed error messages for Windows users:
- Specific guidance for permission issues
- Device detection failures with suggested fixes
- Automatic retry with fallback devices
- Enhanced logging for troubleshooting

### Still Having Issues?

1. Ensure you're using the correct build commands (`npm run dist:win` for Windows)
2. Check that the build process completes without errors
3. Verify that `ffmpeg.exe` exists in the application's resources/ffmpeg-static folder
4. Try running the application as administrator (temporarily)
5. Check Windows audio device settings
6. Test with `npm run test-ffmpeg` before building
7. **NEW**: Check the console for detailed error messages and automatic fallback attempts

### Environment Variables

You can override the ffmpeg path by setting the `FFMPEG_BIN` environment variable to point to a working ffmpeg installation.

### Advanced Troubleshooting

If the enhanced automatic fixes don't resolve your issue:

1. **Manual Device Testing:**
   - Open Command Prompt as administrator
   - Run: `ffmpeg -f dshow -list_devices true -i dummy`
   - Check that your microphone device appears in the list

2. **DirectShow Filters:**
   - Some Windows systems may need additional DirectShow filters
   - Consider installing K-Lite Codec Pack or LAV Filters

3. **Windows Audio Service:**
   - Press Win+R, type `services.msc`
   - Ensure "Windows Audio" service is running
   - Restart it if necessary 