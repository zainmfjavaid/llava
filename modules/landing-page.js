// landing-page.js - Landing page functionality
import { APIClient } from './api-client.js';
import { authManager } from './auth-manager.js';
import { sidebarManager } from './sidebar-manager.js';
import { chatManager } from './chat-manager.js';

export async function initializeLandingPage() {
  // Initialize chat functionality
  chatManager.initialize();

  // Initialize sidebar
  await sidebarManager.initialize();
}

// Add back to home functionality
export function addBackToHomeButton() {
  const recordingScreen = document.getElementById('recordingScreen');
  if (!recordingScreen) return;
  
  // Check if back button already exists
  if (recordingScreen.querySelector('.back-to-home-btn')) return;
  
  const backButton = document.createElement('button');
  backButton.className = 'back-to-home-btn';
  backButton.innerHTML = `
    <svg viewBox="0 0 24 24" fill="currentColor">
      <path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/>
    </svg>
  `;
  
  backButton.addEventListener('click', async () => {
    // If recording is active, stop it before navigating home
    const { getIsRecording, stopRecording } = await import('./recording-controls.js');
    if (getIsRecording()) await stopRecording();
    const initialScreen = document.getElementById('initialScreen');
    const recordingScreen = document.getElementById('recordingScreen');
    
    if (initialScreen) initialScreen.style.display = 'flex';
    if (recordingScreen) recordingScreen.style.display = 'none';
    
    // Refresh notes in sidebar
    await sidebarManager.refreshNotes();
    
    // Clear current note data
    window.currentNoteId = null;
    window.currentNote = null;
  });
  
  // Add button to the top of the recording screen
  const contentArea = recordingScreen.querySelector('.content-area');
  if (contentArea) {
    contentArea.insertBefore(backButton, contentArea.firstChild);
  }
}

// Add Home button functionality to sidebar
export function initializeSidebarHomeButtons() {
  const homeBtn = document.getElementById('homeBtn');
  const homeBtnRecording = document.getElementById('homeBtnRecording');
  const homeBtnChat = document.getElementById('homeBtnChat');
  const backToHomeBtn = document.getElementById('backToHomeBtn');
  const backToHomeBtnChat = document.getElementById('backToHomeBtnChat');
  
  // Function to navigate to home screen
  const navigateToHome = async () => {
    // If recording is active, stop it before navigating home
    const { getIsRecording, stopRecording } = await import('./recording-controls.js');
    if (getIsRecording()) await stopRecording();
    const initialScreen = document.getElementById('initialScreen');
    const recordingScreen = document.getElementById('recordingScreen');
    const chatScreen = document.getElementById('chatScreen');
    
    if (initialScreen) initialScreen.style.display = 'flex';
    if (recordingScreen) recordingScreen.style.display = 'none';
    if (chatScreen) chatScreen.style.display = 'none';
    
    // Update Home button active states
    updateHomeButtonStates();
    
    // Refresh notes in sidebar
    const { sidebarManager } = await import('./sidebar-manager.js');
    await sidebarManager.refreshNotes();
    
    // Clear current note data
    window.currentNoteId = null;
    window.currentNote = null;
    // Clear any existing chat history when returning home
    chatManager.clearChat();
  };
  
  // Add click listeners
  if (homeBtn) {
    homeBtn.addEventListener('click', navigateToHome);
  }
  if (homeBtnRecording) {
    homeBtnRecording.addEventListener('click', navigateToHome);
  }
  if (homeBtnChat) {
    homeBtnChat.addEventListener('click', navigateToHome);
  }
  if (backToHomeBtn) {
    backToHomeBtn.addEventListener('click', navigateToHome);
  }
  if (backToHomeBtnChat) {
    backToHomeBtnChat.addEventListener('click', navigateToHome);
  }
  
  // Initialize active states
  updateHomeButtonStates();
  // Sign out button functionality
  const signOutBtns = document.querySelectorAll('.sidebar-signout-btn');
  signOutBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      authManager.logout();
      // Reload app to show auth screen
      window.location.reload();
    });
  });
}

// Update Home button active states based on current screen
export function updateHomeButtonStates() {
  const homeBtn = document.getElementById('homeBtn');
  const homeBtnRecording = document.getElementById('homeBtnRecording');
  const homeBtnChat = document.getElementById('homeBtnChat');
  const initialScreen = document.getElementById('initialScreen');
  const recordingScreen = document.getElementById('recordingScreen');
  const chatScreen = document.getElementById('chatScreen');
  
  // Home is active when:
  // 1. initialScreen is visible (flex or empty string) AND other screens are hidden
  // 2. OR when no specific note/chat is loaded (we're on the default home view)
  const isInitialScreenVisible = initialScreen && 
    (initialScreen.style.display === 'flex' || initialScreen.style.display === '');
  const isRecordingScreenHidden = !recordingScreen || 
    recordingScreen.style.display === 'none' || recordingScreen.style.display === '';
  const isChatScreenHidden = !chatScreen || 
    chatScreen.style.display === 'none' || chatScreen.style.display === '';
  
  const isOnHomeScreen = isInitialScreenVisible && isRecordingScreenHidden && isChatScreenHidden;
  
  if (homeBtn) {
    homeBtn.classList.toggle('active', isOnHomeScreen);
  }
  if (homeBtnRecording) {
    homeBtnRecording.classList.toggle('active', isOnHomeScreen);
  }
  if (homeBtnChat) {
    homeBtnChat.classList.toggle('active', isOnHomeScreen);
  }
}