// main.js
// Initialize Electron modules and load environment variables
const { app, BrowserWindow, ipcMain, screen } = require('electron');
const path = require('path');
// Load environment variables from .env (packaged vs dev)
require('dotenv').config({
  path: app.isPackaged
    ? path.join(process.resourcesPath, '.env')
    : path.join(__dirname, '.env')
});
// Add auto-update support via GitHub releases
const { updateElectronApp } = require('update-electron-app');
updateElectronApp({
  repo: 'zainmfjavaid/llava',
  updateInterval: '1 hour'
});
const { spawn } = require('child_process');
const fs = require('fs');
const { exec } = require('child_process');
const ffmpegPath = app.isPackaged 
  ? path.join(process.resourcesPath, 'ffmpeg')
  : require('ffmpeg-static');
const { 
  TranscribeStreamingClient, 
  StartStreamTranscriptionCommand
} = require('@aws-sdk/client-transcribe-streaming');
const { Readable, PassThrough } = require('stream');
const { v4: uuidv4 } = require('uuid');
const http2 = require('http2');
const WebSocket = require('ws');
const { promisify } = require('util');
const sleep = promisify(setTimeout);

// Debug ffmpeg path
console.log('[Main] FFmpeg path:', ffmpegPath);
console.log('[Main] App is packaged:', app.isPackaged);
if (app.isPackaged) {
  console.log('[Main] Resources path:', process.resourcesPath);
}

// Check if ffmpeg exists
try {
  const ffmpegExists = fs.existsSync(ffmpegPath);
  console.log('[Main] FFmpeg exists:', ffmpegExists);
  if (!ffmpegExists && app.isPackaged) {
    console.error('[Main] FFmpeg binary not found at:', ffmpegPath);
    // List contents of resources directory for debugging
    try {
      const resourcesContents = fs.readdirSync(process.resourcesPath);
      console.log('[Main] Resources directory contents:', resourcesContents);
    } catch (e) {
      console.error('[Main] Cannot read resources directory:', e);
    }
  }
} catch (e) {
  console.error('[Main] Error checking ffmpeg existence:', e);
}

let audioRecordingProcess = null;
let transcribeClient = null;
let audioPassThrough = null;
let isRestarting = false;
let audioLevelProcess = null;

function createWindow() {
  // Determine window dimensions: max 1512x857 or screen size, whichever is smaller
  const { width: screenWidth, height: screenHeight } = screen.getPrimaryDisplay().workAreaSize;
  const windowWidth = Math.min(1512, screenWidth);
  const windowHeight = Math.min(935, screenHeight);
  const win = new BrowserWindow({
    width: windowWidth,
    height: windowHeight,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true
    }
  });
  win.loadFile('index.html');
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Add connection retry function
async function createTranscribeClient(region, credentials, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      const client = new TranscribeStreamingClient({
        region,
        credentials,
        maxAttempts: 5,
        requestHandler: {
          connectionTimeout: 10000,
          socketTimeout: 300000,
          keepAlive: true,
          keepAliveMsecs: 3000,
          maxSockets: 50,
          requestTimeout: 300000 // 5 minutes
        }
      });

      // Test the connection
      await client.config.credentials();
      return client;
    } catch (error) {
      console.error(`[Main] Failed to create client (attempt ${i + 1}):`, error);
      if (i < retries - 1) {
        await sleep(1000 * Math.pow(2, i)); // Exponential backoff
        continue;
      }
      throw error;
    }
  }
}

// Add stream retry function
async function startTranscriptionStream(client, command, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      const stream = await client.send(command);
      return stream;
    } catch (error) {
      console.error(`[Main] Failed to start stream (attempt ${i + 1}):`, error);
      if (i < retries - 1) {
        await sleep(1000 * Math.pow(2, i)); // Exponential backoff
        continue;
      }
      throw error;
    }
  }
}

// Helper function for transcription with retry logic
async function startTranscriptionWithRetry(event, attempt = 1, maxRetries = 3) {
  try {
    if (isRestarting) {
      isRestarting = false;
    }

    if (audioRecordingProcess || transcribeClient) {
      cleanup();
    }

    const awsAccessKeyId = process.env.AWS_ACCESS_KEY_ID;
    const awsSecretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
    const awsRegion = process.env.AWS_REGION || 'us-east-1';

    if (!awsAccessKeyId || !awsSecretAccessKey) {
      throw new Error('AWS credentials not set in environment');
    }

    transcribeClient = await createTranscribeClient(awsRegion, {
      accessKeyId: awsAccessKeyId,
      secretAccessKey: awsSecretAccessKey
    });

    const sender = event.sender;
    let audioBuffer = Buffer.alloc(0);
    const CHUNK_SIZE = 16384; // 16 KB, safe for AWS Transcribe
    audioPassThrough = new PassThrough({
      highWaterMark: 64 * 1024, // 64 KB buffer
      allowHalfOpen: true
    });
    audioPassThrough.on('error', (error) => {
      try { cleanup(); } catch (e) {}
    });
    const args = [
      '-y', '-fflags', 'nobuffer', '-thread_queue_size', '4096', '-f'
    ];
    if (process.platform === 'darwin') {
      args.push('avfoundation', '-i', ':0');
    } else if (process.platform === 'win32') {
      args.push('dshow', '-i', 'audio=Stereo Mix');
    } else {
      args.push('pulse', '-i', 'default');
    }
    args.push('-vn', '-ac', '2', '-ar', '16000', '-acodec', 'pcm_s16le', '-f', 's16le', '-');
    audioRecordingProcess = spawn(ffmpegPath, args);
    audioRecordingProcess.on('error', (error) => {
      try {
        if (sender && !sender.isDestroyed()) {
          sender.send('transcription-error', `FFmpeg error: ${error.message}`);
        }
        cleanup();
      } catch (e) {}
    });
    audioRecordingProcess.stderr.on('data', (data) => {
      try {
        const msg = data.toString();
        if (msg.includes('AVCaptureDeviceTypeExternal is deprecated')) return;
        console.log('[Main] FFmpeg stderr:', msg);
      } catch (e) {}
    });
    audioRecordingProcess.on('exit', (code, signal) => {
      try {
        if (code !== 0 && code !== null && signal !== 'SIGTERM' && signal !== 'SIGINT') {
          if (sender && !sender.isDestroyed()) {
            sender.send('transcription-error', `FFmpeg process exited with code ${code}`);
          }
        }
        cleanup();
      } catch (e) {}
    });
    const streamReady = new Promise((resolve) => {
      audioPassThrough.once('readable', resolve);
    });
    audioRecordingProcess.stdout.on('data', (chunk) => {
      try {
        audioBuffer = Buffer.concat([audioBuffer, chunk]);
        while (audioBuffer.length >= CHUNK_SIZE) {
          const audioChunk = audioBuffer.slice(0, CHUNK_SIZE);
          audioBuffer = audioBuffer.slice(CHUNK_SIZE);
          if (audioPassThrough && !audioPassThrough.destroyed) {
            const writeSuccess = audioPassThrough.write(audioChunk);
            if (!writeSuccess && audioRecordingProcess && !audioRecordingProcess.killed) {
              audioRecordingProcess.stdout.pause();
              audioPassThrough.once('drain', () => {
                try {
                  if (audioRecordingProcess && !audioRecordingProcess.killed) {
                    audioRecordingProcess.stdout.resume();
                  }
                } catch (e) {}
              });
            }
          }
        }
      } catch (error) {
        cleanup();
        throw error;
      }
    });
    await streamReady;
    async function* audioGenerator() {
      try {
        let retryCount = 0;
        const maxRetries = 3;
        let lastChunkTime = Date.now();
        const keepAliveInterval = 2000;
        let isFirstChunk = true;
        while (retryCount < maxRetries) {
          try {
            for await (const chunk of audioPassThrough) {
              if (chunk && chunk.length > 0) {
                if (isFirstChunk) {
                  await new Promise(resolve => setTimeout(resolve, 100));
                  isFirstChunk = false;
                }
                const now = Date.now();
                if (now - lastChunkTime > keepAliveInterval) {
                  yield { AudioEvent: { AudioChunk: Buffer.alloc(2) } };
                }
                yield { AudioEvent: { AudioChunk: chunk } };
                lastChunkTime = now;
                await new Promise(resolve => setTimeout(resolve, 20));
              }
            }
            break;
          } catch (error) {
            retryCount++;
            if (retryCount < maxRetries) {
              await new Promise(resolve => setTimeout(resolve, 1000));
              if (audioPassThrough && !audioPassThrough.destroyed) {
                audioPassThrough.removeAllListeners();
                audioPassThrough.end();
              }
              audioPassThrough = new PassThrough({
                highWaterMark: 64 * 1024,
                allowHalfOpen: true
              });
              continue;
            }
            cleanup();
            throw error;
          }
        }
      } catch (error) {
        cleanup();
        throw error;
      }
    }
    const command = new StartStreamTranscriptionCommand({
      LanguageCode: 'en-US',
      MediaSampleRateHertz: 16000,
      MediaEncoding: 'pcm',
      AudioStream: audioGenerator(),
      EnablePartialResultsStabilization: true,
      ShowSpeakerLabels: false,
      NumberOfChannels: 2,
      EnableChannelIdentification: true,
      SessionId: uuidv4()
    });
    const transcribeStream = await startTranscriptionStream(transcribeClient, command);
    try {
      for await (const streamEvent of transcribeStream.TranscriptResultStream) {
        if (streamEvent.TranscriptEvent?.Transcript?.Results?.[0]?.Alternatives?.[0]) {
          const result = streamEvent.TranscriptEvent.Transcript.Results[0];
          if (sender && !sender.isDestroyed()) {
            sender.send('transcription-result', {
              Transcript: result.Alternatives[0].Transcript,
              IsPartial: !result.IsPartial,
              StartTime: result.StartTime,
              EndTime: result.EndTime
            });
          }
        }
      }
    } catch (error) {
      if (
        error.code === 'ERR_STREAM_PREMATURE_CLOSE' ||
        (error.message && error.message.includes('HTTP/2 stream is abnormally aborted'))
      ) {
        cleanup();
        if (attempt < maxRetries) {
          await sleep(1000);
          return await startTranscriptionWithRetry(event, attempt + 1, maxRetries);
        } else {
          if (sender && !sender.isDestroyed()) {
            sender.send('transcription-error', 'Stream closed prematurely after several attempts.');
          }
          return 'Stream closed prematurely after several attempts.';
        }
      }
      if (!isRestarting && (error.name === 'BadRequestException' && error.message.includes('timed out') || error.message.includes('HTTP/2 stream'))) {
        cleanup();
        isRestarting = true;
        await new Promise(resolve => setTimeout(resolve, 1000));
        sender.send('start-transcription');
        return 'Restarting...';
      } else {
        if (sender && !sender.isDestroyed()) {
          sender.send('transcription-error', error.message || error.toString());
        }
        cleanup();
        return error.message || error.toString();
      }
    }
    return 'Recording started';
  } catch (error) {
    if (event.sender && !event.sender.isDestroyed()) {
      event.sender.send('transcription-error', error.message || error.toString());
    }
    return error.message || error.toString();
  }
}

// Use the helper in the handler
ipcMain.handle('start-transcription', async (event) => {
  return await startTranscriptionWithRetry(event, 1, 3);
});

// Add handler for restart
ipcMain.on('start-transcription', async (event) => {
  try {
    await ipcMain.handle('start-transcription', event);
  } catch (error) {
    console.error('[Main] Error during restart:', error);
    event.sender.send('transcription-error', error.message || error.toString());
  }
});

function cleanup() {
  try {
    if (audioRecordingProcess) {
      audioRecordingProcess.stdout.removeAllListeners();
      audioRecordingProcess.stderr.removeAllListeners();
      audioRecordingProcess.removeAllListeners();
      audioRecordingProcess.kill('SIGINT');
      audioRecordingProcess = null;
    }
  } catch (error) {
    console.error('[Main] Error killing FFmpeg process:', error);
  }

  try {
    if (audioPassThrough) {
      audioPassThrough.removeAllListeners();
      audioPassThrough.end();
      audioPassThrough = null;
    }
  } catch (error) {
    console.error('[Main] Error ending PassThrough stream:', error);
  }

  try {
    if (transcribeClient) {
      transcribeClient.destroy();
      transcribeClient = null;
    }
  } catch (error) {
    console.error('[Main] Error destroying Transcribe client:', error);
  }
}

ipcMain.handle('stop-transcription', () => {
  cleanup();
  console.log('[Main] Transcription stopped');
  return 'Recording stopped';
});

ipcMain.handle('get-audio-devices', async () => {
  return new Promise((resolve) => {
    const ffmpegCmd = `"${ffmpegPath}"`;
    
    if (process.platform === 'darwin') {
      exec(`${ffmpegCmd} -f avfoundation -list_devices true -i ""`, { encoding: 'utf8' }, (error, stdout, stderr) => {
        const output = stderr || stdout;
        const lines = output.split('\n');
        const audioDevices = [];
        
        let inAudioSection = false;
        for (const line of lines) {
          if (line.includes('AVFoundation audio devices:')) {
            inAudioSection = true;
            continue;
          }
          if (inAudioSection && line.includes('AVFoundation video devices:')) {
            break;
          }
          if (inAudioSection && line.includes('] ')) {
            const match = line.match(/\[(\d+)\] (.+)/);
            if (match) {
              audioDevices.push({
                id: match[1],
                name: match[2].trim()
              });
            }
          }
        }
        
        resolve(audioDevices.length > 0 ? audioDevices[0] : { id: '0', name: 'Built-in Microphone' });
      });
    } else if (process.platform === 'win32') {
      exec(`${ffmpegCmd} -list_devices true -f dshow -i dummy`, { encoding: 'utf8' }, (error, stdout, stderr) => {
        const output = stderr || stdout;
        const lines = output.split('\n');
        
        for (const line of lines) {
          const audioMatch = line.match(/"([^"]+)"\s+\(audio\)/);
          if (audioMatch) {
            resolve({ id: '0', name: audioMatch[1] });
            return;
          }
        }
        resolve({ id: '0', name: 'Default Microphone' });
      });
    } else {
      resolve({ id: 'default', name: 'Default Microphone' });
    }
  });
});

function launchSystemSoundSettings() {
  if (process.platform === 'darwin') {
    // Newer macOS versions support the x-apple URL scheme which is more reliable.
    exec('open "x-apple.systempreferences:com.apple.preference.sound"', (error) => {
      if (error) {
        console.error('Error opening macOS sound settings:', error);
        // Fallback to the classic preference-pane path
        exec('open "/System/Library/PreferencePanes/Sound.prefPane"');
      }
    });
  } else if (process.platform === 'win32') {
    // Use cmd /c start with a dummy window-title so it works when invoked via exec
    exec('cmd /c start "" ms-settings:sound', (error) => {
      if (error) {
        console.error('Error opening Windows sound settings:', error);
        // Fallback to control panel
        exec('control mmsys.cpl');
      }
    });
  } else {
    exec('gnome-control-center sound', (error) => {
      if (error) {
        console.error('Error opening Linux sound settings:', error);
        // Try alternative commands
        exec('pavucontrol || alsamixer');
      }
    });
  }
}

function launchPrivacySettings() {
  if (process.platform === 'darwin') {
    // Try to open directly to Privacy & Security settings
    exec('open "x-apple.systempreferences:com.apple.preference.security?Privacy"', (error) => {
      if (error) {
        console.error('Error opening macOS privacy settings:', error);
        // Fallback to Security & Privacy pane
        exec('open "/System/Library/PreferencePanes/Security.prefPane"', (fallbackError) => {
          if (fallbackError) {
            console.error('Fallback also failed, opening System Preferences:', fallbackError);
            exec('open "/Applications/System Preferences.app"');
          }
        });
      }
    });
  } else {
    // For other platforms, fall back to sound settings
    launchSystemSoundSettings();
  }
}

// Allow both invoke (promise) and fire-and-forget send usage
ipcMain.handle('open-sound-settings', () => {
  launchSystemSoundSettings();
});

ipcMain.on('open-sound-settings', () => {
  launchSystemSoundSettings();
});

// Add handler for privacy settings
ipcMain.handle('open-privacy-settings', () => {
  launchPrivacySettings();
});

ipcMain.handle('start-audio-monitoring', (event) => {
  if (audioLevelProcess) return;
  
  const args = ['-f'];
  
  if (process.platform === 'darwin') {
    // Use default microphone input - this will trigger permission dialog
    args.push('avfoundation', '-i', ':0');  // Default microphone
  } else if (process.platform === 'win32') {
    args.push('dshow', '-i', 'audio=default');
  } else {
    args.push('pulse', '-i', 'default');
  }
  
  args.push('-ac', '1', '-ar', '16000', '-acodec', 'pcm_s16le', '-f', 'null', '-');
  
  console.log('[Main] Starting audio monitoring with args:', args);
  audioLevelProcess = spawn(ffmpegPath, args);
  
  audioLevelProcess.on('error', (error) => {
    console.error('[Main] Audio monitoring spawn error:', error);
    event.sender.send('audio-monitoring-error', error.message);
  });

  audioLevelProcess.stderr.on('data', (data) => {
    const output = data.toString();
    console.log('[Main] Audio monitoring output:', output);
    
    // Check for permission denied errors
    if (output.includes('Operation not permitted') || output.includes('Permission denied')) {
      console.error('[Main] Audio permission denied');
      event.sender.send('audio-monitoring-error', 'Permission denied');
      return;
    }
    
    // Look for volume level in FFmpeg output
    const volumeMatch = output.match(/volume:\s*(-?\d+\.?\d*)/);
    if (volumeMatch) {
      const volume = parseFloat(volumeMatch[1]);
      // Convert dB to 0-8 scale (rough approximation)
      const level = Math.max(0, Math.min(8, Math.floor((volume + 60) / 8)));
      event.sender.send('audio-level', level);
    }
    
    // Alternative: look for size info as a rough audio activity indicator
    const sizeMatch = output.match(/size=\s*(\d+)kB/);
    if (sizeMatch) {
      const size = parseInt(sizeMatch[1]);
      const level = Math.min(8, Math.floor(size / 10));
      event.sender.send('audio-level', level);
    }
  });
  
  audioLevelProcess.on('exit', (code, signal) => {
    console.log('[Main] Audio monitoring process exited with code:', code, 'signal:', signal);
    // Only treat as error if it's not a normal termination
    // SIGTERM (15) and SIGINT (2) are normal shutdown signals
    // Code 255 with SIGTERM is also normal for FFmpeg
    if (code !== 0 && code !== null && signal !== 'SIGTERM' && signal !== 'SIGINT' && !(code === 255 && signal === null)) {
      event.sender.send('audio-monitoring-error', `Process exited with code ${code}`);
    }
    audioLevelProcess = null;
  });
});

ipcMain.handle('stop-audio-monitoring', () => {
  if (audioLevelProcess) {
    audioLevelProcess.kill('SIGTERM');
    audioLevelProcess = null;
  }
});

// Check microphone permission status
ipcMain.handle('check-microphone-permission', async () => {
  if (process.platform === 'darwin') {
    const { systemPreferences } = require('electron');
    try {
      const microphoneStatus = systemPreferences.getMediaAccessStatus('microphone');
      console.log('[Main] Microphone permission status:', microphoneStatus);
      return microphoneStatus;
    } catch (error) {
      console.error('[Main] Error checking microphone permission:', error);
      return 'not-determined';
    }
  }
  // On other platforms, assume granted
  return 'granted';
});

// Request microphone permission
ipcMain.handle('request-microphone-permission', async () => {
  if (process.platform === 'darwin') {
    const { systemPreferences } = require('electron');
    try {
      const granted = await systemPreferences.askForMediaAccess('microphone');
      console.log('[Main] Microphone permission granted:', granted);
      return granted;
    } catch (error) {
      console.error('[Main] Error requesting microphone permission:', error);
      return false;
    }
  }
  // On other platforms, assume granted
  return true;
}); 