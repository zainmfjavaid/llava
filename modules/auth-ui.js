// auth-ui.js - Authentication UI management
import { authManager } from './auth-manager.js';
import { initializeLandingPage, addBackToHomeButton, initializeSidebarHomeButtons } from './landing-page.js';

export function initializeAuthUI() {
  const authScreen = document.getElementById('authScreen');
  const initialScreen = document.getElementById('initialScreen');
  const loginTab = document.getElementById('loginTab');
  const signupTab = document.getElementById('signupTab');
  const authBtn = document.getElementById('authBtn');
  const authForm = document.getElementById('authFormEl');
  const authError = document.getElementById('authError');
  const emailInput = document.getElementById('emailInput');
  const passwordInput = document.getElementById('passwordInput');
  const nameInput = document.getElementById('nameInput');
  const nameGroup = document.getElementById('nameGroup');
  // const userEmail = document.getElementById('userEmail'); // Removed as home-header is gone
  // const logoutBtn = document.getElementById('logoutBtn'); // Removed as home-header is gone
  // Permission screen elements
  const permissionScreen = document.getElementById('permissionScreen');
  const micPermBtn = document.getElementById('micPermBtn');
  const sysAudioPermBtn = document.getElementById('sysAudioPermBtn');
  const permContinueBtn = document.getElementById('permContinueBtn');
  let micGranted = false;
  let sysAudioGranted = false;

  // Permission handlers
  function updateContinueState() {
    permContinueBtn.disabled = !(micGranted && sysAudioGranted);
  }
  async function requestMicPermission() {
    try {
      // First check if we already have permission
      if (window.electronAPI && window.electronAPI.checkMicrophonePermission) {
        const status = await window.electronAPI.checkMicrophonePermission();
        if (status === 'granted') {
          micGranted = true;
          micPermBtn.textContent = 'Enabled';
          micPermBtn.disabled = true;
          updateContinueState();
          return;
        }
      }
      
      // Request system-level permission first (macOS)
      if (window.electronAPI && window.electronAPI.requestMicrophonePermission) {
        const granted = await window.electronAPI.requestMicrophonePermission();
        if (!granted) {
          throw new Error('System microphone permission denied');
        }
      }
      
      // Then request web API permission
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      micGranted = true;
      micPermBtn.textContent = 'Enabled';
      micPermBtn.disabled = true;
      updateContinueState();
      // Stop tracks
      stream.getTracks().forEach(track => track.stop());
    } catch (err) {
      console.error('Microphone permission error:', err);
      alert('Microphone permission denied.');
    }
  }
  async function requestSysAudioPermission() {
    try {
      // Attempt to trigger system audio permission by starting audio monitoring
      // This will cause macOS to show the permission dialog
      if (window.electronAPI && window.electronAPI.startAudioMonitoring) {
        // Set up error listener first
        const errorHandler = (error) => {
          console.error('Audio monitoring error:', error);
          if (error.includes('Permission denied') || error.includes('Operation not permitted')) {
            showPermissionInstructions();
          }
        };
        
        if (window.electronAPI.onAudioMonitoringError) {
          window.electronAPI.onAudioMonitoringError(errorHandler);
        }
        
        try {
          await window.electronAPI.startAudioMonitoring();
          
          // Wait a moment to see if it works
          setTimeout(async () => {
            await window.electronAPI.stopAudioMonitoring();
            sysAudioGranted = true;
            sysAudioPermBtn.textContent = 'Enabled';
            sysAudioPermBtn.disabled = true;
            updateContinueState();
          }, 1000);
        } catch (monitorError) {
          // If monitoring fails, show manual instructions
          showPermissionInstructions();
        }
      } else {
        throw new Error('Audio monitoring API not available');
      }
    } catch (error) {
      console.error('System audio permission error:', error);
      showPermissionInstructions();
    }
  }
  function showPermissionInstructions() {
    const userChoice = confirm(
      'System audio permission is required for transcription.\n\n' +
      'Click OK to open Privacy Settings where you can:\n' +
      '1. Go to Privacy & Security > Microphone\n' +
      '2. Enable this app for microphone access\n\n' +
      'Then come back and try again.'
    );
    
    if (userChoice && window.electronAPI && window.electronAPI.openPrivacySettings) {
      window.electronAPI.openPrivacySettings();
    }
  }
  function hidePermissionScreen() {
    permissionScreen.classList.add('visually-hidden');
    permissionScreen.style.display = 'none';
  }
  function showPermissionScreen() {
    // Hide other screens
    authScreen.classList.add('visually-hidden');
    authScreen.style.display = 'none';
    initialScreen.classList.add('visually-hidden');
    initialScreen.style.display = 'none';
    // Reset state
    micGranted = false;
    sysAudioGranted = false;
    micPermBtn.textContent = 'Enable';
    micPermBtn.disabled = false;
    sysAudioPermBtn.textContent = 'Enable';
    sysAudioPermBtn.disabled = false;
    updateContinueState();
    // Show permission screen
    permissionScreen.classList.remove('visually-hidden');
    permissionScreen.style.display = 'flex';
  }
  // Permission button listeners
  micPermBtn.addEventListener('click', requestMicPermission);
  sysAudioPermBtn.addEventListener('click', requestSysAudioPermission);
  permContinueBtn.addEventListener('click', async () => {
    hidePermissionScreen();
    await showMainApp();
  });

  let isLoginMode = true;

  // Check if user is already authenticated
  if (authManager.isAuthenticated()) {
    showMainApp().catch(console.error);
  } else {
    showAuthScreen();
  }

  function showAuthScreen() {
    // Ensure permission screen is hidden
    hidePermissionScreen();
    authScreen.classList.remove('visually-hidden');
    authScreen.style.display = 'flex';
    initialScreen.classList.add('visually-hidden');
    initialScreen.style.display = 'none';
    clearError();
  }

  async function showMainApp() {
    // Ensure permission screen is hidden
    hidePermissionScreen();
    initialScreen.classList.remove('visually-hidden');
    initialScreen.style.display = 'flex';
    authScreen.classList.add('visually-hidden');
    authScreen.style.display = 'none';
    const user = authManager.getCurrentUser();
    if (user) {
      // userEmail.textContent = user.email; // Removed as home-header is gone
    }
    
    // Initialize landing page functionality
    await initializeLandingPage();
    initializeSidebarHomeButtons();
    addBackToHomeButton();
    // Re-initialize all app modules now that the main UI is visible (fix auto-resize and event bindings)
    if (window.initializeAppModules) window.initializeAppModules();
  }

  function clearError() {
    authError.textContent = '';
    authError.style.display = 'none';
  }

  function showError(message) {
    authError.textContent = message;
    authError.style.display = 'block';
  }

  function updateAuthMode() {
    clearError();
    if (isLoginMode) {
      loginTab.classList.add('active');
      signupTab.classList.remove('active');
      authBtn.textContent = 'Sign In';
      nameGroup.classList.add('visually-hidden');
      nameInput.required = false;
    } else {
      loginTab.classList.remove('active');
      signupTab.classList.add('active');
      authBtn.textContent = 'Sign Up';
      nameGroup.classList.remove('visually-hidden');
      nameInput.required = true;
    }
  }

  loginTab.addEventListener('click', () => {
    isLoginMode = true;
    updateAuthMode();
  });

  signupTab.addEventListener('click', () => {
    isLoginMode = false;
    updateAuthMode();
  });

  authForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = emailInput.value;
    const password = passwordInput.value;
    const name = nameInput.value;
    authBtn.disabled = true;
    authBtn.textContent = isLoginMode ? 'Signing In...' : 'Signing Up...';

    try {
      if (isLoginMode) {
        await authManager.login(email, password);
        await showMainApp();
      } else {
        await authManager.register(name, email, password);
        showPermissionScreen();
      }
    } catch (error) {
      showError(error.message);
    } finally {
      authBtn.disabled = false;
      updateAuthMode(); // Reset button text
    }
  });

  // if (logoutBtn) { // Removed as home-header is gone
  //   logoutBtn.addEventListener('click', async () => {
  //     try {
  //       await authManager.logout();
  //       showAuthScreen();
  //       emailInput.value = ''; // Clear fields on logout
  //       passwordInput.value = '';
  //     } catch (error) {
  //       console.error('Logout failed:', error);
  //       showError('Logout failed. Please try again.');
  //     }
  //   });
  // }

  return {
    showAuthScreen,
    showMainApp,
    isAuthenticated: () => authManager.isAuthenticated()
  };
}