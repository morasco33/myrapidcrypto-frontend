/**
 * Secure Authentication Module v4.2
 * Implements OWASP best practices for frontend authentication
 */
(function secureAuthModule() {
  'use strict';

  // ======================
  // CONFIGURATION
  // ======================
  const CONFIG = {
    IS_PRODUCTION: window.location.protocol === 'https:',
    API_BASE_URL: window.API_BASE_URL || (
      window.location.hostname === 'localhost'
        ? 'http://localhost:5550/api'
        : 'https://rapidcrypto-backend.onrender.com'
    ),
    AUTH_STORAGE_KEY: 'app_auth_v4',
    USER_STORAGE_KEY: 'app_user_v4',
    SESSION_TIMEOUT: 60 * 60 * 1000, // 1 hour
    REQUEST_TIMEOUT: 10000, // 10 seconds
    MAX_RETRIES: 2,
    MIN_PASSWORD_LENGTH: 6
  };

  // ======================
  // STATE
  // ======================
  const state = {
    authToken: null,
    userData: null,
    csrfToken: generateCSRFToken(),
    pendingRequests: new Map()
  };

  // ======================
  // DOM ELEMENTS
  // ======================
  const elements = {
    loginForm: document.getElementById('loginForm'),
    emailInput: document.getElementById('email'),
    passwordInput: document.getElementById('password'),
    submitButton: document.getElementById('submitBtn'),
    loginMessage: document.getElementById('loginMessage'),
    otpSection: document.getElementById('otpSection'),
    resendVerificationSection: document.getElementById('resendVerificationSection'),
    resendVerificationBtn: document.getElementById('resendVerificationBtn'),
    resendMessage: document.getElementById('resendMessage')
  };

  // ======================
  // INITIALIZATION
  // ======================
  document.addEventListener('DOMContentLoaded', () => {
    if (!validateEnvironment()) {
      displayFatalError('Security violation: Invalid environment');
      return;
    }
    if (!validateElements()) {
      displayFatalError('Security violation: Critical elements missing');
      return;
    }
    setupEventHandlers();
    checkExistingSession();
  });

  // ======================
  // VALIDATION & ENVIRONMENT CHECK
  // ======================
  function validateEnvironment() {
    try {
      if (CONFIG.IS_PRODUCTION && window.location.protocol !== 'https:') {
        throw new Error('Production must use HTTPS');
      }
      if (!CONFIG.API_BASE_URL || (CONFIG.IS_PRODUCTION && CONFIG.API_BASE_URL.includes('localhost'))) {
        throw new Error('Invalid API configuration');
      }
      return true;
    } catch (err) {
      console.error(err);
      return false;
    }
  }

  function validateElements() {
    return [elements.loginForm, elements.emailInput, elements.passwordInput, elements.submitButton, elements.loginMessage].every(el => el !== null);
  }

  // ======================
  // EVENT HANDLERS SETUP
  // ======================
  function setupEventHandlers() {
    elements.loginForm.addEventListener('submit', handleLogin);

    if (elements.resendVerificationBtn) {
      elements.resendVerificationBtn.addEventListener('click', handleResendVerification);
    }

    window.addEventListener('beforeunload', () => {
      clearPasswordField();
    });
  }

  // ======================
  // LOGIN HANDLER
  // ======================
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

    try {
      const response = await fetch(`${CONFIG.API_BASE_URL}/auth/login`, {

        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email, password }),
        credentials: 'include'
    });
    

      const data = await parseResponse(response);

      if (data.needsVerification) {
        displayError('Account requires email verification.');
        showVerificationUI();
        return;
      }

      if (data.success) {
        storeSession(data);
        displayStatus('Authentication successful. Redirecting...');
        redirectToDashboard();
        return;
      }

      displayError(data.message || 'Authentication failed.');
    } catch (err) {
      handleAuthError(err);
    } finally {
      clearPasswordField();
      enableForm();
    }
  }

  // ======================
  // RESEND VERIFICATION
  // ======================
  async function handleResendVerification() {
    clearResendMessage();
    disableResendButton();

    displayResendMessage('Sending verification email...');

    try {
      const response = await secureFetch(`${CONFIG.API_BASE_URL}/auth/resend-verification`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: elements.emailInput.value.trim() }),
        credentials: 'include'
      });

      const data = await parseResponse(response);

      if (data.success) {
        displayResendMessage('Verification email sent.');
      } else {
        displayResendMessage(data.message || 'Failed to send verification email.');
      }
    } catch (err) {
      displayResendMessage('Network error. Please try again.');
    } finally {
      enableResendButton();
    }
  }

  // ======================
  // FETCH & RESPONSE UTILS
  // ======================
  async function secureFetch(url, options, retryCount = 0) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), CONFIG.REQUEST_TIMEOUT);

    const requestId = generateRequestId();
    state.pendingRequests.set(requestId, controller);

    try {
      const response = await fetch(url, { ...options, signal: controller.signal });

      if (response.status === 401) {
        clearSession();
        throw new Error('Session expired');
      }
      if (response.status >= 500) {
        throw new Error('Server error');
      }

      return response;
    } catch (err) {
      if (err.name === 'AbortError' && retryCount < CONFIG.MAX_RETRIES) {
        return secureFetch(url, options, retryCount + 1);
      }
      throw err;
    } finally {
      clearTimeout(timeoutId);
      state.pendingRequests.delete(requestId);
    }
  }

  async function parseResponse(response) {
    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      throw new Error('Invalid server response');
    }

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || 'Request failed');
    }
    return data;
  }

  // ======================
  // SESSION MANAGEMENT
  // ======================
  function storeSession({ token, user }) {
    state.authToken = token;
    state.userData = user;

    sessionStorage.setItem(CONFIG.USER_STORAGE_KEY, JSON.stringify({
      id: user.id,
      email: user.email,
      verified: user.verified,
      expires: Date.now() + CONFIG.SESSION_TIMEOUT
    }));
  }

  function clearSession() {
    state.authToken = null;
    state.userData = null;
    sessionStorage.removeItem(CONFIG.USER_STORAGE_KEY);

    // Optionally notify backend
    secureFetch(`${CONFIG.API_BASE_URL}/auth/logout`, {
      method: 'POST',
      credentials: 'include'
    }).catch(() => {});
  }

  // ======================
  // VALIDATION
  // ======================
  function validateCredentials(email, password) {
    if (!email || !password) {
      displayError('All fields are required.');
      return false;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      displayError('Please enter a valid email address.');
      return false;
    }
    if (password.length < CONFIG.MIN_PASSWORD_LENGTH) {
      displayError(`Password must be at least ${CONFIG.MIN_PASSWORD_LENGTH} characters.`);
      return false;
    }
    return true;
  }

  // ======================
  // UI HELPERS
  // ======================
  function displayStatus(msg) {
    if (!elements.loginMessage) return;
    elements.loginMessage.textContent = msg;
    elements.loginMessage.classList.remove('error');
    elements.loginMessage.classList.add('status');
  }

  function displayError(msg) {
    if (!elements.loginMessage) return;
    elements.loginMessage.textContent = msg;
    elements.loginMessage.classList.remove('status');
    elements.loginMessage.classList.add('error');
  }

  function clearMessage() {
    if (!elements.loginMessage) return;
    elements.loginMessage.textContent = '';
    elements.loginMessage.className = '';
  }

  function disableForm() {
    if (!elements.submitButton) return;
    elements.submitButton.disabled = true;
    elements.submitButton.innerHTML = `<span class="spinner-border spinner-border-sm" aria-hidden="true"></span> Securing...`;
  }

  function enableForm() {
    if (!elements.submitButton) return;
    elements.submitButton.disabled = false;
    elements.submitButton.innerHTML = `<i class="fas fa-sign-in-alt"></i> Login`;
  }

  function clearPasswordField() {
    if (elements.passwordInput) {
      elements.passwordInput.value = '';
    }
  }

  function redirectToDashboard() {
    window.location.href = '/dashboard';
  }

  function showVerificationUI() {
    if (elements.otpSection) elements.otpSection.style.display = 'block';
    if (elements.resendVerificationSection) elements.resendVerificationSection.style.display = 'block';
  }

  function displayResendMessage(msg) {
    if (!elements.resendMessage) return;
    elements.resendMessage.textContent = msg;
  }

  function clearResendMessage() {
    if (!elements.resendMessage) return;
    elements.resendMessage.textContent = '';
  }

  function disableResendButton() {
    if (elements.resendVerificationBtn) {
      elements.resendVerificationBtn.disabled = true;
    }
  }

  function enableResendButton() {
    if (elements.resendVerificationBtn) {
      elements.resendVerificationBtn.disabled = false;
    }
  }

  // ======================
  // ERROR HANDLING
  // ======================
  function handleAuthError(err) {
    console.error('Authentication error:', err);

    let message = 'Authentication failed. Please check your credentials.';
    if (err.message.includes('Failed to fetch')) {
      message = 'Network error. Please check your connection.';
    } else if (err.message.includes('Server error')) {
      message = 'Temporary server issue. Please try again later.';
    }
    displayError(message);
  }

  // ======================
  // SESSION CHECK
  // ======================
  function checkExistingSession() {
    try {
      const sessionData = sessionStorage.getItem(CONFIG.USER_STORAGE_KEY);
      if (!sessionData) return;

      const { id, email, verified, expires } = JSON.parse(sessionData);
      if (expires > Date.now()) {
        state.userData = { id, email, verified };
        redirectToDashboard();
      } else {
        clearSession();
      }
    } catch (err) {
      console.error('Session check failed:', err);
      clearSession();
    }
  }

  // ======================
  // SECURITY UTILITIES
  // ======================
  function generateCSRFToken() {
    const array = new Uint32Array(10);
    window.crypto.getRandomValues(array);
    return Array.from(array, dec => dec.toString(36)).join('');
  }

  function generateRequestId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2);
  }

})(); 