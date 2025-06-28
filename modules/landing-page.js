// landing-page.js - Landing page functionality
import { APIClient } from './api-client.js';
import { authManager } from './auth-manager.js';
import { sidebarManager } from './sidebar-manager.js';
import { chatManager } from './chat-manager.js';
import { clearTranscript } from './transcript-handler.js';
import { resetNotesGenerationState } from './notes-processor.js';

// Helper function to generate the correct audio URL based on environment
function getAudioUrl(filename) {
  // Check if we're in production (similar logic to api-client.js)
  const is_production = false; // Should match the flag in api-client.js
  
  if (is_production) {
    // In production, use the API endpoint
    return `https://dev.llava.io/v1/weekly-podcast-audio/${filename}`;
  } else {
    // In development, check if we're in Electron (custom protocol available)
    if (typeof window !== 'undefined' && window.electronAPI) {
      return `llava-audio:${filename}`;
    } else {
      // In development browser, use localhost API
      return `http://localhost:8081/v1/weekly-podcast-audio/${filename}`;
    }
  }
}

// Helper function to get the correct API base URL
function getApiBaseUrl() {
  const is_production = false; // Should match the flag in api-client.js
  return is_production ? 'https://dev.llava.io/v1' : 'http://localhost:8081/v1';
}

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

        // Update the podcast tile with the new content
        updatePodcastTileWithNewContent(result.summary, result.audio_file_path);

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


// Global function to test audio playback
window.testAudioPlayback = async function(filename) {
  console.log('Testing audio playback for:', filename);
  try {
    // Create a new audio element programmatically
    const audioUrl = getAudioUrl(filename);
    console.log('Using audio URL:', audioUrl);
    const audio = new Audio(audioUrl);
    
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
    console.error('Error testing audio playbook:', error);
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
    
    // Fallback: Use direct URL
    console.log('Using direct URL for download...');
    const audioUrl = getAudioUrl(filename);
    const a = document.createElement('a');
    a.href = audioUrl;
    a.download = filename;
    document.body.appendChild(a);
    
    console.log('Triggering download via direct URL...');
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
  
  // Add hover shimmer effect with throttling
  let lastHoverShimmer = 0;
  podcastTile.addEventListener('mouseenter', () => {
    const now = Date.now();
    // Throttle hover shimmers to max once every 2.5 seconds
    if (now - lastHoverShimmer > 2500) {
      addPodcastTileShimmer();
      lastHoverShimmer = now;
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
      showPodcastPlaceholder();
      return;
    }
    
    // Call the backend to get the most recent podcast file
    const apiBaseUrl = getApiBaseUrl();
    const response = await fetch(`${apiBaseUrl}/get-recent-podcast/${userId}`);
    
    if (response.ok) {
      const data = await response.json();
      displayPodcastTile(data.filename, data.created_date, data.summary_preview);
    } else {
      // No podcast found, show placeholder
      showPodcastPlaceholder();
    }
    
  } catch (error) {
    console.error('Error loading recent podcast:', error);
    showPodcastPlaceholder();
  }
}


// Display the podcast tile with the given information
function displayPodcastTile(filename, date, summaryPreview, updateTitle = false) {
  const podcastTile = document.getElementById('podcastTile');
  const title = document.querySelector('.podcast-tile-title');
  const subtitle = document.getElementById('podcastTileSubtitle');
  const audioSource = document.getElementById('podcastAudioSource');
  const audio = document.querySelector('#podcastTileAudio audio');
  
  if (!podcastTile || !title || !subtitle || !audioSource || !audio) {
    console.error('Podcast tile elements not found for display');
    return;
  }
  
  // Always update title with proper date format
  let dateForTitle;
  const timestampMatch = filename.match(/(\d+)/);
  if (timestampMatch) {
    const timestamp = parseInt(timestampMatch[1]);
    dateForTitle = new Date(timestamp * 1000).toLocaleDateString('en-US', { 
      month: '2-digit', 
      day: '2-digit', 
      year: '2-digit' 
    });
  } else {
    dateForTitle = new Date().toLocaleDateString('en-US', { 
      month: '2-digit', 
      day: '2-digit', 
      year: '2-digit' 
    });
  }
  title.textContent = `The Lost Week Podcast ${dateForTitle}`;
  
  // Update subtitle with date and preview
  subtitle.textContent = `${date} • ${summaryPreview || 'Weekly podcast summary'}`;
  
  // Set audio source
  const audioUrl = getAudioUrl(filename);
  console.log('Setting audio source to:', audioUrl);
  audioSource.src = audioUrl;
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
  
  // Show audio controls and play button for actual podcasts
  const audioContainer = document.getElementById('podcastTileAudio');
  const playButton = document.querySelector('.podcast-play-btn');
  if (audioContainer) {
    audioContainer.style.display = 'none'; // Initially hidden, can be toggled by clicking
  }
  if (playButton) {
    playButton.style.display = 'flex'; // Show play button for actual podcasts
  }
  
  // Show the tile
  podcastTile.style.display = 'block';
  
  // Add shimmer effect for initial load (only if tile wasn't visible before)
  if (!updateTitle && !podcastTile.classList.contains('shimmer-triggered')) {
    setTimeout(() => addPodcastTileShimmer(), 100);
    podcastTile.classList.add('shimmer-triggered');
  }
  
  console.log(`Podcast tile displayed for: ${filename}`);
}

// Update podcast tile with new content (for newly generated podcasts)
function updatePodcastTileWithNewContent(summary, audioFilePath) {
  if (!audioFilePath) {
    console.warn('No audio file path provided, showing error message');
    alert('Podcast generation completed but no audio was created (likely due to ElevenLabs quota limits)');
    return;
  }
  
  // Extract filename from path
  const audioFilename = audioFilePath.split('/').pop();
  
  // Get current date in MM/DD/YY format
  const now = new Date();
  const dateForTitle = now.toLocaleDateString('en-US', { 
    month: '2-digit', 
    day: '2-digit', 
    year: '2-digit' 
  });
  const dateForSubtitle = now.toLocaleDateString('en-US', { 
    month: 'long', 
    day: 'numeric', 
    year: 'numeric' 
  });
  
  // Update the podcast tile with new title
  displayPodcastTile(audioFilename, dateForSubtitle, 'Your Weekly Wrap Up', true);
  
  // Add shimmer effect for new podcast
  addPodcastTileShimmer();
  
  console.log(`Podcast tile updated with new content: ${audioFilename}`);
}

// Show placeholder when no recent podcast is available
function showPodcastPlaceholder() {
  const podcastTile = document.getElementById('podcastTile');
  const title = document.querySelector('.podcast-tile-title');
  const subtitle = document.getElementById('podcastTileSubtitle');
  const audioContainer = document.getElementById('podcastTileAudio');
  const playButton = document.querySelector('.podcast-play-btn');
  
  if (!podcastTile || !title || !subtitle) {
    console.error('Podcast tile elements not found for placeholder');
    return;
  }
  
  // Set placeholder content
  title.textContent = 'Coming Soon - Your Weekly Podcast';
  subtitle.textContent = 'Generate your first podcast using the Weekly button above';
  
  // Hide audio controls and play button for placeholder
  if (audioContainer) {
    audioContainer.style.display = 'none';
  }
  if (playButton) {
    playButton.style.display = 'none';
  }
  
  // Show the tile
  podcastTile.style.display = 'block';
  
  console.log('Podcast tile showing placeholder - no recent podcast available');
}

// Add shimmer animation to podcast tile
function addPodcastTileShimmer() {
  const podcastTile = document.getElementById('podcastTile');
  if (!podcastTile) return;
  
  // Don't add shimmer if one is already in progress
  if (podcastTile.classList.contains('shimmer')) {
    console.log('Shimmer already in progress, skipping');
    return;
  }
  
  // Add shimmer class
  podcastTile.classList.add('shimmer');
  
  // Remove shimmer class after animation completes (1.5s duration)
  setTimeout(() => {
    podcastTile.classList.remove('shimmer');
  }, 1500);
  
  console.log('Podcast tile shimmer animation triggered');
}