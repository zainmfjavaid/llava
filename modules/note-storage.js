// note-storage.js - Note storage and synchronization
import { APIClient } from './api-client.js';
import { authManager } from './auth-manager.js';

class NoteStorage {
  constructor() {
    this.currentNote = null;
    this.autosaveTimeout = null;
    this.autosaveDelay = 2000; // 2 seconds
  }

  async createNote(title, transcript, rawNotes, notes) {
    if (!authManager.isAuthenticated()) {
      throw new Error('User not authenticated');
    }

    try {
      const noteData = {
        title: title || 'Untitled',
        transcript: transcript || '',
        raw_notes: rawNotes || '',
        notes: notes || '',
      };

      const savedNote = await APIClient.createNote(noteData);
      this.currentNote = savedNote;
      
      // Update right sidebar with new note ID
      if (window.rightSidebarManager) {
        window.rightSidebarManager.setCurrentNote(savedNote.id);
      }
      
      // Update global reference
      window.currentNoteId = savedNote.id;
      window.currentNote = savedNote;
      
      return savedNote;
    } catch (error) {
      console.error('Failed to create note:', error);
      throw error;
    }
  }

  async updateNote(noteData) {
    if (!this.currentNote || !authManager.isAuthenticated()) {
      return;
    }

    try {
      const updatedNote = await APIClient.updateNote(this.currentNote.id, {
        title: noteData.title || this.currentNote.title,
        transcript: noteData.transcript || this.currentNote.transcript,
        raw_notes: noteData.raw_notes || this.currentNote.raw_notes,
        notes: noteData.notes || this.currentNote.notes,
      });
      this.currentNote = updatedNote;
      return updatedNote;
    } catch (error) {
      console.error('Failed to update note:', error);
      throw error;
    }
  }

  scheduleAutosave(noteData) {
    // Clear existing timeout
    if (this.autosaveTimeout) {
      clearTimeout(this.autosaveTimeout);
    }

    // Schedule new autosave
    this.autosaveTimeout = setTimeout(() => {
      this.updateNote(noteData).catch(error => {
        console.error('Autosave failed:', error);
      });
    }, this.autosaveDelay);
  }

  async getUserNotes() {
    if (!authManager.isAuthenticated()) {
      return [];
    }

    try {
      return await APIClient.getUserNotes();
    } catch (error) {
      console.error('Failed to get user notes:', error);
      return [];
    }
  }

  async deleteNote(noteId) {
    try {
      await APIClient.deleteNote(noteId);
      if (this.currentNote && this.currentNote.id === noteId) {
        this.currentNote = null;
      }
    } catch (error) {
      console.error('Failed to delete note:', error);
      throw error;
    }
  }

  getCurrentNote() {
    return this.currentNote;
  }

  setCurrentNote(note) {
    this.currentNote = note;
  }

  clearCurrentNote() {
    this.currentNote = null;
    if (this.autosaveTimeout) {
      clearTimeout(this.autosaveTimeout);
      this.autosaveTimeout = null;
    }
  }
}

// Create singleton instance
export const noteStorage = new NoteStorage();

// Helper functions for common operations
export async function saveCurrentSession(title, transcript, rawNotes, notes) {
  try {
    if (noteStorage.getCurrentNote()) {
      // Update existing note
      return await noteStorage.updateNote({
        title,
        transcript,
        raw_notes: rawNotes,
        notes,
      });
    } else {
      // Create new note
      return await noteStorage.createNote(title, transcript, rawNotes, notes);
    }
  } catch (error) {
    console.error('Failed to save session:', error);
    throw error;
  }
}

export function scheduleSessionAutosave(title, transcript, rawNotes, notes) {
  if (!authManager.isAuthenticated()) {
    return;
  }

  noteStorage.scheduleAutosave({
    title,
    transcript,
    raw_notes: rawNotes,
    notes,
  });
}