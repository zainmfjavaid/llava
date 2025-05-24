import { elements } from './dom-utils.js';
import { startAudioMonitoring, stopAudioMonitoring } from './audio-monitor.js';

// Settings functionality
export function toggleSettings(e) {
  e.stopPropagation();
  elements.settingsDropdown.classList.toggle('show');
  
  if (elements.settingsDropdown.classList.contains('show')) {
    startAudioMonitoring();
  } else {
    stopAudioMonitoring();
  }
}

// Prevent settings dropdown from closing when clicking inside it
export function preventSettingsClose(e) {
  e.stopPropagation();
}

// Close settings when clicking outside
export function handleDocumentClick(e) {
  if (!elements.settingsIcon.contains(e.target) && !elements.settingsDropdown.contains(e.target)) {
    elements.settingsDropdown.classList.remove('show');
    stopAudioMonitoring();
  }
}

// Sound settings button
export function openSoundSettings() {
  window.electronAPI.openSoundSettings();
  elements.settingsDropdown.classList.remove('show');
}

// Initialize settings event listeners
export function initializeSettingsListeners() {
  elements.settingsIcon.addEventListener('click', toggleSettings);
  elements.settingsDropdown.addEventListener('click', preventSettingsClose);
  elements.soundSettingsBtn.addEventListener('click', openSoundSettings);
  
  // Close settings when clicking outside
  document.addEventListener('click', handleDocumentClick);
}