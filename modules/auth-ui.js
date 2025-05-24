// auth-ui.js - Authentication UI management
import { authManager } from './auth-manager.js';

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
  const userEmail = document.getElementById('userEmail');
  const logoutBtn = document.getElementById('logoutBtn');

  let isLoginMode = true;

  // Check if user is already authenticated
  if (authManager.isAuthenticated()) {
    showMainApp();
  } else {
    showAuthScreen();
  }

  function showAuthScreen() {
    authScreen.style.display = 'flex';
    initialScreen.style.display = 'none';
    clearError();
  }

  function showMainApp() {
    authScreen.style.display = 'none';
    initialScreen.style.display = 'flex';
    const user = authManager.getCurrentUser();
    if (user) {
      userEmail.textContent = user.email;
    }
  }

  function clearError() {
    authError.textContent = '';
    authError.style.display = 'none';
  }

  function showError(message) {
    authError.textContent = message;
    authError.style.display = 'block';
  }

  function setLoginMode(isLogin) {
    isLoginMode = isLogin;
    if (isLogin) {
      loginTab.classList.add('active');
      signupTab.classList.remove('active');
      authBtn.textContent = 'Sign In';
    } else {
      loginTab.classList.remove('active');
      signupTab.classList.add('active');
      authBtn.textContent = 'Sign Up';
    }
    clearError();
  }

  // Tab switching
  loginTab.addEventListener('click', () => setLoginMode(true));
  signupTab.addEventListener('click', () => setLoginMode(false));

  // Form submission
  authForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const email = emailInput.value.trim();
    const password = passwordInput.value;

    if (!email || !password) {
      showError('Please fill in all fields');
      return;
    }

    if (password.length < 6) {
      showError('Password must be at least 6 characters');
      return;
    }

    authBtn.disabled = true;
    authBtn.textContent = isLoginMode ? 'Signing In...' : 'Signing Up...';
    clearError();

    try {
      if (isLoginMode) {
        await authManager.login(email, password);
      } else {
        await authManager.register(email, password);
      }
      
      showMainApp();
      
      // Initialize app modules after successful authentication
      if (window.initializeAppModules) {
        window.initializeAppModules();
      }
      
      // Clear form
      emailInput.value = '';
      passwordInput.value = '';
      
    } catch (error) {
      showError(error.message);
    } finally {
      authBtn.disabled = false;
      authBtn.textContent = isLoginMode ? 'Sign In' : 'Sign Up';
    }
  });

  // Logout
  logoutBtn.addEventListener('click', () => {
    authManager.logout();
    showAuthScreen();
  });

  // Enter key handling
  emailInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      passwordInput.focus();
    }
  });

  passwordInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      authForm.dispatchEvent(new Event('submit'));
    }
  });

  return {
    showAuthScreen,
    showMainApp,
    isAuthenticated: () => authManager.isAuthenticated()
  };
}