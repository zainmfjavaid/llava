// sidebar-manager.js - Sidebar functionality for notes navigation
import { APIClient } from './api-client.js';
import { authManager } from './auth-manager.js';
import { setTranscript } from './transcript-handler.js';
import { clearTranscript } from './transcript-handler.js';
import { resetNotesGenerationState } from './notes-processor.js';
import { rightSidebarManager } from './right-sidebar-manager.js';

class SidebarManager {
  constructor() {
    this.isCollapsed = false;
    this.notes = [];
    this.currentNoteId = null;
    this.initialized = false;
  }

  async initialize() {
    // Prevent multiple initializations
    if (this.initialized) {
      return;
    }
    this.initialized = true;
    
    // Restore sidebar state for all screens
    this.restoreSidebarState();
    // Load notes before setting up event listeners
    await this.loadNotes();
    this.setupEventListeners();
    this.setupFocusBlurLogic();
    this.setupRecordingScreenSidebar();
  }

  restoreSidebarState() {
    // Initial screen
    const sidebar = document.querySelector('.initial-screen .sidebar');
    if (sidebar) {
      const collapsed = localStorage.getItem('sidebar-collapsed-initial') === 'true';
      sidebar.classList.toggle('collapsed', collapsed);
      const shrinkIcon = document.getElementById('sidebar-toggle-shrink');
      const expandIcon = document.getElementById('sidebar-toggle-expand');
      if (shrinkIcon && expandIcon) {
        shrinkIcon.style.display = collapsed ? 'none' : 'block';
        expandIcon.style.display = collapsed ? 'block' : 'none';
      }
    }
    // Recording screen
    const sidebarRecording = document.querySelector('.recording-screen .sidebar');
    if (sidebarRecording) {
      const collapsed = localStorage.getItem('sidebar-collapsed-recording') === 'true';
      sidebarRecording.classList.toggle('collapsed', collapsed);
      const shrinkIconRecording = document.getElementById('sidebar-toggle-shrink-recording');
      const expandIconRecording = document.getElementById('sidebar-toggle-expand-recording');
      if (shrinkIconRecording && expandIconRecording) {
        shrinkIconRecording.style.display = collapsed ? 'none' : 'block';
        expandIconRecording.style.display = collapsed ? 'block' : 'none';
      }
    }
    // Chat screen
    const sidebarChat = document.querySelector('.chat-screen .sidebar');
    if (sidebarChat) {
      const collapsed = localStorage.getItem('sidebar-collapsed-chat') === 'true';
      sidebarChat.classList.toggle('collapsed', collapsed);
      const shrinkIconChat = document.getElementById('sidebar-toggle-shrink-chat');
      const expandIconChat = document.getElementById('sidebar-toggle-expand-chat');
      if (shrinkIconChat && expandIconChat) {
        shrinkIconChat.style.display = collapsed ? 'none' : 'block';
        expandIconChat.style.display = collapsed ? 'block' : 'none';
      }
    }
  }

  setupEventListeners() {
    const sidebarToggleBtn = document.getElementById('sidebar-toggle');
    const sidebar = document.querySelector('.initial-screen .sidebar');
    
    if (sidebarToggleBtn && sidebar) {
      sidebarToggleBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.toggleSidebar(sidebar, 'sidebar-toggle-shrink', 'sidebar-toggle-expand');
      });

      // When sidebar is collapsed, allow click anywhere to expand
      sidebar.addEventListener('click', (e) => {
        if (sidebar.classList.contains('collapsed')) {
          e.stopPropagation();
          this.expandSidebar(sidebar, 'sidebar-toggle-shrink', 'sidebar-toggle-expand');
        }
      });
    } else {
      console.error('[SM] Initial screen sidebar or toggle button NOT FOUND.');
    }

    // Also setup chat screen sidebar
    this.setupChatScreenSidebar();
  }

  setupRecordingScreenSidebar() {
    const sidebarToggleBtnRecording = document.getElementById('sidebar-toggle-recording');
    const sidebarRecording = document.querySelector('.recording-screen .sidebar');

    if (sidebarToggleBtnRecording && sidebarRecording) {
      sidebarToggleBtnRecording.addEventListener('click', (e) => {
        e.stopPropagation();
        this.toggleSidebar(sidebarRecording, 'sidebar-toggle-shrink-recording', 'sidebar-toggle-expand-recording');
      });

      // When sidebar is collapsed, allow click anywhere to expand
      sidebarRecording.addEventListener('click', (e) => {
        if (sidebarRecording.classList.contains('collapsed')) {
          e.stopPropagation();
          this.expandSidebar(sidebarRecording, 'sidebar-toggle-shrink-recording', 'sidebar-toggle-expand-recording');
        }
      });
    } else {
      console.error('[SM] Recording screen sidebar or toggle button NOT FOUND.');
    }
  }

  setupChatScreenSidebar() {
    const sidebarToggleBtnChat = document.getElementById('sidebar-toggle-chat');
    const sidebarChat = document.querySelector('.chat-screen .sidebar');

    if (sidebarToggleBtnChat && sidebarChat) {
      sidebarToggleBtnChat.addEventListener('click', (e) => {
        e.stopPropagation();
        this.toggleSidebar(sidebarChat, 'sidebar-toggle-shrink-chat', 'sidebar-toggle-expand-chat');
      });

      // When sidebar is collapsed, allow click anywhere to expand
      sidebarChat.addEventListener('click', (e) => {
        if (sidebarChat.classList.contains('collapsed')) {
          e.stopPropagation();
          this.expandSidebar(sidebarChat, 'sidebar-toggle-shrink-chat', 'sidebar-toggle-expand-chat');
        }
      });
    } else {
      console.error('[SM] Chat screen sidebar or toggle button NOT FOUND.');
    }
  }

  setupFocusBlurLogic() {
    // Setup focus/blur logic for all sidebars
    const sidebars = document.querySelectorAll('.sidebar');
    
    sidebars.forEach(sidebar => {
      // Add focus on mousedown
      sidebar.addEventListener('mousedown', (e) => {
        e.stopPropagation();
        sidebar.classList.add('focused');
      });
    });

    // Remove focus when clicking outside any sidebar
    document.addEventListener('mousedown', (e) => {
      sidebars.forEach(sidebar => {
        if (!sidebar.contains(e.target)) {
          sidebar.classList.remove('focused');
        }
      });
    });
  }

  toggleSidebar(sidebar, shrinkIconId, expandIconId) {
    if (!sidebar) {
      console.error('[SM] toggleSidebar: sidebar element is null!');
      return;
    }
    if (sidebar.classList.contains('collapsed')) {
      this.expandSidebar(sidebar, shrinkIconId, expandIconId);
    } else {
      this.collapseSidebar(sidebar, shrinkIconId, expandIconId);
    }
  }

  collapseSidebar(sidebar, shrinkIconId, expandIconId) {
    const shrinkIcon = document.getElementById(shrinkIconId);
    const expandIcon = document.getElementById(expandIconId);
    if (sidebar && !sidebar.classList.contains('collapsed')) {
      sidebar.classList.add('collapsed');
      sidebar.classList.remove('focused');
      if (shrinkIcon) shrinkIcon.style.display = 'none';
      if (expandIcon) expandIcon.style.display = 'block';
      this.saveSidebarState(sidebar, true);
    }
  }

  expandSidebar(sidebar, shrinkIconId, expandIconId) {
    const shrinkIcon = document.getElementById(shrinkIconId);
    const expandIcon = document.getElementById(expandIconId);
    if (sidebar && sidebar.classList.contains('collapsed')) {
      sidebar.classList.remove('collapsed');
      if (shrinkIcon) shrinkIcon.style.display = 'block';
      if (expandIcon) expandIcon.style.display = 'none';
      this.saveSidebarState(sidebar, false);
    }
  }

  saveSidebarState(sidebar, collapsed) {
    if (sidebar.classList.contains('initial-screen')) {
      localStorage.setItem('sidebar-collapsed-initial', collapsed);
    } else if (sidebar.classList.contains('recording-screen')) {
      localStorage.setItem('sidebar-collapsed-recording', collapsed);
    } else if (sidebar.classList.contains('chat-screen')) {
      localStorage.setItem('sidebar-collapsed-chat', collapsed);
    } else {
      // fallback: check parent nodes
      if (sidebar.closest('.initial-screen')) {
        localStorage.setItem('sidebar-collapsed-initial', collapsed);
      } else if (sidebar.closest('.recording-screen')) {
        localStorage.setItem('sidebar-collapsed-recording', collapsed);
      } else if (sidebar.closest('.chat-screen')) {
        localStorage.setItem('sidebar-collapsed-chat', collapsed);
      }
    }
  }

  async loadNotes() {
    const notesSidebar = document.getElementById('notesSidebar');
    const notesSidebarRecording = document.getElementById('notesSidebarRecording');

    try {
      this.notes = await APIClient.getUserNotes();
      this.displayNotes();
    } catch (error) {
      console.error('Failed to load notes for sidebar:', error);
      
      const errorHtml = `
        <div class="loading-notes-sidebar">
          <p>Failed to load notes</p>
        </div>
      `;
      
      if (notesSidebar) notesSidebar.innerHTML = errorHtml;
      if (notesSidebarRecording) notesSidebarRecording.innerHTML = errorHtml;
    }
  }

  displayNotes() {
    const notesSidebar = document.getElementById('notesSidebar');
    const notesSidebarRecording = document.getElementById('notesSidebarRecording');

    if (this.notes.length === 0) {
      const emptyHtml = `
        <div class="empty-notes-sidebar">
          <p>No notes yet</p>
        </div>
      `;
      
      if (notesSidebar) notesSidebar.innerHTML = emptyHtml;
      if (notesSidebarRecording) notesSidebarRecording.innerHTML = emptyHtml;
      return;
    }

    // Group notes by date
    const groupedNotes = this.groupNotesByDate(this.notes);
    
    // Generate HTML for organized date sections
    let html = '';
    Object.keys(groupedNotes).forEach(dateKey => {
      const dateNotes = groupedNotes[dateKey];
      html += `
        <div class="date-section-sidebar">
          <div class="date-section-header">${dateKey}</div>
          ${dateNotes.map(note => `
            <div class="note-item-sidebar" data-note-id="${note.id}" onclick="sidebarManager.selectNote('${note.id}')">
              <div class="note-content-sidebar">
                <div class="note-title-sidebar">${this.escapeHtml(note.title)}</div>
                <div class="note-date-sidebar">${this.formatTime(note.date_created)}</div>
              </div>
              <button class="delete-note-btn" onclick="event.stopPropagation(); sidebarManager.deleteNote('${note.id}')" title="Delete note">
                <svg viewBox="0 0 24 24" fill="currentColor">
                  <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>
                </svg>
              </button>
            </div>
          `).join('')}
        </div>
      `;
    });

    // Update both sidebar instances
    if (notesSidebar) notesSidebar.innerHTML = html;
    if (notesSidebarRecording) notesSidebarRecording.innerHTML = html;
  }

  groupNotesByDate(notes) {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    // Get start of last week (7 days ago)
    const lastWeekStart = new Date(today);
    lastWeekStart.setDate(lastWeekStart.getDate() - 7);

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
      } else if (noteDateOnly.getTime() >= lastWeekStart.getTime()) {
        dateKey = 'Last Week';
      } else {
        // Format as "Mon, Jan 15" for older dates
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

    // Return groups in the right order: Today, Yesterday, Last Week, then by date descending
    const orderedGroups = {};
    if (groups['Today']) orderedGroups['Today'] = groups['Today'];
    if (groups['Yesterday']) orderedGroups['Yesterday'] = groups['Yesterday'];
    if (groups['Last Week']) orderedGroups['Last Week'] = groups['Last Week'];

    // Add other dates in descending order
    Object.keys(groups)
      .filter(key => key !== 'Today' && key !== 'Yesterday' && key !== 'Last Week')
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

  formatTime(dateString) {
    // Backend sends UTC timestamps, so we need to treat them as UTC
    const date = new Date(dateString + 'Z');
    return date.toLocaleTimeString('en-US', { 
      hour: 'numeric', 
      minute: '2-digit',
      hour12: true 
    });
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  async selectNote(noteId) {
    // If recording is active, stop it before loading a new note
    const { getIsRecording, stopRecording } = await import('./recording-controls.js');
    if (getIsRecording()) await stopRecording();
    try {
      // Clear active state from all items in both sidebars
      document.querySelectorAll('.note-item-sidebar').forEach(item => {
        item.classList.remove('active');
      });

      // Add active state to selected item in both sidebars
      const selectedItems = document.querySelectorAll(`.note-item-sidebar[data-note-id="${noteId}"]`);
      selectedItems.forEach(item => {
        item.classList.add('active');
      });

      this.currentNoteId = noteId;
      
      // Load the note and reconstruct the view
      const note = await APIClient.getNote(noteId);
      await this.reconstructNoteView(note);
      
    } catch (error) {
      console.error('Failed to select note:', error);
      alert('Failed to load note. Please try again.');
    }
  }

  async reconstructNoteView(note) {
    // Hide landing page and show recording screen
    const initialScreen = document.getElementById('initialScreen');
    const recordingScreen = document.getElementById('recordingScreen');
    
    if (initialScreen) initialScreen.style.display = 'none';
    if (recordingScreen) recordingScreen.style.display = 'block';

    // Update home button states
    const { updateHomeButtonStates } = await import('./landing-page.js');
    updateHomeButtonStates();

    // Import required modules
    const { setCurrentNoteId } = await import('./notes-processor.js');
    const { processGeneratedNotes } = await import('./markdown-processor.js');
    const { elements, updateSeparatorVisibility, autoResizeTitle } = await import('./dom-utils.js');

    // Clear any existing resume text and reset controls
    const existingResumeText = document.querySelector('.resume-text');
    if (existingResumeText) existingResumeText.remove();

    // Reset recording controls state
    const recordingControls = document.getElementById('recordingControls');
    if (recordingControls) {
      recordingControls.classList.remove('expanded');
      recordingControls.classList.remove('transcript-open');
    }

    // Reset the generate notes button state before configuring for the new note
    resetNotesGenerationState();

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

    if (titleInput) {
      titleInput.value = note.title;
      autoResizeTitle();
    }

    // Set transcript content using the proper function
    setTranscript(note.transcript);

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
        
        const notesWrapper = notesInput.parentNode;
        notesWrapper.replaceChild(notesDiv, notesInput);
        elements.notesInput = notesDiv;
        
        // Load note titles for citations
        this.loadCitationTitles(notesDiv);
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
          
          const notesWrapper = notesInput.parentNode;
          notesWrapper.replaceChild(textarea, notesInput);
          elements.notesInput = textarea;
        } else {
          notesInput.value = note.raw_notes || '';
        }
      }
      
      // Show generate notes button if transcript is not empty
      if (generateNotesBtn && note.transcript && note.transcript.trim().length > 0) {
        generateNotesBtn.style.display = 'flex';
      } else if (generateNotesBtn) {
        generateNotesBtn.style.display = 'none';
      }
      
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
    
    // Initialize and show right sidebar for Q&A
    rightSidebarManager.initialize();
    rightSidebarManager.setCurrentNote(note.id);
    rightSidebarManager.showSidebar(note.id);
  }

  // Refresh notes list (useful after creating/deleting notes)
  async refreshNotes() {
    await this.loadNotes();
  }

  // Highlight a specific note in the sidebar
  highlightNote(noteId) {
    // Clear all active states from both sidebars
    document.querySelectorAll('.note-item-sidebar').forEach(item => {
      item.classList.remove('active');
    });

    // Add active state to the specified note in both sidebars
    const noteItems = document.querySelectorAll(`.note-item-sidebar[data-note-id="${noteId}"]`);
    noteItems.forEach(noteItem => {
      noteItem.classList.add('active');
    });
    
    this.currentNoteId = noteId;
  }

  // Get current selected note ID
  getCurrentNoteId() {
    return this.currentNoteId;
  }

  // Delete a note
  async deleteNote(noteId) {
    try {
      // Show confirmation dialog
      const confirmDelete = confirm('Are you sure you want to delete this note? This action cannot be undone.');
      if (!confirmDelete) {
        return;
      }

      // Call API to delete the note
      await APIClient.deleteNote(noteId);
      
      // If we deleted the currently active note, clear the current state
      if (this.currentNoteId === noteId) {
        this.currentNoteId = null;
        window.currentNoteId = null;
        window.currentNote = null;
        
        // Clear transcript data when deleting active note
        clearTranscript();
        
        // Reset notes generation state when deleting active note
        resetNotesGenerationState();
        
        // Navigate back to home screen if this was the active note
        const initialScreen = document.getElementById('initialScreen');
        const recordingScreen = document.getElementById('recordingScreen');
        
        if (initialScreen && recordingScreen) {
          recordingScreen.style.display = 'none';
          initialScreen.style.display = 'block';
          
          // Update home button states
          const { updateHomeButtonStates } = await import('./landing-page.js');
          updateHomeButtonStates();
        }
      }
      
      // Refresh the sidebar to remove the deleted note
      await this.refreshNotes();
      
      console.log('Note deleted successfully');
      
    } catch (error) {
      console.error('Failed to delete note:', error);
      alert('Failed to delete note. Please try again.');
    }
  }

  // Load citation titles for note references
  async loadCitationTitles(container) {
    const citations = container.querySelectorAll('.note-citation');
    
    for (const citation of citations) {
      const noteId = citation.getAttribute('data-note-id');
      try {
        const referencedNote = await APIClient.getNote(noteId);
        citation.textContent = referencedNote.title;
      } catch (error) {
        console.error(`Failed to load note ${noteId}:`, error);
        citation.textContent = 'Note not found';
      }
    }
  }
}

// Create singleton instance
export const sidebarManager = new SidebarManager();

// Make it globally accessible for onclick handlers
window.sidebarManager = sidebarManager;

// Export functions for use by other modules
export async function refreshSidebar() {
  await sidebarManager.refreshNotes();
}

export function highlightSidebarNote(noteId) {
  sidebarManager.highlightNote(noteId);
}