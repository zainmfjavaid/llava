// auth-ui.js - Authentication UI management
import { authManager } from './auth-manager.js';
import { initializeLandingPage, addBackToHomeButton } from './landing-page.js';

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
  // const userEmail = document.getElementById('userEmail'); // Removed as home-header is gone
  // const logoutBtn = document.getElementById('logoutBtn'); // Removed as home-header is gone

  let isLoginMode = true;

  // Check if user is already authenticated
  if (authManager.isAuthenticated()) {
    showMainApp();
  } else {
    showAuthScreen();
  }

  function showAuthScreen() {
    authScreen.classList.remove('visually-hidden');
    authScreen.style.display = 'flex';
    initialScreen.classList.add('visually-hidden');
    initialScreen.style.display = 'none';
    clearError();
  }

  function showMainApp() {
    initialScreen.classList.remove('visually-hidden');
    initialScreen.style.display = 'flex';
    authScreen.classList.add('visually-hidden');
    authScreen.style.display = 'none';
    const user = authManager.getCurrentUser();
    if (user) {
      // userEmail.textContent = user.email; // Removed as home-header is gone
    }
    
    // Initialize landing page functionality
    initializeLandingPage();
    addBackToHomeButton();
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
    } else {
      loginTab.classList.remove('active');
      signupTab.classList.add('active');
      authBtn.textContent = 'Sign Up';
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
    authBtn.disabled = true;
    authBtn.textContent = isLoginMode ? 'Signing In...' : 'Signing Up...';

    try {
      if (isLoginMode) {
        await authManager.login(email, password);
      } else {
        await authManager.signup(email, password);
      }
      showMainApp();
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