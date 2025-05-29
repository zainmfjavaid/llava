// landing-page.js - Landing page functionality
import { APIClient } from './api-client.js';
import { authManager } from './auth-manager.js';
import { sidebarManager } from './sidebar-manager.js';
import { chatManager } from './chat-manager.js';
import { clearTranscript } from './transcript-handler.js';
import { resetNotesGenerationState } from './notes-processor.js';

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
    
    await smoothNavigateHome();
  });
  
  // Add button to the top of the recording screen
  const contentArea = recordingScreen.querySelector('.content-area');
  if (contentArea) {
    contentArea.insertBefore(backButton, contentArea.firstChild);
  }
}

// Add Home button functionality to sidebar
// Smooth navigation to home function
export async function smoothNavigateHome() {
  const initialScreen = document.getElementById('initialScreen');
  const recordingScreen = document.getElementById('recordingScreen');
  const chatScreen = document.getElementById('chatScreen');
  const contextDumpScreen = document.getElementById('contextDumpScreen');
  
  // Expand sidebar smoothly
  const sidebar = document.querySelector('.recording-screen .sidebar, .chat-screen .sidebar, .context-dump-screen .sidebar, .initial-screen .sidebar');
  if (sidebar && sidebar.classList.contains('collapsed')) {
    sidebarManager.expandSidebar(sidebar, 'sidebar-toggle-shrink', 'sidebar-toggle-expand');
  }
  
  // Setup crossfade transition back to home
  const currentScreen = recordingScreen && recordingScreen.style.display !== 'none' ? recordingScreen : 
                       chatScreen && chatScreen.style.display !== 'none' ? chatScreen :
                       contextDumpScreen && contextDumpScreen.style.display !== 'none' ? contextDumpScreen : null;
  
  if (currentScreen && initialScreen) {
    // Position initial screen on top with opacity 0
    initialScreen.style.position = 'absolute';
    initialScreen.style.top = '0';
    initialScreen.style.left = '0';
    initialScreen.style.width = '100%';
    initialScreen.style.height = '100%';
    initialScreen.style.zIndex = '10';
    initialScreen.style.display = 'flex';
    initialScreen.style.opacity = '0';
    initialScreen.style.transition = 'opacity 0.3s ease';
    
    // Fade out current screen and fade in initial screen simultaneously
    currentScreen.style.transition = 'opacity 0.3s ease';
    currentScreen.style.opacity = '0';
    
    setTimeout(() => {
      initialScreen.style.opacity = '1';
    }, 50);
    
    // Clean up after transition
    setTimeout(() => {
      currentScreen.style.display = 'none';
      initialScreen.style.position = '';
      initialScreen.style.top = '';
      initialScreen.style.left = '';
      initialScreen.style.width = '';
      initialScreen.style.height = '';
      initialScreen.style.zIndex = '';
      initialScreen.style.transition = '';
      initialScreen.style.opacity = '';
      currentScreen.style.transition = '';
      currentScreen.style.opacity = '';
    }, 350);
  }
  
  // Update Home button active states after transition
  setTimeout(() => {
    updateHomeButtonStates();
  }, 200);
  
  // Refresh notes in sidebar
  setTimeout(async () => {
    await sidebarManager.refreshNotes();
  }, 150);
  
  // Clear current note data and transcript
  window.currentNoteId = null;
  window.currentNote = null;
  clearTranscript(); // Clear transcript data when navigating home
  resetNotesGenerationState(); // Reset notes generation state when navigating home
  // Clear any existing chat history when returning home
  chatManager.clearChat();
}

export function initializeSidebarHomeButtons() {
  const homeBtn = document.getElementById('homeBtn');
  const homeBtnRecording = document.getElementById('homeBtnRecording');
  const homeBtnChat = document.getElementById('homeBtnChat');
  const homeBtnContext = document.getElementById('homeBtnContext');
  const backToHomeBtn = document.getElementById('backToHomeBtn');
  const backToHomeBtnChat = document.getElementById('backToHomeBtnChat');
  const backToHomeBtnContext = document.getElementById('backToHomeBtnContext');
  
  // Function to navigate to home screen
  const navigateToHome = async () => {
    // If recording is active, stop it before navigating home
    const { getIsRecording, stopRecording } = await import('./recording-controls.js');
    if (getIsRecording()) await stopRecording();
    
    await smoothNavigateHome();
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
  if (homeBtnContext) {
    homeBtnContext.addEventListener('click', navigateToHome);
  }
  if (backToHomeBtn) {
    backToHomeBtn.addEventListener('click', navigateToHome);
  }
  if (backToHomeBtnChat) {
    backToHomeBtnChat.addEventListener('click', navigateToHome);
  }
  if (backToHomeBtnContext) {
    backToHomeBtnContext.addEventListener('click', navigateToHome);
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
  const homeBtnContext = document.getElementById('homeBtnContext');
  const initialScreen = document.getElementById('initialScreen');
  const recordingScreen = document.getElementById('recordingScreen');
  const chatScreen = document.getElementById('chatScreen');
  const contextDumpScreen = document.getElementById('contextDumpScreen');
  
  // Home is active when:
  // 1. initialScreen is visible (flex or empty string) AND other screens are hidden
  // 2. OR when no specific note/chat is loaded (we're on the default home view)
  const isInitialScreenVisible = initialScreen && 
    (initialScreen.style.display === 'flex' || initialScreen.style.display === '');
  const isRecordingScreenHidden = !recordingScreen || 
    recordingScreen.style.display === 'none' || recordingScreen.style.display === '';
  const isChatScreenHidden = !chatScreen || 
    chatScreen.style.display === 'none' || chatScreen.style.display === '';
  const isContextDumpScreenHidden = !contextDumpScreen || 
    contextDumpScreen.style.display === 'none' || contextDumpScreen.style.display === '';
  
  const isOnHomeScreen = isInitialScreenVisible && isRecordingScreenHidden && isChatScreenHidden && isContextDumpScreenHidden;
  
  if (homeBtn) {
    homeBtn.classList.toggle('active', isOnHomeScreen);
  }
  if (homeBtnRecording) {
    homeBtnRecording.classList.toggle('active', isOnHomeScreen);
  }
  if (homeBtnChat) {
    homeBtnChat.classList.toggle('active', isOnHomeScreen);
  }
  if (homeBtnContext) {
    homeBtnContext.classList.toggle('active', isOnHomeScreen);
  }
}