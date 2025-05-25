import { elements, updateSeparatorVisibility } from './dom-utils.js';
import { getCurrentTranscript } from './transcript-handler.js';
import { APIClient } from './api-client.js';
import { noteStorage } from './note-storage.js';
import { authManager } from './auth-manager.js';
import { processGeneratedNotes } from './markdown-processor.js';
import { handleNotesInput, handleNotesKeydown, initializeNotesAsEditable } from './notes-editor.js';
import { initializeStreamingNotesArea, handleStreamingResponse } from './streaming-handler.js';

// Track current note session for backend updates
let currentNoteId = null;
let notesUpdateTimeout = null;
let titleUpdateTimeout = null;
let notesGenerated = false; // Flag to track if AI notes have been generated

// Set current note ID for backend updates
export async function setCurrentNoteId(noteId) {
  currentNoteId = noteId;
  notesGenerated = false; // Reset when new note is created
  
  // Sync with noteStorage system
  if (noteId) {
    try {
      const note = await APIClient.getNote(noteId);
      noteStorage.setCurrentNote(note);
    } catch (error) {
      console.error('Failed to sync note with storage system:', error);
    }
  }
}

// Get current note ID
export function getCurrentNoteId() {
  return currentNoteId;
}

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

// Debounced update function for notes
export function debouncedUpdateNotes() {
  if (notesUpdateTimeout) {
    clearTimeout(notesUpdateTimeout);
  }
  
  notesUpdateTimeout = setTimeout(async () => {
    if (currentNoteId && authManager.isAuthenticated()) {
      try {
        const updateData = {
          title: elements.titleInput.value || 'Untitled',
          transcript: getCurrentTranscript(),
          notes: elements.notesInput.innerHTML || ''
        };
        
        // Only include raw_notes if notes haven't been generated yet
        if (!notesGenerated) {
          updateData.raw_notes = extractRawNotes();
        }
        
        await APIClient.updateNote(currentNoteId, updateData);
        console.log('Notes updated in backend');
      } catch (error) {
        console.error('Failed to update notes in backend:', error);
      }
    }
  }, 2000); // 2 second debounce
}

// Debounced update function for title
function debouncedUpdateTitle() {
  if (titleUpdateTimeout) {
    clearTimeout(titleUpdateTimeout);
  }
  
  titleUpdateTimeout = setTimeout(async () => {
    if (currentNoteId && authManager.isAuthenticated()) {
      try {
        const updateData = {
          title: elements.titleInput.value || 'Untitled',
          transcript: getCurrentTranscript(),
          notes: elements.notesInput.innerHTML || ''
        };
        
        // Only include raw_notes if notes haven't been generated yet
        if (!notesGenerated) {
          updateData.raw_notes = extractRawNotes();
        }
        
        await APIClient.updateNote(currentNoteId, updateData);
        console.log('Title updated in backend');
      } catch (error) {
        console.error('Failed to update title in backend:', error);
      }
    }
  }, 1000); // 1 second debounce for title
}

// Function to call generate-title API endpoint
export async function generateTitle() {
  const currentTranscript = getCurrentTranscript();
  
  if (!currentTranscript.trim()) {
    return null;
  }
  
  try {
    const data = await APIClient.generateTitle(currentTranscript.trim());
    const generatedTitle = data.title;
    
    // Update current note with the generated title if we have one tracked
    if (currentNoteId && authManager.isAuthenticated() && generatedTitle) {
      try {
        const updateData = {
          title: generatedTitle,
          transcript: currentTranscript.trim(),
          notes: elements.notesInput.innerHTML || ''
        };
        
        // Only include raw_notes if notes haven't been generated yet
        if (!notesGenerated) {
          updateData.raw_notes = extractRawNotes();
        }
        
        await APIClient.updateNote(currentNoteId, updateData);
        console.log('Note updated with generated title');
      } catch (error) {
        console.error('Failed to update note with title:', error);
      }
    }
    
    return generatedTitle;
  } catch (error) {
    console.error('Failed to generate title:', error);
    return null;
  }
}

// Function to create mixed content div with user editing capability
export function createEditableNotesDiv(notes) {
  const processedNotes = processGeneratedNotes(notes);
  
  // If notes input is already a contentEditable div, just update its content
  if (elements.notesInput.contentEditable === 'true') {
    elements.notesInput.innerHTML = processedNotes;
    window.notesDisplay = elements.notesInput;
  } else {
    // Create a new contentEditable div element (fallback)
    const notesDiv = document.createElement('div');
    notesDiv.className = 'notes-input notes-display';
    notesDiv.contentEditable = true;
    notesDiv.innerHTML = processedNotes;
    
    // Replace the textarea with the div
    elements.notesInput.parentNode.replaceChild(notesDiv, elements.notesInput);
    
    // Update the reference to point to the new div
    elements.notesInput = notesDiv;
    window.notesDisplay = notesDiv;
  }
  
  // Get the current notes div (either existing or newly created)
  const currentNotesDiv = elements.notesInput;
  
  // Add event listeners for external links
  const externalLinks = currentNotesDiv.querySelectorAll('.external-link');
  externalLinks.forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      window.electronAPI.openExternal(link.href);
    });
  });
  
  // Ensure event listeners are added (they may already exist if it was initialized as editable)
  if (!currentNotesDiv.hasEventListener) {
    currentNotesDiv.addEventListener('input', handleNotesInput);
    currentNotesDiv.addEventListener('keydown', handleNotesKeydown);
    currentNotesDiv.hasEventListener = true;
  }
  
  return currentNotesDiv;
}

// Generate notes functionality with streaming support
export async function generateNotes() {
  const rawNotes = elements.notesInput.textContent || elements.notesInput.value || '';
  const currentTranscript = getCurrentTranscript();
  
  if (!currentTranscript.trim()) {
    alert('No transcript available to generate notes from');
    return;
  }
  
  // Show loading state
  const originalText = elements.generateNotesBtn.querySelector('svg').nextSibling.textContent.trim();
  elements.generateNotesBtn.querySelector('svg').nextSibling.textContent = ' Generating...';
  elements.generateNotesBtn.disabled = true;
  
  // Hide resume text using visibility hidden and disable it to preserve spacing
  const resumeText = document.querySelector('.resume-text');
  if (resumeText) {
    resumeText.style.visibility = 'hidden';
    resumeText.style.pointerEvents = 'none';
    // Don't remove expanded class yet to maintain spacing
  }
  updateSeparatorVisibility();
  
  // Initialize the notes area for streaming
  initializeStreamingNotesArea();
  
  try {
    // Use the API client for authenticated requests
    const response = await APIClient.generateNotesStream(currentTranscript.trim(), rawNotes);
    
    // Handle streaming response
    await handleStreamingResponse(response);
    
    // Mark that notes have been generated - this locks raw_notes
    notesGenerated = true;
    
    // Now hide both generate notes button and resume text with display none
    elements.generateNotesBtn.style.display = 'none';
    if (resumeText) {
      resumeText.style.display = 'none';
      elements.recordingControls.classList.remove('expanded');
    }
    updateSeparatorVisibility();
    
  } catch (error) {
    console.error('Failed to generate notes:', error);
    alert(`Error generating notes: ${error.message}`);
    // Reset button state on error - restore resume text visibility
    elements.generateNotesBtn.querySelector('svg').nextSibling.textContent = originalText;
    elements.generateNotesBtn.disabled = false;
    if (resumeText) {
      resumeText.style.visibility = 'visible';
      resumeText.style.pointerEvents = 'auto';
    }
  }
}

// Initialize notes processing event listeners
export function initializeNotesListeners() {
  elements.generateNotesBtn.addEventListener('click', generateNotes);
  
  // Initialize the notes input as editable with markdown support
  initializeNotesAsEditable();
  
  // Add title input listener for debounced updates
  elements.titleInput.addEventListener('input', () => {
    debouncedUpdateTitle();
  });
}