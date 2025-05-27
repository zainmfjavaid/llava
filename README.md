# llava - AI Meeting Notes

An Electron application for real-time meeting transcription and AI-powered note generation.

## Features

- Real-time audio transcription using Deepgram
- AI-powered meeting notes generation
- Cross-platform support (macOS, Windows, Linux)
- Audio level monitoring
- Microphone permission handling

## Development

```bash
# Install dependencies
npm install

# Test ffmpeg installation
npm run test-ffmpeg

# Start development server
npm start
```

## Building for Distribution

### Important: Cross-Platform FFmpeg Support

This application uses `ffmpeg-static` which downloads platform-specific binaries during installation. To build for different platforms, you must use the correct build commands that ensure the right ffmpeg binary is included.

### Build Commands

```bash
# Build for macOS (downloads macOS ffmpeg binary)
npm run dist:mac

# Build for Windows (downloads Windows ffmpeg.exe binary)
npm run dist:win

# Build for Linux (downloads Linux ffmpeg binary)
npm run dist:linux

# Build for all platforms sequentially
npm run release
```

**Why these commands work:**
- They remove `node_modules` before building
- They set the correct `npm_config_platform` and `npm_config_arch` environment variables
- This forces `ffmpeg-static` to download the correct binary for the target platform
- The binary is then packaged with the application

### Cross-Platform Building

You can build for Windows and Linux from macOS (and vice versa) using the platform-specific commands above. The build process will:

1. Remove existing `node_modules`
2. Set platform environment variables
3. Reinstall dependencies (downloading the correct ffmpeg binary)
4. Build the application with the correct binary

## Platform-Specific Notes

### Windows
If you encounter `ENOENT spawn error` for ffmpeg on Windows:
1. **Use the correct build command**: `npm run dist:win` (not `npm run dist`)
2. See the [Windows Troubleshooting Guide](WINDOWS_TROUBLESHOOTING.md) for detailed solutions
3. Common causes include antivirus interference and incorrect build process

### macOS
- The application requires microphone permissions
- You'll be prompted to grant access when first using transcription features
- Use `npm run dist:mac` to build for macOS

### Linux
- Use `npm run dist:linux` to build for Linux
- Ensure you have the necessary system dependencies for Electron building

## Testing FFmpeg

Before building, you can verify that ffmpeg is working correctly:

```bash
npm run test-ffmpeg
```

This will show:
- Current platform and architecture
- FFmpeg binary path
- Whether the binary exists and can execute
- FFmpeg version information

## Dependencies

- Electron 28.1.0
- Deepgram SDK for transcription
- ffmpeg-static for audio processing (platform-specific binaries)
- dotenv for environment configuration

## Environment Variables

Create a `.env` file with:

```
DEEPGRAM_API_KEY=your_deepgram_api_key_here
```

## Package Configuration

The application uses a specific configuration to handle cross-platform ffmpeg binaries:

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

## Troubleshooting

### Common Issues

1. **ENOENT spawn error on Windows**: Use `npm run dist:win` instead of `npm run dist`
2. **Wrong ffmpeg binary**: Ensure you're using platform-specific build commands
3. **Antivirus blocking**: Add application to antivirus whitelist
4. **Microphone permissions**: Check system privacy settings

### Debug Information

The application provides detailed logging:
- FFmpeg path and existence checks
- Platform detection
- Resource directory contents
- Detailed error messages with solutions

### Getting Help

- **Windows Issues**: See [WINDOWS_TROUBLESHOOTING.md](WINDOWS_TROUBLESHOOTING.md)
- **FFmpeg Issues**: Run `npm run test-ffmpeg` to diagnose
- **Build Issues**: Ensure you're using the correct platform-specific build commands

## License

[Add your license information here]

## Contributing

When contributing, please ensure:
1. Test on multiple platforms when possible
2. Use the correct build commands for testing
3. Update documentation for any platform-specific changes
4. Test ffmpeg functionality with `npm run test-ffmpeg` 