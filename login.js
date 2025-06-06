// login.js
(function secureAuthModule() {
  'use strict';

  const CONFIG = {
    IS_PRODUCTION: window.location.protocol === 'https:',
    AUTH_STORAGE_KEY: 'app_auth_v4',
    USER_STORAGE_KEY: 'app_user_v4',
    SESSION_TIMEOUT: 60 * 60 * 1000,
    REQUEST_TIMEOUT: 10000,
    MAX_RETRIES: 2,
    MIN_PASSWORD_LENGTH: 6
  };

  const state = {
    authToken: null,
    userData: null,
    pendingRequests: new Map()
  };

  const elements = {
    emailInput: document.getElementById('email'),
    passwordInput: document.getElementById('password'),
    form: document.getElementById('loginForm'),
    messageBox: document.getElementById('messageBox')
  };

  function getApiBaseUrl() {
    if (window.API_BASE_URL) return window.API_BASE_URL;
    console.error("CRITICAL: window.API_BASE_URL is not set!");
    return CONFIG.IS_PRODUCTION ? 'https://your-production-api.com' : 'http://localhost:3001';
  }

  function validateCredentials(email, password) {
    if (!email || !password || password.length < CONFIG.MIN_PASSWORD_LENGTH) {
      displayError('Please enter a valid email and password.');
      return false;
    }
    return true;
  }

  function disableForm() {
    elements.emailInput.disabled = true;
    elements.passwordInput.disabled = true;
  }

  function enableForm() {
    elements.emailInput.disabled = false;
    elements.passwordInput.disabled = false;
  }

  function clearPasswordField() {
    elements.passwordInput.value = '';
  }

  function displayStatus(message) {
    elements.messageBox.textContent = message;
    elements.messageBox.style.color = 'green';
  }

  function displayError(message) {
    elements.messageBox.textContent = message;
    elements.messageBox.style.color = 'red';
  }

  function clearMessage() {
    elements.messageBox.textContent = '';
  }

  function redirectToDashboard() {
    window.location.href = 'dashboard.html';
  }

  function storeSession({ token, user }) {
    state.authToken = token;
    state.userData = user;

    sessionStorage.setItem(CONFIG.AUTH_STORAGE_KEY, token);
    sessionStorage.setItem(CONFIG.USER_STORAGE_KEY, JSON.stringify({
      userId: user._id,
      email: user.email,
      username: user.username,
      verified: user.verified,
      expires: Date.now() + CONFIG.SESSION_TIMEOUT
    }));
  }

  async function handleLogin(event) {
    event.preventDefault();
    clearMessage();
    disableForm();

    const email = elements.emailInput.value.trim();
    const password = elements.passwordInput.value;

    if (!validateCredentials(email, password)) {
      enableForm();
      return;
    }

    displayStatus('Verifying credentials...');
    const API_URL = getApiBaseUrl();

    try {
      const response = await fetch(`${API_URL}/api/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email, password })
      });

      const data = await response.json();

      if (!response.ok) {
        if (response.status === 403 && data.needsVerification) {
          displayError(data.message || 'Account requires email verification.');
          enableForm();
          clearPasswordField();
          return;
        }
        throw new Error(data.message || `Login failed: ${response.status}`);
      }

      if (data.token && data.user) {
        storeSession(data);
        displayStatus('Authentication successful. Redirecting...');
        redirectToDashboard();
      } else {
        displayError(data.message || 'Authentication succeeded, but data is missing.');
      }
    } catch (err) {
      displayError(err.message || 'Login failed. Please try again.');
    } finally {
      if (window.location.pathname.endsWith('login.html')) {
        clearPasswordField();
        enableForm();
      }
    }
  }

  document.addEventListener('DOMContentLoaded', function () {
    if (elements.form) {
      elements.form.addEventListener('submit', handleLogin);
    }
  });

})();
