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
  
  // Initialize podcast tile
  initializePodcastTile();
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
  
  if (weeklyBtn && !weeklyBtn.hasAttribute('data-initialized')) {
    console.log('Initializing weekly button event listener');
    // Mark as initialized to prevent duplicate event listeners
    weeklyBtn.setAttribute('data-initialized', 'true');
    
    weeklyBtn.addEventListener('click', async () => {
      // Prevent multiple concurrent generations
      if (weeklyBtn.disabled) {
        console.log('Weekly generation already in progress, ignoring click');
        return;
      }
      
      // Declare originalContent outside try block
      let originalContent = weeklyBtn.innerHTML;
      
      try {
        console.log('Weekly podcast generation started');
        // Show loading state
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
            <audio controls preload="metadata" style="width: 100%; margin-bottom: 20px;" 
                   onerror="console.error('Audio load error:', this.error); console.error('Audio error details:', this.error ? this.error.message : 'Unknown error')"
                   onloadstart="console.log('Audio load started for:', this.src)"
                   oncanplay="console.log('Audio can play:', this.src)"
                   onloadeddata="console.log('Audio data loaded:', this.src)"
                   onplay="console.log('Audio started playing')"
                   onpause="console.log('Audio paused')"
                   onended="console.log('Audio ended')"
                   onabort="console.log('Audio loading aborted')"
                   onemptied="console.log('Audio emptied')"
                   onstalled="console.log('Audio stalled')">
              <source src="llava-audio:${audioFilename}" type="audio/mpeg"
                      onerror="console.error('Audio source error for:', this.src)">
              Your browser does not support the audio element.
            </audio>
            <div style="font-size: 0.8em; color: #666; margin-bottom: 10px;">
              Audio URL: <a href="llava-audio:${audioFilename}" target="_blank">llava-audio:${audioFilename}</a>
            </div>
            <div class="audio-controls">
              <button class="download-audio-btn" onclick="downloadPodcastAudio('${audioFilename}')">
                📥 Download MP3
              </button>
              <button class="test-audio-btn" onclick="testAudioPlayback('${audioFilename}')" style="background: #17a2b8; color: white; border: none; padding: 8px 16px; border-radius: 8px; cursor: pointer; font-weight: 500; margin-left: 8px;">
                🔊 Test Audio
              </button>
              <span style="font-size: 0.8em; color: #666; margin-left: 10px;">
                File: ${audioFilename}
              </span>
            </div>
          </div>
        ` : `
          <div class="weekly-summary-no-audio">
            <h3>⚠️ Audio Generation Unavailable</h3>
            <p style="margin: 0; color: #666; font-size: 0.9em;">
              Audio couldn't be generated (likely due to ElevenLabs quota limits). You can still read the podcast transcript below.
            </p>
          </div>
        `}
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

    .weekly-summary-no-audio {
      margin-bottom: 24px;
      padding: 16px;
      background: #fff3cd;
      border: 1px solid #ffeaa7;
      border-radius: 8px;
    }

    .weekly-summary-no-audio h3 {
      margin: 0 0 8px 0;
      font-size: 1.1rem;
      font-weight: 600;
      color: #856404;
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

// Global function to test audio playback
window.testAudioPlayback = async function(filename) {
  console.log('Testing audio playback for:', filename);
  try {
    // Create a new audio element programmatically
    const audio = new Audio(`llava-audio:${filename}`);
    
    // Add event listeners for debugging
    audio.addEventListener('loadstart', () => console.log('Test audio: Load started'));
    audio.addEventListener('loadeddata', () => console.log('Test audio: Data loaded'));
    audio.addEventListener('canplay', () => console.log('Test audio: Can play'));
    audio.addEventListener('play', () => console.log('Test audio: Playing'));
    audio.addEventListener('error', (e) => {
      console.error('Test audio error:', e);
      console.error('Audio error code:', audio.error ? audio.error.code : 'Unknown');
      console.error('Audio error message:', audio.error ? audio.error.message : 'Unknown');
    });
    
    // Try to play
    console.log('Attempting to play audio...');
    await audio.play();
    
    // Stop after 3 seconds for testing
    setTimeout(() => {
      audio.pause();
      console.log('Test audio stopped');
    }, 3000);
    
  } catch (error) {
    console.error('Error testing audio playback:', error);
    alert(`Failed to test audio: ${error.message}`);
  }
};

// Global function to download podcast audio
window.downloadPodcastAudio = async function(filename) {
  console.log('Download button clicked for:', filename);
  try {
    // Try API endpoint first (if server is running)
    console.log('Trying API endpoint first...');
    try {
      const { APIClient } = await import('./api-client.js');
      const response = await APIClient.getWeeklyPodcastAudio(filename, true);
      
      console.log('API response received:', response.status, response.statusText);
      
      // Create blob from response
      const blob = await response.blob();
      console.log('Blob created from API, size:', blob.size, 'bytes');
      
      // Create download link
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      
      console.log('Triggering download via API...');
      a.click();
      
      // Cleanup
      setTimeout(() => {
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        console.log('API download cleanup completed');
      }, 100);
      
      return; // Success, exit function
      
    } catch (apiError) {
      console.log('API endpoint failed, trying direct file access:', apiError.message);
    }
    
    // Fallback: Use custom protocol for direct file access
    console.log('Using direct file access via custom protocol...');
    const a = document.createElement('a');
    a.href = `llava-audio:${filename}`;
    a.download = filename;
    document.body.appendChild(a);
    
    console.log('Triggering download via custom protocol...');
    a.click();
    
    // Cleanup
    setTimeout(() => {
      document.body.removeChild(a);
      console.log('Direct download cleanup completed');
    }, 100);
    
  } catch (error) {
    console.error('Error downloading audio:', error);
    console.error('Error stack:', error.stack);
    alert(`Failed to download audio file: ${error.message}`);
  }
};

// Initialize podcast tile functionality
export function initializePodcastTile() {
  console.log('Initializing podcast tile...');
  
  const podcastTile = document.getElementById('podcastTile');
  const playBtn = document.getElementById('podcastPlayBtn');
  const audioContainer = document.getElementById('podcastTileAudio');
  const audioSource = document.getElementById('podcastAudioSource');
  const subtitle = document.getElementById('podcastTileSubtitle');
  
  if (!podcastTile || !playBtn || !audioContainer || !audioSource || !subtitle) {
    console.error('Podcast tile elements not found');
    return;
  }
  
  // Load the most recent podcast
  loadMostRecentPodcast();
  
  // Handle play button click
  playBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    const audio = audioContainer.querySelector('audio');
    const playIcon = playBtn.querySelector('.play-icon');
    const pauseIcon = playBtn.querySelector('.pause-icon');
    
    if (audio.paused) {
      audio.play();
      playIcon.style.display = 'none';
      pauseIcon.style.display = 'block';
    } else {
      audio.pause();
      playIcon.style.display = 'block';
      pauseIcon.style.display = 'none';
    }
  });
  
  // Handle tile click (show/hide audio controls)
  podcastTile.addEventListener('click', (e) => {
    // Don't toggle if clicking the play button
    if (e.target.closest('.podcast-play-btn')) return;
    
    if (audioContainer.style.display === 'none') {
      audioContainer.style.display = 'block';
    } else {
      audioContainer.style.display = 'none';
    }
  });
}

// Load the most recent podcast from the audio files directory
async function loadMostRecentPodcast() {
  try {
    console.log('Loading most recent podcast...');
    
    // Try to get the user ID for API calls
    const userId = authManager.getCurrentUser()?.id;
    if (!userId) {
      console.warn('No user ID available for podcast loading');
      return;
    }
    
    // Call the backend to get the most recent podcast file
    const response = await fetch(`http://localhost:8081/v1/get-recent-podcast/${userId}`);
    
    if (response.ok) {
      const data = await response.json();
      displayPodcastTile(data.filename, data.created_date, data.summary_preview);
    } else {
      // Fallback: try to load from local files
      await loadPodcastFromLocalFiles();
    }
    
  } catch (error) {
    console.error('Error loading recent podcast:', error);
    await loadPodcastFromLocalFiles();
  }
}

// Fallback method to load podcast from local files
async function loadPodcastFromLocalFiles() {
  try {
    // List of known audio files (this could be made dynamic)
    const audioFiles = [
      'weekly_podcast_1750559534.mp3',
      'weekly_podcast_1750558435.mp3',
      'weekly_podcast_1750558064.mp3',
      'weekly_podcast_1750557525.mp3',
      'weekly_podcast_1750556893.mp3'
    ];
    
    // Find the most recent one that exists
    for (const filename of audioFiles) {
      try {
        // Test if the file exists by trying to load it
        const testAudio = new Audio(`llava-audio:${filename}`);
        await new Promise((resolve, reject) => {
          testAudio.addEventListener('canplaythrough', resolve, { once: true });
          testAudio.addEventListener('error', reject, { once: true });
          testAudio.load();
        });
        
        // If we get here, the file exists
        const timestamp = filename.match(/(\d+)/)?.[1];
        const date = timestamp ? new Date(parseInt(timestamp) * 1000).toLocaleDateString() : 'Recent';
        displayPodcastTile(filename, date, 'Weekly podcast summary with Liam & Daniel');
        return;
        
      } catch (fileError) {
        console.log(`File ${filename} not accessible, trying next...`);
        continue;
      }
    }
    
    // If no files found, hide the tile
    console.log('No accessible podcast files found');
    hidePodcastTile();
    
  } catch (error) {
    console.error('Error loading podcast from local files:', error);
    hidePodcastTile();
  }
}

// Display the podcast tile with the given information
function displayPodcastTile(filename, date, summaryPreview) {
  const podcastTile = document.getElementById('podcastTile');
  const subtitle = document.getElementById('podcastTileSubtitle');
  const audioSource = document.getElementById('podcastAudioSource');
  const audio = document.querySelector('#podcastTileAudio audio');
  
  if (!podcastTile || !subtitle || !audioSource || !audio) {
    console.error('Podcast tile elements not found for display');
    return;
  }
  
  // Update subtitle with date and preview
  subtitle.textContent = `${date} • ${summaryPreview || 'Weekly podcast summary'}`;
  
  // Set audio source
  audioSource.src = `llava-audio:${filename}`;
  audio.load();
  
  // Add audio event listeners
  audio.addEventListener('ended', () => {
    const playIcon = document.querySelector('.podcast-play-btn .play-icon');
    const pauseIcon = document.querySelector('.podcast-play-btn .pause-icon');
    if (playIcon && pauseIcon) {
      playIcon.style.display = 'block';
      pauseIcon.style.display = 'none';
    }
  });
  
  audio.addEventListener('pause', () => {
    const playIcon = document.querySelector('.podcast-play-btn .play-icon');
    const pauseIcon = document.querySelector('.podcast-play-btn .pause-icon');
    if (playIcon && pauseIcon) {
      playIcon.style.display = 'block';
      pauseIcon.style.display = 'none';
    }
  });
  
  audio.addEventListener('play', () => {
    const playIcon = document.querySelector('.podcast-play-btn .play-icon');
    const pauseIcon = document.querySelector('.podcast-play-btn .pause-icon');
    if (playIcon && pauseIcon) {
      playIcon.style.display = 'none';
      pauseIcon.style.display = 'block';
    }
  });
  
  // Show the tile
  podcastTile.style.display = 'block';
  
  console.log(`Podcast tile displayed for: ${filename}`);
}

// Hide the podcast tile if no recent podcast is available
function hidePodcastTile() {
  const podcastTile = document.getElementById('podcastTile');
  if (podcastTile) {
    podcastTile.style.display = 'none';
  }
  console.log('Podcast tile hidden - no recent podcast available');
}