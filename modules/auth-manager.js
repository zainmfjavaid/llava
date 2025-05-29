// auth-manager.js - Authentication management
// Toggle production vs development API endpoint
const is_production = true; // set to true in production builds
const API_BASE_URL = is_production
  ? 'https://api.llava.io/v1'
  : 'http://localhost:9000/v1';

class AuthManager {
  constructor() {
    this.currentUser = null;
    this.loadStoredUser();
  }

  loadStoredUser() {
    try {
      const stored = localStorage.getItem('llava_user');
      if (stored) {
        this.currentUser = JSON.parse(stored);
      }
    } catch (error) {
      console.error('Error loading stored user:', error);
      localStorage.removeItem('llava_user');
    }
  }

  saveUser(user) {
    this.currentUser = user;
    localStorage.setItem('llava_user', JSON.stringify(user));
  }

  clearUser() {
    this.currentUser = null;
    localStorage.removeItem('llava_user');
  }

  isAuthenticated() {
    return this.currentUser !== null;
  }

  getCurrentUser() {
    return this.currentUser;
  }

  async register(name, email, password) {
    try {
      const response = await fetch(`${API_BASE_URL}/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name, email, password }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Registration failed');
      }

      const user = await response.json();
      this.saveUser(user);
      return user;
    } catch (error) {
      console.error('Registration error:', error);
      throw error;
    }
  }

  async login(email, password) {
    try {
      const response = await fetch(`${API_BASE_URL}/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Login failed');
      }

      const user = await response.json();
      this.saveUser(user);
      return user;
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    }
  }

  logout() {
    this.clearUser();
  }
}

// Create singleton instance
export const authManager = new AuthManager();

// API helper functions for authenticated requests
export async function authenticatedFetch(url, options = {}) {
  const user = authManager.getCurrentUser();
  if (!user) {
    throw new Error('User not authenticated');
  }

  // Don't set Content-Type for FormData, let the browser set it with boundary
  const headers = {};
  if (!(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }
  
  // Merge with any existing headers
  Object.assign(headers, options.headers);

  return fetch(url, {
    ...options,
    headers,
  });
}

export { AuthManager };