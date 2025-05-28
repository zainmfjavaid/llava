// DOM element references and utilities
export const elements = {
  initialScreen: document.getElementById('initialScreen'),
  recordingScreen: document.getElementById('recordingScreen'),
  recordBtn: document.getElementById('recordBtn'),
  stopBtn: document.getElementById('stopBtn'),
  titleInput: document.getElementById('titleInput'),
  notesInput: document.getElementById('notesInput'),
  audioVisualizer: document.getElementById('audioVisualizer'),
  transcriptContent: document.getElementById('transcriptContent'),
  recordingControls: document.getElementById('recordingControls'),
  transcriptContentWrapper: document.getElementById('transcriptContentWrapper'),
  settingsIcon: document.getElementById('settingsIcon'),
  settingsDropdown: document.getElementById('settingsDropdown'),
  audioDevice: document.getElementById('audioDevice'),
  audioLevelBars: document.getElementById('audioLevelBars'),
  soundSettingsBtn: document.getElementById('soundSettingsBtn'),
  copyIcon: document.getElementById('copyIcon'),
  scrollToBottomBtn: document.getElementById('scrollToBottomBtn'),
  generateNotesBtn: document.getElementById('generateNotesBtn'),
  separator: document.getElementById('separator')
};

// Auto-resize title input
export function autoResizeTitle() {
  // Store cursor position before resizing
  const start = elements.titleInput.selectionStart;
  const end = elements.titleInput.selectionEnd;
  
  elements.titleInput.style.height = 'auto';
  elements.titleInput.style.height = elements.titleInput.scrollHeight + 'px';
  
  // Restore cursor position after resizing
  elements.titleInput.setSelectionRange(start, end);
}

// Helper function to check if title field is empty
export function isTitleEmpty() {
  return !elements.titleInput.value || elements.titleInput.value.trim() === '';
}

// Helper function to manage separator visibility
export function updateSeparatorVisibility() {
  const isGenerateNotesVisible = elements.generateNotesBtn.style.display === 'flex';
  const isTranscriptOpen = elements.recordingControls.classList.contains('transcript-open');
  
  if (isTranscriptOpen && isGenerateNotesVisible) {
    elements.separator.style.display = 'block';
  } else {
    elements.separator.style.display = 'none';
  }
}

// Wave animation functions
export function startWaveAnimations() {
  const audioBars = document.querySelectorAll('.audio-bar');
  audioBars.forEach(bar => {
    bar.classList.add('recording');
    bar.classList.remove('paused');
  });
}

export function stopWaveAnimations() {
  const audioBars = document.querySelectorAll('.audio-bar');
  audioBars.forEach(bar => {
    bar.classList.remove('recording');
    bar.classList.add('paused');
  });
  
  // Set static short-long-short pattern
  audioBars[0].style.height = '8px';
  audioBars[1].style.height = '16px';
  audioBars[2].style.height = '8px';
}

// Copy functionality
export function showCopySuccess() {
  const copySvg = elements.copyIcon.querySelector('.copy-svg');
  const checkmarkSvg = elements.copyIcon.querySelector('.checkmark-svg');
  
  // Hide copy icon and show checkmark
  copySvg.style.display = 'none';
  checkmarkSvg.style.display = 'block';
  elements.copyIcon.style.color = '#48bb78';
  
  // Revert after 1 second
  setTimeout(() => {
    copySvg.style.display = 'block';
    checkmarkSvg.style.display = 'none';
    elements.copyIcon.style.color = '';
  }, 1000);
}

// Get all text nodes within an element
export function getTextNodes(element) {
  const textNodes = [];
  const walker = document.createTreeWalker(
    element,
    NodeFilter.SHOW_TEXT,
    null,
    false
  );
  
  let node;
  while (node = walker.nextNode()) {
    textNodes.push(node);
  }
  
  return textNodes;
}