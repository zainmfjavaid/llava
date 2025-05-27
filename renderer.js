// renderer.js - Main renderer entry point
import { loadAudioDevice, initializeAudioIPCListeners } from './modules/audio-monitor.js';

// Global function to open a note by ID
window.openNote = async function(noteId) {
  try {
    const { sidebarManager } = await import('./modules/sidebar-manager.js');
    await sidebarManager.selectNote(noteId);
  } catch (error) {
    console.error('Failed to open note:', error);
  }
};
import { 
  handleTranscriptionResult, 
  handleTranscriptionError, 
  initializeTranscriptListeners 
} from './modules/transcript-handler.js';
import { initializeNotesListeners } from './modules/notes-processor.js';
import { initializeRecordingControls } from './modules/recording-controls.js';
import { initializeSettingsListeners } from './modules/settings-manager.js';
import { initializeAuthUI } from './modules/auth-ui.js';
import { authManager } from './modules/auth-manager.js';
import { initializeSidebarHomeButtons, initializeLandingPage } from './modules/landing-page.js';

// Handle Deepgram transcription results
window.electronAPI.onTranscriptionResult(handleTranscriptionResult);

// Handle transcription errors
window.electronAPI.onTranscriptionError(handleTranscriptionError);

// Handle device chosen
window.electronAPI.onDeviceChosen((name)=>{
  console.log('[Renderer] ===== DEVICE CHOSEN =====');
  console.log('[Renderer] FFmpeg capturing from:', name);
});

// Handle FFmpeg capturing info for debugging
if (window.electronAPI.onFFmpegCapturingFrom) {
  window.electronAPI.onFFmpegCapturingFrom((device) => {
    console.log('[Renderer] ===== FFMPEG CAPTURE STARTED =====');
    console.log('[Renderer] FFmpeg capturing from:', device);
    console.log('[Renderer] Timestamp:', new Date().toISOString());
  });
}

// Handle transcription status updates for debugging
if (window.electronAPI.onTranscriptionStatus) {
  window.electronAPI.onTranscriptionStatus((status) => {
    console.log('[Renderer] ===== TRANSCRIPTION STATUS =====');
    console.log('[Renderer] Status:', status);
    console.log('[Renderer] Timestamp:', new Date().toISOString());
  });
}

// Handle AWS audio configuration updates
if (window.electronAPI.onAWSAudioConfigured) {
  window.electronAPI.onAWSAudioConfigured((config) => {
    console.log('[Renderer] ===== AWS AUDIO CONFIGURED =====');
    console.log('[Renderer] Config:', config);
    
    // Show AWS audio status in UI
    showAWSAudioStatus(config);
  });
}

// Function to show AWS audio configuration status
function showAWSAudioStatus(config) {
  // Remove any existing status elements
  const existingStatus = document.querySelector('.aws-audio-status');
  if (existingStatus) existingStatus.remove();
  
  // Create status element
  const statusDiv = document.createElement('div');
  statusDiv.className = 'aws-audio-status';
  statusDiv.innerHTML = `
    <div class="aws-status-info">
      <div class="aws-capture">📡 Capturing: ${config.capture}</div>
      <div class="aws-output">🔊 Output: ${config.output}</div>
      <div class="aws-status">${config.status}</div>
      <button class="enable-output-btn" onclick="enableAudioOutput()">🔊 Enable Speaker Output</button>
    </div>
  `;
  
  // Add styles
  statusDiv.style.cssText = `
    position: fixed;
    top: 10px;
    right: 10px;
    background: rgba(0, 0, 0, 0.8);
    color: white;
    padding: 10px;
    border-radius: 8px;
    font-size: 12px;
    z-index: 1000;
    max-width: 300px;
  `;
  
  document.body.appendChild(statusDiv);
  
  // Auto-hide after 10 seconds
  setTimeout(() => {
    if (statusDiv.parentNode) {
      statusDiv.remove();
    }
  }, 10000);
}

// Global function to enable audio output
window.enableAudioOutput = async function() {
  try {
    const success = await window.electronAPI.enableAudioOutput();
    if (success) {
      alert('Audio output enabled! You should now hear sound through your speakers.');
    } else {
      alert('Failed to enable audio output. Please check your audio device settings.');
    }
  } catch (error) {
    console.error('Error enabling audio output:', error);
    alert('Error enabling audio output: ' + error.message);
  }
};

// Add transcription result handler for debugging
if (window.electronAPI.onTranscriptionResult) {
  window.electronAPI.onTranscriptionResult((data) => {
    console.log('[Renderer] ===== TRANSCRIPTION RESULT RECEIVED =====');
    console.log('[Renderer] Raw data:', JSON.stringify(data, null, 2));
    console.log('[Renderer] Timestamp:', new Date().toISOString());
    
    if (data.channel && data.channel.alternatives) {
      console.log('[Renderer] Alternatives count:', data.channel.alternatives.length);
      data.channel.alternatives.forEach((alt, index) => {
        console.log(`[Renderer] Alternative ${index}:`, {
          transcript: alt.transcript,
          confidence: alt.confidence,
          is_final: data.is_final
        });
      });
    }
  });
}

// Add transcription error handler for debugging
if (window.electronAPI.onTranscriptionError) {
  window.electronAPI.onTranscriptionError((error) => {
    console.error('[Renderer] ===== TRANSCRIPTION ERROR =====');
    console.error('[Renderer] Error:', error);
    console.error('[Renderer] Timestamp:', new Date().toISOString());
  });
}

// Handle audio monitoring fallback events
if (window.electronAPI.onAudioMonitoringFallback) {
  window.electronAPI.onAudioMonitoringFallback((device) => {
    console.log('[Renderer] ===== AUDIO MONITORING FALLBACK =====');
    console.log('[Renderer] Switching to fallback device:', device);
    console.log('[Renderer] Timestamp:', new Date().toISOString());
  });
}

// Initialize all modules
function initialize() {
  // Initialize authentication UI first
  const authUI = initializeAuthUI();
  
  // Only initialize other modules if user is authenticated
  if (authUI.isAuthenticated()) {
    initializeAppModules();
  }
  
  // Listen for authentication state changes
  window.addEventListener('storage', (e) => {
    if (e.key === 'llava_user') {
      if (authManager.isAuthenticated() && !authUI.isAuthenticated()) {
        // User just logged in
        authUI.showMainApp().catch(console.error);
        initializeAppModules();
      } else if (!authManager.isAuthenticated() && authUI.isAuthenticated()) {
        // User just logged out
        authUI.showAuthScreen();
      }
    }
  });
}

let appModulesInitialized = false;

function initializeAppModules() {
  // Prevent double initialization
  if (appModulesInitialized) {
    return;
  }
  
  // Initialize audio monitoring
  loadAudioDevice();
  initializeAudioIPCListeners();
  
  // Initialize transcript handling
  initializeTranscriptListeners();
  
  // Initialize notes processing
  initializeNotesListeners();
  
  // Initialize recording controls
  initializeRecordingControls();
  
  // Initialize settings management
  initializeSettingsListeners();
  
  // Initialize sidebar home buttons
  initializeSidebarHomeButtons();
  
  // Initialize landing page with chat
  initializeLandingPage();
  
  appModulesInitialized = true;
}

// Expose globally for auth module to call
window.initializeAppModules = initializeAppModules;

// Start the application
initialize();