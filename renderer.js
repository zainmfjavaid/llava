// renderer.js
const initialScreen = document.getElementById('initialScreen');
const recordingScreen = document.getElementById('recordingScreen');
const recordBtn = document.getElementById('recordBtn');
const stopBtn = document.getElementById('stopBtn');
const titleInput = document.getElementById('titleInput');
const notesInput = document.getElementById('notesInput');
const audioVisualizer = document.getElementById('audioVisualizer');
const transcriptContent = document.getElementById('transcriptContent');
const recordingControls = document.getElementById('recordingControls');
const transcriptContentWrapper = document.getElementById('transcriptContentWrapper');
const settingsIcon = document.getElementById('settingsIcon');
const settingsDropdown = document.getElementById('settingsDropdown');
const audioDevice = document.getElementById('audioDevice');
const audioLevelBars = document.getElementById('audioLevelBars');
const soundSettingsBtn = document.getElementById('soundSettingsBtn');
const copyIcon = document.getElementById('copyIcon');

let currentTranscript = '';
let isRecording = false;
let filePath = null;
let autoScrollEnabled = true;    // Auto-scroll state for transcript
// --- Audio monitoring state ---
let audioContext = null;         // Web Audio context
let analyser = null;             // Web Audio analyser node
let micStream = null;            // MediaStream from getUserMedia
let monitorRaf = null;           // animationFrame id for level updates
let audioLevelInterval = null;   // legacy – kept so other code compiles (not used anymore)

// Start recording
recordBtn.addEventListener('click', async () => {
  try {
    filePath = await window.electronAPI.startTranscription();
    
    // Switch to recording screen
    initialScreen.style.display = 'none';
    recordingScreen.style.display = 'block';
    
    isRecording = true;
    currentTranscript = '';
    transcriptContent.textContent = '';
    
    // Start wave animations
    startWaveAnimations();
    
    // Show settings icon when recording starts
    settingsIcon.classList.remove('hidden');
    
    console.log('Recording started, file:', filePath);
    
  } catch (error) {
    console.error('Failed to start transcription:', error);
    alert(`Error starting recording: ${error.message}`);
  }
});

// Stop recording
stopBtn.addEventListener('click', async () => {
  try {
    const savedFile = await window.electronAPI.stopTranscription();
    isRecording = false;
    
    // Stop wave animations and set static pattern
    stopWaveAnimations();
    
    // Hide settings icon when recording stops
    settingsIcon.classList.add('hidden');
    settingsDropdown.classList.remove('show');
    stopAudioMonitoring();
    
    // Replace stop button with resume text
    stopBtn.style.display = 'none';
    const resumeText = document.createElement('span');
    resumeText.className = 'resume-text';
    resumeText.textContent = 'Resume';
    resumeText.style.cursor = 'pointer';
    stopBtn.parentNode.insertBefore(resumeText, stopBtn.nextSibling);
    
    // Expand controls to accommodate resume text
    recordingControls.classList.add('expanded');
    
    // Add click handler for resume
    resumeText.addEventListener('click', async () => {
      try {
        filePath = await window.electronAPI.startTranscription();
        isRecording = true;
        
        // Start wave animations again
        startWaveAnimations();
        
        // Show settings icon when resuming
        settingsIcon.classList.remove('hidden');
        
        // Switch back to stop button
        resumeText.remove();
        stopBtn.style.display = 'block';
        recordingControls.classList.remove('expanded');
        
      } catch (error) {
        console.error('Failed to resume recording:', error);
        alert(`Error resuming recording: ${error.message}`);
      }
    });
    
    console.log('Recording stopped, file saved:', savedFile);
    
  } catch (error) {
    console.error('Failed to stop transcription:', error);
    alert(`Error stopping recording: ${error.message}`);
  }
});

// Toggle transcript panel when audio visualizer is clicked
audioVisualizer.addEventListener('click', () => {
  recordingControls.classList.toggle('transcript-open');
});

// Wave animation functions
function startWaveAnimations() {
  const audioBars = document.querySelectorAll('.audio-bar');
  audioBars.forEach(bar => bar.classList.add('recording'));
}

function stopWaveAnimations() {
  const audioBars = document.querySelectorAll('.audio-bar');
  audioBars.forEach(bar => bar.classList.remove('recording'));
  
  // Set static short-long-short pattern
  audioBars[0].style.height = '8px';
  audioBars[1].style.height = '16px';
  audioBars[2].style.height = '8px';
}

// Handle Deepgram transcription results
window.electronAPI.onTranscriptionResult((data) => {
  console.log('[Renderer] Deepgram result:', data);
  
  if (data.channel && data.channel.alternatives && data.channel.alternatives.length > 0) {
    const alternative = data.channel.alternatives[0];
    const transcript = alternative.transcript;
    
    if (transcript && transcript.trim().length > 0) {
      if (data.is_final) {
        // Final result - add to permanent transcript
        currentTranscript += transcript + ' ';
        transcriptContent.textContent = currentTranscript;
        if (autoScrollEnabled) {
          transcriptContent.scrollTop = transcriptContent.scrollHeight;
        }
      } else {
        // Interim result - show temporarily
        transcriptContent.textContent = currentTranscript + transcript;
        if (autoScrollEnabled) {
          transcriptContent.scrollTop = transcriptContent.scrollHeight;
        }
      }
    }
  }
});

// Handle transcription errors
window.electronAPI.onTranscriptionError((error) => {
  console.error('[Renderer] Transcription error:', error);
  alert(`Transcription error: ${error.message || error}`);
});

// Auto-focus title input when recording screen appears
const observer = new MutationObserver((mutations) => {
  mutations.forEach((mutation) => {
    if (mutation.target === recordingScreen && recordingScreen.style.display === 'block') {
      titleInput.focus();
    }
  });
});

observer.observe(recordingScreen, { attributes: true, attributeFilter: ['style'] });

// Auto-resize title input
function autoResizeTitle() {
  titleInput.style.height = 'auto';
  titleInput.style.height = titleInput.scrollHeight + 'px';
}

titleInput.addEventListener('input', autoResizeTitle);
titleInput.addEventListener('focus', autoResizeTitle);

// Auto-scroll detection for transcript
function handleTranscriptScroll() {
  const isAtBottom = transcriptContent.scrollTop + transcriptContent.clientHeight >= transcriptContent.scrollHeight - 5;
  
  if (!isAtBottom) {
    // User scrolled up, disable auto-scroll
    autoScrollEnabled = false;
  } else {
    // User is at bottom, re-enable auto-scroll
    autoScrollEnabled = true;
  }
}

transcriptContent.addEventListener('scroll', handleTranscriptScroll);

// Settings functionality
settingsIcon.addEventListener('click', (e) => {
  e.stopPropagation();
  settingsDropdown.classList.toggle('show');
  
  if (settingsDropdown.classList.contains('show')) {
    startAudioMonitoring();
  } else {
    stopAudioMonitoring();
  }
});

// Prevent settings dropdown from closing when clicking inside it
settingsDropdown.addEventListener('click', (e) => {
  e.stopPropagation();
});

// Close settings when clicking outside
document.addEventListener('click', (e) => {
  if (!settingsIcon.contains(e.target) && !settingsDropdown.contains(e.target)) {
    settingsDropdown.classList.remove('show');
    stopAudioMonitoring();
  }
});

// Close transcript when clicking outside the transcript window
document.addEventListener('click', (e) => {
  if (recordingControls.classList.contains('transcript-open') && 
      !transcriptContentWrapper.contains(e.target) && 
      !audioVisualizer.contains(e.target) &&
      !recordingControls.contains(e.target)) {
    recordingControls.classList.remove('transcript-open');
  }
});

// Sound settings button
soundSettingsBtn.addEventListener('click', () => {
  window.electronAPI.openSoundSettings();
  settingsDropdown.classList.remove('show');
});

// Copy transcript functionality
copyIcon.addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(currentTranscript);
    showCopySuccess();
  } catch (error) {
    console.error('Failed to copy transcript:', error);
    
    // Fallback for older browsers
    const textArea = document.createElement('textarea');
    textArea.value = currentTranscript;
    document.body.appendChild(textArea);
    textArea.select();
    document.execCommand('copy');
    document.body.removeChild(textArea);
    
    showCopySuccess();
  }
});

function showCopySuccess() {
  const copySvg = copyIcon.querySelector('.copy-svg');
  const checkmarkSvg = copyIcon.querySelector('.checkmark-svg');
  
  // Hide copy icon and show checkmark
  copySvg.style.display = 'none';
  checkmarkSvg.style.display = 'block';
  copyIcon.style.color = '#48bb78';
  
  // Revert after 1 second
  setTimeout(() => {
    copySvg.style.display = 'block';
    checkmarkSvg.style.display = 'none';
    copyIcon.style.color = '';
  }, 1000);
}

// Load audio-input device info (primary mic name)
// 1. Try Web Media enumeration (high accuracy once mic permission is granted)
// 2. Fallback to the existing Electron IPC method
async function loadAudioDevice() {
  try {
    // Ensure permission so device labels are populated
    await navigator.mediaDevices.getUserMedia({ audio: true });

    const devices = await navigator.mediaDevices.enumerateDevices();
    const audioInputs = devices.filter((d) => d.kind === 'audioinput');

    if (audioInputs.length > 0) {
      // Prefer the currently active track label if available
      const label = audioInputs[0].label || 'Microphone';
      audioDevice.textContent = label;
      return;
    }
  } catch (err) {
    // Browser / permission error – fall back to IPC method
    console.warn('Web API audio device detection failed:', err);
  }

  // Fallback – ask main process via IPC (may be less accurate but cross-platform)
  if (window.electronAPI && window.electronAPI.getAudioDevices) {
    try {
      const device = await window.electronAPI.getAudioDevices();
      audioDevice.textContent = device.name || 'Microphone';
    } catch (ipcErr) {
      console.error('Failed to load audio device via IPC:', ipcErr);
      audioDevice.textContent = 'Unknown Device';
    }
  } else {
    audioDevice.textContent = 'Unknown Device';
  }
}

// Helper – paint level bars (0-8)
function paintAudioLevel(level) {
  const bars = audioLevelBars.querySelectorAll('.audio-level-bar');
  bars.forEach((bar, idx) => {
    if (idx < level) bar.classList.add('active');
    else bar.classList.remove('active');
  });
}

// Back-compat: still respond to IPC events if main process supplies them
if (window.electronAPI && window.electronAPI.onAudioLevel) {
  window.electronAPI.onAudioLevel(paintAudioLevel);
}

let isMonitoring = false;

// Use Web Audio analyser to compute a rough RMS every animation frame
function startAudioMonitoring() {
  if (isMonitoring) return;

  // Try Web Audio first
  navigator.mediaDevices.getUserMedia({ audio: true })
    .then((stream) => {
      micStream = stream;

      audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const source = audioContext.createMediaStreamSource(stream);

      analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);

      const dataArray = new Uint8Array(analyser.frequencyBinCount);

      // Track the peak rms (decays slowly) for auto-gain scaling
      let peakRms = 0.01; // start with a tiny value to avoid div-by-zero

      const update = () => {
        analyser.getByteTimeDomainData(dataArray);

        // Compute RMS of the waveform (0-1 range)
        let sumSquares = 0;
        for (let i = 0; i < dataArray.length; i++) {
          const val = (dataArray[i] - 128) / 128;
          sumSquares += val * val;
        }
        const rms = Math.sqrt(sumSquares / dataArray.length);

        // Update peakRms with slow decay (98% per frame for less aggressive auto-gain)
        peakRms = Math.max(rms, peakRms * 0.98);

        // Apply noise floor - ignore very quiet signals
        const noiseFloor = 0.008;
        const adjustedRms = Math.max(0, rms - noiseFloor);
        
        // Normalise against current peak to get value 0-1, then to 0-8 bars
        let norm = adjustedRms / (Math.max(peakRms - noiseFloor, 0.01));
        // Apply curve for better sensitivity - less aggressive than before
        norm = Math.pow(norm, 0.7);

        let level = Math.round(norm * 8);
        level = Math.min(6, Math.max(0, level)); // Cap at 6 instead of 8 to prevent oversensitivity

        // Show at least 1 bar only for clear signals above noise floor
        if (adjustedRms > 0.005 && level === 0) level = 1;

        paintAudioLevel(level);

        monitorRaf = requestAnimationFrame(update);
      };

      update();
      isMonitoring = true;
    })
    .catch((err) => {
      console.error('Web Audio monitoring failed:', err);
      // Fallback to IPC-based monitoring
      if (window.electronAPI && window.electronAPI.startAudioMonitoring) {
        window.electronAPI.startAudioMonitoring();
        isMonitoring = true;
      }
    });
}

function stopAudioMonitoring() {
  if (!isMonitoring) return;

  // Stop Web Audio path
  if (monitorRaf) cancelAnimationFrame(monitorRaf);
  monitorRaf = null;

  if (micStream) {
    micStream.getTracks().forEach((t) => t.stop());
    micStream = null;
  }

  if (audioContext) {
    audioContext.close();
    audioContext = null;
    analyser = null;
  }

  // Clear bars
  paintAudioLevel(0);

  // Tell main process to stop IPC monitoring if it was started
  if (window.electronAPI && window.electronAPI.stopAudioMonitoring) {
    window.electronAPI.stopAudioMonitoring();
  }

  isMonitoring = false;
}

// Initialize
loadAudioDevice(); 