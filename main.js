// main.js
require('dotenv').config();
const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const ffmpegPath = require('ffmpeg-static');
const { createClient, LiveTranscriptionEvents } = require('@deepgram/sdk');
const fs = require('fs');
const { exec } = require('child_process');

let audioRecordingProcess = null;
let transcriptionConnection = null;
let audioLevelProcess = null;

function createWindow() {
  const win = new BrowserWindow({
    width: 1100,
    height: 800,
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
  if (audioRecordingProcess || transcriptionConnection) {
    console.log('Transcription already running');
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
      interim_results: false,
      utterance_end_ms: 1000,
      vad_events: true,
      diarize: true,
      encoding: 'linear16',
      sample_rate: 16000,
      channels: 1
    });

    // Handle transcription events
    transcriptionConnection.on(LiveTranscriptionEvents.Open, () => {
      console.log('[Deepgram] Connection opened');
    });

    transcriptionConnection.on(LiveTranscriptionEvents.Transcript, (data) => {
      console.log('[Deepgram] Transcript received:', data);
      event.sender.send('transcription-result', data);
    });

    transcriptionConnection.on(LiveTranscriptionEvents.Error, (error) => {
      console.error('[Deepgram] Error:', error);
      event.sender.send('transcription-error', error);
    });

    transcriptionConnection.on(LiveTranscriptionEvents.Close, () => {
      console.log('[Deepgram] Connection closed');
    });


    // Setup FFmpeg arguments for audio capture with input queue buffering
    const args = ['-y', '-fflags', 'nobuffer', '-thread_queue_size', '512'];
    
    if (process.platform === 'darwin') {
      args.push('-f', 'avfoundation', '-i', ':0', '-vn');
    } else if (process.platform === 'win32') {
      args.push('-f', 'dshow', '-i', 'audio=Stereo Mix');
    } else {
      args.push('-f', 'pulse', '-i', 'default');
    }
    
    // Configure audio codec
    args.push('-ac', '1', '-ar', '16000', '-acodec', 'pcm_s16le', '-f', 'wav', '-');

    console.log('[FFmpeg] Starting with args:', args.join(' '));
    audioRecordingProcess = spawn(ffmpegPath, args);

    // Handle audio data
    audioRecordingProcess.stdout.on('data', (chunk) => {
      // Send to Deepgram for live transcription
      if (transcriptionConnection && transcriptionConnection.getReadyState() === 1) {
        transcriptionConnection.send(chunk);
      }
    });

    audioRecordingProcess.stderr.on('data', (data) => {
      console.error('[FFmpeg] Error:', data.toString());
    });

    audioRecordingProcess.on('exit', (code) => {
      console.log('[FFmpeg] Process exited with code:', code);
      audioRecordingProcess = null;
    });

    console.log('[Main] Transcription started');
    return 'Recording started';

  } catch (error) {
    console.error('[Main] Failed to start transcription:', error);
    throw error;
  }
});

ipcMain.handle('stop-transcription', () => {
  console.log('[Main] Stopping transcription...');
  
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
        console.log('FFmpeg output:', stderr);
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
        
        console.log('Detected audio devices:', audioDevices);
        resolve(audioDevices.length > 0 ? audioDevices[0] : { id: '0', name: 'Built-in Microphone' });
      });
    } else if (process.platform === 'win32') {
      exec(`${ffmpegCmd} -list_devices true -f dshow -i dummy`, { encoding: 'utf8' }, (error, stdout, stderr) => {
        console.log('FFmpeg Windows output:', stderr);
        const output = stderr || stdout;
        const lines = output.split('\n');
        
        for (const line of lines) {
          const audioMatch = line.match(/"([^"]+)"\s+\(audio\)/);
          if (audioMatch) {
            console.log('Found Windows audio device:', audioMatch[1]);
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
  console.log('Opening sound settings for platform:', process.platform);

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

// Allow both invoke (promise) and fire-and-forget send usage
ipcMain.handle('open-sound-settings', () => {
  launchSystemSoundSettings();
});

ipcMain.on('open-sound-settings', () => {
  launchSystemSoundSettings();
});

ipcMain.handle('start-audio-monitoring', (event) => {
  if (audioLevelProcess) return;
  
  const args = ['-f'];
  
  if (process.platform === 'darwin') {
    args.push('avfoundation', '-i', ':0');
  } else if (process.platform === 'win32') {
    args.push('dshow', '-i', 'audio=default');
  } else {
    args.push('pulse', '-i', 'default');
  }
  
  args.push('-ac', '1', '-ar', '16000', '-acodec', 'pcm_s16le', '-f', 'null', '-');
  
  audioLevelProcess = spawn(ffmpegPath, args);
  
  audioLevelProcess.stderr.on('data', (data) => {
    const output = data.toString();
    
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
  
  audioLevelProcess.on('exit', () => {
    audioLevelProcess = null;
  });
});

ipcMain.handle('stop-audio-monitoring', () => {
  if (audioLevelProcess) {
    audioLevelProcess.kill('SIGTERM');
    audioLevelProcess = null;
  }
}); 