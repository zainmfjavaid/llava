import { elements, isTitleEmpty, autoResizeTitle, startWaveAnimations, stopWaveAnimations, updateSeparatorVisibility } from './dom-utils.js';
import { generateTitle } from './notes-processor.js';
import { stopAudioMonitoring } from './audio-monitor.js';
import { getCurrentTranscript } from './transcript-handler.js';

let isRecording = false;

// Start recording
export async function startRecording() {
  try {
    await window.electronAPI.startTranscription();
    
    // Switch to recording screen
    elements.initialScreen.style.display = 'none';
    elements.recordingScreen.style.display = 'block';
    
    isRecording = true;
    // Clear transcript content
    elements.transcriptContent.textContent = '';
    
    // Start wave animations
    startWaveAnimations();
    
    // Show settings icon when recording starts
    elements.settingsIcon.classList.remove('hidden');
    
    console.log('Recording started');
    
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
    
    // Generate title if title field is empty and we have a transcript (non-blocking)
    const currentTranscript = getCurrentTranscript();
    
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
    
    console.log('Recording stopped');
    
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
    
    // Start wave animations again
    startWaveAnimations();
    
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

// Get recording state
export function getIsRecording() {
  return isRecording;
}

// Initialize recording controls
export function initializeRecordingControls() {
  elements.recordBtn.addEventListener('click', startRecording);
  elements.stopBtn.addEventListener('click', stopRecording);
  
  // Auto-focus title input when recording screen appears
  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      if (mutation.target === elements.recordingScreen && elements.recordingScreen.style.display === 'block') {
        elements.titleInput.focus();
      }
    });
  });
  
  observer.observe(elements.recordingScreen, { attributes: true, attributeFilter: ['style'] });
  
  // Auto-resize title input
  elements.titleInput.addEventListener('input', autoResizeTitle);
}