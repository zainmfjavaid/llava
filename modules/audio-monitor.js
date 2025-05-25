import { elements } from './dom-utils.js';

// --- Audio monitoring state ---
let audioContext = null;         // Web Audio context
let analyser = null;             // Web Audio analyser node
let micStream = null;            // MediaStream from getUserMedia
let monitorRaf = null;           // animationFrame id for level updates
let isMonitoring = false;

// Helper – paint level bars (0-8)
export function paintAudioLevel(level) {
  const bars = elements.audioLevelBars.querySelectorAll('.audio-level-bar');
  bars.forEach((bar, idx) => {
    if (idx < level) bar.classList.add('active');
    else bar.classList.remove('active');
  });
}

// Load audio-input device info (primary mic name)
// Only enumerate devices, don't request permission yet
export async function loadAudioDevice() {
  try {
    // First try to enumerate without requesting permission
    const devices = await navigator.mediaDevices.enumerateDevices();
    const audioInputs = devices.filter((d) => d.kind === 'audioinput');

    if (audioInputs.length > 0 && audioInputs[0].label) {
      // Device labels are available (permission was granted before)
      elements.audioDevice.textContent = audioInputs[0].label;
      return;
    }
  } catch (err) {
    console.warn('Web API audio device enumeration failed:', err);
  }

  // Fallback – ask main process via IPC (may be less accurate but cross-platform)
  if (window.electronAPI && window.electronAPI.getAudioDevices) {
    try {
      const device = await window.electronAPI.getAudioDevices();
      elements.audioDevice.textContent = device.name || 'Microphone';
    } catch (ipcErr) {
      console.error('Failed to load audio device via IPC:', ipcErr);
      elements.audioDevice.textContent = 'Default Microphone';
    }
  } else {
    elements.audioDevice.textContent = 'Default Microphone';
  }
}

// Load audio device info after permission is granted (during recording)
export async function loadAudioDeviceWithPermission() {
  try {
    // Request permission and get actual device info
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    
    const devices = await navigator.mediaDevices.enumerateDevices();
    const audioInputs = devices.filter((d) => d.kind === 'audioinput');

    if (audioInputs.length > 0) {
      elements.audioDevice.textContent = audioInputs[0].label || 'Microphone';
    }
    
    // Stop the temporary stream
    stream.getTracks().forEach(track => track.stop());
  } catch (err) {
    console.warn('Failed to load audio device with permission:', err);
  }
}

// Use Web Audio analyser to compute a rough RMS every animation frame
export function startAudioMonitoring() {
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

export function stopAudioMonitoring() {
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

// Back-compat: still respond to IPC events if main process supplies them
export function initializeAudioIPCListeners() {
  if (window.electronAPI && window.electronAPI.onAudioLevel) {
    window.electronAPI.onAudioLevel(paintAudioLevel);
  }
}