// landing-page.js - Landing page functionality
import { APIClient } from './api-client.js';
import { authManager } from './auth-manager.js';
import { sidebarManager } from './sidebar-manager.js';

export async function initializeLandingPage() {
  const chatInput = document.getElementById('chatInput');
  const chatSendBtn = document.getElementById('chatSendBtn');
  
  // Initialize textarea with auto-resizing and send button functionality
  if (chatInput && chatSendBtn) {
    initTextarea(chatInput, chatSendBtn);
    
    // Handle chat send (placeholder for now)
    chatSendBtn.addEventListener('click', () => {
      console.log('Chat functionality not implemented yet');
    });
    
    // Handle Enter key to send
    chatInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        if (!chatSendBtn.disabled) {
          chatSendBtn.click();
        }
      }
    });
  }

  // Initialize sidebar
  await sidebarManager.initialize();

function initTextarea(textarea, sendButton = null) {
  if (sendButton) {
    sendButton.disabled = true;
  }

  // Set initial height
  textarea.style.height = 'auto';
  textarea.style.height = Math.max(textarea.scrollHeight, 42) + 'px';
  textarea.style.overflowY = 'hidden';

  textarea.addEventListener('input', () => {
    // Reset height to auto to get the correct scrollHeight
    textarea.style.height = 'auto';
    const newHeight = Math.min(Math.max(textarea.scrollHeight, 42), 360);
    textarea.style.height = `${newHeight}px`;
    textarea.style.overflowY = textarea.scrollHeight > 360 ? 'scroll' : 'hidden';

    // Enable/disable send button based on content
    if (sendButton) {
      sendButton.disabled = textarea.value.trim() === '';
    }
  });
}
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
  const backToHomeBtn = document.getElementById('backToHomeBtn');
  
  // Function to navigate to home screen
  const navigateToHome = async () => {
    const initialScreen = document.getElementById('initialScreen');
    const recordingScreen = document.getElementById('recordingScreen');
    
    if (initialScreen) initialScreen.style.display = 'flex';
    if (recordingScreen) recordingScreen.style.display = 'none';
    
    // Update Home button active states
    updateHomeButtonStates();
    
    // Refresh notes in sidebar
    const { sidebarManager } = await import('./sidebar-manager.js');
    await sidebarManager.refreshNotes();
    
    // Clear current note data
    window.currentNoteId = null;
    window.currentNote = null;
  };
  
  // Add click listeners
  if (homeBtn) {
    homeBtn.addEventListener('click', navigateToHome);
  }
  if (homeBtnRecording) {
    homeBtnRecording.addEventListener('click', navigateToHome);
  }
  if (backToHomeBtn) {
    backToHomeBtn.addEventListener('click', navigateToHome);
  }
  
  // Initialize active states
  updateHomeButtonStates();
}

// Update Home button active states based on current screen
export function updateHomeButtonStates() {
  const homeBtn = document.getElementById('homeBtn');
  const homeBtnRecording = document.getElementById('homeBtnRecording');
  const initialScreen = document.getElementById('initialScreen');
  const recordingScreen = document.getElementById('recordingScreen');
  
  // Home is active when:
  // 1. initialScreen is visible (flex or empty string) AND recordingScreen is hidden
  // 2. OR when no specific note is loaded (we're on the default home view)
  const isInitialScreenVisible = initialScreen && 
    (initialScreen.style.display === 'flex' || initialScreen.style.display === '');
  const isRecordingScreenHidden = !recordingScreen || 
    recordingScreen.style.display === 'none' || recordingScreen.style.display === '';
  
  const isOnHomeScreen = isInitialScreenVisible && isRecordingScreenHidden;
  
  if (homeBtn) {
    homeBtn.classList.toggle('active', isOnHomeScreen);
  }
  if (homeBtnRecording) {
    homeBtnRecording.classList.toggle('active', isOnHomeScreen);
  }
}