// context-dump.js - Context Dump functionality
import { elements } from './dom-utils.js';
import { sidebarManager } from './sidebar-manager.js';

// Uploaded files storage
let uploadedFiles = [];

// Initialize context dump functionality
export function initializeContextDump() {
  // Get elements
  const vibeBtn = document.getElementById('vibeBtn');
  const contextContinueBtn = document.getElementById('contextContinueBtn');
  const backToHomeBtnContext = document.getElementById('backToHomeBtnContext');
  const homeBtnContext = document.getElementById('homeBtnContext');
  
  // Add click listener to Vibe button
  if (vibeBtn) {
    vibeBtn.addEventListener('click', showContextDumpScreen);
  }
  
  // Add click listener to Continue button
  if (contextContinueBtn) {
    contextContinueBtn.addEventListener('click', handleContinueFromContextDump);
  }
  
  // Add navigation listeners
  if (backToHomeBtnContext) {
    backToHomeBtnContext.addEventListener('click', navigateToHome);
  }
  
  if (homeBtnContext) {
    homeBtnContext.addEventListener('click', navigateToHome);
  }
  
  // Initialize file upload functionality
  initializeFileUpload();
}

// Initialize file upload functionality
function initializeFileUpload() {
  const fileInput = document.getElementById('contextFiles');
  const fileUploadArea = document.getElementById('fileUploadArea');
  const uploadedFilesContainer = document.getElementById('uploadedFiles');
  
  if (!fileInput || !fileUploadArea || !uploadedFilesContainer) return;
  
  // Handle file input change
  fileInput.addEventListener('change', handleFileSelect);
  
  // Handle drag and drop
  fileUploadArea.addEventListener('dragover', handleDragOver);
  fileUploadArea.addEventListener('dragleave', handleDragLeave);
  fileUploadArea.addEventListener('drop', handleFileDrop);
  
  // Handle click to trigger file input
  fileUploadArea.addEventListener('click', (e) => {
    if (e.target === fileUploadArea || e.target.closest('.file-upload-content')) {
      fileInput.click();
    }
  });
}

// Handle file selection
function handleFileSelect(event) {
  const files = Array.from(event.target.files);
  addFiles(files);
  // Clear the input so the same file can be selected again
  event.target.value = '';
}

// Handle drag over
function handleDragOver(event) {
  event.preventDefault();
  event.stopPropagation();
  event.currentTarget.classList.add('dragover');
}

// Handle drag leave
function handleDragLeave(event) {
  event.preventDefault();
  event.stopPropagation();
  event.currentTarget.classList.remove('dragover');
}

// Handle file drop
function handleFileDrop(event) {
  event.preventDefault();
  event.stopPropagation();
  event.currentTarget.classList.remove('dragover');
  
  const files = Array.from(event.dataTransfer.files);
  addFiles(files);
}

// Add files to the uploaded files list
function addFiles(files) {
  const allowedTypes = ['text/plain', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/pdf', 'image/png', 'image/jpeg', 'image/jpg'];
  const allowedExtensions = ['.txt', '.doc', '.docx', '.pdf', '.png', '.jpg', '.jpeg'];
  
  files.forEach(file => {
    // Check file type
    const isValidType = allowedTypes.includes(file.type) || 
                       allowedExtensions.some(ext => file.name.toLowerCase().endsWith(ext));
    
    if (!isValidType) {
      alert(`File "${file.name}" is not supported. Please upload TXT, DOC, DOCX, PDF, PNG, JPG, or JPEG files.`);
      return;
    }
    
    // Check if file already exists
    if (uploadedFiles.some(f => f.name === file.name && f.size === file.size)) {
      alert(`File "${file.name}" is already uploaded.`);
      return;
    }
    
    // Add file to list
    uploadedFiles.push(file);
    renderUploadedFiles();
  });
}

// Render uploaded files list
function renderUploadedFiles() {
  const container = document.getElementById('uploadedFiles');
  if (!container) return;
  
  container.innerHTML = '';
  
  uploadedFiles.forEach((file, index) => {
    const fileElement = document.createElement('div');
    fileElement.className = 'uploaded-file';
    
    const fileIcon = getFileIcon(file.name);
    const fileSize = formatFileSize(file.size);
    
    fileElement.innerHTML = `
      <div class="uploaded-file-info">
        <svg class="uploaded-file-icon" viewBox="0 0 24 24" fill="currentColor">
          ${fileIcon}
        </svg>
        <div class="uploaded-file-details">
          <div class="uploaded-file-name">${file.name}</div>
          <div class="uploaded-file-size">${fileSize}</div>
        </div>
      </div>
      <button class="uploaded-file-remove" onclick="window.removeUploadedFile(${index})" type="button">
        <svg viewBox="0 0 24 24" fill="currentColor">
          <path d="M19,6.41L17.59,5L12,10.59L6.41,5L5,6.41L10.59,12L5,17.59L6.41,19L12,13.41L17.59,19L19,17.59L13.41,12L19,6.41Z"/>
        </svg>
      </button>
    `;
    
    container.appendChild(fileElement);
  });
}

// Get file icon based on file extension
function getFileIcon(filename) {
  const ext = filename.split('.').pop().toLowerCase();
  
  switch (ext) {
    case 'pdf':
      return '<path d="M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2M18,20H6V4H13V9H18V20Z"/>';
    case 'doc':
    case 'docx':
      return '<path d="M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2M18,20H6V4H13V9H18V20Z"/>';
    case 'txt':
      return '<path d="M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2M18,20H6V4H13V9H18V20Z"/>';
    case 'png':
    case 'jpg':
    case 'jpeg':
      return '<path d="M8.5,13.5L11,16.5L14.5,12L19,18H5M21,19V5C21,3.89 20.1,3 19,3H5A2,2 0 0,0 3,5V19A2,2 0 0,0 5,21H19A2,2 0 0,0 21,19Z"/>';
    default:
      return '<path d="M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2M18,20H6V4H13V9H18V20Z"/>';
  }
}

// Format file size
function formatFileSize(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Remove uploaded file
window.removeUploadedFile = function(index) {
  uploadedFiles.splice(index, 1);
  renderUploadedFiles();
};

// Show context dump screen with smooth transition
export async function showContextDumpScreen() {
  const initialScreen = document.getElementById('initialScreen');
  const contextDumpScreen = document.getElementById('contextDumpScreen');
  
  if (!initialScreen || !contextDumpScreen) return;
  
  // Smoothly collapse sidebar
  const sidebar = document.querySelector('.initial-screen .sidebar');
  if (sidebar && !sidebar.classList.contains('collapsed')) {
    sidebarManager.collapseSidebar(sidebar, 'sidebar-toggle-shrink', 'sidebar-toggle-expand');
  }
  
  // Setup crossfade transition
  // Position context dump screen on top with opacity 0
  contextDumpScreen.style.position = 'absolute';
  contextDumpScreen.style.top = '0';
  contextDumpScreen.style.left = '0';
  contextDumpScreen.style.width = '100%';
  contextDumpScreen.style.height = '100%';
  contextDumpScreen.style.zIndex = '10';
  contextDumpScreen.style.display = 'block';
  contextDumpScreen.style.opacity = '0';
  contextDumpScreen.style.transition = 'opacity 0.3s ease';
  
  // Fade out initial screen and fade in context dump screen simultaneously
  initialScreen.style.transition = 'opacity 0.3s ease';
  initialScreen.style.opacity = '0';
  
  setTimeout(() => {
    contextDumpScreen.style.opacity = '1';
  }, 50);
  
  // Clean up after transition
  setTimeout(() => {
    initialScreen.style.display = 'none';
    contextDumpScreen.style.position = '';
    contextDumpScreen.style.top = '';
    contextDumpScreen.style.left = '';
    contextDumpScreen.style.width = '';
    contextDumpScreen.style.height = '';
    contextDumpScreen.style.zIndex = '';
    contextDumpScreen.style.transition = '';
    contextDumpScreen.style.opacity = '';
    initialScreen.style.transition = '';
    initialScreen.style.opacity = '';
  }, 350);
  
  // Update home button states after transition
  setTimeout(async () => {
    const { updateHomeButtonStates } = await import('./landing-page.js');
    updateHomeButtonStates();
  }, 200);
}

// Handle continue button click - transition to recording screen
async function handleContinueFromContextDump() {
  // Collect current form data
  const contextData = getFormData();
  
  // TODO: Send context data to backend
  // This will be implemented when backend communication is added
  console.log('Context data to be sent to backend:', contextData);
  
  // Navigate to recording screen
  await showRecordingScreenFromContextDump();
}

// Get current form data
function getFormData() {
  const contextNotes = document.getElementById('contextNotes');
  
  return {
    notes: contextNotes ? contextNotes.value.trim() : '',
    files: uploadedFiles.map(file => ({
      name: file.name,
      size: file.size,
      type: file.type,
      lastModified: file.lastModified
    }))
  };
}

// Navigate to recording screen from context dump
async function showRecordingScreenFromContextDump() {
  const contextDumpScreen = document.getElementById('contextDumpScreen');
  const recordingScreen = document.getElementById('recordingScreen');
  
  if (!contextDumpScreen || !recordingScreen) return;
  
  // Setup crossfade transition to recording screen
  recordingScreen.style.position = 'absolute';
  recordingScreen.style.top = '0';
  recordingScreen.style.left = '0';
  recordingScreen.style.width = '100%';
  recordingScreen.style.height = '100%';
  recordingScreen.style.zIndex = '10';
  recordingScreen.style.display = 'block';
  recordingScreen.style.opacity = '0';
  recordingScreen.style.transition = 'opacity 0.3s ease';
  
  // Fade out context dump screen and fade in recording screen simultaneously
  contextDumpScreen.style.transition = 'opacity 0.3s ease';
  contextDumpScreen.style.opacity = '0';
  
  setTimeout(() => {
    recordingScreen.style.opacity = '1';
  }, 50);
  
  // Clean up after transition
  setTimeout(() => {
    contextDumpScreen.style.display = 'none';
    recordingScreen.style.position = '';
    recordingScreen.style.top = '';
    recordingScreen.style.left = '';
    recordingScreen.style.width = '';
    recordingScreen.style.height = '';
    recordingScreen.style.zIndex = '';
    recordingScreen.style.transition = '';
    recordingScreen.style.opacity = '';
    contextDumpScreen.style.transition = '';
    contextDumpScreen.style.opacity = '';
  }, 350);
  
  // Update home button states after transition
  setTimeout(async () => {
    const { updateHomeButtonStates } = await import('./landing-page.js');
    updateHomeButtonStates();
  }, 200);
  
  // Start recording automatically
  setTimeout(async () => {
    const { startRecording } = await import('./recording-controls.js');
    await startRecording();
  }, 400);
}

// Navigate back to home screen
async function navigateToHome() {
  const { smoothNavigateHome } = await import('./landing-page.js');
  await smoothNavigateHome();
}

// Clear context data and form
export function clearContextData() {
  // Clear uploaded files
  uploadedFiles = [];
  renderUploadedFiles();
  
  // Clear form fields
  const contextNotes = document.getElementById('contextNotes');
  if (contextNotes) contextNotes.value = '';
}

// Get current context data (for external use)
export function getCurrentContextData() {
  return getFormData();
}