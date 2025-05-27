import { elements, showCopySuccess, updateSeparatorVisibility } from './dom-utils.js';

let currentTranscript = '';
let autoScrollEnabled = true;    // Auto-scroll state for transcript
let lastSpeaker = null;          // Track the last speaker for line breaks
let lastEndTime = 0;             // Track when the last segment ended

// Handle Amazon Transcribe results
export function handleTranscriptionResult(data) {
  if (!data.Transcript) return;

  const transcript = data.Transcript;
  
  if (transcript && transcript.trim().length > 0) {
    // Get timing information if available
    const segmentStart = data.StartTime || 0;
    const segmentEnd = data.EndTime || 0;
    
    // Determine the speaker if available
    let primarySpeaker = null;
    if (data.SpeakerLabel) {
      primarySpeaker = parseInt(data.SpeakerLabel.replace('spk_', ''));
    }
    
    // Determine if we need a double newline
    let needsNewline = false;
    
    // Add newline if speaker changed
    if (primarySpeaker !== null && lastSpeaker !== null && primarySpeaker !== lastSpeaker) {
      needsNewline = true;
    }
    
    if (data.IsPartial === false) {
      // Final result - add to permanent transcript
      let textToAdd = transcript;
      
      // Add double newline prefix if needed
      if (needsNewline) {
        textToAdd = '\n\n' + textToAdd;
      }
      
      currentTranscript += textToAdd + ' ';
      elements.transcriptContent.textContent = currentTranscript;
      
      // Update tracking variables
      lastSpeaker = primarySpeaker;
      lastEndTime = segmentEnd;
      
      if (autoScrollEnabled) {
        elements.transcriptContent.scrollTop = elements.transcriptContent.scrollHeight;
      }
    } else {
      // Interim result - show temporarily
      let textToAdd = transcript;
      
      // Add double newline prefix if needed for interim display
      if (needsNewline) {
        textToAdd = '\n\n' + textToAdd;
      }
      
      elements.transcriptContent.textContent = currentTranscript + textToAdd;
      if (autoScrollEnabled) {
        elements.transcriptContent.scrollTop = elements.transcriptContent.scrollHeight;
      }
    }
  }
}

// Handle transcription errors
export function handleTranscriptionError(error) {
  console.error('[Renderer] Transcription error:', error);
  alert(`Transcription error: ${error.message || error}`);
}

// Auto-scroll detection for transcript
export function handleTranscriptScroll() {
  const isAtBottom = elements.transcriptContent.scrollTop + elements.transcriptContent.clientHeight >= elements.transcriptContent.scrollHeight - 5;
  
  if (!isAtBottom) {
    // User scrolled up, disable auto-scroll and show button
    autoScrollEnabled = false;
    elements.scrollToBottomBtn.style.display = 'flex';
  } else {
    // User is at bottom, re-enable auto-scroll and hide button
    autoScrollEnabled = true;
    elements.scrollToBottomBtn.style.display = 'none';
  }
}

// Scroll to bottom button functionality
export function scrollToBottom() {
  elements.transcriptContent.scrollTop = elements.transcriptContent.scrollHeight;
  autoScrollEnabled = true;
  elements.scrollToBottomBtn.style.display = 'none';
}

// Copy transcript functionality
export async function copyTranscript() {
  try {
    await navigator.clipboard.writeText(currentTranscript);
    showCopySuccess();
  } catch (error) {
    console.error('Failed to copy transcript:', error);
    
    // Fallback for older browsers
    const textArea = document.createElement('textarea');
    textArea.value = currentTranscript;
    document.body.appendChild(textArea);
    textArea.select();
    document.execCommand('copy');
    document.body.removeChild(textArea);
    
    showCopySuccess();
  }
}

// Clear transcript
export function clearTranscript() {
  currentTranscript = '';
  elements.transcriptContent.textContent = '';
  lastSpeaker = null;
  lastEndTime = 0;
}

// Get current transcript
export function getCurrentTranscript() {
  return currentTranscript;
}

// Set transcript content (for viewing existing notes)
export function setTranscript(transcript) {
  currentTranscript = transcript || '';
  elements.transcriptContent.textContent = currentTranscript;
  lastSpeaker = null;
  lastEndTime = 0;
}

// Initialize transcript event listeners
export function initializeTranscriptListeners() {
  elements.transcriptContent.addEventListener('scroll', handleTranscriptScroll);
  elements.scrollToBottomBtn.addEventListener('click', scrollToBottom);
  elements.copyIcon.addEventListener('click', copyTranscript);
  
  // Toggle transcript panel when audio visualizer is clicked
  elements.audioVisualizer.addEventListener('click', () => {
    elements.recordingControls.classList.toggle('transcript-open');
    updateSeparatorVisibility();
  });
  
  // Close transcript when clicking outside the transcript window
  document.addEventListener('click', (e) => {
    if (elements.recordingControls.classList.contains('transcript-open') && 
        !elements.transcriptContentWrapper.contains(e.target) && 
        !elements.audioVisualizer.contains(e.target) &&
        !elements.recordingControls.contains(e.target)) {
      elements.recordingControls.classList.remove('transcript-open');
    }
  });
  
  // Initialize scroll button
  if (elements.scrollToBottomBtn) {
    elements.scrollToBottomBtn.style.display = 'none';
  }
}