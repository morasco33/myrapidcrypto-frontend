/**
 * Secure Authentication Module v4.3 (Revised)
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
      (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
        ? 'http://localhost:3001/api' // Assuming backend runs on 3001 locally (server.js default)
        : 'https://rapidcrypto-backend.onrender.com/api' // Your production backend
    ),
    AUTH_STORAGE_KEY: 'app_auth_v4', // Consider if this needs to be 'app_auth_v4_token' or similar
    USER_STORAGE_KEY: 'app_user_v4',
    SESSION_TIMEOUT: 60 * 60 * 1000, // 1 hour
    REQUEST_TIMEOUT: 15000, // 15 seconds
    MAX_RETRIES: 1, // Reduced default retries, can be 0 if not desired for login
    MIN_PASSWORD_LENGTH: 6
  };

  // ======================
  // STATE
  // ======================
  const state = {
    authToken: null, // This would be populated if login directly set it, or if token was stored and reloaded
    userData: null,
    // csrfToken: generateCSRFToken(), // CSRF token primarily for state-changing GET requests or form submissions not via JS fetch with JSON
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
    otpSection: document.getElementById('otpSection'), // Ensure this ID exists if used
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
      // Don't display fatal error for optional elements like OTP/resend if they aren't on all pages
      console.warn('One or more optional UI elements for login might be missing.');
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

  function validateElements() {
    // Critical elements for login form functionality
    const criticalElements = [elements.loginForm, elements.emailInput, elements.passwordInput, elements.submitButton, elements.loginMessage];
    if (criticalElements.some(el => !el)) {
        console.error("Fatal Error: One or more critical login DOM elements are missing.");
        if (elements.loginMessage) { // Attempt to display error if loginMessage itself exists
            displayError('Page setup error. Please contact support.', elements.loginMessage);
        }
        return false; // Indicate failure if critical elements are missing
    }
    return true; // All critical elements present
  }

  function displayFatalError(message) {
    // Simplified fatal error display
    if (elements.loginMessage) {
        elements.loginMessage.textContent = message;
        elements.loginMessage.className = 'error';
    } else {
        alert(message); // Fallback
    }
    if(elements.loginForm) elements.loginForm.style.display = 'none'; // Hide form
  }


  // ======================
  // EVENT HANDLERS SETUP
  // ======================
  function setupEventHandlers() {
    if (elements.loginForm) {
      elements.loginForm.addEventListener('submit', handleLogin);
    } else {
      console.error("Login form not found. Cannot attach submit handler.");
    }

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
        headers: {
            'Content-Type': 'application/json',
            // 'X-CSRF-Token': state.csrfToken // If using CSRF tokens for POSTs
        },
        body: JSON.stringify({ email, password }),
        // credentials: 'include' // Use if backend CORS Allow-Credentials is true and you need to send/receive cookies
      });

      // parseResponse will throw for non-ok responses, error is caught below
      const data = await parseResponse(response);

      if (data.success) {
        // Backend now also returns needsVerification:true on 403, which parseResponse would throw on.
        // So, this path is only for truly successful login.
        storeSession(data); // data contains { token, user }
        displayStatus('Authentication successful. Redirecting...', elements.loginMessage);
        redirectToDashboard();
        // No return needed here as redirectToDashboard navigates away
      } else {
        // This case might not be reached if parseResponse throws for all non-success backend responses.
        // However, if backend could send 200 OK with { success: false, message: "..." }
        displayError(data.message || 'Authentication failed. Please check server response.', elements.loginMessage);
      }

    } catch (err) {
        // This catch block handles errors from secureFetch (network, timeout)
        // or errors thrown by parseResponse (backend error messages)
        // or errors from the needsVerification flow.
      if (err.needsVerification) {
        displayError(err.message || 'Account requires email verification.', elements.loginMessage);
        showVerificationUI(email); // Pass email for resend
      } else {
        // General error handling using the message from the error object
        handleAuthError(err, 'Login', elements.loginMessage);
      }
    } finally {
      clearPasswordField();
      enableForm();
    }
  }

  // ======================
  // RESEND VERIFICATION
  // ======================
  async function handleResendVerification() {
    clearMessage(elements.resendMessage);
    disableResendButton();

    const email = elements.emailInput.value.trim(); // Get email from input
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        displayMessage('Please enter a valid email in the email field above.', elements.resendMessage, 'error');
        enableResendButton();
        return;
    }

    displayMessage('Sending verification email...', elements.resendMessage, 'status');

    try {
      const response = await secureFetch(`${CONFIG.API_BASE_URL}/resend-verification-email`, { // CORRECTED ENDPOINT
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email }),
      });

      const data = await parseResponse(response); // Will throw on error

      if (data.success) {
        displayMessage(data.message || 'Verification email sent. Please check your inbox.', elements.resendMessage, 'status');
      } else {
        // Should be caught by parseResponse throwing, but as a fallback:
        displayMessage(data.message || 'Failed to send verification email.', elements.resendMessage, 'error');
      }
    } catch (err) {
      handleAuthError(err, 'Resend Verification', elements.resendMessage);
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

    const requestId = Math.random().toString(36).substring(2); // Simpler request ID
    state.pendingRequests.set(requestId, controller);

    try {
      const fetchOptions = { ...options, signal: controller.signal };
      // If your server needs credentials (cookies, auth headers) for this specific call:
      // if (options.credentials === 'include') fetchOptions.credentials = 'include';
      
      const response = await fetch(url, fetchOptions);
      clearTimeout(timeoutId);
      state.pendingRequests.delete(requestId);

      if (!response.ok) {
        // Attempt to parse error response for a message from backend
        let errorData;
        try {
          errorData = await response.json();
        } catch (e) {
          // Not JSON or empty response
          errorData = { message: `Server responded with status: ${response.status}` };
        }
        
        const error = new Error(errorData.message || `HTTP error ${response.status}`);
        error.status = response.status;
        error.data = errorData; // Attach full error data if available

        // Specific handling for 403 - needs verification
        if (response.status === 403 && errorData.needsVerification) {
            error.message = errorData.message || "Email verification required.";
            error.needsVerification = true;
        }
        throw error;
      }
      return response; // Return the whole response for further processing

    } catch (err) {
      clearTimeout(timeoutId);
      state.pendingRequests.delete(requestId);

      if (err.name === 'AbortError' && retryCount < CONFIG.MAX_RETRIES) {
        console.warn(`Request to ${url} timed out. Retrying (${retryCount + 1}/${CONFIG.MAX_RETRIES})...`);
        return secureFetch(url, options, retryCount + 1);
      }
      // Re-throw other errors (including AbortError after max retries or actual HTTP errors)
      throw err;
    }
  }

  async function parseResponse(response) {
    // secureFetch now ensures response.ok is true, or throws an error.
    // So, we just need to parse the JSON.
    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      // This case should ideally be handled by backend sending correct Content-Type
      // or secureFetch identifying non-JSON error response.
      console.error('Server response was not JSON. Raw text:', await response.text());
      throw new Error('Invalid server response format. Expected JSON.');
    }

    return await response.json();
  }


  // ======================
  // SESSION MANAGEMENT
  // ======================
  function storeSession(data) { // data = { token, user (with _id), ... }
    state.authToken = data.token; // Store token in state if needed for immediate subsequent requests
    
    // Normalize user data for consistent use in state.userData
    state.userData = {
        id: data.user._id, // Use _id from backend
        email: data.user.email,
        username: data.user.username,
        verified: data.user.verified,
        // any other frequently accessed, non-sensitive data
    };

    // Store essential, non-sensitive user info and expiry for session checking
    sessionStorage.setItem(CONFIG.USER_STORAGE_KEY, JSON.stringify({
      // Storing _id as 'id' in session storage for consistency if preferred,
      // or store as '_id' and retrieve as '_id'. Let's use 'id'.
      id: data.user._id,
      email: data.user.email,
      username: data.user.username, // Good to have for quick display
      verified: data.user.verified,
      expires: Date.now() + CONFIG.SESSION_TIMEOUT
    }));

    // Optionally, store the auth token if your app reloads it from sessionStorage on init
    // For a Single Page App that doesn't fully reload, state.authToken might be enough.
    // If full page reloads happen and you need the token without re-login:
    // sessionStorage.setItem(CONFIG.AUTH_STORAGE_KEY, data.token);
  }

  function clearSession() {
    state.authToken = null;
    state.userData = null;
    sessionStorage.removeItem(CONFIG.USER_STORAGE_KEY);
    sessionStorage.removeItem(CONFIG.AUTH_STORAGE_KEY); // If you store token separately

    // Optionally notify backend (fire and forget)
    secureFetch(`${CONFIG.API_BASE_URL}/logout`, { // Assuming a /logout endpoint exists
      method: 'POST',
      // credentials: 'include' // if your logout needs cookies
    }).catch(err => console.warn('Logout notification to backend failed:', err.message));
  }

  function checkExistingSession() {
    try {
      const sessionDataString = sessionStorage.getItem(CONFIG.USER_STORAGE_KEY);
      if (!sessionDataString) return;

      const sessionData = JSON.parse(sessionDataString);
      
      // Validate expected properties
      if (sessionData.id && sessionData.email && typeof sessionData.verified !== 'undefined' && sessionData.expires) {
        if (sessionData.expires > Date.now()) {
          // Session is valid, restore state (partially, token might need separate handling if stored)
          state.userData = {
            id: sessionData.id,
            email: sessionData.email,
            username: sessionData.username,
            verified: sessionData.verified
          };
          // const token = sessionStorage.getItem(CONFIG.AUTH_STORAGE_KEY);
          // if (token) state.authToken = token;

          console.log('Active session found. Redirecting to dashboard.');
          redirectToDashboard();
        } else {
          console.log('Session expired. Clearing.');
          clearSession();
        }
      } else {
        console.warn('Invalid session data structure in storage. Clearing.');
        clearSession();
      }
    } catch (err) {
      console.error('Session check failed:', err.message, '. Clearing session.');
      clearSession(); // Clear corrupted session data
    }
  }

  // ======================
  // VALIDATION
  // ======================
  function validateCredentials(email, password) {
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

  // ======================
  // UI HELPERS
  // ======================
  function displayMessage(msg, element, type = 'status') { // type can be 'status' or 'error'
    if (!element) return;
    element.textContent = msg;
    element.className = type; // Assumes CSS classes 'status' and 'error' exist
  }

  function displayStatus(msg, element) {
    displayMessage(msg, element, 'status');
  }

  function displayError(msg, element) {
    displayMessage(msg, element, 'error');
  }
  
  function clearMessage(element) {
    if (!element) return;
    element.textContent = '';
    element.className = '';
  }

  function disableForm() {
    if (elements.submitButton) {
      elements.submitButton.disabled = true;
      // Keep existing spinner logic or adapt
      elements.submitButton.innerHTML = `<span class="spinner-border spinner-border-sm" aria-hidden="true"></span> Logging In...`;
    }
    if (elements.emailInput) elements.emailInput.disabled = true;
    if (elements.passwordInput) elements.passwordInput.disabled = true;
  }

  function enableForm() {
    if (elements.submitButton) {
      elements.submitButton.disabled = false;
      elements.submitButton.innerHTML = `<i class="fas fa-sign-in-alt"></i> Login`;
    }
    if (elements.emailInput) elements.emailInput.disabled = false;
    if (elements.passwordInput) elements.passwordInput.disabled = false;
  }

  function clearPasswordField() {
    if (elements.passwordInput) {
      elements.passwordInput.value = '';
    }
  }

  function redirectToDashboard() {
    // Consider adding base path if your app is not at the root
    window.location.href = '/dashboard.html'; // Or '/dashboard' if using a router that handles this
  }

  function showVerificationUI(email) {
    // If OTP section is present, make it visible.
    // if (elements.otpSection) elements.otpSection.style.display = 'block';
    
    // Show resend verification section
    if (elements.resendVerificationSection) {
      elements.resendVerificationSection.style.display = 'block';
    }
    // Pre-fill email for resend if it's not already filled, or ensure it's correct
    if (email && elements.emailInput && !elements.emailInput.value) {
        elements.emailInput.value = email;
    }
  }

  function disableResendButton() {
    if (elements.resendVerificationBtn) {
      elements.resendVerificationBtn.disabled = true;
      elements.resendVerificationBtn.textContent = 'Sending...';
    }
  }

  function enableResendButton() {
    if (elements.resendVerificationBtn) {
      elements.resendVerificationBtn.disabled = false;
      elements.resendVerificationBtn.textContent = 'Resend Verification Email';
    }
  }

  // ======================
  // ERROR HANDLING
  // ======================
  function handleAuthError(err, context = 'Operation', messageElement) {
    console.error(`[${context} Error]:`, err.message, err.data || err);
    let displayMsg = err.message; // Prioritize message from Error object (could be from backend)

    // Fallback for very generic errors or if err.message is unhelpful
    if (!displayMsg || displayMsg.toLowerCase().includes('failed to fetch') || displayMsg.toLowerCase().includes('networkerror')) {
      displayMsg = 'Network connection issue. Please check your internet and try again.';
    } else if (err.status >= 500 || displayMsg.toLowerCase().includes('server error')) {
      displayMsg = `A temporary server issue occurred (${context}). Please try again later.`;
    } else if (displayMsg === 'Request failed' || err.status) { // Default for other HTTP errors if message isn't specific enough
       displayMsg = `${context} failed. Server responded: ${err.message || `Status ${err.status}`}`;
    }
    // If err.message was specific (e.g., "Invalid credentials."), it will be used.
    displayError(displayMsg, messageElement);
  }

  // ======================
  // SECURITY UTILITIES (CSRF might be needed if not using Bearer tokens for all state changes)
  // ======================
  // function generateCSRFToken() { /* ... */ } // Keep if used

})();