// api-client.js - API client for backend communication
import { authManager, authenticatedFetch } from './auth-manager.js';

// Toggle production vs development API endpoint
const is_production = true; // set to true in production builds
const API_BASE_URL = is_production
  ? 'https://api.llava.io/v1'
  : 'http://localhost:9000/v1';

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

  static async createNoteWithContext(userId, contextData) {
    // Create FormData to handle file uploads
    const formData = new FormData();
    formData.append('user_id', userId);
    formData.append('notes', contextData.notes || '');
    
    // Add files if they exist
    if (contextData.files && contextData.files.length > 0) {
      contextData.files.forEach(file => {
        formData.append('files', file);
      });
    }

    const response = await authenticatedFetch(`${API_BASE_URL}/notes/context`, {
      method: 'POST',
      body: formData,
      // Don't set Content-Type header, let the browser set it with boundary
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Failed to create note with context');
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

  // Chat/QA endpoints
  static async sendChatMessage(question, chatHistory = []) {
    const user = authManager.getCurrentUser();
    if (!user) throw new Error('User not authenticated');

    const response = await authenticatedFetch(`${API_BASE_URL}/qa-chat`, {
      method: 'POST',
      body: JSON.stringify({
        user_id: user.id,
        question,
        chat_history: chatHistory,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Failed to send chat message');
    }

    return await response.json();
  }

  static async sendChatMessageStream(question, chatHistory = []) {
    const user = authManager.getCurrentUser();
    if (!user) throw new Error('User not authenticated');

    const response = await fetch(`${API_BASE_URL}/qa-chat-stream`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        user_id: user.id,
        question,
        chat_history: chatHistory,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Failed to send chat message');
    }

    return response;
  }

  static async sendSingleNoteQAStream(question, noteId, chatHistory = [], liveData = null) {
    const user = authManager.getCurrentUser();
    if (!user && !noteId) throw new Error('User not authenticated');

    let requestBody;
    
    if (noteId) {
      // Saved note mode
      requestBody = {
        note_id: noteId,
        question,
        chat_history: chatHistory,
      };
    } else {
      // Live transcript mode
      requestBody = {
        transcript: liveData?.transcript || '',
        notes: liveData?.notes || '',
        title: liveData?.title || 'Live Recording',
        user_id: user.id,
        question,
        chat_history: chatHistory,
      };
    }

    const response = await fetch(`${API_BASE_URL}/single-note-qa-stream`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Failed to send single note QA message');
    }

    return response;
  }

  static async sendVibeQAStream(noteId, liveData = null) {
    const user = authManager.getCurrentUser();
    if (!user && !noteId) throw new Error('User not authenticated');

    let requestBody;
    
    if (noteId) {
      // Saved note mode - still send live data if available
      requestBody = {
        note_id: noteId,
      };
      
      // If we have live data, include it in the request
      if (liveData) {
        requestBody.transcript = liveData.transcript || '';
        requestBody.notes = liveData.notes || '';
        requestBody.title = liveData.title || '';
      }
      
      console.log('[DEBUG] Vibe API request (saved note):', requestBody);
    } else {
      // Live transcript mode
      requestBody = {
        transcript: liveData?.transcript || '',
        notes: liveData?.notes || '',
        title: liveData?.title || 'Live Recording',
        user_id: user.id,
      };
      console.log('[DEBUG] Vibe API request (live data):', {
        ...requestBody,
        transcript: `${requestBody.transcript.length} chars: "${requestBody.transcript.substring(0, 100)}..."`,
        notes: `${requestBody.notes.length} chars`
      });
      
      // Warn if transcript is empty
      if (!requestBody.transcript || requestBody.transcript.trim().length === 0) {
        console.warn('[DEBUG] Warning: Sending empty transcript to backend!');
      }
    }

    const response = await fetch(`${API_BASE_URL}/vibe-qa-stream`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const error = await response.json();
      console.error('[DEBUG] Vibe API error response:', error);
      throw new Error(error.detail || 'Failed to send vibe QA request');
    }

    console.log('[DEBUG] Vibe API response status:', response.status);
    return response;
  }
}