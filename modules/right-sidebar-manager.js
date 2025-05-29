// right-sidebar-manager.js - Right sidebar Q&A functionality for transcript-specific conversations
import { APIClient } from './api-client.js';
import { getCurrentTranscript } from './transcript-handler.js';

class RightSidebarManager {
  constructor() {
    this.isVisible = false;
    this.isCollapsed = false;
    this.qaHistory = [];
    this.currentNoteId = null;
    this.isStreaming = false;
    this.initialized = false;
    
    // DOM elements
    this.rightSidebar = null;
    this.qaMessages = null;
    this.qaInput = null;
    this.qaSendBtn = null;
    this.rightSidebarToggle = null;
    this.qaEmptyState = null;
  }

  initialize() {
    if (this.initialized) return;
    this.initialized = true;

    // Get DOM elements
    this.rightSidebar = document.getElementById('rightSidebar');
    this.qaMessages = document.getElementById('qaMessages');
    this.qaInput = document.getElementById('qaInput');
    this.qaSendBtn = document.getElementById('qaSendBtn');
    this.rightSidebarToggle = document.getElementById('rightSidebarToggle');
    this.qaVibeBtn = document.getElementById('qaVibeBtn');
    this.qaEmptyState = this.qaMessages?.querySelector('.qa-empty-state');

    if (!this.rightSidebar || !this.qaMessages || !this.qaInput || !this.qaSendBtn) {
      console.error('Right sidebar elements not found');
      return;
    }

    this.setupEventListeners();
    this.initTextarea();
    this.initializeVibeButtonState();
  }

  setupEventListeners() {
    // Toggle button
    this.rightSidebarToggle.addEventListener('click', (e) => {
      e.stopPropagation();
      this.toggleCollapse();
    });

    // When sidebar is collapsed, allow click anywhere to expand
    this.rightSidebar.addEventListener('click', (e) => {
      if (this.isCollapsed) {
        e.stopPropagation();
        this.expandSidebar();
      }
    });

    // Send button
    this.qaSendBtn.addEventListener('click', () => {
      this.sendMessage();
    });

    // Vibe button
    if (this.qaVibeBtn) {
      this.qaVibeBtn.addEventListener('click', () => {
        this.sendVibeMessage();
      });
    }

    // Enter key to send
    this.qaInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        if (!this.qaSendBtn.disabled) {
          this.sendMessage();
        }
      }
    });

    // Focus logic - add focus on click anywhere in sidebar
    this.rightSidebar.addEventListener('mousedown', (e) => {
      if (!this.isCollapsed) {
        e.stopPropagation();
        this.rightSidebar.classList.add('focused');
      }
    });

    // Remove focus when clicking outside sidebar
    document.addEventListener('mousedown', (e) => {
      if (!this.rightSidebar.contains(e.target)) {
        this.rightSidebar.classList.remove('focused');
      }
    });
  }

  initTextarea() {
    this.qaSendBtn.disabled = true;

    // Set initial height without triggering resize
    this.qaInput.style.height = '42px';
    this.qaInput.style.overflowY = 'hidden';

    // Add focus/blur listeners for background opacity effect
    this.qaInput.addEventListener('focus', () => {
      this.rightSidebar?.classList.add('focused');
    });

    this.qaInput.addEventListener('blur', () => {
      this.rightSidebar?.classList.remove('focused');
    });

    this.qaInput.addEventListener('input', () => {
      // Check if content actually needs more height before resizing
      const currentHeight = parseInt(this.qaInput.style.height);
      const contentHeight = this.qaInput.scrollHeight;
      
      // Only resize if content doesn't fit or is smaller than current height
      if (contentHeight !== currentHeight) {
        // Temporarily disable transition to prevent visual jump
        const originalTransition = this.qaInput.style.transition;
        this.qaInput.style.transition = 'none';
        
        // Calculate new height without setting to auto first
        const newHeight = Math.min(Math.max(contentHeight, 42), 120);
        this.qaInput.style.height = `${newHeight}px`;

        // Re-enable transition after the change
        requestAnimationFrame(() => {
          this.qaInput.style.transition = originalTransition;
        });

        // Show scrollbar if content exceeds max height
        if (contentHeight > 120) {
          this.qaInput.style.overflowY = 'scroll';
        } else {
          this.qaInput.style.overflowY = 'hidden';
        }
      }

      // Enable/disable send button
      this.qaSendBtn.disabled = this.qaInput.value.trim() === '' || this.isStreaming;
    });
  }

  initializeVibeButtonState() {
    // Hide vibe button initially (it will be shown when recording starts)
    if (this.qaVibeBtn) {
      this.qaVibeBtn.style.display = 'none';
    }
  }

  showSidebar(noteId = null) {
    if (!this.rightSidebar) return;
    
    this.currentNoteId = noteId;
    this.rightSidebar.classList.add('active');
    this.isVisible = true;
    
    // Restore collapsed state from localStorage
    const collapsed = localStorage.getItem('right-sidebar-collapsed') === 'true';
    this.isCollapsed = collapsed;
    this.rightSidebar.classList.toggle('collapsed', collapsed);
    
    // Clear previous conversation when showing for a different note
    if (noteId && noteId !== this.currentNoteId) {
      this.clearConversation();
    }
    
    // Update empty state message based on whether we have a note ID
    if (this.qaEmptyState) {
      if (noteId) {
        this.qaEmptyState.innerHTML = '<p>Ask questions about this transcript</p>';
      } else {
        this.qaEmptyState.innerHTML = '<p>Ask questions about your live recording</p>';
      }
    }
  }

  hideSidebar() {
    if (!this.rightSidebar) return;
    
    this.rightSidebar.classList.remove('active');
    this.rightSidebar.classList.remove('focused');
    this.isVisible = false;
  }

  toggleCollapse() {
    if (this.isCollapsed) {
      this.expandSidebar();
    } else {
      this.collapseSidebar();
    }
  }

  collapseSidebar() {
    if (!this.rightSidebar || this.isCollapsed) return;
    
    this.rightSidebar.classList.add('collapsed');
    this.rightSidebar.classList.remove('focused');
    this.isCollapsed = true;
    localStorage.setItem('right-sidebar-collapsed', 'true');
  }

  expandSidebar() {
    if (!this.rightSidebar || !this.isCollapsed) return;
    
    this.rightSidebar.classList.remove('collapsed');
    this.isCollapsed = false;
    localStorage.setItem('right-sidebar-collapsed', 'false');
  }

  async sendMessage() {
    const question = this.qaInput.value.trim();
    if (!question || this.isStreaming) return;

    // Clear input immediately
    this.qaInput.value = '';
    this.qaInput.style.height = '42px';
    this.qaInput.style.overflowY = 'hidden';
    this.qaSendBtn.disabled = true;

    // Hide empty state
    if (this.qaEmptyState) {
      this.qaEmptyState.style.display = 'none';
    }

    // Add user message
    this.addUserMessage(question);

    // Send to API
    await this.sendMessageToAPI(question);
  }

  async sendMessageToAPI(question) {
    this.isStreaming = true;

    try {
      // Add AI message placeholder
      const aiMessageElement = this.addAIMessage('');
      
      // Stream response using the single note endpoint (will be implemented)
      await this.streamAIResponse(question, aiMessageElement);
      
    } catch (error) {
      console.error('Error sending QA message:', error);
      this.addErrorMessage(error.message || 'Failed to send message');
    } finally {
      this.isStreaming = false;
      this.qaInput.focus();
    }
  }

  async sendVibeMessage() {
    if (this.isStreaming) return;

    // Hide empty state
    if (this.qaEmptyState) {
      this.qaEmptyState.style.display = 'none';
    }

    this.isStreaming = true;

    try {
      // Add vibe AI message placeholder
      const vibeMessageElement = this.addVibeMessage('');
      
      // Stream vibe response
      await this.streamVibeResponse(vibeMessageElement);
      
    } catch (error) {
      console.error('Error sending vibe message:', error);
      this.addErrorMessage(error.message || 'Failed to get vibe response');
    } finally {
      this.isStreaming = false;
    }
  }

  addUserMessage(message) {
    const messageElement = document.createElement('div');
    messageElement.className = 'qa-message user';
    messageElement.innerHTML = `
      <div class="qa-message-content">${this.escapeHtml(message)}</div>
    `;
    
    this.qaMessages.appendChild(messageElement);
    this.scrollToBottom();
    
    // Add to history
    this.qaHistory.push({ role: 'user', content: message });
  }

  addAIMessage(message, isComplete = false) {
    const messageElement = document.createElement('div');
    messageElement.className = 'qa-message ai';
    
    const copyButton = isComplete ? this.createCopyButton() : '';
    const content = message || this.createThinkingDots();
    messageElement.innerHTML = `
      <div class="qa-message-content">${content}</div>
      ${copyButton}
    `;
    
    this.qaMessages.appendChild(messageElement);
    this.scrollToBottom();
    
    return messageElement;
  }

  addVibeMessage(message, isComplete = false) {
    const messageElement = document.createElement('div');
    messageElement.className = 'qa-message ai vibe';
    
    const copyButton = isComplete ? this.createCopyButton() : '';
    const content = message || this.createThinkingDots();
    messageElement.innerHTML = `
      <div class="qa-message-content">${content}</div>
      ${copyButton}
    `;
    
    this.qaMessages.appendChild(messageElement);
    this.scrollToBottom();
    
    return messageElement;
  }

  addErrorMessage(message) {
    const messageElement = document.createElement('div');
    messageElement.className = 'qa-message ai error';
    messageElement.innerHTML = `
      <div class="qa-message-content" style="background: rgba(220, 53, 69, 0.1); border-color: rgba(220, 53, 69, 0.3); color: #dc3545;">
        Error: ${this.escapeHtml(message)}
      </div>
    `;
    
    this.qaMessages.appendChild(messageElement);
    this.scrollToBottom();
  }

  async streamAIResponse(question, messageElement) {
    if (!messageElement) return;
    
    try {
      let response;
      
      if (this.currentNoteId) {
        // Use saved note
        response = await APIClient.sendSingleNoteQAStream(question, this.currentNoteId, this.qaHistory);
      } else {
        // Gather live transcript data
        const liveData = this.gatherLiveTranscriptData();
        response = await APIClient.sendSingleNoteQAStream(question, null, this.qaHistory, liveData);
      }
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      
      let content = '';
      const contentElement = messageElement.querySelector('.qa-message-content');
      
      while (true) {
        const { done, value } = await reader.read();
        
        if (done) break;
        
        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n');
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              
              if (data.type === 'done') {
                this.finalizeAIMessage(contentElement, content);
                this.qaHistory.push({ role: 'assistant', content: content });
                return;
              } else if (data.content) {
                content += data.content;
                const rendered = this.renderMarkdown(content);
                contentElement.innerHTML = rendered;
                this.scrollToBottom();
              }
            } catch (e) {
              // Ignore JSON parse errors
            }
          }
        }
      }
      
      // Fallback finalization
      this.finalizeAIMessage(contentElement, content);
      this.qaHistory.push({ role: 'assistant', content: content });
      
    } catch (error) {
      console.error('Streaming error:', error);
      const contentElement = messageElement.querySelector('.qa-message-content');
      if (contentElement) {
        contentElement.innerHTML = `<span style="color: #dc3545;">Error: ${this.escapeHtml(error.message)}</span>`;
      }
    }
  }

  async streamVibeResponse(messageElement) {
    if (!messageElement) return;
    
    try {
      let response;
      
      // Always gather live transcript data
      const liveData = this.gatherLiveTranscriptData();
      console.log('[DEBUG] Gathered live data:', liveData);
      
      if (this.currentNoteId) {
        // Use saved note but include live data
        console.log('[DEBUG] Using saved note ID with live data:', this.currentNoteId);
        response = await APIClient.sendVibeQAStream(this.currentNoteId, liveData);
      } else {
        // Use only live transcript data
        console.log('[DEBUG] Sending live data to API:', liveData);
        response = await APIClient.sendVibeQAStream(null, liveData);
      }
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      
      let content = '';
      const contentElement = messageElement.querySelector('.qa-message-content');
      
      while (true) {
        const { done, value } = await reader.read();
        
        if (done) break;
        
        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n');
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              
              if (data.type === 'done') {
                this.finalizeVibeMessage(contentElement, content);
                return;
              } else if (data.content) {
                content += data.content;
                const rendered = this.renderMarkdown(content);
                contentElement.innerHTML = rendered;
                this.scrollToBottom();
              }
            } catch (e) {
              // Ignore JSON parse errors
            }
          }
        }
      }
      
      // Fallback finalization
      this.finalizeVibeMessage(contentElement, content);
      
    } catch (error) {
      console.error('Vibe streaming error:', error);
      const contentElement = messageElement.querySelector('.qa-message-content');
      if (contentElement) {
        contentElement.innerHTML = `<span style="color: #dc3545;">Error: ${this.escapeHtml(error.message)}</span>`;
      }
    }
  }

  finalizeAIMessage(contentElement, content) {
    if (contentElement) {
      const renderedContent = this.renderMarkdown(content);
      contentElement.innerHTML = renderedContent;
      
      // Add copy button
      const messageElement = contentElement.closest('.qa-message');
      if (messageElement && !messageElement.querySelector('.qa-copy-btn')) {
        const copyButton = this.createCopyButton();
        messageElement.insertAdjacentHTML('beforeend', copyButton);
        
        const copyBtn = messageElement.querySelector('.qa-copy-btn');
        if (copyBtn) {
          this.setupCopyButton(copyBtn, content);
        }
      }
      
      this.scrollToBottom();
    }
  }

  finalizeVibeMessage(contentElement, content) {
    if (contentElement) {
      const renderedContent = this.renderMarkdown(content);
      contentElement.innerHTML = renderedContent;
      
      // Add copy button
      const messageElement = contentElement.closest('.qa-message');
      if (messageElement && !messageElement.querySelector('.qa-copy-btn')) {
        const copyButton = this.createCopyButton();
        messageElement.insertAdjacentHTML('beforeend', copyButton);
        
        const copyBtn = messageElement.querySelector('.qa-copy-btn');
        if (copyBtn) {
          this.setupCopyButton(copyBtn, content);
        }
      }
      
      this.scrollToBottom();
    }
  }

  renderMarkdown(text) {
    // Use marked.js for proper markdown rendering like the main chat
    if (typeof marked !== 'undefined') {
      return marked.parse(text);
    }
    // Fallback to simple rendering if marked is not available
    return text
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/`(.*?)`/g, '<code>$1</code>')
      .replace(/\n/g, '<br>');
  }

  createThinkingDots() {
    return `
      <div class="qa-thinking-dots">
        <div class="dot"></div>
        <div class="dot"></div>
        <div class="dot"></div>
      </div>
    `;
  }

  createCopyButton() {
    return `
      <button class="qa-copy-btn" title="Copy message">
        <svg viewBox="0 0 24 24" fill="currentColor">
          <path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/>
        </svg>
      </button>
    `;
  }

  setupCopyButton(button, content) {
    button.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(content);
        
        const originalSVG = button.innerHTML;
        button.innerHTML = `
          <svg viewBox="0 0 24 24" fill="currentColor">
            <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
          </svg>
        `;
        button.style.color = '#22c55e';
        
        setTimeout(() => {
          button.innerHTML = originalSVG;
          button.style.color = '';
        }, 2000);
      } catch (err) {
        console.error('Failed to copy:', err);
      }
    });
  }

  scrollToBottom() {
    if (this.qaMessages) {
      requestAnimationFrame(() => {
        this.qaMessages.scrollTop = this.qaMessages.scrollHeight;
      });
    }
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  clearConversation() {
    this.qaHistory = [];
    if (this.qaMessages) {
      // Keep only the empty state
      const emptyState = this.qaMessages.querySelector('.qa-empty-state');
      this.qaMessages.innerHTML = '';
      if (emptyState) {
        this.qaMessages.appendChild(emptyState);
        emptyState.style.display = 'flex';
      }
    }
  }

  setCurrentNote(noteId) {
    if (this.currentNoteId !== noteId) {
      this.currentNoteId = noteId;
      this.clearConversation();
    }
  }

  // Debug function to test transcript gathering manually
  testTranscriptGathering() {
    console.log('[DEBUG] Testing transcript gathering...');
    const data = this.gatherLiveTranscriptData();
    console.log('[DEBUG] Test result:', data);
    return data;
  }

  gatherLiveTranscriptData() {
    // Gather current transcript and notes data from the DOM
    const titleInput = document.getElementById('titleInput');
    const notesInput = document.getElementById('notesInput');
    const transcriptContent = document.getElementById('transcriptContent');
    
    let title = titleInput?.value || 'Live Recording';
    let notes = '';
    let transcript = '';
    
    // Get notes content (handle both textarea and contentEditable)
    if (notesInput) {
      if (notesInput.tagName === 'TEXTAREA') {
        notes = notesInput.value || '';
      } else {
        // For contentEditable divs, convert HTML to plain text while preserving line breaks
        const clone = notesInput.cloneNode(true);
        
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
        
        notes = clone.textContent || '';
      }
    }
    
    // Get transcript content - prefer the transcript handler for accuracy
    try {
      if (typeof getCurrentTranscript === 'function') {
        transcript = getCurrentTranscript() || '';
        console.log('[DEBUG] Transcript from getCurrentTranscript():', transcript.length, 'characters');
      } else {
        console.warn('[DEBUG] getCurrentTranscript is not a function, using DOM fallback');
        throw new Error('getCurrentTranscript not available');
      }
    } catch (error) {
      console.error('[DEBUG] Error getting transcript from handler:', error);
      // Fallback to DOM content if transcript handler fails
      if (transcriptContent) {
        const transcriptClone = transcriptContent.cloneNode(true);
        
        // Remove any buttons or UI elements
        transcriptClone.querySelectorAll('button, .scroll-to-bottom-btn').forEach(el => el.remove());
        
        transcript = transcriptClone.textContent || '';
        console.log('[DEBUG] Transcript from DOM fallback:', transcript.length, 'characters');
      } else {
        console.error('[DEBUG] No transcriptContent element found');
      }
    }
    
    const result = {
      title: title.trim(),
      notes: notes.trim(),
      transcript: transcript.trim()
    };
    
    console.log('[DEBUG] gatherLiveTranscriptData result:', {
      title: result.title,
      notesLength: result.notes.length,
      transcriptLength: result.transcript.length,
      transcriptPreview: result.transcript.substring(0, 100) + '...'
    });
    
    return result;
  }
}

// Export singleton instance
export const rightSidebarManager = new RightSidebarManager();

// Make it globally accessible
window.rightSidebarManager = rightSidebarManager;

// Also expose debug functions globally for testing
window.debugTranscript = () => rightSidebarManager.testTranscriptGathering();