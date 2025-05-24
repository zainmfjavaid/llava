import { elements, showCopySuccess, updateSeparatorVisibility } from './dom-utils.js';

let currentTranscript = '';
let autoScrollEnabled = true;    // Auto-scroll state for transcript

// Handle Deepgram transcription results
export function handleTranscriptionResult(data) {
  console.log('[Renderer] Deepgram result:', data);
  
  if (data.channel && data.channel.alternatives && data.channel.alternatives.length > 0) {
    const alternative = data.channel.alternatives[0];
    const transcript = alternative.transcript;
    
    if (transcript && transcript.trim().length > 0) {
      if (data.is_final) {
        // Final result - add to permanent transcript
        currentTranscript += transcript + ' ';
        elements.transcriptContent.textContent = currentTranscript;
        if (autoScrollEnabled) {
          elements.transcriptContent.scrollTop = elements.transcriptContent.scrollHeight;
        }
      } else {
        // Interim result - show temporarily
        elements.transcriptContent.textContent = currentTranscript + transcript;
        if (autoScrollEnabled) {
          elements.transcriptContent.scrollTop = elements.transcriptContent.scrollHeight;
        }
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
}

// Get current transcript
export function getCurrentTranscript() {
  return currentTranscript;
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