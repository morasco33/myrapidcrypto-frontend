// --- START OF REWRITTEN login.js ---
/**
 * Secure Authentication Module v4.3 (Revised for auth.js compatibility)
 */
(function secureAuthModule() {
  'use strict';

  // CONFIGURATION (align keys with auth.js if possible, or use auth.js directly for storage)
  const CONFIG = {
    IS_PRODUCTION: window.location.protocol === 'https:',
    API_BASE_URL: window.API_BASE_URL || ( // Picks up from HTML or defaults
      (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
        ? 'http://localhost:3001/api' 
        : 'https://rapidcrypto-backend.onrender.com/api'
    ),
    // Keys used by auth.js (for writing after successful login)
    AUTH_JS_TOKEN_KEY: 'cryptohub_auth_token',
    AUTH_JS_USER_INFO_KEY: 'cryptohub_user_info',
    // Key for this script's own session check (can be sessionStorage to avoid conflicts during login flow)
    LOGIN_SESSION_CHECK_KEY: 'app_login_session_v4_status', // Temporary flag for redirect
    SESSION_TIMEOUT_MS: 60 * 60 * 1000, // 1 hour for the temporary flag
    REQUEST_TIMEOUT: 30000, 
    MAX_RETRIES: 1,
    MIN_PASSWORD_LENGTH: 6
  };

  const elements = {
    loginForm: document.getElementById('loginForm'),
    emailInput: document.getElementById('email'),
    passwordInput: document.getElementById('password'),
    submitButton: document.getElementById('submitBtn'),
    loginMessage: document.getElementById('loginMessage'),
    resendVerificationSection: document.getElementById('resendVerificationSection'),
    resendVerificationBtn: document.getElementById('resendVerificationBtn'),
    resendMessage: document.getElementById('resendMessage')
  };

  document.addEventListener('DOMContentLoaded', () => {
    if (!validateEnvironment()) {
      displayFatalError('Security violation: Invalid environment');
      return;
    }
    if (!validateElements()) return;
    
    setupEventHandlers();
    // This check is to prevent re-showing login form if auth.js already decided user is logged in
    // and is trying to redirect to dashboard.
    // If auth.js is active, its checkAuthState might have already redirected.
    // This check is a failsafe *if* the user lands here despite being logged in via localStorage.
    checkIfAlreadyLoggedInByAuthJs(); 
  });

  function checkIfAlreadyLoggedInByAuthJs() {
    // Check if auth.js would consider the user logged in
    if (localStorage.getItem(CONFIG.AUTH_JS_TOKEN_KEY)) {
        console.log('LOGIN.JS: Detected existing token via AUTH_JS_TOKEN_KEY. auth.js should handle redirect.');
        // Potentially hide login form or show "Redirecting..."
        // but auth.js's checkAuthState should fire and redirect.
        // If somehow auth.js hasn't redirected yet, this could force it:
        // window.location.href = '/dashboard.html'; 
        // However, this might cause a double redirect if auth.js is also doing it.
        // Best to let auth.js handle its own redirect from auth pages if token exists.
    }
  }


  function validateEnvironment() { /* ... (keep your existing validateEnvironment) ... */ 
    try {
      if (CONFIG.IS_PRODUCTION && window.location.protocol !== 'https:') {
        throw new Error('Production environment must use HTTPS.');
      }
      if (!CONFIG.API_BASE_URL || (CONFIG.IS_PRODUCTION && (CONFIG.API_BASE_URL.includes('localhost') || CONFIG.API_BASE_URL.startsWith('http:')))) {
        throw new Error('Invalid API configuration for the current environment.');
      }
      return true;
    } catch (err) {
      console.error("Environment validation failed:", err.message);
      return false;
    }
  }

  function validateElements() { /* ... (keep your existing validateElements) ... */ 
    const criticalElements = [elements.loginForm, elements.emailInput, elements.passwordInput, elements.submitButton, elements.loginMessage];
    if (criticalElements.some(el => !el)) {
        console.error("Fatal Error: One or more critical login DOM elements are missing.");
        if (elements.loginMessage) { 
            displayError('Page setup error. Please contact support.', elements.loginMessage);
        }
        return false; 
    }
    return true; 
  }
  
  function displayFatalError(message) { /* ... (keep your existing displayFatalError) ... */
    if (elements.loginMessage) {
        elements.loginMessage.textContent = message;
        elements.loginMessage.className = 'error';
    } else {
        alert(message); 
    }
    if(elements.loginForm) elements.loginForm.style.display = 'none'; 
  }


  function setupEventHandlers() {
    if (elements.loginForm) {
      elements.loginForm.addEventListener('submit', handleLogin);
    }
    if (elements.resendVerificationBtn) {
      elements.resendVerificationBtn.addEventListener('click', handleResendVerification);
    }
    window.addEventListener('beforeunload', clearPasswordField);
  }

  async function handleLogin(event) {
    event.preventDefault();
    clearMessage(elements.loginMessage);
    if (elements.resendVerificationSection) elements.resendVerificationSection.style.display = 'none';

    disableForm();
    const email = elements.emailInput.value.trim();
    const password = elements.passwordInput.value;

    if (!validateCredentials(email, password)) {
      enableForm();
      return;
    }
    displayStatus('Verifying credentials...', elements.loginMessage);

    try {
      const response = await secureFetch(`${CONFIG.API_BASE_URL}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await parseResponse(response); // data contains { token, user }

      if (data.success) {
        // SUCCESS: Store session using auth.js's keys and localStorage
        localStorage.setItem(CONFIG.AUTH_JS_TOKEN_KEY, data.token);
        localStorage.setItem(CONFIG.AUTH_JS_USER_INFO_KEY, JSON.stringify(data.user));
        
        // Optional: Set a temporary flag for this script's own redirect logic if needed,
        // but primary state is now in localStorage for auth.js
        sessionStorage.setItem(CONFIG.LOGIN_SESSION_CHECK_KEY, JSON.stringify({
            loggedIn: true,
            expires: Date.now() + CONFIG.SESSION_TIMEOUT_MS
        }));

        displayStatus('Authentication successful. Redirecting...', elements.loginMessage);
        redirectToDashboard();
      } else {
        // Should be caught by parseResponse throwing for non-ok, but as fallback
        displayError(data.message || 'Authentication failed (unexpected).', elements.loginMessage);
      }
    } catch (err) {
      if (err.needsVerification) {
        displayError(err.message || 'Account requires email verification.', elements.loginMessage);
        showVerificationUI(email);
      } else {
        handleAuthError(err, 'Login', elements.loginMessage);
      }
    } finally {
      clearPasswordField();
      enableForm();
    }
  }

  async function handleResendVerification() { /* ... (keep your existing handleResendVerification) ... */ 
    clearMessage(elements.resendMessage);
    disableResendButton();

    const email = elements.emailInput.value.trim(); 
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        displayMessage('Please enter a valid email in the email field above.', elements.resendMessage, 'error');
        enableResendButton();
        return;
    }
    displayMessage('Sending verification email...', elements.resendMessage, 'status');
    try {
      const response = await secureFetch(`${CONFIG.API_BASE_URL}/resend-verification-email`, { 
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email }),
      });
      const data = await parseResponse(response); 
      if (data.success) {
        displayMessage(data.message || 'Verification email sent. Please check your inbox.', elements.resendMessage, 'status');
      } else {
        displayMessage(data.message || 'Failed to send verification email.', elements.resendMessage, 'error');
      }
    } catch (err) {
      handleAuthError(err, 'Resend Verification', elements.resendMessage);
    } finally {
      enableResendButton();
    }
  }

  async function secureFetch(url, options, retryCount = 0) { /* ... (keep your existing secureFetch) ... */
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), CONFIG.REQUEST_TIMEOUT);
    const requestId = Math.random().toString(36).substring(2); 
    // state.pendingRequests.set(requestId, controller); // state object removed for simplicity here, can be added back if needed

    try {
      const fetchOptions = { ...options, signal: controller.signal };
      const response = await fetch(url, fetchOptions);
      clearTimeout(timeoutId);
      // state.pendingRequests.delete(requestId);

      if (!response.ok) {
        let errorData;
        try {
          errorData = await response.json();
        } catch (e) {
          errorData = { message: `Server responded with status: ${response.status}` };
        }
        const error = new Error(errorData.message || `HTTP error ${response.status}`);
        error.status = response.status;
        error.data = errorData; 
        if (response.status === 403 && errorData.needsVerification) {
            error.message = errorData.message || "Email verification required.";
            error.needsVerification = true;
        }
        throw error;
      }
      return response; 
    } catch (err) {
      clearTimeout(timeoutId);
      // state.pendingRequests.delete(requestId);
      if (err.name === 'AbortError' && retryCount < CONFIG.MAX_RETRIES) {
        console.warn(`Request to ${url} timed out. Retrying (${retryCount + 1}/${CONFIG.MAX_RETRIES})...`);
        return secureFetch(url, options, retryCount + 1);
      }
      throw err;
    }
  }

  async function parseResponse(response) { /* ... (keep your existing parseResponse) ... */
    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      console.error('Server response was not JSON. Raw text:', await response.text());
      throw new Error('Invalid server response format. Expected JSON.');
    }
    return await response.json();
  }
  
  function validateCredentials(email, password) { /* ... (keep your existing validateCredentials) ... */
    if (!email || !password) {
      displayError('Email and password are required.', elements.loginMessage);
      return false;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      displayError('Please enter a valid email address.', elements.loginMessage);
      return false;
    }
    if (password.length < CONFIG.MIN_PASSWORD_LENGTH) {
      displayError(`Password must be at least ${CONFIG.MIN_PASSWORD_LENGTH} characters.`, elements.loginMessage);
      return false;
    }
    return true;
  }

  // --- UI HELPERS (keep existing displayMessage, displayStatus, displayError, clearMessage, disableForm, enableForm, clearPasswordField) ---
  function displayMessage(msg, element, type = 'status') { if (!element) return; element.textContent = msg; element.className = type; }
  function displayStatus(msg, element) { displayMessage(msg, element, 'status'); }
  function displayError(msg, element) { displayMessage(msg, element, 'error'); }
  function clearMessage(element) { if (!element) return; element.textContent = ''; element.className = ''; }
  function disableForm() { if (elements.submitButton) { elements.submitButton.disabled = true; elements.submitButton.innerHTML = `<span class="spinner-border spinner-border-sm" aria-hidden="true"></span> Logging In...`; } if (elements.emailInput) elements.emailInput.disabled = true; if (elements.passwordInput) elements.passwordInput.disabled = true; }
  function enableForm() { if (elements.submitButton) { elements.submitButton.disabled = false; elements.submitButton.innerHTML = `<i class="fas fa-sign-in-alt"></i> Login`; } if (elements.emailInput) elements.emailInput.disabled = false; if (elements.passwordInput) elements.passwordInput.disabled = false; }
  function clearPasswordField() { if (elements.passwordInput) elements.passwordInput.value = ''; }
  // --- END UI HELPERS ---

  function redirectToDashboard() {
    console.log('LOGIN.JS: Redirecting to dashboard. Token and UserInfo set in localStorage for auth.js.');
    // auth.js should now pick up the state on dashboard load.
    window.location.href = '/dashboard.html';
  }

  function showVerificationUI(email) { /* ... (keep your existing showVerificationUI) ... */
    if (elements.resendVerificationSection) {
      elements.resendVerificationSection.style.display = 'block';
    }
    if (email && elements.emailInput && !elements.emailInput.value) {
        elements.emailInput.value = email;
    }
  }
  function disableResendButton() { /* ... (keep your existing disableResendButton) ... */
    if (elements.resendVerificationBtn) {
      elements.resendVerificationBtn.disabled = true;
      elements.resendVerificationBtn.textContent = 'Sending...';
    }
  }
  function enableResendButton() { /* ... (keep your existing enableResendButton) ... */
    if (elements.resendVerificationBtn) {
      elements.resendVerificationBtn.disabled = false;
      elements.resendVerificationBtn.textContent = 'Resend Verification Email';
    }
  }

  function handleAuthError(err, context = 'Operation', messageElement) { /* ... (keep your existing handleAuthError) ... */
    console.error(`[${context} Error]:`, err.message, err.data || err);
    let displayMsg = err.message; 
    if (!displayMsg || displayMsg.toLowerCase().includes('failed to fetch') || displayMsg.toLowerCase().includes('networkerror')) {
      displayMsg = 'Network connection issue. Please check your internet and try again.';
    } else if (err.status >= 500 || displayMsg.toLowerCase().includes('server error')) {
      displayMsg = `A temporary server issue occurred (${context}). Please try again later.`;
    } else if (displayMsg === 'Request failed' || err.status) { 
       displayMsg = `${context} failed. Server responded: ${err.message || `Status ${err.status}`}`;
    }
    displayError(displayMsg, messageElement);
  }

})();
// --- END OF REWRITTEN login.js ---