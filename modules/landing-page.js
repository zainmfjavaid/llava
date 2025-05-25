// landing-page.js - Landing page functionality
import { APIClient } from './api-client.js';
import { authManager } from './auth-manager.js';

export function initializeLandingPage() {
  const chatInput = document.getElementById('chatInput');
  const chatSendBtn = document.getElementById('chatSendBtn');
  const notesGrid = document.getElementById('notesGrid');
  
  // Enable/disable chat send button based on input
  if (chatInput && chatSendBtn) {
    chatInput.addEventListener('input', () => {
      chatSendBtn.disabled = !chatInput.value.trim();
    });
    
    // Handle chat send (placeholder for now)
    chatSendBtn.addEventListener('click', () => {
      console.log('Chat functionality not implemented yet');
    });
  }
  
  // Load and display past notes
  loadPastNotes();
}

async function loadPastNotes() {
  const notesGrid = document.getElementById('notesGrid');
  if (!notesGrid) return;
  
  try {
    const notes = await APIClient.getUserNotes();
    displayNotes(notes);
  } catch (error) {
    console.error('Failed to load notes:', error);
    notesGrid.innerHTML = `
      <div class="loading-notes">
        Failed to load notes. Please try again later.
      </div>
    `;
  }
}

function displayNotes(notes) {
  const notesGrid = document.getElementById('notesGrid');
  if (!notesGrid) return;
  
  if (notes.length === 0) {
    notesGrid.innerHTML = `
      <div class="loading-notes">
        No notes yet. Start by recording your first session!
      </div>
    `;
    return;
  }
  
  notesGrid.innerHTML = notes.map(note => `
    <div class="note-tile" onclick="openNote('${note.id}')">
      <div class="note-tile-title">${escapeHtml(note.title)}</div>
      <div class="note-tile-preview">${escapeHtml(getPreviewText(note))}</div>
      <div class="note-tile-status">
        <span class="status-badge ${note.is_ai_enhanced ? 'ai-enhanced' : 'manual'}">
          ${note.is_ai_enhanced ? 'AI Enhanced' : 'Manual Notes'}
        </span>
      </div>
    </div>
  `).join('');
}

function getPreviewText(note) {
  // Prioritize showing AI-enhanced notes, then raw notes, then transcript
  const text = note.notes || note.raw_notes || note.transcript || '';
  // Remove any HTML tags and get first 150 characters
  const cleanText = text.replace(/<[^>]*>/g, '').replace(/\n+/g, ' ').trim();
  return cleanText.length > 150 ? cleanText.substring(0, 150) + '...' : cleanText;
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Global function to open a note (called from onclick)
window.openNote = async function(noteId) {
  try {
    const note = await APIClient.getNote(noteId);
    reconstructNoteView(note);
  } catch (error) {
    console.error('Failed to load note:', error);
    alert('Failed to load note. Please try again.');
  }
};

async function reconstructNoteView(note) {
  // Hide landing page and show recording screen
  const initialScreen = document.getElementById('initialScreen');
  const recordingScreen = document.getElementById('recordingScreen');
  
  if (initialScreen) initialScreen.style.display = 'none';
  if (recordingScreen) recordingScreen.style.display = 'block';
  
  // Import required modules
  const { setCurrentNoteId, createEditableNotesDiv, processGeneratedNotes } = await import('./notes-processor.js');
  const { elements, updateSeparatorVisibility } = await import('./dom-utils.js');
  
  // Clear any existing resume text and reset controls
  const existingResumeText = document.querySelector('.resume-text');
  if (existingResumeText) existingResumeText.remove();
  
  // Reset recording controls state
  const recordingControls = document.getElementById('recordingControls');
  if (recordingControls) {
    recordingControls.classList.remove('expanded');
    recordingControls.classList.remove('transcript-open');
  }
  
  // Set the current note ID for proper backend integration
  await setCurrentNoteId(note.id);
  
  // Populate the fields
  const titleInput = document.getElementById('titleInput');
  const notesInput = document.getElementById('notesInput');
  const transcriptContent = document.getElementById('transcriptContent');
  const generateNotesBtn = document.getElementById('generateNotesBtn');
  const stopBtn = document.getElementById('stopBtn');
  
  if (titleInput) titleInput.value = note.title;
  
  // Set transcript content
  if (transcriptContent) {
    transcriptContent.textContent = note.transcript;
  }
  
  // Always show the transcript panel in reconstruction mode
  if (recordingControls) {
    recordingControls.classList.add('transcript-open');
  }
  
  // Make sure audio monitoring is stopped during reconstruction
  const { stopAudioMonitoring } = await import('./audio-monitor.js');
  stopAudioMonitoring();
  
  // Configure UI based on is_ai_enhanced flag
  if (note.is_ai_enhanced && note.notes) {
    // AI-enhanced notes: show AI notes, hide generate button and resume
    if (notesInput) {
      // Convert to contentEditable div and populate with AI notes
      const processedNotes = processGeneratedNotes(note.notes);
      
      // Replace textarea with contentEditable div
      const notesDiv = document.createElement('div');
      notesDiv.className = 'notes-input notes-display';
      notesDiv.contentEditable = 'true';
      notesDiv.innerHTML = processedNotes;
      
      notesInput.parentNode.replaceChild(notesDiv, notesInput);
      elements.notesInput = notesDiv;
    }
    
    // Hide generate notes button
    if (generateNotesBtn) generateNotesBtn.style.display = 'none';
    
    // Hide stop button (AI enhanced means recording is complete)
    if (stopBtn) stopBtn.style.display = 'none';
    
  } else {
    // Manual notes: show raw notes as textarea, show generate button and resume
    if (notesInput) {
      // Ensure it's a textarea for manual editing
      if (notesInput.contentEditable === 'true' || notesInput.tagName === 'DIV') {
        // Convert back to textarea
        const textarea = document.createElement('textarea');
        textarea.className = 'notes-input';
        textarea.id = 'notesInput';
        textarea.placeholder = 'Write notes...';
        textarea.value = note.raw_notes || '';
        
        notesInput.parentNode.replaceChild(textarea, notesInput);
        elements.notesInput = textarea;
      } else {
        notesInput.value = note.raw_notes || '';
      }
    }
    
    // Show generate notes button
    if (generateNotesBtn) generateNotesBtn.style.display = 'flex';
    
    // Hide stop button and show resume text
    if (stopBtn) stopBtn.style.display = 'none';
    
    // Create and show resume text
    const resumeText = document.createElement('span');
    resumeText.className = 'resume-text';
    resumeText.textContent = 'Resume';
    resumeText.style.cursor = 'pointer';
    
    if (stopBtn && stopBtn.parentNode) {
      stopBtn.parentNode.insertBefore(resumeText, stopBtn.nextSibling);
    }
    
    // Add resume functionality
    resumeText.addEventListener('click', async () => {
      const { resumeRecording } = await import('./recording-controls.js');
      resumeRecording();
    });
    
    // Set controls in expanded state to show resume and generate buttons
    if (recordingControls) {
      recordingControls.classList.add('expanded');
    }
  }
  
  // Update separator visibility
  updateSeparatorVisibility();
  
  // Store current note data for future operations
  window.currentNoteId = note.id;
  window.currentNote = note;
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
      <path d="M19 7v4H5.83l3.58-3.59L8 6l-6 6 6 6 1.41-1.41L5.83 13H21V7z"/>
    </svg>
    Back to Home
  `;
  
  backButton.addEventListener('click', () => {
    const initialScreen = document.getElementById('initialScreen');
    const recordingScreen = document.getElementById('recordingScreen');
    
    if (initialScreen) initialScreen.style.display = 'flex';
    if (recordingScreen) recordingScreen.style.display = 'none';
    
    // Reload notes to refresh the list
    loadPastNotes();
    
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