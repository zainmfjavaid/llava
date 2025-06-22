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

  // Initialize weekly summary button
  initializeWeeklyButton();
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
  window.recordingMode = null; // Clear recording mode when navigating home
  window.contextDumpInitiatedBy = null; // Clear context dump initiation mode
  clearTranscript(); // Clear transcript data when navigating home
  resetNotesGenerationState(); // Reset notes generation state when navigating home
  // Clear any existing chat history when returning home
  chatManager.clearChat();
  
  // Restore vibe button visibility when returning to home
  const vibeBtn = document.getElementById('vibeBtn');
  const gaiaBtn = document.getElementById('gaiaBtn');
  if (vibeBtn) {
    vibeBtn.style.display = 'inline-flex';
  }
  if (gaiaBtn) {
    gaiaBtn.style.display = 'inline-flex';
  }

  // As a final step, force a full reload to reset any lingering state
  setTimeout(() => {
    window.location.reload();
  }, 400);
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

// Initialize weekly summary button functionality
export function initializeWeeklyButton() {
  const weeklyBtn = document.getElementById('weeklyBtn');
  
  if (weeklyBtn) {
    weeklyBtn.addEventListener('click', async () => {
      try {
        // Show loading state
        const originalContent = weeklyBtn.innerHTML;
        weeklyBtn.disabled = true;
        weeklyBtn.innerHTML = `
          <div class="weekly-icon">
            <svg class="spinner" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" opacity="0.2"/>
              <path d="M4 12a8 8 0 018-8V2.5a.5.5 0 011 0V4a8 8 0 11-8 8z" fill="currentColor"/>
            </svg>
          </div>
          <span>Generating...</span>
        `;

        // Import APIClient and generate weekly summary with audio
        const { APIClient } = await import('./api-client.js');
        const result = await APIClient.generateWeeklyPodcast();

        // Show the summary in a modal or popup with audio option
        showWeeklySummaryModal(result.summary, result.audio_file_path);

      } catch (error) {
        console.error('Error generating weekly summary:', error);
        
        // Show error message
        alert(`Failed to generate weekly summary: ${error.message}`);
        
      } finally {
        // Restore button state
        weeklyBtn.disabled = false;
        weeklyBtn.innerHTML = originalContent;
      }
    });
  }
}

// Show weekly summary in a modal
function showWeeklySummaryModal(summary, audioFilePath = null) {
  // Extract filename from path for API call
  const audioFilename = audioFilePath ? audioFilePath.split('/').pop() : null;
  
  // Create modal overlay
  const modal = document.createElement('div');
  modal.className = 'weekly-summary-modal';
  modal.innerHTML = `
    <div class="weekly-summary-content">
      <div class="weekly-summary-header">
        <h2>🎙️ Weekly Podcast Summary</h2>
        <button class="weekly-summary-close" aria-label="Close">
          <svg viewBox="0 0 24 24" fill="currentColor">
            <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
          </svg>
        </button>
      </div>
      <div class="weekly-summary-body">
        ${audioFilename ? `
          <div class="weekly-summary-audio">
            <h3>🎧 Listen to Podcast</h3>
            <audio controls preload="metadata" style="width: 100%; margin-bottom: 20px;">
              <source src="/api/v1/weekly-podcast-audio/${audioFilename}" type="audio/mpeg">
              Your browser does not support the audio element.
            </audio>
            <div class="audio-controls">
              <button class="download-audio-btn" onclick="downloadPodcastAudio('${audioFilename}')">
                📥 Download MP3
              </button>
            </div>
          </div>
        ` : ''}
        <div class="weekly-summary-text">
          <h3>📝 Transcript</h3>
          ${summary.replace(/\n/g, '<br>')}
        </div>
      </div>
      <div class="weekly-summary-footer">
        <button class="weekly-summary-copy-btn">Copy Text</button>
      </div>
    </div>
  `;

  // Add modal styles
  const style = document.createElement('style');
  style.textContent = `
    .weekly-summary-modal {
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 1000;
      padding: 20px;
      box-sizing: border-box;
    }

    .weekly-summary-content {
      background: white;
      border-radius: 16px;
      max-width: 800px;
      width: 100%;
      max-height: 80vh;
      overflow: hidden;
      display: flex;
      flex-direction: column;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
    }

    .weekly-summary-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 24px;
      border-bottom: 1px solid #e9ecef;
    }

    .weekly-summary-header h2 {
      margin: 0;
      font-size: 1.5rem;
      font-weight: 600;
      color: var(--text-dark-color);
    }

    .weekly-summary-close {
      background: none;
      border: none;
      cursor: pointer;
      padding: 8px;
      border-radius: 8px;
      transition: background-color 0.2s ease;
    }

    .weekly-summary-close:hover {
      background-color: #f8f9fa;
    }

    .weekly-summary-close svg {
      width: 20px;
      height: 20px;
    }

    .weekly-summary-body {
      padding: 24px;
      overflow-y: auto;
      flex: 1;
    }

    .weekly-summary-audio {
      margin-bottom: 24px;
      padding-bottom: 24px;
      border-bottom: 1px solid #e9ecef;
    }

    .weekly-summary-audio h3 {
      margin: 0 0 16px 0;
      font-size: 1.2rem;
      font-weight: 600;
      color: var(--text-dark-color);
    }

    .audio-controls {
      display: flex;
      gap: 12px;
      margin-top: 12px;
    }

    .download-audio-btn {
      background: #28a745;
      color: white;
      border: none;
      padding: 8px 16px;
      border-radius: 8px;
      cursor: pointer;
      font-weight: 500;
      font-size: 0.9rem;
      transition: background-color 0.2s ease;
    }

    .download-audio-btn:hover {
      background: #218838;
    }

    .weekly-summary-text {
      font-size: 1rem;
      line-height: 1.6;
      color: var(--text-dark-color);
      white-space: pre-wrap;
    }

    .weekly-summary-text h3 {
      margin: 0 0 16px 0;
      font-size: 1.2rem;
      font-weight: 600;
      color: var(--text-dark-color);
    }

    .weekly-summary-footer {
      padding: 16px 24px;
      border-top: 1px solid #e9ecef;
      display: flex;
      justify-content: flex-end;
    }

    .weekly-summary-copy-btn {
      background: #667eea;
      color: white;
      border: none;
      padding: 8px 16px;
      border-radius: 8px;
      cursor: pointer;
      font-weight: 500;
      transition: background-color 0.2s ease;
    }

    .weekly-summary-copy-btn:hover {
      background: #5a67d8;
    }

    .spinner {
      animation: spin 1s linear infinite;
      width: 14px;
      height: 14px;
    }

    @keyframes spin {
      from { transform: rotate(0deg); }
      to { transform: rotate(360deg); }
    }
  `;
  document.head.appendChild(style);

  // Add event listeners
  const closeBtn = modal.querySelector('.weekly-summary-close');
  const copyBtn = modal.querySelector('.weekly-summary-copy-btn');

  closeBtn.addEventListener('click', () => {
    document.body.removeChild(modal);
    document.head.removeChild(style);
  });

  copyBtn.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(summary);
      copyBtn.textContent = 'Copied!';
      setTimeout(() => {
        copyBtn.textContent = 'Copy to Clipboard';
      }, 2000);
    } catch (err) {
      console.error('Failed to copy text:', err);
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = summary;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      copyBtn.textContent = 'Copied!';
      setTimeout(() => {
        copyBtn.textContent = 'Copy to Clipboard';
      }, 2000);
    }
  });

  // Close modal when clicking outside
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      document.body.removeChild(modal);
      document.head.removeChild(style);
    }
  });

  // Add to DOM
  document.body.appendChild(modal);
}

// Global function to download podcast audio
window.downloadPodcastAudio = async function(filename) {
  try {
    const { APIClient } = await import('./api-client.js');
    const response = await APIClient.getWeeklyPodcastAudio(filename);
    
    // Create blob from response
    const blob = await response.blob();
    
    // Create download link
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    
    // Cleanup
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
    
  } catch (error) {
    console.error('Error downloading audio:', error);
    alert('Failed to download audio file');
  }
};