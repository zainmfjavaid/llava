import { elements, isTitleEmpty, autoResizeTitle, startWaveAnimations, stopWaveAnimations, updateSeparatorVisibility } from './dom-utils.js';
import { generateTitle, setCurrentNoteId, resetNotesGenerationState } from './notes-processor.js';
import { startAudioMonitoring, stopAudioMonitoring, loadAudioDeviceWithPermission } from './audio-monitor.js';
import { getCurrentTranscript, clearTranscript } from './transcript-handler.js';
import { APIClient } from './api-client.js';
import { authManager } from './auth-manager.js';
import { noteStorage } from './note-storage.js';
import { rightSidebarManager } from './right-sidebar-manager.js';

// Helper function to extract raw notes with line breaks preserved
function extractRawNotes() {
  if (elements.notesInput.tagName === 'TEXTAREA') {
    return elements.notesInput.value || '';
  } else {
    // For contentEditable divs, convert HTML to plain text while preserving line breaks
    const clone = elements.notesInput.cloneNode(true);
    
    // Replace <br> tags with newlines
    clone.querySelectorAll('br').forEach(br => {
      br.replaceWith('\n');
    });
    
    // Replace block elements with newlines
    clone.querySelectorAll('div, p, h1, h2, h3, h4, h5, h6, li').forEach(block => {
      if (block.nextSibling) {
        block.insertAdjacentText('afterend', '\n');
      }
    });
    
    return clone.textContent || '';
  }
}

let isRecording = false;

// Clear all fields and reset UI for new recording
function clearRecordingSession() {
  // Clear title input
  elements.titleInput.value = '';
  autoResizeTitle();
  
  // Clear and reset notes input to textarea
  const notesInput = elements.notesInput;
  if (notesInput.contentEditable === 'true' || notesInput.tagName === 'DIV') {
    // Convert back to textarea
    const textarea = document.createElement('textarea');
    textarea.className = 'notes-input';
    textarea.id = 'notesInput';
    textarea.placeholder = 'Write notes...';
    textarea.value = '';
    
    const notesWrapper = notesInput.parentNode;
    notesWrapper.replaceChild(textarea, notesInput);
    elements.notesInput = textarea;
  } else {
    notesInput.value = '';
  }
  
  // Clear transcript content and transcript data
  elements.transcriptContent.textContent = '';
  clearTranscript(); // Clear the transcript data variable
  
  // Reset notes generation state
  resetNotesGenerationState();
  
  // Remove any existing resume text
  const existingResumeText = document.querySelector('.resume-text');
  if (existingResumeText) existingResumeText.remove();
  
  // Reset recording controls state
  elements.recordingControls.classList.remove('expanded');
  elements.recordingControls.classList.remove('transcript-open');
  
  // Show stop button, hide generate notes button
  elements.stopBtn.style.display = 'block';
  elements.generateNotesBtn.style.display = 'none';
  
  // Update separator visibility
  updateSeparatorVisibility();
  
  // Clear global note references
  window.currentNoteId = null;
  window.currentNote = null;
}

// Start recording
export async function startRecording() {
  try {
    // Clear all previous session data
    clearRecordingSession();
    
    await window.electronAPI.startTranscription();
    
    // Smoothly transition to recording screen
    // Smoothly collapse sidebar
    const sidebar = document.querySelector('.initial-screen .sidebar');
    if (sidebar && !sidebar.classList.contains('collapsed')) {
      const { sidebarManager } = await import('./sidebar-manager.js');
      sidebarManager.collapseSidebar(sidebar, 'sidebar-toggle-shrink', 'sidebar-toggle-expand');
    }
    
    // Setup crossfade transition
    if (elements.initialScreen && elements.recordingScreen) {
      // Position recording screen on top with opacity 0
      elements.recordingScreen.style.position = 'absolute';
      elements.recordingScreen.style.top = '0';
      elements.recordingScreen.style.left = '0';
      elements.recordingScreen.style.width = '100%';
      elements.recordingScreen.style.height = '100%';
      elements.recordingScreen.style.zIndex = '10';
      elements.recordingScreen.style.display = 'block';
      elements.recordingScreen.style.opacity = '0';
      elements.recordingScreen.style.transition = 'opacity 0.3s ease';
      
      // Fade out initial screen and fade in recording screen simultaneously
      elements.initialScreen.style.transition = 'opacity 0.3s ease';
      elements.initialScreen.style.opacity = '0';
      
      setTimeout(() => {
        elements.recordingScreen.style.opacity = '1';
      }, 50);
      
      // Clean up after transition
      setTimeout(() => {
        elements.initialScreen.style.display = 'none';
        elements.recordingScreen.style.position = '';
        elements.recordingScreen.style.top = '';
        elements.recordingScreen.style.left = '';
        elements.recordingScreen.style.width = '';
        elements.recordingScreen.style.height = '';
        elements.recordingScreen.style.zIndex = '';
        elements.recordingScreen.style.transition = '';
        elements.recordingScreen.style.opacity = '';
        elements.initialScreen.style.transition = '';
        elements.initialScreen.style.opacity = '';
      }, 350);
    }
    
    // Auto-resize title textarea and update home button states after transition
    setTimeout(() => {
      autoResizeTitle();
    }, 200);
    
    setTimeout(async () => {
      const { updateHomeButtonStates } = await import('./landing-page.js');
      updateHomeButtonStates();
    }, 200);
    
    isRecording = true;
    
    // Clear current note for new recording
    noteStorage.clearCurrentNote();
    
    // Show Vibe button while recording
    if (elements.vibeBtn) {
      elements.vibeBtn.style.display = 'inline-block';
    }
    
    // Show GAIA button while recording
    if (elements.gaiaBtn) {
      elements.gaiaBtn.style.display = 'inline-block';
    }
    
    // Show Vibe button in right sidebar while recording
    if (elements.qaVibeBtn) {
      elements.qaVibeBtn.style.display = 'block';
    }
    
    // Start wave animations
    startWaveAnimations();
    
    // Start audio monitoring for the level meters
    startAudioMonitoring();
    
    // Load actual device info now that we have permission
    loadAudioDeviceWithPermission();
    
    // Show settings icon when recording starts
    elements.settingsIcon.classList.remove('hidden');
    
    // Initialize and show right sidebar for new recording
    rightSidebarManager.initialize();
    rightSidebarManager.setCurrentNote(null); // No note ID yet for new recording
    rightSidebarManager.showSidebar(null); // Show sidebar in live mode
  } catch (error) {
    console.error('Failed to start transcription:', error);
    alert(`Error starting recording: ${error.message}`);
  }
}

// Stop recording
export async function stopRecording() {
  try {
    await window.electronAPI.stopTranscription();
    isRecording = false;
    
    // Stop wave animations and set static pattern
    stopWaveAnimations();
    
    // Hide settings icon when recording stops
    elements.settingsIcon.classList.add('hidden');
    elements.settingsDropdown.classList.remove('show');
    stopAudioMonitoring();
    
    // Get current transcript for logging
    const currentTranscript = getCurrentTranscript();
    const currentNotes = extractRawNotes();
    
    // Log transcript and raw notes to backend when stopping
    if (authManager.isAuthenticated() && currentTranscript.trim()) {
      try {
        const note = await noteStorage.createNote(
          elements.titleInput.value || 'Untitled Recording',
          currentTranscript.trim(),
          currentNotes,
          '' // No AI-generated notes yet
        );
        await setCurrentNoteId(note.id);
        
        // Refresh sidebar to show the new note
        const { refreshSidebar } = await import('./sidebar-manager.js');
        await refreshSidebar();
        
        console.log('Transcript logged to backend');
      } catch (error) {
        console.error('Failed to log transcript to backend:', error);
      }
    }
    
    // Generate title if title field is empty and we have a transcript (non-blocking)
    if (isTitleEmpty() && currentTranscript.trim()) {
      generateTitle().then(generatedTitle => {
        if (generatedTitle && isTitleEmpty()) {
          elements.titleInput.value = generatedTitle;
          autoResizeTitle();
        }
      }).catch(error => {
        console.error('Title generation failed:', error);
      });
    }
    
    // Show Generate notes button if transcript is not empty
    if (currentTranscript.trim().length > 0) {
      elements.generateNotesBtn.style.display = 'flex';
    }
    updateSeparatorVisibility();
    
    // Hide Vibe button when recording stops
    if (elements.vibeBtn) {
      elements.vibeBtn.style.display = 'none';
    }
    
    // Hide GAIA button when recording stops
    if (elements.gaiaBtn) {
      elements.gaiaBtn.style.display = 'none';
    }
    
    // Hide Vibe button in right sidebar when recording stops
    if (elements.qaVibeBtn) {
      elements.qaVibeBtn.style.display = 'none';
    }
    
    // Replace stop button with resume text
    elements.stopBtn.style.display = 'none';
    const resumeText = document.createElement('span');
    resumeText.className = 'resume-text';
    resumeText.textContent = 'Resume';
    resumeText.style.cursor = 'pointer';
    elements.stopBtn.parentNode.insertBefore(resumeText, elements.stopBtn.nextSibling);
    
    // Expand controls to accommodate resume text
    elements.recordingControls.classList.add('expanded');
    
    // Add click handler for resume
    resumeText.addEventListener('click', resumeRecording);    
  } catch (error) {
    console.error('Failed to stop transcription:', error);
    alert(`Error stopping recording: ${error.message}`);
  }
}

// Resume recording
export async function resumeRecording() {
  try {
    await window.electronAPI.startTranscription();
    isRecording = true;
    
    // Show Vibe button again
    if (elements.vibeBtn) {
      elements.vibeBtn.style.display = 'inline-block';
    }
    
    // Show Vibe button in right sidebar again
    if (elements.qaVibeBtn) {
      elements.qaVibeBtn.style.display = 'block';
    }
    
    // Start wave animations again
    startWaveAnimations();
    
    // Start audio monitoring again
    startAudioMonitoring();
    
    // Show settings icon when resuming
    elements.settingsIcon.classList.remove('hidden');
    
    // Hide Generate notes button when resuming
    elements.generateNotesBtn.style.display = 'none';
    updateSeparatorVisibility();
    
    // Switch back to stop button
    const resumeText = document.querySelector('.resume-text');
    if (resumeText) {
      resumeText.remove();
    }
    elements.stopBtn.style.display = 'block';
    elements.recordingControls.classList.remove('expanded');
    
  } catch (error) {
    console.error('Failed to resume recording:', error);
    alert(`Error resuming recording: ${error.message}`);
  }
}

// Handle vibe button click
async function handleVibeClick() {
  // Show the right sidebar if it's not visible
  if (!rightSidebarManager.isVisible) {
    rightSidebarManager.showSidebar(); // No noteId means live transcript mode
  }
  
  // Trigger vibe QA in the right sidebar
  await rightSidebarManager.sendVibeMessage();
}

// Get recording state
export function getIsRecording() {
  return isRecording;
}

// Initialize recording controls
export function initializeRecordingControls() {
  elements.recordBtn.addEventListener('click', startRecording);
  elements.stopBtn.addEventListener('click', stopRecording);
  elements.vibeBtn.addEventListener('click', handleVibeClick);
  
  // Auto-focus title input when recording screen appears
  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      if (mutation.target === elements.recordingScreen && elements.recordingScreen.style.display === 'block') {
        // Auto-resize title textarea when recording screen is displayed
        autoResizeTitle();
        elements.titleInput.focus();
      }
    });
  });
  
  observer.observe(elements.recordingScreen, { attributes: true, attributeFilter: ['style'] });
  
  // Auto-resize title input
  elements.titleInput.addEventListener('input', autoResizeTitle);
}