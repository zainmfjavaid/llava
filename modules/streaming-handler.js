import { elements } from './dom-utils.js';
import { getCurrentTranscript } from './transcript-handler.js';
import { APIClient } from './api-client.js';
import { authManager } from './auth-manager.js';
import { processGeneratedNotes } from './markdown-processor.js';

// Initialize the notes area for streaming content
export function initializeStreamingNotesArea() {
  // Ensure notes input is a contentEditable div
  if (elements.notesInput.contentEditable !== 'true') {
    initializeNotesAsEditable();
  }
  
  // Clear existing content and add a streaming container
  elements.notesInput.innerHTML = '';
  
  // Create a container for the streaming generated notes
  const streamingContainer = document.createElement('div');
  streamingContainer.className = 'generated-notes streaming-content';
  streamingContainer.id = 'streaming-container';
  elements.notesInput.appendChild(streamingContainer);
  
  // Store reference for streaming updates
  window.streamingContainer = streamingContainer;
}

// Handle Server-Sent Events streaming response
export async function handleStreamingResponse(response) {
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let accumulatedContent = '';
  
  try {
    while (true) {
      const { done, value } = await reader.read();
      
      if (done) {
        break;
      }
      
      // Decode the chunk and add to buffer
      buffer += decoder.decode(value, { stream: true });
      
      // Process complete lines from buffer
      const lines = buffer.split('\n');
      buffer = lines.pop() || ''; // Keep incomplete line in buffer
      
      for (const line of lines) {
        if (line.trim() === '') continue;
        
        // Parse SSE format: "data: {json}"
        if (line.startsWith('data: ')) {
          const jsonStr = line.slice(6); // Remove "data: " prefix
          
          try {
            const message = JSON.parse(jsonStr);
            await handleStreamMessage(message, accumulatedContent);
            
            // Accumulate content for processing
            if (message.type === 'content') {
              accumulatedContent += message.content;
            }
            
            // Handle completion
            if (message.type === 'done') {
              await finalizeStreamedContent(accumulatedContent);
              return;
            }
            
          } catch (parseError) {
            console.error('Error parsing stream message:', parseError, 'Raw:', jsonStr);
          }
        }
      }
    }
    
    // Process any remaining content
    if (accumulatedContent.trim()) {
      await finalizeStreamedContent(accumulatedContent);
    }
    
  } catch (error) {
    console.error('Error reading stream:', error);
    throw error;
  } finally {
    reader.releaseLock();
  }
}

// Handle individual stream messages
export async function handleStreamMessage(message, accumulatedContent) {
  const streamingContainer = window.streamingContainer;
  if (!streamingContainer) return;
  
  switch (message.type) {
    case 'content':
      // Add new content to the streaming container
      await updateStreamingContent(message.content, accumulatedContent);
      break;
      
    case 'retry':
      // Show retry message to user
      showRetryMessage(message.content);
      break;
      
    case 'error':
      // Handle error message
      throw new Error(message.content || 'Stream error occurred');
      
    case 'done':
      // Streaming complete - will be handled in main loop
      break;
      
    default:
      console.warn('Unknown stream message type:', message.type);
  }
}

// Update streaming content incrementally
export async function updateStreamingContent(newContent, fullContent) {
  const streamingContainer = window.streamingContainer;
  if (!streamingContainer) return;
  
  // Process the full accumulated content with markdown
  const processedContent = processGeneratedNotes(fullContent + newContent);
  
  // Extract content from the wrapper div
  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = processedContent;
  const generatedNotesDiv = tempDiv.querySelector('.generated-notes');
  
  if (generatedNotesDiv) {
    // Update the streaming container with processed content
    streamingContainer.innerHTML = generatedNotesDiv.innerHTML;
  }
  
  // Scroll to show new content
  streamingContainer.scrollIntoView({ behavior: 'smooth', block: 'end' });
}

// Show retry message to user
export function showRetryMessage(message) {
  const streamingContainer = window.streamingContainer;
  if (!streamingContainer) return;
  
  // Create a temporary retry indicator
  const retryDiv = document.createElement('div');
  retryDiv.className = 'retry-message';
  retryDiv.style.cssText = 'color: #718096; font-style: italic; font-size: 0.9em; margin: 0.5rem 0;';
  retryDiv.textContent = message;
  
  streamingContainer.appendChild(retryDiv);
  
  // Remove retry message after 3 seconds
  setTimeout(() => {
    if (retryDiv.parentNode) {
      retryDiv.remove();
    }
  }, 3000);
}

// Finalize streamed content
export async function finalizeStreamedContent(fullContent) {
  // Get the current note info from the notes processor
  const { getCurrentNoteId } = await import('./notes-processor.js');
  const streamingContainer = window.streamingContainer;
  if (!streamingContainer) return;
  
  // Process the complete content with markdown
  const processedContent = processGeneratedNotes(fullContent);
  
  // Replace the streaming container with final processed content
  elements.notesInput.innerHTML = processedContent;
  
  // Add event listeners for external links
  const externalLinks = elements.notesInput.querySelectorAll('.external-link');
  externalLinks.forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      window.electronAPI.openExternal(link.href);
    });
  });
  
  // Ensure event listeners are added (import required functions)
  const { handleNotesInput, handleNotesKeydown } = await import('./notes-editor.js');
  if (!elements.notesInput.hasEventListener) {
    elements.notesInput.addEventListener('input', handleNotesInput);
    elements.notesInput.addEventListener('keydown', handleNotesKeydown);
    elements.notesInput.hasEventListener = true;
  }
  
  // Update references
  window.notesDisplay = elements.notesInput;
  
  // Update backend with AI-generated notes
  const currentNoteId = getCurrentNoteId();
  if (currentNoteId && authManager.isAuthenticated()) {
    try {
      const title = elements.titleInput.value || 'Untitled';
      const transcript = getCurrentTranscript();
      
      await APIClient.updateNote(currentNoteId, {
        title: title,
        transcript: transcript,
        // Don't send raw_notes - they should remain unchanged
        notes: fullContent,
        status: 'completed'
      });
      
      // Set AI enhanced flag to true
      await APIClient.setNoteAiEnhanced(currentNoteId);
      console.log('AI-generated notes saved to backend and marked as AI enhanced');
    } catch (error) {
      console.error('Failed to save AI notes to backend:', error);
    }
  } else {
    console.warn('No current note ID available for saving generated notes');
  }
}

// Initialize the notes input as a contentEditable div with markdown support
function initializeNotesAsEditable() {
  // Create a contentEditable div to replace the textarea
  const notesDiv = document.createElement('div');
  notesDiv.className = 'notes-input notes-display';
  notesDiv.contentEditable = true;
  notesDiv.setAttribute('data-placeholder', 'Write notes...');
  
  // Replace the textarea with the div
  const notesWrapper = elements.notesInput.parentNode;
  notesWrapper.replaceChild(notesDiv, elements.notesInput);
  
  // Update the reference to point to the new div
  elements.notesInput = notesDiv;
  
  // Add event listeners for markdown processing (import required functions)
  import('./notes-editor.js').then(({ handleNotesInput, handleNotesKeydown }) => {
    notesDiv.addEventListener('input', handleNotesInput);
    notesDiv.addEventListener('keydown', handleNotesKeydown);
  });
  
  return notesDiv;
}