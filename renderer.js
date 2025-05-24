// renderer.js - Main renderer entry point
import { loadAudioDevice, initializeAudioIPCListeners } from './modules/audio-monitor.js';
import { 
  handleTranscriptionResult, 
  handleTranscriptionError, 
  initializeTranscriptListeners 
} from './modules/transcript-handler.js';
import { initializeNotesListeners } from './modules/notes-processor.js';
import { initializeRecordingControls } from './modules/recording-controls.js';
import { initializeSettingsListeners } from './modules/settings-manager.js';

// Handle Deepgram transcription results
window.electronAPI.onTranscriptionResult(handleTranscriptionResult);

// Handle transcription errors
window.electronAPI.onTranscriptionError(handleTranscriptionError);

// Initialize all modules
function initialize() {
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
}

// Start the application
initialize();