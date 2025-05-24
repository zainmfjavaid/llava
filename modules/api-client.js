// api-client.js - API client for backend communication
import { authManager, authenticatedFetch } from './auth-manager.js';

const API_BASE_URL = 'http://localhost:9000';

export class APIClient {
  // Notes CRUD operations
  static async createNote(noteData) {
    const user = authManager.getCurrentUser();
    if (!user) throw new Error('User not authenticated');

    const response = await authenticatedFetch(`${API_BASE_URL}/notes`, {
      method: 'POST',
      body: JSON.stringify({
        ...noteData,
        user_id: user.id,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Failed to create note');
    }

    return await response.json();
  }

  static async getNote(noteId) {
    const response = await authenticatedFetch(`${API_BASE_URL}/notes/${noteId}`);
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Failed to get note');
    }

    return await response.json();
  }

  static async getUserNotes() {
    const user = authManager.getCurrentUser();
    if (!user) throw new Error('User not authenticated');

    const response = await authenticatedFetch(`${API_BASE_URL}/notes/user/${user.id}`);
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Failed to get notes');
    }

    return await response.json();
  }

  static async updateNote(noteId, noteData) {
    const user = authManager.getCurrentUser();
    if (!user) throw new Error('User not authenticated');

    const response = await authenticatedFetch(`${API_BASE_URL}/notes/${noteId}`, {
      method: 'PUT',
      body: JSON.stringify({
        ...noteData,
        user_id: user.id,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Failed to update note');
    }

    return await response.json();
  }

  static async deleteNote(noteId) {
    const response = await authenticatedFetch(`${API_BASE_URL}/notes/${noteId}`, {
      method: 'DELETE',
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Failed to delete note');
    }

    return await response.json();
  }

  static async setNoteAiEnhanced(noteId) {
    const response = await authenticatedFetch(`${API_BASE_URL}/notes/${noteId}/set-ai-enhanced`, {
      method: 'POST',
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Failed to set AI enhanced flag');
    }

    return await response.json();
  }

  // AI generation endpoints
  static async generateTitle(transcript) {
    const user = authManager.getCurrentUser();
    
    const response = await fetch(`${API_BASE_URL}/generate-title`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        transcript,
        user_id: user?.id,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Failed to generate title');
    }

    return await response.json();
  }

  static async generateNotesStream(transcript, rawNotes) {
    const user = authManager.getCurrentUser();
    
    const response = await fetch(`${API_BASE_URL}/generate-notes-stream`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        transcript,
        raw_notes: rawNotes,
        user_id: user?.id,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Failed to generate notes');
    }

    return response;
  }
}