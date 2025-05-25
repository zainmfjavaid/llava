// landing-page.js - Landing page functionality
import { APIClient } from './api-client.js';
import { authManager } from './auth-manager.js';

export function initializeLandingPage() {
  const chatInput = document.getElementById('chatInput');
  const chatSendBtn = document.getElementById('chatSendBtn');
  const notesList = document.getElementById('notesList');
  
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

function initTextarea(textarea, sendButton = null) {
  if (sendButton) {
    sendButton.disabled = true;
  }

  // Set initial height
  textarea.style.height = 'auto';
  textarea.style.height = Math.max(textarea.scrollHeight, 60) + 'px';
  textarea.style.overflowY = 'hidden';

  textarea.addEventListener('input', () => {
    // Reset height to auto to get the correct scrollHeight
    textarea.style.height = 'auto';
    const newHeight = Math.min(textarea.scrollHeight, 360);
    textarea.style.height = `${newHeight}px`;
    textarea.style.overflowY = textarea.scrollHeight > 360 ? 'scroll' : 'hidden';

    // Enable/disable send button based on content
    if (sendButton) {
      sendButton.disabled = textarea.value.trim() === '';
    }
  });
}
  
  // Load and display past notes
  loadPastNotes();
}

async function loadPastNotes() {
  const notesList = document.getElementById('notesList');
  if (!notesList) return;
  
  try {
    const notes = await APIClient.getUserNotes();
    displayNotes(notes);
  } catch (error) {
    console.error('Failed to load notes:', error);
    notesList.innerHTML = `
      <div class="loading-notes">
        Failed to load notes. Please try again later.
      </div>
    `;
  }
}

function displayNotes(notes) {
  const notesList = document.getElementById('notesList');
  if (!notesList) return;
  
  if (notes.length === 0) {
    notesList.innerHTML = `
      <div class="loading-notes">
        No notes yet. Start by recording your first session!
      </div>
    `;
    return;
  }
  
  // Group notes by date
  const groupedNotes = groupNotesByDate(notes);
  
  // Generate HTML for each date group
  let html = '';
  Object.keys(groupedNotes).forEach(dateKey => {
    const dateNotes = groupedNotes[dateKey];
    html += `
      <div class="date-group">
        <div class="date-header">${dateKey}</div>
        ${dateNotes.map(note => `
          <div class="note-item" onclick="openNote('${note.id}')">
            <div class="note-content">
              <div class="note-title">${escapeHtml(note.title)}</div>
              <div class="note-time">${formatTime(note.date_created)}</div>
            </div>
            <button class="note-delete-btn" onclick="event.stopPropagation(); deleteNote('${note.id}')" title="Delete note">
              <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>
              </svg>
            </button>
          </div>
        `).join('')}
      </div>
    `;
  });
  
  notesList.innerHTML = html;
}

function groupNotesByDate(notes) {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  
  const groups = {};
  
  notes.forEach(note => {
    // Backend sends UTC timestamps, so we need to treat them as UTC
    const noteDate = new Date(note.date_created + 'Z');
    const noteDateOnly = new Date(noteDate.getFullYear(), noteDate.getMonth(), noteDate.getDate());
    
    let dateKey;
    if (noteDateOnly.getTime() === today.getTime()) {
      dateKey = 'Today';
    } else if (noteDateOnly.getTime() === yesterday.getTime()) {
      dateKey = 'Yesterday';
    } else {
      // Format as "Mon, Jan 15" for other dates
      dateKey = noteDate.toLocaleDateString('en-US', { 
        weekday: 'short', 
        month: 'short', 
        day: 'numeric' 
      });
    }
    
    if (!groups[dateKey]) {
      groups[dateKey] = [];
    }
    groups[dateKey].push(note);
  });
  
  // Sort each group by time (most recent first)
  Object.keys(groups).forEach(dateKey => {
    groups[dateKey].sort((a, b) => new Date(b.date_created + 'Z') - new Date(a.date_created + 'Z'));
  });
  
  // Return groups in the right order: Today, Yesterday, then by date descending
  const orderedGroups = {};
  if (groups['Today']) orderedGroups['Today'] = groups['Today'];
  if (groups['Yesterday']) orderedGroups['Yesterday'] = groups['Yesterday'];
  
  // Add other dates in descending order
  Object.keys(groups)
    .filter(key => key !== 'Today' && key !== 'Yesterday')
    .sort((a, b) => {
      // Parse the date strings back to compare them
      const dateA = new Date(groups[a][0].date_created + 'Z');
      const dateB = new Date(groups[b][0].date_created + 'Z');
      return dateB - dateA;
    })
    .forEach(key => {
      orderedGroups[key] = groups[key];
    });
  
  return orderedGroups;
}

function formatTime(dateString) {
  // Backend sends UTC timestamps, so we need to treat them as UTC
  const date = new Date(dateString + 'Z');
  return date.toLocaleTimeString('en-US', { 
    hour: 'numeric', 
    minute: '2-digit',
    hour12: true 
  });
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

// Global function to delete a note (called from onclick)
window.deleteNote = async function(noteId) {
  if (!confirm('Are you sure you want to delete this note? This action cannot be undone.')) {
    return;
  }
  
  try {
    await APIClient.deleteNote(noteId);
    // Reload the notes list to reflect the deletion
    loadPastNotes();
  } catch (error) {
    console.error('Failed to delete note:', error);
    alert('Failed to delete note. Please try again.');
  }
};

async function reconstructNoteView(note) {
  // Hide landing page and show recording screen
  const initialScreen = document.getElementById('initialScreen');
  const recordingScreen = document.getElementById('recordingScreen');
  
  if (initialScreen) initialScreen.style.display = 'none';
  if (recordingScreen) recordingScreen.style.display = 'block';
  
  // Import required modules
  const { setCurrentNoteId } = await import('./notes-processor.js');
  const { processGeneratedNotes } = await import('./markdown-processor.js');
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
  
  // Wait a moment for DOM to be ready
  await new Promise(resolve => setTimeout(resolve, 50));
  
  // Populate the fields
  const titleInput = document.getElementById('titleInput');
  let notesInput = document.getElementById('notesInput');
  const transcriptContent = document.getElementById('transcriptContent');
  const generateNotesBtn = document.getElementById('generateNotesBtn');
  const stopBtn = document.getElementById('stopBtn');
  
  // If notesInput is not found, try finding it with querySelector
  if (!notesInput) {
    notesInput = document.querySelector('.notes-input');
  }
  
  if (titleInput) titleInput.value = note.title;
  
  // Set transcript content
  if (transcriptContent) {
    transcriptContent.textContent = note.transcript;
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