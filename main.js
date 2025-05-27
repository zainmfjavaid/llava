console.log('[Main] main.js script started execution.');
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

const { createClient, LiveTranscriptionEvents } = require('@deepgram/sdk');

let audioRecordingProcess = null;
let transcriptionConnection = null;
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

ipcMain.handle('start-transcription', async (event) => {
  console.log('[Main] Received start-transcription IPC call.');
  if (audioRecordingProcess || transcriptionConnection) {
    console.warn('[Main] Start transcription called but already in progress or connection exists.');
    return;
  }

  const apiKey = process.env.DEEPGRAM_API_KEY;
  if (!apiKey) {
    throw new Error('DEEPGRAM_API_KEY not set in environment');
  }

  try {
    // Create Deepgram client
    const deepgram = createClient(apiKey);

    // Setup live transcription connection
    transcriptionConnection = deepgram.listen.live({
      model: 'nova-3',
      language: 'en-US',
      smart_format: true,
      interim_results: true,
      utterance_end_ms: 1000,
      vad_events: true,
      diarize: true,
      encoding: 'linear16',
      sample_rate: 16000,
      channels: 1
    });

    // Handle transcription events
    transcriptionConnection.on(LiveTranscriptionEvents.Open, () => {
    });

    transcriptionConnection.on(LiveTranscriptionEvents.Transcript, (data) => {
      event.sender.send('transcription-result', data);
    });

    transcriptionConnection.on(LiveTranscriptionEvents.Error, (error) => {
      event.sender.send('transcription-error', error.message || error.toString());
    });

    transcriptionConnection.on(LiveTranscriptionEvents.Close, () => {
    });


    // Setup FFmpeg arguments for audio capture with input queue buffering
    const args = ['-y', '-fflags', 'nobuffer', '-thread_queue_size', '512'];
    
    if (process.platform === 'darwin') {
      args.push('-f', 'avfoundation', '-i', ':0', '-vn');
    } else if (process.platform === 'win32') {
      // Dynamically detect the default DirectShow audio device
      const deviceName = await getDefaultDshowAudioDevice();
      console.log(`[Main] Using Windows audio device: ${deviceName}`);
      args.push('-f', 'dshow', '-i', `audio=${deviceName}`);
    } else {
      args.push('-f', 'pulse', '-i', 'default');
    }
    
    // Configure audio codec
    args.push('-ac', '1', '-ar', '16000', '-acodec', 'pcm_s16le', '-f', 'wav', '-');

    console.log('[Main] Starting ffmpeg with args:', args);
    console.log('[Main] FFmpeg binary path:', ffmpegPath);

    audioRecordingProcess = spawn(ffmpegPath, args);

    // Add error handling for spawn
    audioRecordingProcess.on('error', (error) => {
      console.error('[Main] FFmpeg spawn error:', error);
      event.sender.send('transcription-error', `FFmpeg error: ${error.message}`);
      audioRecordingProcess = null;
    });

    // Handle audio data
    audioRecordingProcess.stdout.on('data', (chunk) => {
      // Send to Deepgram for live transcription
      if (transcriptionConnection && transcriptionConnection.getReadyState() === 1) {
        transcriptionConnection.send(chunk);
      }
    });

    audioRecordingProcess.stderr.on('data', (data) => {
      console.log('[Main] FFmpeg stderr:', data.toString());
    });

    audioRecordingProcess.on('exit', (code) => {
      console.log('[Main] FFmpeg process exited with code:', code);
      audioRecordingProcess = null;
    });

    return 'Recording started';

  } catch (error) {
    console.error('[Main] Failed to start transcription:', error);
    throw error;
  }
});

ipcMain.handle('stop-transcription', () => {
  
  // Stop audio recording process
  if (audioRecordingProcess) {
    audioRecordingProcess.kill('SIGINT');
    audioRecordingProcess = null;
  }


  // Close Deepgram connection
  if (transcriptionConnection) {
    transcriptionConnection.finish();
    transcriptionConnection = null;
  }

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

// Helper: Detect first available DirectShow audio device name on Windows
async function getDefaultDshowAudioDevice() {
  return new Promise((resolve) => {
    // Build ffmpeg enumeration command
    const ffmpegCmd = `"${ffmpegPath}" -list_devices true -f dshow -i dummy`;
    exec(ffmpegCmd, { encoding: 'utf8' }, (error, stdout, stderr) => {
      const output = stderr || stdout || '';
      const lines = output.split('\n');
      for (const line of lines) {
        const match = line.match(/"([^\"]+)"\s+\(audio\)/);
        if (match) {
          resolve(match[1]); // Return the first detected audio device name
          return;
        }
      }
      // Fallback to default if none detected
      resolve('default');
    });
  });
} 