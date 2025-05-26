// Function to process generated notes with markdown and custom tags
export function processGeneratedNotes(notes, noteStorage = null) {
  // First, handle llava:userinsp tags
  let processedNotes = notes.replace(/<llava:userinsp>(.*?)<\/llava:userinsp>/gs, '<llava:userinsp>$1</llava:userinsp>');
  
  // Convert markdown headers
  processedNotes = processedNotes.replace(/^### (.*$)/gm, '<h3># $1</h3>');
  processedNotes = processedNotes.replace(/^## (.*$)/gm, '<h2>$1</h2>');
  processedNotes = processedNotes.replace(/^# (.*$)/gm, '<h1>$1</h1>');
  
  // Convert markdown bold text
  processedNotes = processedNotes.replace(/\*([^*]+)\*/g, '<strong>$1</strong>');
  
  // Convert note citations in brackets (any alphanumeric ID)
  processedNotes = processedNotes.replace(/\[([0-9A-Za-z]+)\](?!\()/g, (match, noteId) => {
    console.log('Found citation:', match, 'noteId:', noteId);
    return `<span class="note-citation" data-note-id="${noteId}" onclick="openNote('${noteId}')">Loading...</span>`;
  });
  
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