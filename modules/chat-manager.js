// chat-manager.js - Chat functionality for QA interactions
import { APIClient } from './api-client.js';
import { authManager } from './auth-manager.js';
import { sidebarManager } from './sidebar-manager.js';
// marked is loaded globally via CDN

class ChatManager {
  constructor() {
    this.chatHistory = [];
    this.chatContainer = null;
    this.chatInput = null;
    this.chatSendBtn = null;
    this.isStreaming = false;
    this.isFullscreen = false;
    this.fullscreenListenersAdded = false;
    this.initialized = false;
    this.autoScroll = true;
    this.userScrolledUp = false;
  }

  initialize() {
    // Prevent double initialization of chat manager
    if (this.initialized) {
      return;
    }
    this.initialized = true;
    // Initialize home page chat (original small input)
    this.initializeHomeChat();
    
    // Initialize fullscreen chat navigation
    this.initializeFullscreenNavigation();
  }

  initializeHomeChat() {
    this.chatInput = document.getElementById('chatInput');
    this.chatSendBtn = document.getElementById('chatSendBtn');
    
    if (!this.chatInput || !this.chatSendBtn) {
      console.error('Home chat elements not found');
      return;
    }

    // Initialize textarea functionality for home page
    this.initTextarea(this.chatInput, this.chatSendBtn);
    
    // Add event listeners for home page chat
    this.setupHomeChatListeners();
  }

  initializeFullscreenNavigation() {
    // Navigation buttons
    const backToHomeBtn = document.getElementById('backToHomeBtnChat');
    const homeBtn = document.getElementById('homeBtnChat');
    
    if (backToHomeBtn) {
      backToHomeBtn.addEventListener('click', () => this.exitChatScreen());
    }
    
    if (homeBtn) {
      homeBtn.addEventListener('click', () => this.exitChatScreen());
    }

    // Sidebar toggle is handled by sidebar-manager.js
  }

  setupHomeChatListeners() {
    // Send button click
    this.chatSendBtn.addEventListener('click', () => {
      this.openChatScreen();
    });

    // Enter key to open chat screen
    this.chatInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        if (!this.chatSendBtn.disabled) {
          this.openChatScreen();
        }
      }
    });
  }

  async openChatScreen() {
    const question = this.chatInput.value.trim();
    if (!question) return;

    // Smoothly transition to chat screen
    const initialScreen = document.getElementById('initialScreen');
    const chatScreen = document.getElementById('chatScreen');
    
    // Smoothly collapse sidebar
    const sidebar = document.querySelector('.initial-screen .sidebar');
    if (sidebar && !sidebar.classList.contains('collapsed')) {
      const { sidebarManager } = await import('./sidebar-manager.js');
      sidebarManager.collapseSidebar(sidebar, 'sidebar-toggle-shrink', 'sidebar-toggle-expand');
    }
    
    // Setup crossfade transition
    if (initialScreen && chatScreen) {
      // Position chat screen on top with opacity 0
      chatScreen.style.position = 'absolute';
      chatScreen.style.top = '0';
      chatScreen.style.left = '0';
      chatScreen.style.width = '100%';
      chatScreen.style.height = '100%';
      chatScreen.style.zIndex = '10';
      chatScreen.style.display = 'flex';
      chatScreen.style.opacity = '0';
      chatScreen.style.transition = 'opacity 0.3s ease';
      
      // Fade out initial screen and fade in chat screen simultaneously
      initialScreen.style.transition = 'opacity 0.3s ease';
      initialScreen.style.opacity = '0';
      
      setTimeout(() => {
        chatScreen.style.opacity = '1';
      }, 50);
      
      // Clean up after transition
      setTimeout(() => {
        initialScreen.style.display = 'none';
        chatScreen.style.position = '';
        chatScreen.style.top = '';
        chatScreen.style.left = '';
        chatScreen.style.width = '';
        chatScreen.style.height = '';
        chatScreen.style.zIndex = '';
        chatScreen.style.transition = '';
        chatScreen.style.opacity = '';
        initialScreen.style.transition = '';
        initialScreen.style.opacity = '';
      }, 350);
    }

    // Initialize fullscreen chat interface first
    await this.initializeFullscreenChat();
    
    // Clear home input immediately
    this.chatInput.value = '';
    this.chatInput.style.height = '42px';
    this.chatSendBtn.disabled = true;
    
    // Send the initial message (ensuring DOM is ready)
    setTimeout(() => {
      this.sendInitialMessage(question);
    }, 100);
  }

  async initializeFullscreenChat() {
    this.isFullscreen = true;
    
    // Get fullscreen elements
    this.chatContainer = document.getElementById('chatMessagesFullscreen');
    this.chatInputFullscreen = document.getElementById('chatInputFullscreen');
    this.chatSendFullscreen = document.getElementById('chatSendFullscreen');
    this.chatEmptyState = document.getElementById('chatEmptyState');
    
    
    if (!this.chatContainer || !this.chatInputFullscreen || !this.chatSendFullscreen) {
      console.error('Fullscreen chat elements not found');
      console.error('Missing elements:', {
        chatContainer: !this.chatContainer,
        chatInputFullscreen: !this.chatInputFullscreen,
        chatSendFullscreen: !this.chatSendFullscreen
      });
      return;
    }

    // Initialize fullscreen textarea
    this.initTextarea(this.chatInputFullscreen, this.chatSendFullscreen);
    
    // Setup fullscreen event listeners (only once)
    if (!this.fullscreenListenersAdded) {
      this.setupFullscreenChatListeners();
      this.fullscreenListenersAdded = true;
    }
    
    // Initialize sidebar for chat screen
    await this.initializeChatSidebar();
    
    // Initialize empty state properly but don't clear existing messages
    this.initializeEmptyState();
  }

  async initializeChatSidebar() {
    try {
      // Load notes and populate chat sidebar
      if (sidebarManager) {
        // Refresh notes data
        await sidebarManager.refreshNotes();
        
        // Populate the chat sidebar manually since sidebarManager doesn't know about it
        this.populateChatSidebar();
      }
    } catch (error) {
      console.error('Error initializing chat sidebar:', error);
    }
  }

  populateChatSidebar() {
    const notesSidebarChat = document.getElementById('notesSidebarChat');
    if (!notesSidebarChat || !sidebarManager.notes) return;

    if (sidebarManager.notes.length === 0) {
      notesSidebarChat.innerHTML = `
        <div class="empty-notes-sidebar">
          <p>No notes yet</p>
        </div>
      `;
      return;
    }

    // Group notes by date (copying logic from sidebarManager)
    const groupedNotes = this.groupNotesByDate(sidebarManager.notes);
    
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

    notesSidebarChat.innerHTML = html;
  }

  groupNotesByDate(notes) {
    // Copy the grouping logic from sidebarManager
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    const lastWeek = new Date(today);
    lastWeek.setDate(lastWeek.getDate() - 7);
    
    const grouped = {};
    
    notes.forEach(note => {
      const noteDate = new Date(note.date_created);
      const noteDateOnly = new Date(noteDate.getFullYear(), noteDate.getMonth(), noteDate.getDate());
      
      let groupKey;
      if (noteDateOnly.getTime() === today.getTime()) {
        groupKey = 'Today';
      } else if (noteDateOnly.getTime() === yesterday.getTime()) {
        groupKey = 'Yesterday';
      } else if (noteDateOnly >= lastWeek) {
        groupKey = 'Last 7 days';
      } else {
        groupKey = 'Older';
      }
      
      if (!grouped[groupKey]) {
        grouped[groupKey] = [];
      }
      grouped[groupKey].push(note);
    });
    
    return grouped;
  }

  formatTime(dateString) {
    // Backend sends UTC timestamps; treat them correctly as UTC
    const date = new Date(dateString + 'Z');
    return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  }

  setupFullscreenChatListeners() {
    // Send button click
    this.chatSendFullscreen.addEventListener('click', () => {
      this.sendMessage();
    });

    // Enter key to send
    this.chatInputFullscreen.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        if (!this.chatSendFullscreen.disabled) {
          this.sendMessage();
        }
      }
    });

    // Auto-scroll detection - user can break out by scrolling up
    this.chatContainer.addEventListener('scroll', () => {
      const container = this.chatContainer;
      const isAtBottom = container.scrollTop + container.clientHeight >= container.scrollHeight - 5;
      
      if (isAtBottom) {
        // User scrolled back to bottom, re-enable auto-scroll
        this.autoScroll = true;
        this.userScrolledUp = false;
      } else {
        // User scrolled up, disable auto-scroll
        this.autoScroll = false;
        this.userScrolledUp = true;
      }
    });
  }

  async sendInitialMessage(question) {
    // Ensure container is available
    if (!this.chatContainer) {
      console.error('Chat container not available for initial message');
      return;
    }

    // Hide empty state
    if (this.chatEmptyState) {
      this.chatEmptyState.style.display = 'none';
    }

    // Add user message
    this.addUserMessage(question);
    
    // Send to API directly (bypass sendMessageToAPI to avoid conflicts)
    this.isStreaming = true;
    if (this.chatSendFullscreen) this.chatSendFullscreen.disabled = true;

    try {
      // Add AI message placeholder
      const aiMessageElement = this.addAIMessage('');
      
      // Stream response
      await this.streamAIResponse(question, aiMessageElement);
      
    } catch (error) {
      console.error('Error sending initial message:', error);
      this.addErrorMessage(error.message || 'Failed to send message');
    } finally {
      // Re-enable input
      this.isStreaming = false;
      if (this.chatInputFullscreen) this.chatInputFullscreen.focus();
    }
  }

  initTextarea(textarea, sendButton) {
    if (!textarea || !sendButton) return;

    sendButton.disabled = true;

    // Set initial height
    textarea.style.height = 'auto';
    textarea.style.height = Math.max(textarea.scrollHeight, 42) + 'px';
    textarea.style.overflowY = 'hidden';

    textarea.addEventListener('input', () => {
      // Reset height to auto to get the correct scrollHeight
      textarea.style.height = 'auto';
      const newHeight = Math.min(Math.max(textarea.scrollHeight, 42), 360);
      textarea.style.height = `${newHeight}px`;
      textarea.style.overflowY = textarea.scrollHeight > 360 ? 'scroll' : 'hidden';

      // Add expanded padding class for multiline like web_frontend
      if (textarea.scrollHeight > 42) {
        textarea.classList.add('expanded-padding');
      } else {
        textarea.classList.remove('expanded-padding');
      }

      // Enable/disable send button based on content
      sendButton.disabled = textarea.value.trim() === '' || this.isStreaming;
    });
  }

  async sendMessage() {
    if (!this.isFullscreen) return;
    
    const question = this.chatInputFullscreen.value.trim();
    if (!question || this.isStreaming) return;

    // Re-enable auto-scroll when sending a new message
    this.autoScroll = true;
    this.userScrolledUp = false;

    // Hide empty state if visible
    if (this.chatEmptyState) {
      this.chatEmptyState.style.display = 'none';
    }

    // Clear input
    this.chatInputFullscreen.value = '';
    this.chatInputFullscreen.style.height = '42px';
    
    // Add user message
    this.addUserMessage(question);
    
    // Send to API
    await this.sendMessageToAPI(question);
  }

  async sendMessageToAPI(question) {    
    // Disable input during streaming
    this.isStreaming = true;
    if (this.chatSendFullscreen) this.chatSendFullscreen.disabled = true;

    try {
      // Add AI message placeholder
      const aiMessageElement = this.addAIMessage('');
      
      // Stream response
      await this.streamAIResponse(question, aiMessageElement);
      
    } catch (error) {
      console.error('Error sending message:', error);
      this.addErrorMessage(error.message || 'Failed to send message');
    } finally {
      // Re-enable input
      this.isStreaming = false;
      if (this.chatInputFullscreen) this.chatInputFullscreen.focus();
    }
  }

  async exitChatScreen() {
    const initialScreen = document.getElementById('initialScreen');
    const chatScreen = document.getElementById('chatScreen');
    
    // Use the smooth navigation function from landing-page
    const { smoothNavigateHome } = await import('./landing-page.js');
    await smoothNavigateHome();
    
    // Reset fullscreen state
    this.isFullscreen = false;
    
    // Clear chat when exiting chat screen
    this.clearChat();
  }


  addUserMessage(message) {    
    if (!this.chatContainer) {
      console.error('Cannot add user message: chatContainer is null');
      return;
    }
    
    const messageElement = document.createElement('div');
    messageElement.className = 'chat-message user-message';
    messageElement.innerHTML = `
      <div class="message-content">${this.escapeHtml(message)}</div>
    `;
    
    this.chatContainer.appendChild(messageElement);
    this.scrollToBottom();
    
    // Add to chat history
    this.chatHistory.push({ role: 'user', content: message });
  }

  addAIMessage(message, isComplete = false) {
    if (!this.chatContainer) {
      console.error('Cannot add AI message: chatContainer is null');
      return null;
    }
    
    const messageElement = document.createElement('div');
    messageElement.className = 'chat-message ai-message';
    
    const copyButton = isComplete ? this.createCopyButton() : '';
    const content = message || this.createThinkingDots();
    messageElement.innerHTML = `
      <div class="message-content">${content}</div>
      ${copyButton}
    `;
    
    this.chatContainer.appendChild(messageElement);
    this.scrollToBottom();
    
    return messageElement;
  }

  addErrorMessage(message) {
    if (!this.chatContainer) return;
    
    const messageElement = document.createElement('div');
    messageElement.className = 'chat-message error-message';
    messageElement.innerHTML = `
      <div class="message-content">Error: ${this.escapeHtml(message)}</div>
    `;
    
    this.chatContainer.appendChild(messageElement);
    this.scrollToBottom();
  }

  async streamAIResponse(question, messageElement) {
    if (!messageElement) return;
    
    try {
      const response = await APIClient.sendChatMessageStream(question, this.chatHistory);
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      
      let content = '';
      const contentElement = messageElement.querySelector('.message-content');
      
      // Start with empty content
      contentElement.innerHTML = '';
      
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
                // Remove streaming indicator and finalize
                this.finalizeAIMessage(contentElement, content);
                this.chatHistory.push({ role: 'assistant', content: content });
                return;
              } else if (data.content) {
                content += data.content;
                // Update content without streaming indicator
                const rendered = this.renderMarkdown(content);
                contentElement.innerHTML = rendered;
                this.scrollToBottom();
              }
            } catch (e) {
              // Ignore JSON parse errors for malformed chunks
            }
          }
        }
      }
      
      // Fallback finalization
      this.finalizeAIMessage(contentElement, content);
      this.chatHistory.push({ role: 'assistant', content: content });
      
    } catch (error) {
      console.error('Streaming error:', error);
      const contentElement = messageElement.querySelector('.message-content');
      if (contentElement) {
        contentElement.innerHTML = `<span class="error-text">Error: ${this.escapeHtml(error.message)}</span>`;
      }
    }
  }

  finalizeAIMessage(contentElement, content) {
    // Remove streaming indicator and finalize message with markdown
    if (contentElement) {
      const renderedContent = this.renderMarkdown(content);
      contentElement.innerHTML = renderedContent;
      
      // Add copy button to the parent message element
      const messageElement = contentElement.closest('.chat-message');
      if (messageElement && !messageElement.querySelector('.copy-btn')) {
        const copyButton = this.createCopyButton();
        messageElement.insertAdjacentHTML('beforeend', copyButton);
        
        // Set up copy button listener
        const copyBtn = messageElement.querySelector('.copy-btn');
        if (copyBtn) {
          this.setupCopyButton(copyBtn, content);
        }
      }
      
      // Load note titles for any note citations in this message
      const noteCitationSpans = contentElement.querySelectorAll('.note-citation');
      noteCitationSpans.forEach(async (span) => {
        const noteId = span.getAttribute('data-note-id');
        try {
          const note = await APIClient.getNote(noteId);
          span.textContent = note.title;
        } catch (err) {
          console.error('Failed to load note title for chat citation', noteId, err);
          span.textContent = 'Note not found';
        }
      });
      
      this.scrollToBottom();
    }
  }

  scrollToBottom() {
    if (this.chatContainer && this.autoScroll) {
      // Use requestAnimationFrame to ensure DOM has updated
      requestAnimationFrame(() => {
        this.chatContainer.scrollTop = this.chatContainer.scrollHeight;
      });
    }
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  initializeEmptyState() {
    // Just make sure empty state exists and is visible if no messages
    if (this.chatContainer && this.chatEmptyState) {
      const hasMessages = this.chatContainer.children.length > 1; // More than just empty state
      if (hasMessages) {
        this.chatEmptyState.style.display = 'none';
      } else {
        this.chatEmptyState.style.display = 'flex';
      }
    }
  }

  renderMarkdown(text) {
    const html = marked.parse(text, { 
      mangle: false, 
      headerIds: false, 
      gfm: true,
      breaks: true
    });
    // Replace note citations [noteId] (alphanumeric) with note-citation spans
    const withNoteCitations = html.replace(/\[([0-9A-Za-z]+)\](?!\()/g, '<span class="note-citation" data-note-id="$1" onclick="openNote(\'$1\')">$1</span>');
    // Convert numeric citation indices [n] into chat citation bubbles
    const withCitations = withNoteCitations.replace(/\[(\d+)\]/g, '<span class="citation">$1</span>');
    // Add chat-link class to <a> tags
    return withCitations.replace(/<a /g, '<a class="chat-link" ');
  }

  createThinkingDots() {
    return `
      <div class="thinking-dots">
        <div class="dot"></div>
        <div class="dot"></div>
        <div class="dot"></div>
      </div>
    `;
  }

  createCopyButton() {
    return `
      <button class="copy-btn" title="Copy message">
        <svg viewBox="0 0 24 24" fill="currentColor">
          <path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/>
        </svg>
      </button>
    `;
  }

  setupCopyButton(button, content) {
    button.addEventListener('click', async () => {
      try {
        if (navigator.clipboard && navigator.clipboard.write) {
          const htmlBlob = new Blob([content], { type: 'text/html' });
          const textBlob = new Blob([content], { type: 'text/plain' });
          await navigator.clipboard.write([
            new ClipboardItem({
              'text/html': htmlBlob,
              'text/plain': textBlob
            })
          ]);
        } else {
          await navigator.clipboard.writeText(content);
        }
        const originalSVG = button.innerHTML;
        button.innerHTML = `
          <svg viewBox="0 0 24 24" fill="currentColor">
            <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
          </svg>
        `;
        button.classList.add('copied');
        setTimeout(() => {
          button.innerHTML = originalSVG;
          button.classList.remove('copied');
        }, 2000);
      } catch (err) {
        console.error('Failed to copy:', err);
      }
    });
  }

  clearChat() {
    this.chatHistory = [];
    if (this.chatContainer) {
      const emptyState = this.chatContainer.querySelector('.chat-empty-state');
      this.chatContainer.innerHTML = '';
      if (emptyState) {
        this.chatContainer.appendChild(emptyState);
        emptyState.style.display = 'flex';
      }
    }
  }
}

// Export singleton instance
export const chatManager = new ChatManager();