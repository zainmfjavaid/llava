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
const { execSync } = require('child_process');

// Determine ffmpeg path with fallback logic
let ffmpegPath;
if (app.isPackaged) {
  // Primary path: ffmpeg binary in ffmpeg-static directory
  const primaryPath = path.join(process.resourcesPath, 'ffmpeg-static', 'ffmpeg' + (process.platform === 'win32' ? '.exe' : ''));
  // Fallback path: old structure (direct in resources)
  const fallbackPath = path.join(process.resourcesPath, 'ffmpeg' + (process.platform === 'win32' ? '.exe' : ''));
  
  if (fs.existsSync(primaryPath)) {
    ffmpegPath = primaryPath;
  } else if (fs.existsSync(fallbackPath)) {
    ffmpegPath = fallbackPath;
    console.log('[Main] Using fallback ffmpeg path');
  } else {
    ffmpegPath = primaryPath; // Use primary path for error reporting
  }
} else {
  ffmpegPath = require('ffmpeg-static');
}

// Debug ffmpeg path
console.log('[Main] FFmpeg path:', ffmpegPath);
console.log('[Main] App is packaged:', app.isPackaged);
console.log('[Main] Platform:', process.platform);
if (app.isPackaged) {
  console.log('[Main] Resources path:', process.resourcesPath);
  console.log('[Main] Expected ffmpeg location:', path.join(process.resourcesPath, 'ffmpeg-static'));
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
      
      // Check if ffmpeg-static directory exists
      const ffmpegStaticPath = path.join(process.resourcesPath, 'ffmpeg-static');
      if (fs.existsSync(ffmpegStaticPath)) {
        const ffmpegStaticContents = fs.readdirSync(ffmpegStaticPath);
        console.log('[Main] ffmpeg-static directory contents:', ffmpegStaticContents);
      } else {
        console.error('[Main] ffmpeg-static directory not found at:', ffmpegStaticPath);
      }
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

// Function to start FFmpeg audio capture after Deepgram connection is ready
function startFFmpegCapture(event, ffmpegPath, args, deviceName) {
  console.log('[Main] ===== STARTING FFMPEG AUDIO CAPTURE =====');
  console.log('[Main] FFmpeg binary path:', ffmpegPath);
  console.log('[Main] FFmpeg arguments:', args);
  console.log('[Main] Full command would be:', `"${ffmpegPath}" ${args.join(' ')}`);
  console.log('[Main] Target device:', deviceName);
  console.log('[Main] Platform:', process.platform);
  console.log('[Main] Deepgram connection ready state:', transcriptionConnection.getReadyState());
  
  // Send device info to renderer for debugging
  event.sender.send('ffmpeg-capturing-from', deviceName);

  console.log('[Main] Spawning FFmpeg process...');
  audioRecordingProcess = spawn(ffmpegPath, args);
  
  console.log('[Main] ✓ FFmpeg process spawned successfully');
  console.log('[Main] Process PID:', audioRecordingProcess.pid);
  console.log('[Main] Process command:', audioRecordingProcess.spawnargs ? audioRecordingProcess.spawnargs.join(' ') : 'N/A');
  
  // Add timeout to detect if no audio data comes through
  const audioDataTimeout = setTimeout(() => {
    if (audioChunkCount === 0) {
      console.error('[Main] ❌ CRITICAL: No audio data received after 5 seconds');
      console.error('[Main] This indicates FFmpeg is not capturing audio properly');
      console.error('[Main] FFmpeg may have failed silently or device access was denied');
      
      // Windows-specific diagnostics
      if (process.platform === 'win32') {
        console.error('[Main] Windows-specific troubleshooting:');
        console.error('[Main] 1. Check if Windows microphone privacy settings allow this app');
        console.error('[Main] 2. Verify the device name:', deviceName);
        console.error('[Main] 3. Try running as administrator');
        console.error('[Main] 4. Check Windows audio driver updates');
        console.error('[Main] FFmpeg args used:', args.join(' '));
      }
      
      event.sender.send('transcription-error', 'No audio data received - check microphone permissions and device');
    }
  }, 5000);

  // Add error handling for spawn
  audioRecordingProcess.on('error', (error) => {
    console.error('[Main] FFmpeg spawn error:', error);
    let errorMessage = `FFmpeg error: ${error.message}`;
    
    // Provide more helpful error messages for common Windows issues
    if (process.platform === 'win32' && error.code === 'ENOENT') {
      errorMessage += '\n\nThis usually means:\n' +
        '1. FFmpeg binary was not found at the expected location\n' +
        '2. The binary might not have the correct permissions\n' +
        '3. Windows Defender or antivirus might be blocking the executable\n\n' +
        `Expected path: ${ffmpegPath}\n` +
        'Try rebuilding the application or check if antivirus is blocking the file.';
    }
    
    event.sender.send('transcription-error', errorMessage);
    audioRecordingProcess = null;
  });

  // Track audio data flow
  let audioChunkCount = 0;
  let totalAudioBytes = 0;
  let connectionReadyLogged = false;
  
  // Handle audio data
  audioRecordingProcess.stdout.on('data', (chunk) => {
    audioChunkCount++;
    totalAudioBytes += chunk.length;
    
    // Clear the timeout on first audio data
    if (audioChunkCount === 1) {
      clearTimeout(audioDataTimeout);
      console.log('[Main] ✅ First audio data received - FFmpeg is working');
    }
    
    // Enhanced logging for first 10 chunks and then every 50th
    if (audioChunkCount <= 10 || audioChunkCount % 50 === 0) {
      console.log(`[Main] ===== AUDIO CHUNK ${audioChunkCount} =====`);
      console.log(`[Main] Chunk size: ${chunk.length} bytes`);
      console.log(`[Main] Total audio received: ${totalAudioBytes} bytes`);
      console.log(`[Main] Audio rate: ${(totalAudioBytes / (audioChunkCount * 0.1)).toFixed(0)} bytes/sec (estimated)`);
      
      // Sample first few bytes for debugging
      if (chunk.length > 0) {
        const sampleBytes = chunk.slice(0, Math.min(8, chunk.length));
        console.log(`[Main] First ${sampleBytes.length} bytes:`, Array.from(sampleBytes).map(b => `0x${b.toString(16).padStart(2, '0')}`).join(' '));
      }
    }
    
    // Send to Deepgram for live transcription
    const connectionState = transcriptionConnection ? transcriptionConnection.getReadyState() : null;
    
    if (transcriptionConnection && connectionState === 1) {
      if (!connectionReadyLogged) {
        console.log('[Main] ===== STARTING AUDIO STREAM TO DEEPGRAM =====');
        console.log('[Main] Deepgram connection ready, starting audio stream');
        console.log('[Main] First chunk being sent has', chunk.length, 'bytes');
        connectionReadyLogged = true;
      }
      
      try {
        transcriptionConnection.send(chunk);
        
        if (audioChunkCount <= 10) { // Log first 10 sends in detail
          console.log(`[Main] ✓ Successfully sent audio chunk ${audioChunkCount} to Deepgram (${chunk.length} bytes)`);
          console.log(`[Main] Connection state after send: ${transcriptionConnection.getReadyState()}`);
        }
        
        // Periodic confirmation that audio is still flowing
        if (audioChunkCount % 100 === 0) {
          console.log(`[Main] ✓ Audio streaming continues - sent ${audioChunkCount} chunks (${totalAudioBytes} total bytes)`);
        }
        
      } catch (sendError) {
        console.error(`[Main] ✗ Failed to send audio chunk ${audioChunkCount}:`, sendError);
        console.error(`[Main] Connection state during error: ${connectionState}`);
      }
      
    } else {
      if (audioChunkCount <= 20) { // Log more attempts to help debug connection timing
        console.warn(`[Main] ✗ Cannot send audio chunk ${audioChunkCount} - Deepgram not ready`);
        console.warn(`[Main] Connection state: ${connectionState} (1=OPEN, 0=CONNECTING, 2=CLOSING, 3=CLOSED)`);
        console.warn(`[Main] Connection object exists: ${!!transcriptionConnection}`);
      }
      
      // If we have audio but connection isn't ready after many chunks, this indicates an issue
      if (audioChunkCount === 20 && connectionState !== 1) {
        console.error('[Main] ===== AUDIO/CONNECTION TIMING ISSUE DETECTED =====');
        console.error('[Main] WARNING: Audio is flowing but Deepgram connection is not ready after 20 chunks');
        console.error('[Main] Connection state:', connectionState);
        console.error('[Main] This may indicate a Windows-specific audio/connection timing issue');
        console.error('[Main] Total audio buffered:', totalAudioBytes, 'bytes');
      }
    }
  });

  audioRecordingProcess.stderr.on('data', (data) => {
    const output = data.toString();
    console.log('[Main] ===== FFMPEG STDERR OUTPUT =====');
    console.log('[Main] Raw stderr:', JSON.stringify(output));
    console.log('[Main] Stderr content:', output);
    
    // Look for specific indicators that FFmpeg is working
    if (output.includes('Stream mapping:')) {
      console.log('[Main] ✓ FFmpeg stream mapping detected - audio capture should be starting');
    }
    if (output.includes('Press [q] to stop')) {
      console.log('[Main] ✓ FFmpeg is ready and capturing audio');
    }
    if (output.includes('Input #0')) {
      console.log('[Main] ✓ FFmpeg detected input source');
    }
    if (output.includes('Audio:')) {
      console.log('[Main] ✓ FFmpeg detected audio stream configuration');
    }
    if (output.includes('size=')) {
      console.log('[Main] ✓ FFmpeg is processing audio data');
    }
    
    // Look for error patterns
    if (output.toLowerCase().includes('error')) {
      console.error('[Main] ✗ FFmpeg stderr contains error:', output);
    }
    if (output.toLowerCase().includes('failed')) {
      console.error('[Main] ✗ FFmpeg stderr contains failure:', output);
    }
    if (output.toLowerCase().includes('cannot')) {
      console.error('[Main] ✗ FFmpeg stderr contains "cannot":', output);
    }
    
    // Windows DirectShow specific messages
    if (process.platform === 'win32') {
      if (output.includes('DirectShow')) {
        console.log('[Main] ✓ Windows DirectShow detected in output');
      }
      if (output.includes('dshow')) {
        console.log('[Main] ✓ DirectShow filter referenced');
      }
    }
  });

  audioRecordingProcess.on('exit', (code, signal) => {
    console.log('[Main] ===== FFMPEG PROCESS EXITED =====');
    console.log('[Main] Exit code:', code);
    console.log('[Main] Exit signal:', signal);
    console.log(`[Main] Total audio chunks processed: ${audioChunkCount}`);
    console.log(`[Main] Total bytes processed: ${totalAudioBytes}`);
    console.log('[Main] Process duration: from spawn to exit');
    console.log('[Main] Cleanup: Setting audioRecordingProcess to null');
    audioRecordingProcess = null;
  });
}

ipcMain.handle('start-transcription', async (event) => {
  if (audioRecordingProcess || transcriptionConnection) {
    return;
  }

  const apiKey = process.env.DEEPGRAM_API_KEY;
  console.log('[Main] ===== STARTING DEEPGRAM TRANSCRIPTION =====');
  console.log('[Main] Deepgram API key check:', apiKey ? 'Key found' : 'Key missing');
  console.log('[Main] API key length:', apiKey ? apiKey.length : 0);
  console.log('[Main] API key prefix:', apiKey ? apiKey.substring(0, 8) + '...' : 'none');
  
  if (!apiKey) {
    throw new Error('DEEPGRAM_API_KEY not set in environment');
  }

  try {
    // Create Deepgram client
    console.log('[Main] Creating Deepgram client...');
    const deepgram = createClient(apiKey);
    console.log('[Main] Deepgram client created successfully');

    // Setup live transcription connection
    console.log('[Main] Configuring live transcription with options:');
    const transcriptionConfig = {
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
    };
    console.log('[Main] Transcription config:', JSON.stringify(transcriptionConfig, null, 2));
    
    console.log('[Main] Creating live transcription connection...');
    transcriptionConnection = deepgram.listen.live(transcriptionConfig);
    console.log('[Main] Live transcription connection created');

    // Handle transcription events
    transcriptionConnection.on(LiveTranscriptionEvents.Open, () => {
      console.log('[Main] ===== DEEPGRAM CONNECTION OPENED =====');
      console.log('[Main] Connection ready state:', transcriptionConnection.getReadyState());
      console.log('[Main] Connection is ready to receive audio data');
      event.sender.send('transcription-status', 'Deepgram connection opened');
      
      // Start FFmpeg after a short delay to ensure Deepgram is fully ready
      console.log('[Main] Scheduling FFmpeg start in 100ms...');
      setTimeout(() => {
        console.log('[Main] Starting FFmpeg capture now...');
        startFFmpegCapture(event, ffmpegPath, args, deviceName);
      }, 100);
    });

    transcriptionConnection.on(LiveTranscriptionEvents.Transcript, (data) => {
      console.log('[Main] ===== TRANSCRIPTION RECEIVED =====');
      console.log('[Main] Raw transcription data:', JSON.stringify(data, null, 2));
      
      // Analyze the transcription data structure
      if (data.channel && data.channel.alternatives) {
        console.log('[Main] Number of alternatives:', data.channel.alternatives.length);
        data.channel.alternatives.forEach((alt, index) => {
          console.log(`[Main] Alternative ${index}:`, {
            transcript: alt.transcript,
            confidence: alt.confidence,
            words_count: alt.words ? alt.words.length : 0
          });
        });
      }
      
      console.log('[Main] Transcription metadata:', {
        is_final: data.is_final,
        speech_final: data.speech_final,
        start: data.start,
        duration: data.duration,
        from_finalize: data.from_finalize
      });
      
      event.sender.send('transcription-result', data);
    });

    transcriptionConnection.on(LiveTranscriptionEvents.Error, (error) => {
      console.error('[Main] ===== DEEPGRAM ERROR =====');
      console.error('[Main] Error type:', typeof error);
      console.error('[Main] Error message:', error.message || 'No message');
      console.error('[Main] Error code:', error.code || 'No code');
      console.error('[Main] Full error object:', JSON.stringify(error, null, 2));
      console.error('[Main] Connection state at error:', transcriptionConnection ? transcriptionConnection.getReadyState() : 'null');
      event.sender.send('transcription-error', error.message || error.toString());
    });

    transcriptionConnection.on(LiveTranscriptionEvents.Close, () => {
      console.log('[Main] ===== DEEPGRAM CONNECTION CLOSED =====');
      console.log('[Main] Connection state:', transcriptionConnection ? transcriptionConnection.getReadyState() : 'null');
      console.log('[Main] Close event timestamp:', new Date().toISOString());
      event.sender.send('transcription-status', 'Deepgram connection closed');
    });

    // Add additional event listeners for more detailed monitoring
    transcriptionConnection.on(LiveTranscriptionEvents.Metadata, (data) => {
      console.log('[Main] ===== DEEPGRAM METADATA =====');
      console.log('[Main] Metadata received:', JSON.stringify(data, null, 2));
    });

    transcriptionConnection.on(LiveTranscriptionEvents.SpeechStarted, (data) => {
      console.log('[Main] ===== SPEECH STARTED =====');
      console.log('[Main] Speech started event:', JSON.stringify(data, null, 2));
    });

    transcriptionConnection.on(LiveTranscriptionEvents.UtteranceEnd, (data) => {
      console.log('[Main] ===== UTTERANCE END =====');
      console.log('[Main] Utterance end event:', JSON.stringify(data, null, 2));
    });

    transcriptionConnection.on(LiveTranscriptionEvents.Warning, (data) => {
      console.warn('[Main] ===== DEEPGRAM WARNING =====');
      console.warn('[Main] Warning received:', JSON.stringify(data, null, 2));
    });


    // Setup FFmpeg arguments for audio capture with AWS virtual audio support
    const args = ['-y'];
    let deviceName = 'default'; // Initialize device name variable
    
    if (process.platform === 'darwin') {
      args.push('-f', 'avfoundation', '-i', ':0', '-vn');
      deviceName = 'Default microphone';
    } else if (process.platform === 'win32') {
      // Configure AWS virtual audio for simultaneous capture and output
      const awsConfig = configureAWSVirtualAudio();
      
      if (awsConfig) {
        console.log('[Main] Using AWS virtual audio configuration for mixed audio capture');
        
        // Get physical microphone device (not AWS virtual)
        const physicalMic = getWindowsPhysicalMicrophone();
        console.log('[Main] Physical microphone device:', physicalMic);
        console.log('[Main] System audio device:', awsConfig.captureDevice);
        
        if (physicalMic) {
          // Capture both physical mic AND system audio, then mix
          deviceName = `${physicalMic} + ${awsConfig.captureDevice}`;
          event.sender.send('device-chosen', `Mixed Audio: ${deviceName} (with speaker output)`);
          
          // Input 0: Physical microphone
          args.push('-f', 'dshow');
          args.push('-audio_buffer_size', '20');
          args.push('-rtbufsize', '100M');
          args.push('-thread_queue_size', '512');
          args.push('-i', `audio=${physicalMic}`);
          
          // Input 1: System audio via AWS virtual device
          args.push('-f', 'dshow');
          args.push('-audio_buffer_size', '20');
          args.push('-rtbufsize', '100M');
          args.push('-thread_queue_size', '512');
          args.push('-i', `audio=${awsConfig.captureDevice}`);
          
          // Mix both inputs together
          args.push('-filter_complex', '[0:a][1:a]amix=inputs=2:duration=longest[aout]');
          args.push('-map', '[aout]');
          
          // Send AWS configuration info to renderer
          event.sender.send('aws-audio-configured', {
            capture: deviceName,
            output: awsConfig.outputDevice,
            status: 'Physical microphone + System audio mixed, with speaker output enabled'
          });
        } else {
          // Use AWS Virtual Audio but configure it to capture microphone input
          console.log('[Main] No physical mic found, configuring AWS Virtual Audio for microphone input');
          
          // Try to use the AWS virtual microphone device which should route actual mic input
          deviceName = 'Microphone (AWS Virtual Microphone Device)';
          event.sender.send('device-chosen', `AWS Virtual Microphone: ${deviceName}`);
          
          // Enhanced FFmpeg settings for AWS virtual device
          args.push('-f', 'dshow');
          args.push('-audio_buffer_size', '50');   // Larger buffer for virtual devices
          args.push('-rtbufsize', '50M');          
          args.push('-thread_queue_size', '1024'); // Larger queue
          args.push('-use_wallclock_as_timestamps', '1');
          args.push('-fflags', '+genpts');
          args.push('-probesize', '32');           // Faster probing
          args.push('-analyzeduration', '0');      // Skip analysis for faster start
          args.push('-i', `audio=${deviceName}`);
          
          event.sender.send('aws-audio-configured', {
            capture: deviceName,
            output: awsConfig.outputDevice,
            status: 'AWS Virtual Microphone configured for microphone input'
          });
        }
        
      } else {
        // Enhanced fallback with virtual device detection
        deviceName = getWindowsAudioDevice();
        console.log('[Main] Using Windows microphone device:', deviceName);
        
        // Check if we're about to use a virtual device
        const isVirtualDevice = deviceName && (
          deviceName.toLowerCase().includes('aws virtual') ||
          deviceName.toLowerCase().includes('virtual microphone') ||
          deviceName.toLowerCase().includes('line (aws')
        );
        
        if (isVirtualDevice) {
          console.error('[Main] ⚠️ CRITICAL: Detected virtual audio device for microphone input');
          console.error('[Main] Virtual devices capture system audio, not microphone input');
          console.error('[Main] This will result in no audio data for speech transcription');
          
          // Try enhanced device detection to find real microphones
          const realDevice = getEnhancedWindowsDevice();
          if (realDevice && realDevice !== deviceName && !realDevice.toLowerCase().includes('virtual')) {
            console.log('[Main] Found alternative real device:', realDevice);
            deviceName = realDevice;
          } else {
            console.error('[Main] No real microphone devices found on system');
            console.error('[Main] User needs to connect a physical microphone');
            
            // Send error to renderer with specific guidance
            event.sender.send('transcription-error', 
              'No physical microphone detected.\n\n' +
              'The system only found virtual audio devices which capture system audio, not microphone input.\n\n' +
              'Please:\n' +
              '1. Connect a physical microphone (USB, headset, or built-in)\n' +
              '2. Check Windows sound settings to ensure microphone is detected\n' +
              '3. Test microphone in Windows Voice Recorder first\n' +
              '4. Restart the application after connecting a microphone'
            );
            return 'No physical microphone available';
          }
        }
        
        event.sender.send('device-chosen', deviceName);
        
        // Windows-specific DirectShow capture for microphone (input #0)
        args.push('-f', 'dshow');
        args.push('-audio_buffer_size', '50');  // Increased for stability
        args.push('-rtbufsize', '50M');         // Adjusted buffer size
        args.push('-thread_queue_size', '1024'); // Larger queue
        args.push('-use_wallclock_as_timestamps', '1'); // Better timing
        args.push('-i', `audio=${deviceName}`);

        // Try to capture system audio as second input and mix (optional)
        const sysDevice = getWindowsSystemAudioDevice(deviceName);
        if (sysDevice) {
          console.log('[Main] Using Windows system-audio device:', sysDevice);
          args.push('-f', 'dshow');
          args.push('-audio_buffer_size', '50');
          args.push('-rtbufsize', '50M');
          args.push('-thread_queue_size', '1024');
          args.push('-use_wallclock_as_timestamps', '1');
          args.push('-i', `audio=${sysDevice}`);
          args.push('-filter_complex', '[0:a][1:a]amix=inputs=2:duration=longest:dropout_transition=2[aout]');
          args.push('-map', '[aout]');
        }
      }
    } else {
      args.push('-f', 'pulse', '-i', 'default');
      deviceName = 'Default microphone';
    }
    
    // Configure audio codec
    args.push('-ac', '1', '-ar', '16000', '-acodec', 'pcm_s16le', '-f', 'wav', '-');

    return 'Recording started';

  } catch (error) {
    console.error('[Main] Failed to start transcription:', error);
    throw error;
  }
});

ipcMain.handle('stop-transcription', () => {
  console.log('[Main] ===== STOPPING TRANSCRIPTION =====');
  
  // Stop audio recording process
  if (audioRecordingProcess) {
    console.log('[Main] Stopping FFmpeg process (PID:', audioRecordingProcess.pid, ')');
    audioRecordingProcess.kill('SIGINT');
    audioRecordingProcess = null;
    console.log('[Main] ✓ FFmpeg process stop signal sent');
  } else {
    console.log('[Main] No FFmpeg process to stop');
  }

  // Close Deepgram connection
  if (transcriptionConnection) {
    console.log('[Main] Closing Deepgram connection (state:', transcriptionConnection.getReadyState(), ')');
    transcriptionConnection.finish();
    transcriptionConnection = null;
    console.log('[Main] ✓ Deepgram connection finished');
  } else {
    console.log('[Main] No Deepgram connection to close');
  }

  console.log('[Main] ===== TRANSCRIPTION STOPPED =====');
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
      const devName = getWindowsAudioDevice();
      resolve({ id: '0', name: devName });
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
  } else if (process.platform === 'win32') {
    // Open Windows microphone privacy settings
    exec('cmd /c start "" ms-settings:privacy-microphone', (error) => {
      if (error) {
        console.error('Error opening Windows privacy settings:', error);
        // Fallback to system settings home
        exec('control /name Microsoft.Privacy', (fallbackError) => {
          if (fallbackError) {
            console.error('Fallback privacy settings also failed:', fallbackError);
          }
        });
      }
    });
  } else {
    // For other platforms, open sound settings as fallback
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
  
  const args = ['-y'];
  
  if (process.platform === 'darwin') {
    // Use default microphone input - this will trigger permission dialog
    args.push('-f', 'avfoundation', '-i', ':0');  // Default microphone
  } else if (process.platform === 'win32') {
    const devName = getWindowsAudioDevice();
    console.log('[Main] Monitoring Windows device:', devName);
    
    // Windows-specific configuration for DirectShow
    args.push('-f', 'dshow');
    
    // Critical Windows settings for reliable audio capture
    args.push('-audio_buffer_size', '20');  // Smaller buffer for lower latency
    args.push('-rtbufsize', '100M');        // Larger real-time buffer
    args.push('-thread_queue_size', '512'); // Thread queue for buffering
    
    // Pass device name without extra quotes for the same reason as above (see transcription args)
    args.push('-i', `audio=${devName}`);
  } else {
    args.push('-f', 'pulse', '-i', 'default');
  }
  
  args.push('-ac', '1', '-ar', '16000', '-acodec', 'pcm_s16le', '-f', 'null', '-');
  
  console.log('[Main] Starting audio monitoring with args:', args);
  console.log('[Main] Full FFmpeg command would be:', ffmpegPath, args.join(' '));
  
  audioLevelProcess = spawn(ffmpegPath, args);
  
  audioLevelProcess.on('error', (error) => {
    console.error('[Main] Audio monitoring spawn error:', error);
    console.error('[Main] Error code:', error.code);
    console.error('[Main] Error errno:', error.errno);
    console.error('[Main] Error syscall:', error.syscall);
    console.error('[Main] Error path:', error.path);
    
    let errorMessage = error.message;
    
    // Provide more helpful error messages for common Windows issues
    if (process.platform === 'win32' && error.code === 'ENOENT') {
      errorMessage += '\n\nFFmpeg binary not found. This usually means:\n' +
        '1. The application was not built correctly for Windows\n' +
        '2. Antivirus software is blocking the executable\n' +
        '3. The binary lacks proper permissions\n\n' +
        `Expected path: ${ffmpegPath}`;
    }
    
    event.sender.send('audio-monitoring-error', errorMessage);
  });

  audioLevelProcess.stderr.on('data', (data) => {
    const output = data.toString();
    console.log('[Main] Audio monitoring stderr:', output);
    
    // Check for Windows-specific errors
    if (process.platform === 'win32') {
      if (output.includes('Cannot find a device named')) {
        console.error('[Main] Windows device not found error');
        event.sender.send('audio-monitoring-error', `Device not found: ${output}`);
        return;
      }
      if (output.includes('Could not open input device')) {
        console.error('[Main] Windows input device error');
        event.sender.send('audio-monitoring-error', `Could not open input device: ${output}`);
        return;
      }
      if (output.includes('No such file or directory')) {
        console.error('[Main] Windows file not found error');
        event.sender.send('audio-monitoring-error', `File/device not found: ${output}`);
        return;
      }
    }
    
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
    
    // Only treat as error if it's not a normal or expected termination
    // SIGTERM (15) and SIGINT (2) are normal shutdown signals
    // Code 255 with SIGTERM is also normal for FFmpeg
    // Code 1 can be normal for device testing/monitoring on Windows
    const isNormalExit = (
      code === 0 || 
      code === null || 
      signal === 'SIGTERM' || 
      signal === 'SIGINT' || 
      (code === 255 && signal === null) ||
      (code === 1 && process.platform === 'win32' && signal === null) // Windows device testing
    );
    
    if (!isNormalExit) {
      console.error('[Main] Unexpected audio monitoring exit');
      event.sender.send('audio-monitoring-error', `Process exited unexpectedly with code ${code}`);
    } else {
      console.log('[Main] Audio monitoring stopped normally');
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

// Add handler for enabling audio output during recording
ipcMain.handle('enable-audio-output', () => {
  return enableAudioOutput();
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

// util: detect default Windows audio device name
function getWindowsAudioDevice() {
  try {
    console.log('[Main] Attempting to enumerate Windows audio devices...');
    console.log('[Main] FFmpeg path for device enumeration:', ffmpegPath);
    const command = `"${ffmpegPath}" -list_devices true -f dshow -i dummy`;
    console.log('[Main] Running command:', command);
    
    // Use both stdout and stderr since FFmpeg outputs device list to stderr
    const result = execSync(command, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
    console.log('[Main] Device enumeration stdout:', result);
  } catch (e) {
    // FFmpeg device listing writes to stderr and exits with code 1, so catch the output
    console.log('[Main] Device enumeration stderr (expected):', e.stderr);
    
    if (e.stderr) {
      const lines = e.stderr.split(/\r?\n/);
      const foundDevices = [];
      
      for (const line of lines) {
        console.log('[Main] Checking line:', line);
        const m = line.match(/"([^\"]+)"\s+\(audio\)/i);
        if (m) {
          foundDevices.push(m[1]);
          console.log('[Main] Found audio device:', m[1]);
        }
      }
      
      console.log('[Main] All detected devices:', foundDevices);
      
      // Enhanced device filtering to prioritize real microphones
      console.log('[Main] All detected audio devices:', foundDevices);
      
      // Filter out ALL virtual devices
      const realDevices = foundDevices.filter(device => {
        const deviceLower = device.toLowerCase();
        return !deviceLower.includes('aws virtual') &&
               !deviceLower.includes('line (aws') &&
               !deviceLower.includes('speakers (aws') &&
               !deviceLower.includes('virtual audio cable') &&
               !deviceLower.includes('virtual microphone') &&
               !deviceLower.includes('stereo mix') &&
               !deviceLower.includes('what u hear');
      });
      
      console.log('[Main] Real (non-virtual) devices:', realDevices);
      
      // Prioritize actual microphone devices
      const microphoneDevices = realDevices.filter(device => {
        const deviceLower = device.toLowerCase();
        return deviceLower.includes('microphone') ||
               deviceLower.includes('mic') ||
               deviceLower.includes('built-in') ||
               deviceLower.includes('realtek') ||
               deviceLower.includes('intel') ||
               deviceLower.includes('usb audio') ||
               deviceLower.includes('headset') ||
               deviceLower.includes('webcam');
      });
      
      console.log('[Main] Microphone-specific devices:', microphoneDevices);
      
      if (microphoneDevices.length > 0) {
        console.log('[Main] ✓ Using real microphone device:', microphoneDevices[0]);
        return microphoneDevices[0];
      }
      
      if (realDevices.length > 0) {
        console.log('[Main] ✓ Using real audio device:', realDevices[0]);
        return realDevices[0];
      }
      
      // Last resort: warn user about virtual device limitations
      console.warn('[Main] ⚠️ WARNING: No real microphone devices found!');
      console.warn('[Main] Only virtual devices available - these may not capture microphone input');
      console.warn('[Main] Please connect a physical microphone or check device settings');
      
      if (foundDevices.length > 0) {
        console.log('[Main] ⚠️ Using virtual device (may not work for mic input):', foundDevices[0]);
        return foundDevices[0];
      }
    }
    
    // If device enumeration completely failed, log the error
    if (e.code !== 1) {  // Code 1 is expected for device listing
      console.error('[Main] Unexpected error during device enumeration:', e);
      console.error('[Main] Error code:', e.code);
      console.error('[Main] Error status:', e.status);
      console.error('[Main] Error signal:', e.signal);
    }
  }
  
  // Return common Windows microphone names as fallbacks (excluding AWS virtual devices)
  console.log('[Main] No specific device found, trying common Windows microphone names');
  const commonNames = [
    'Microphone (Realtek High Definition Audio)',
    'Microphone Array (Intel Smart Sound Technology for Digital Microphones)', 
    'Built-in Microphone',
    'Microphone',
    'Default'
  ];
  
  // Try to verify each fallback device works
  for (const deviceName of commonNames) {
    try {
      console.log('[Main] Testing device:', deviceName);
      // Use a gentler test - just try to open the device briefly
      execSync(`"${ffmpegPath}" -f dshow -i audio="${deviceName}" -t 0.1 -f null -`, 
        { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'], timeout: 3000 });
      console.log('[Main] Device works:', deviceName);
      return deviceName;
    } catch (testError) {
      console.log('[Main] Device test failed for:', deviceName, '- trying next fallback');
      // Don't log full error details for each failed test to reduce noise
    }
  }
  
  console.log('[Main] All fallbacks failed, using Default');
  return 'Default';
}

// Enhanced Windows device detection with more thorough testing
function getEnhancedWindowsDevice() {
  // Expanded list of common real microphone devices
  const commonNames = [
    'Microphone (Realtek High Definition Audio)',
    'Microphone Array (Intel Smart Sound Technology for Digital Microphones)',
    'Built-in Microphone',
    'Internal Microphone', 
    'USB Audio Device',
    'Headset Microphone',
    'Webcam Microphone',
    'Microphone (USB Audio Device)',
    'Microphone (2- USB Audio Device)',
    'Microphone (C920 HD Pro Webcam)',
    'Microphone (HD Pro Webcam C920)',
    'Microphone',
    'Default'
  ];
  
  console.log('[Main] Testing enhanced device list for real microphones:', commonNames);
  
  // Try to verify each device works and is NOT a virtual device
  for (const deviceName of commonNames) {
    // Skip virtual devices completely
    if (deviceName.toLowerCase().includes('virtual') || 
        deviceName.toLowerCase().includes('aws') ||
        deviceName.toLowerCase().includes('line (')) {
      console.log('[Main] Skipping virtual device:', deviceName);
      continue;
    }
    
    try {
      console.log('[Main] Testing enhanced device:', deviceName);
      
      // More thorough test - try to capture audio for a bit longer
      const testCommand = `"${ffmpegPath}" -f dshow -audio_buffer_size 50 -i audio="${deviceName}" -t 0.5 -f null -`;
      
      execSync(testCommand, { 
        encoding: 'utf8', 
        stdio: ['pipe', 'pipe', 'pipe'], 
        timeout: 5000 
      });
      
      console.log('[Main] ✓ Enhanced device test passed:', deviceName);
      return deviceName;
      
    } catch (testError) {
      console.log('[Main] Enhanced device test failed for:', deviceName);
      
      // Log specific error for debugging
      if (testError.stderr) {
        const errorOutput = testError.stderr.toString();
        if (errorOutput.includes('Cannot find') || errorOutput.includes('No such')) {
          console.log('[Main] Device not found:', deviceName);
        } else if (errorOutput.includes('Permission') || errorOutput.includes('Access')) {
          console.log('[Main] Permission issue with device:', deviceName);
        } else {
          console.log('[Main] Other issue with device:', deviceName, '- continuing');
        }
      }
    }
  }
  
  console.log('[Main] All enhanced device tests failed, no real microphones found');
  return null; // Return null to indicate no real device found
}

// === Function to get physical microphone (non-AWS virtual device) ===
function getWindowsPhysicalMicrophone() {
  try {
    console.log('[Main] Searching for physical microphone devices...');
    const command = `"${ffmpegPath}" -list_devices true -f dshow -i dummy`;
    
    const result = execSync(command, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
  } catch (e) {
    if (e.stderr) {
      const lines = e.stderr.split(/\r?\n/);
      const physicalMics = [];
      
      for (const line of lines) {
        const m = line.match(/"([^\"]+)"\s+\(audio\)/i);
        if (m) {
          const deviceName = m[1];
          // Exclude AWS virtual devices to find physical microphones
          if (!deviceName.toLowerCase().includes('aws virtual') && 
              !deviceName.toLowerCase().includes('line (aws') &&
              !deviceName.toLowerCase().includes('speakers (aws')) {
            physicalMics.push(deviceName);
          }
        }
      }
      
      console.log('[Main] Found physical microphones:', physicalMics);
      
      // Test each physical microphone to find a working one
      for (const micName of physicalMics) {
        try {
          console.log('[Main] Testing physical microphone:', micName);
          execSync(`"${ffmpegPath}" -f dshow -i audio="${micName}" -t 0.1 -f null -`, 
            { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'], timeout: 3000 });
          console.log('[Main] Physical microphone works:', micName);
          return micName;
        } catch (testError) {
          console.log('[Main] Physical microphone test failed for:', micName);
        }
      }
    }
  }
  
  // Fallback to common physical microphone names
  const commonPhysicalMics = [
    'Microphone (Realtek High Definition Audio)',
    'Microphone Array (Intel Smart Sound Technology for Digital Microphones)',
    'Built-in Microphone',
    'Internal Microphone',
    'Microphone'
  ];
  
  for (const micName of commonPhysicalMics) {
    try {
      console.log('[Main] Testing fallback physical microphone:', micName);
      execSync(`"${ffmpegPath}" -f dshow -i audio="${micName}" -t 0.1 -f null -`, 
        { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'], timeout: 3000 });
      console.log('[Main] Fallback physical microphone works:', micName);
      return micName;
    } catch (testError) {
      console.log('[Main] Fallback microphone test failed for:', micName);
    }
  }
  
  console.log('[Main] No working physical microphone found');
  return null;
}

// === Enhanced system audio capture with device switching ===
function getWindowsSystemAudioDevice(micDevice) {
  // Prioritize AWS virtual audio devices for system capture
  const candidates = [
    'Line (AWS virtual microphone device)',  // Primary choice for system audio capture
    'virtual-audio-capturer',
    'Stereo Mix (Realtek High Definition Audio)',
    'Stereo Mix (Realtek Audio)', 
    'Stereo Mix',
    'What U Hear (Sound Blaster Audigy)',
    'Primary Sound Capture Driver'
  ];

  for (const name of candidates) {
    if (name === micDevice) continue; // skip if same as mic
    try {
      execSync(`"${ffmpegPath}" -f dshow -i audio="${name}" -t 0.1 -f null -`, {
        stdio: ['pipe', 'pipe', 'pipe'], timeout: 3000
      });
      console.log('[Main] Found working system audio device:', name);
      return name; // works!
    } catch (_) {
      // not available, continue
    }
  }
  return null; // none found
}

// === New function to handle AWS virtual audio device configuration ===
function configureAWSVirtualAudio() {
  if (process.platform !== 'win32') return null;
  
  try {
    console.log('[Main] Configuring AWS virtual audio for simultaneous capture/output...');
    
    // Try to set default playback to AWS virtual speakers to enable output
    const setPlaybackCmd = 'powershell "Get-AudioDevice -List | Where-Object {$_.Name -like \'*AWS virtual speakers*\'} | Set-AudioDevice"';
    
    try {
      execSync(setPlaybackCmd, { timeout: 5000, stdio: 'pipe' });
      console.log('[Main] Set AWS virtual speakers as default output device');
    } catch (playbackError) {
      console.log('[Main] Could not set AWS speakers as default (may not be necessary)');
    }
    
    return {
      captureDevice: 'Line (AWS virtual microphone device)',
      outputDevice: 'Speakers (AWS virtual speakers 7.1 device)'
    };
    
  } catch (error) {
    console.error('[Main] Error configuring AWS virtual audio:', error);
    return null;
  }
}

// === Function to enable audio output while maintaining capture ===
function enableAudioOutput() {
  if (process.platform !== 'win32') return false;
  
  try {
    console.log('[Main] Enabling audio output via AWS virtual speakers...');
    
    // Use AudioDeviceCmdlets or nircmd to set the audio output device
    const enableOutputCmd = 'powershell "Get-AudioDevice -List | Where-Object {$_.Name -like \'*AWS virtual speakers*\'} | Set-AudioDevice"';
    
    execSync(enableOutputCmd, { timeout: 5000, stdio: 'pipe' });
    console.log('[Main] Successfully enabled audio output');
    return true;
    
  } catch (error) {
    console.error('[Main] Failed to enable audio output:', error);
    return false;
  }
} 