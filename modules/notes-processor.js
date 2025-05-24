import { elements, updateSeparatorVisibility } from './dom-utils.js';
import { getCurrentTranscript } from './transcript-handler.js';

// Function to call generate-title API endpoint
export async function generateTitle() {
  const currentTranscript = getCurrentTranscript();
  
  if (!currentTranscript.trim()) {
    return null;
  }
  
  try {
    const response = await fetch('http://localhost:9000/generate-title', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        transcript: currentTranscript.trim()
      })
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    return data.title;
  } catch (error) {
    console.error('Failed to generate title:', error);
    return null;
  }
}

// Function to process generated notes with markdown and custom tags
export function processGeneratedNotes(notes) {
  // First, handle llava:userinsp tags
  let processedNotes = notes.replace(/<llava:userinsp>(.*?)<\/llava:userinsp>/gs, '<llava:userinsp>$1</llava:userinsp>');
  
  // Convert markdown headers
  processedNotes = processedNotes.replace(/^### (.*$)/gm, '<h3># $1</h3>');
  processedNotes = processedNotes.replace(/^## (.*$)/gm, '<h2>$1</h2>');
  processedNotes = processedNotes.replace(/^# (.*$)/gm, '<h1>$1</h1>');
  
  // Convert markdown bold text
  processedNotes = processedNotes.replace(/\*([^*]+)\*/g, '<strong>$1</strong>');
  
  // Convert markdown links
  processedNotes = processedNotes.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" class="external-link">$1</a>');
  
  // Convert markdown bulleted lists (handles nested lists)
  const lines = processedNotes.split('\n');
  let result = [];
  let inList = false;
  let listStack = [];
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const match = line.match(/^(\s*)[-*]\s+(.+)/);
    
    if (match) {
      const indent = match[1].length;
      const content = match[2];
      
      // Calculate list level based on indentation
      const level = Math.floor(indent / 2);
      
      // Manage list stack
      while (listStack.length > level + 1) {
        result.push('</ul>');
        listStack.pop();
      }
      
      if (listStack.length === level) {
        result.push('<ul>');
        listStack.push(level);
      }
      
      result.push(`<li>${content}</li>`);
      inList = true;
    } else {
      // Close all open lists when not in a list item
      while (listStack.length > 0) {
        result.push('</ul>');
        listStack.pop();
      }
      inList = false;
      
      if (line.trim() !== '') {
        result.push(line);
      } else {
        result.push('');
      }
    }
  }
  
  // Close any remaining open lists
  while (listStack.length > 0) {
    result.push('</ul>');
    listStack.pop();
  }
  
  processedNotes = result.join('\n');
  
  // Clean up excessive whitespace between HTML elements
  processedNotes = processedNotes
    .replace(/\n\s*\n/g, '\n')  // Remove multiple consecutive newlines
    .replace(/>\s*\n\s*</g, '><')  // Remove whitespace between HTML tags
    .replace(/>\s*\n\s*/g, '>')  // Remove trailing whitespace after tags
    .replace(/\s*\n\s*</g, '<')  // Remove leading whitespace before tags
    .trim();
  
  // Wrap everything in a div with the generated-notes class
  return `<div class="generated-notes">${processedNotes}</div>`;
}

// Function to create mixed content div with user editing capability
export function createEditableNotesDiv(notes) {
  const processedNotes = processGeneratedNotes(notes);
  
  // Create a new contentEditable div element
  const notesDiv = document.createElement('div');
  notesDiv.className = 'notes-input notes-display';
  notesDiv.contentEditable = true;
  notesDiv.innerHTML = processedNotes;
  
  // Replace the textarea with the div
  elements.notesInput.parentNode.replaceChild(notesDiv, elements.notesInput);
  
  // Update the reference to point to the new div
  window.notesDisplay = notesDiv;
  
  // Add event listeners for external links
  const externalLinks = notesDiv.querySelectorAll('.external-link');
  externalLinks.forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      window.electronAPI.openExternal(link.href);
    });
  });
  
  // Add input event listener for header processing and content handling
  notesDiv.addEventListener('input', handleNotesInput);
  notesDiv.addEventListener('keydown', handleNotesKeydown);
  
  return notesDiv;
}

// Handle input in the notes div
export function handleNotesInput(e) {
  const target = e.target;
  
  // Mark edited content as user content
  markEditedContentAsUser(target);
  
  // Process headers if user types # at the beginning of a line
  setTimeout(() => processMarkdownHeaders(target), 0);
  
  // Process bullet points if user types - or * at the beginning of a line
  setTimeout(() => processMarkdownBullets(target), 0);
}

// Mark edited content as user content with smooth color transition
export function markEditedContentAsUser(container) {
  const selection = window.getSelection();
  if (selection.rangeCount === 0) return;
  
  const range = selection.getRangeAt(0);
  let currentElement = range.commonAncestorContainer;
  
  // Find the nearest element that could contain text
  if (currentElement.nodeType === Node.TEXT_NODE) {
    currentElement = currentElement.parentElement;
  }
  
  // Check if we're editing AI-generated content
  const aiGeneratedParent = currentElement.closest('.generated-notes');
  if (aiGeneratedParent) {
    // Mark this element as modified by user
    currentElement.classList.add('user-modified');
    
    // Store original content for comparison
    if (!currentElement.dataset.originalContent) {
      currentElement.dataset.originalContent = currentElement.textContent;
    }
    
    // Check if content has been restored to original
    setTimeout(() => {
      if (currentElement.textContent.trim() === currentElement.dataset.originalContent.trim()) {
        currentElement.classList.remove('user-modified');
      }
    }, 100);
  }
}

// Handle keydown events in the notes div
export function handleNotesKeydown(e) {
  const selection = window.getSelection();
  if (selection.rangeCount === 0) return;
  
  const range = selection.getRangeAt(0);
  const currentNode = range.commonAncestorContainer;
  
  if (e.key === 'Enter') {
    // Handle Enter key in bullet points
    const bulletElement = currentNode.nodeType === Node.TEXT_NODE ? 
      currentNode.parentElement.closest('.user-bullet-item') : 
      currentNode.closest('.user-bullet-item');
    
    if (bulletElement) {
      e.preventDefault();
      handleBulletEnterKey(bulletElement, range);
      return;
    }
  }
  
  if (e.key === 'Tab') {
    // Handle Tab key in bullet points for indentation
    const bulletElement = currentNode.nodeType === Node.TEXT_NODE ? 
      currentNode.parentElement.closest('.user-bullet-item') : 
      currentNode.closest('.user-bullet-item');
    
    if (bulletElement) {
      e.preventDefault();
      handleBulletTabKey(bulletElement, e.shiftKey);
      return;
    }
  }
  
  if (e.key === 'Backspace') {
    // Check if we're in a header and at the beginning
    const headerElement = currentNode.nodeType === Node.TEXT_NODE ? 
      currentNode.parentElement : currentNode;
    
    // If we are inside a header element (h1–h6) and the caret is at the very beginning,
    // convert it back to plain text on Backspace rather than deleting characters.
    if (headerElement && /^H[1-6]$/.test(headerElement.tagName) && range.startOffset === 0) {
      e.preventDefault();
      convertHeaderToText(headerElement);
      return;
    }
    
    // Handle Backspace in empty bullet points
    const bulletElement = currentNode.nodeType === Node.TEXT_NODE ? 
      currentNode.parentElement.closest('.user-bullet-item') : 
      currentNode.closest('.user-bullet-item');
    
    if (bulletElement) {
      const textContent = bulletElement.textContent.trim();
      if (textContent === '' && range.startOffset === 0) {
        e.preventDefault();
        removeBulletPoint(bulletElement);
        return;
      }
    }
  }
}

// Process markdown headers in the content
export function processMarkdownHeaders(container) {
  const selection = window.getSelection();
  if (selection.rangeCount === 0) return;
  
  const range = selection.getRangeAt(0);
  let currentNode = range.commonAncestorContainer;
  
  // Find the text node we're working with
  if (currentNode.nodeType !== Node.TEXT_NODE) {
    const textNodes = currentNode.childNodes;
    for (let node of textNodes) {
      if (node.nodeType === Node.TEXT_NODE && range.intersectsNode(node)) {
        currentNode = node;
        break;
      }
    }
  }
  
  if (currentNode.nodeType !== Node.TEXT_NODE) return;
  
  // If the text node already lives inside a header element (h1–h6) we
  // should not recreate the header on every keystroke, otherwise the DOM
  // gets replaced and the caret jumps to the end of the line.
  if (currentNode.parentElement && /^H[1-6]$/.test(currentNode.parentElement.tagName)) {
    return;
  }

  const text = currentNode.textContent;
  const caretPosition = range.startOffset;
  
  // Find the line containing the caret
  const beforeCaret = text.substring(0, caretPosition);
  const lineStart = beforeCaret.lastIndexOf('\n') + 1;
  const lineEnd = text.indexOf('\n', caretPosition);
  const currentLine = text.substring(lineStart, lineEnd === -1 ? text.length : lineEnd);
  
  // Check if the current line matches header pattern (including just # followed by space)
  const headerMatch = currentLine.match(/^(#{1,5})\s(.*)$/);
  if (headerMatch) {
    const headerLevel = headerMatch[1].length;
    const headerText = headerMatch[2];
    
    if (headerLevel <= 5) {
      // Create h3 element (even if headerText is empty)
      const headerElement = document.createElement('h3');
      headerElement.className = 'user-header';
      headerElement.contentEditable = true;
      
      // If there's text after the space, include it
      if (headerText) {
        headerElement.textContent = `# ${headerText}`;
      } else {
        headerElement.textContent = '# ';
      }
      
      // Split the text node and replace the header line
      const beforeLine = text.substring(0, lineStart);
      const afterLine = text.substring(lineEnd === -1 ? text.length : lineEnd);
      
      // Create new text nodes for before and after
      if (beforeLine) {
        const beforeNode = document.createTextNode(beforeLine);
        currentNode.parentNode.insertBefore(beforeNode, currentNode);
      }
      
      currentNode.parentNode.insertBefore(headerElement, currentNode);
      
      if (afterLine) {
        const afterNode = document.createTextNode(afterLine);
        currentNode.parentNode.insertBefore(afterNode, currentNode);
      }
      
      currentNode.remove();
      
      // Set cursor at the end of the header text
      const newRange = document.createRange();
      const textNode = headerElement.firstChild;
      if (textNode) {
        newRange.setStart(textNode, textNode.textContent.length);
        newRange.collapse(true);
      } else {
        newRange.selectNodeContents(headerElement);
        newRange.collapse(false);
      }
      selection.removeAllRanges();
      selection.addRange(newRange);
    }
  }
}

// Convert header back to text
export function convertHeaderToText(headerElement) {
  const text = headerElement.textContent;
  const textNode = document.createTextNode(text);
  headerElement.parentNode.replaceChild(textNode, headerElement);
  
  // Set cursor position at the beginning of the text
  const selection = window.getSelection();
  const range = document.createRange();
  range.setStart(textNode, 0);
  range.collapse(true);
  selection.removeAllRanges();
  selection.addRange(range);
}

// Process markdown bullet points in the content
export function processMarkdownBullets(container) {
  const selection = window.getSelection();
  if (selection.rangeCount === 0) return;
  
  const range = selection.getRangeAt(0);
  let currentNode = range.commonAncestorContainer;
  
  // Find the text node we're working with
  if (currentNode.nodeType !== Node.TEXT_NODE) {
    const textNodes = currentNode.childNodes;
    for (let node of textNodes) {
      if (node.nodeType === Node.TEXT_NODE && range.intersectsNode(node)) {
        currentNode = node;
        break;
      }
    }
  }
  
  if (currentNode.nodeType !== Node.TEXT_NODE) return;
  
  // Skip if we're already in a list item
  if (currentNode.parentElement && currentNode.parentElement.tagName === 'LI') {
    return;
  }

  const text = currentNode.textContent;
  const caretPosition = range.startOffset;
  
  // Find the line containing the caret
  const beforeCaret = text.substring(0, caretPosition);
  const lineStart = beforeCaret.lastIndexOf('\n') + 1;
  const lineEnd = text.indexOf('\n', caretPosition);
  const currentLine = text.substring(lineStart, lineEnd === -1 ? text.length : lineEnd);
  
  // Check if the current line matches bullet pattern
  const bulletMatch = currentLine.match(/^(\s*)[-*]\s(.*)$/);
  if (bulletMatch) {
    const indent = bulletMatch[1].length;
    const content = bulletMatch[2];
    const level = Math.floor(indent / 2);
    
    // Find or create the appropriate nested list structure
    const listStructure = findOrCreateListStructure(currentNode, level);
    
    // Create list item element
    const listItem = document.createElement('li');
    listItem.className = 'user-bullet-item';
    listItem.textContent = content;
    
    // Add to the appropriate list
    listStructure.appendChild(listItem);
    
    // Split the text node and replace the bullet line
    const beforeLine = text.substring(0, lineStart);
    const afterLine = text.substring(lineEnd === -1 ? text.length : lineEnd);
    
    // Create new text nodes for before and after
    if (beforeLine) {
      const beforeNode = document.createTextNode(beforeLine);
      currentNode.parentNode.insertBefore(beforeNode, currentNode);
    }
    
    // Insert the list structure if it's new
    if (!listStructure.parentNode) {
      currentNode.parentNode.insertBefore(listStructure, currentNode);
    }
    
    if (afterLine) {
      const afterNode = document.createTextNode(afterLine);
      currentNode.parentNode.insertBefore(afterNode, currentNode);
    }
    
    currentNode.remove();
    
    // Set cursor at the end of the content
    const newRange = document.createRange();
    newRange.setStart(listItem, listItem.childNodes.length);
    newRange.collapse(true);
    selection.removeAllRanges();
    selection.addRange(newRange);
  }
}

// Find or create nested list structure for the given level
function findOrCreateListStructure(currentNode, targetLevel) {
  let container = currentNode.parentNode;
  
  // Look for existing list structures before the current position
  let existingList = null;
  let currentSibling = currentNode.previousSibling;
  
  while (currentSibling) {
    if (currentSibling.tagName === 'UL' && currentSibling.classList.contains('user-bullet-list')) {
      existingList = currentSibling;
      break;
    }
    currentSibling = currentSibling.previousSibling;
  }
  
  if (!existingList) {
    // Create new top-level list
    existingList = document.createElement('ul');
    existingList.className = 'user-bullet-list';
  }
  
  // Navigate to the correct nesting level
  let currentList = existingList;
  let currentLevel = 0;
  
  while (currentLevel < targetLevel) {
    // Look for an existing nested list in the last item
    const lastItem = currentList.lastElementChild;
    if (lastItem && lastItem.tagName === 'LI') {
      let nestedList = lastItem.querySelector('ul');
      if (!nestedList) {
        // Create new nested list
        nestedList = document.createElement('ul');
        nestedList.className = 'user-bullet-list';
        lastItem.appendChild(nestedList);
      }
      currentList = nestedList;
    } else {
      // Need to create a new item and nested list
      const newItem = document.createElement('li');
      newItem.className = 'user-bullet-item';
      currentList.appendChild(newItem);
      
      const nestedList = document.createElement('ul');
      nestedList.className = 'user-bullet-list';
      newItem.appendChild(nestedList);
      currentList = nestedList;
    }
    currentLevel++;
  }
  
  return currentList;
}

// Generate notes functionality
export async function generateNotes() {
  const rawNotes = elements.notesInput.value || '';
  const currentTranscript = getCurrentTranscript();
  
  if (!currentTranscript.trim()) {
    alert('No transcript available to generate notes from');
    return;
  }
  
  // Show loading state
  const originalText = elements.generateNotesBtn.querySelector('svg').nextSibling.textContent.trim();
  elements.generateNotesBtn.querySelector('svg').nextSibling.textContent = ' Generating...';
  elements.generateNotesBtn.disabled = true;
  
  try {
    const response = await fetch('http://localhost:9000/generate-notes', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        transcript: currentTranscript.trim(),
        raw_notes: rawNotes
      })
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    
    // Replace textarea with an editable div for HTML rendering
    createEditableNotesDiv(data.notes);
    
    // Hide generate notes button and remove resume text
    elements.generateNotesBtn.style.display = 'none';
    const resumeText = document.querySelector('.resume-text');
    if (resumeText) {
      resumeText.remove();
      elements.recordingControls.classList.remove('expanded');
    }
    updateSeparatorVisibility();
    
  } catch (error) {
    console.error('Failed to generate notes:', error);
    alert(`Error generating notes: ${error.message}`);
    // Reset button state on error
    elements.generateNotesBtn.querySelector('svg').nextSibling.textContent = originalText;
    elements.generateNotesBtn.disabled = false;
  }
}

// Handle Enter key in bullet points
function handleBulletEnterKey(bulletElement, range) {
  const textContent = bulletElement.textContent.trim();
  
  if (textContent === '') {
    // Empty bullet point - reduce nesting level or exit list
    const parentList = bulletElement.parentNode;
    const grandparentItem = parentList.parentNode;
    
    if (grandparentItem && grandparentItem.tagName === 'LI') {
      // We're in a nested list - move to parent level
      decreaseBulletIndent(bulletElement);
    } else {
      // We're at top level - exit bullet mode
      exitBulletMode(bulletElement);
    }
  } else {
    // Non-empty bullet point - create a new bullet point
    createNewBulletPoint(bulletElement);
  }
}

// Exit bullet mode and continue with normal text
function exitBulletMode(bulletElement) {
  const parentList = bulletElement.parentNode;
  const container = parentList.parentNode;
  
  // Create a line break and place cursor after the list
  const lineBreak = document.createTextNode('\n');
  
  // Remove the empty bullet
  bulletElement.remove();
  
  // Clean up empty list if needed
  if (parentList.children.length === 0) {
    container.insertBefore(lineBreak, parentList.nextSibling);
    parentList.remove();
  } else {
    container.insertBefore(lineBreak, parentList.nextSibling);
  }
  
  // Set cursor after the line break
  const range = document.createRange();
  const selection = window.getSelection();
  range.setStart(lineBreak, 1);
  range.collapse(true);
  selection.removeAllRanges();
  selection.addRange(range);
}

// Handle Tab key in bullet points for indentation
function handleBulletTabKey(bulletElement, isShiftTab) {
  if (isShiftTab) {
    // Shift+Tab: Decrease indentation (unindent)
    decreaseBulletIndent(bulletElement);
  } else {
    // Tab: Increase indentation (indent)
    increaseBulletIndent(bulletElement);
  }
}

// Remove a bullet point and handle focus
function removeBulletPoint(bulletElement) {
  const parentList = bulletElement.parentNode;
  const nextElement = bulletElement.nextSibling;
  const prevElement = bulletElement.previousSibling;
  
  // Remove the bullet element
  bulletElement.remove();
  
  // Clean up empty lists
  if (parentList.children.length === 0) {
    const parentItem = parentList.parentNode;
    if (parentItem && parentItem.tagName === 'LI') {
      // If this was the only item in a nested list, focus on the parent item
      const range = document.createRange();
      const selection = window.getSelection();
      range.setStart(parentItem, parentItem.childNodes.length);
      range.collapse(true);
      selection.removeAllRanges();
      selection.addRange(range);
      parentList.remove();
    } else {
      // Remove empty top-level list
      parentList.remove();
    }
    return;
  }
  
  // Set focus to the next or previous element
  const focusElement = nextElement || prevElement;
  if (focusElement && focusElement.tagName === 'LI') {
    const range = document.createRange();
    const selection = window.getSelection();
    range.setStart(focusElement, 0);
    range.collapse(true);
    selection.removeAllRanges();
    selection.addRange(range);
  }
}

// Create a new bullet point after the current one
function createNewBulletPoint(bulletElement) {
  const newBulletItem = document.createElement('li');
  newBulletItem.className = 'user-bullet-item';
  
  // Insert after current bullet in the same list
  const parentList = bulletElement.parentNode;
  const nextSibling = bulletElement.nextSibling;
  if (nextSibling) {
    parentList.insertBefore(newBulletItem, nextSibling);
  } else {
    parentList.appendChild(newBulletItem);
  }
  
  // Set cursor in the new bullet point
  const range = document.createRange();
  const selection = window.getSelection();
  range.setStart(newBulletItem, 0);
  range.collapse(true);
  selection.removeAllRanges();
  selection.addRange(range);
}

// Increase bullet indentation
function increaseBulletIndent(bulletElement) {
  const currentList = bulletElement.parentNode;
  
  // Create a new nested list
  const nestedList = document.createElement('ul');
  nestedList.className = 'user-bullet-list';
  
  // Move the bullet item to the nested list
  bulletElement.remove();
  nestedList.appendChild(bulletElement);
  
  // Find the previous list item to attach the nested list to
  const prevItem = currentList.lastElementChild;
  if (prevItem && prevItem.tagName === 'LI') {
    // Add nested list to previous item
    prevItem.appendChild(nestedList);
  } else {
    // Create a new item to hold the nested list
    const newItem = document.createElement('li');
    newItem.className = 'user-bullet-item';
    currentList.appendChild(newItem);
    newItem.appendChild(nestedList);
  }
  
  // Restore cursor position
  const range = document.createRange();
  const selection = window.getSelection();
  range.setStart(bulletElement, bulletElement.childNodes.length);
  range.collapse(true);
  selection.removeAllRanges();
  selection.addRange(range);
}

// Decrease bullet indentation
function decreaseBulletIndent(bulletElement) {
  const currentList = bulletElement.parentNode;
  const parentItem = currentList.parentNode;
  
  // Can only unindent if we're in a nested list
  if (parentItem && parentItem.tagName === 'LI') {
    const grandparentList = parentItem.parentNode;
    
    // Move the bullet item to the parent level
    bulletElement.remove();
    
    // Insert after the parent item
    const nextSibling = parentItem.nextSibling;
    if (nextSibling) {
      grandparentList.insertBefore(bulletElement, nextSibling);
    } else {
      grandparentList.appendChild(bulletElement);
    }
    
    // Clean up empty lists
    if (currentList.children.length === 0) {
      currentList.remove();
    }
    
    // Restore cursor position
    const range = document.createRange();
    const selection = window.getSelection();
    range.setStart(bulletElement, bulletElement.childNodes.length);
    range.collapse(true);
    selection.removeAllRanges();
    selection.addRange(range);
  }
}

// Initialize notes processing event listeners
export function initializeNotesListeners() {
  elements.generateNotesBtn.addEventListener('click', generateNotes);
}