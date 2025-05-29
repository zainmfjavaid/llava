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
import { initializeContextDump } from './modules/context-dump.js';
import { rightSidebarManager } from './modules/right-sidebar-manager.js';

// Handle Deepgram transcription results
window.electronAPI.onTranscriptionResult(handleTranscriptionResult);

// Handle transcription errors
window.electronAPI.onTranscriptionError(handleTranscriptionError);

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
  
  // Initialize context dump functionality
  initializeContextDump();
  
  // Initialize right sidebar manager
  rightSidebarManager.initialize();
  
  appModulesInitialized = true;
}

// Expose globally for auth module to call
window.initializeAppModules = initializeAppModules;

// Start the application
initialize();