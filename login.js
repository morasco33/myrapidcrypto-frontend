// login.js

(function secureAuthModule() {
  'use strict';

  // ======================
  // CONFIGURATION
  // ======================
  const CONFIG = {
    IS_PRODUCTION: window.location.protocol === 'https:',
    // API_BASE_URL will be taken directly from window.API_BASE_URL
    // Ensure window.API_BASE_URL is set in login.html correctly
    // e.g., <script>window.API_BASE_URL = "https://rapidcrypto-backend.onrender.com";</script>
    AUTH_STORAGE_KEY: 'app_auth_v4', // Consider renaming if it clashes with other scripts
    USER_STORAGE_KEY: 'app_user_v4', // Consider renaming
    SESSION_TIMEOUT: 60 * 60 * 1000, // 1 hour
    REQUEST_TIMEOUT: 10000, // 10 seconds
    MAX_RETRIES: 2,
    MIN_PASSWORD_LENGTH: 6 // This should match backend validation if any
  };

  // Helper to get the API base URL, ensuring it's defined
  function getApiBaseUrl() {
    if (window.API_BASE_URL) {
      return window.API_BASE_URL;
    }
    // Fallback if not set, but this indicates an issue in HTML setup
    console.error("CRITICAL: window.API_BASE_URL is not set!");
    return CONFIG.IS_PRODUCTION ? 'https://famous-scone-fcd9cb.netlify.app' : 'http://localhost:3001'; // Local backend port is 3001
  }


  // ... (rest of your state, elements, initialization) ...

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
    const API_URL = getApiBaseUrl(); // Get the base URL

    try {
      // ***** MODIFIED FETCH URL *****
      const response = await fetch(`${API_URL}/api/login`, { // Assuming API_BASE_URL does NOT end with /api
                                                          // If API_BASE_URL IS like '...onrender.com/api', then use `${API_URL}/login`
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
            // 'X-CSRF-Token': state.csrfToken // If you implement CSRF protection on backend
        },
        body: JSON.stringify({ email, password }),
        // credentials: 'include' // Keep if CORS on backend is set to credentials: true
                                // and you intend to use cookies for anything (though JWT is primary here)
      });

      // const data = await parseResponse(response); // parseResponse already checks response.ok
      // Let's adjust to align with how backend sends errors for needsVerification
      const data = await response.json(); // Get JSON regardless of status first

      if (!response.ok) {
        // Handle specific backend error for 'needsVerification'
        if (response.status === 403 && data.needsVerification) {
          displayError(data.message || 'Account requires email verification.');
          showVerificationUI();
          enableForm(); // Re-enable form after showing verification UI
          clearPasswordField();
          return;
        }
        // For other errors
        throw new Error(data.message || `Request failed with status ${response.status}`);
      }

      // If response.ok is true, it means login was successful (status 200)
      // The backend sends {success:true, token, user}
      if (data.token && data.user) { // Check for token and user explicitly
        storeSession(data); // data already contains token and user
        displayStatus('Authentication successful. Redirecting...');
        redirectToDashboard();
        // No return needed here as redirectToDashboard navigates away
      } else {
        // This case should ideally not happen if backend sends correct 200 response
        displayError(data.message || 'Authentication successful, but required data missing.');
      }

    } catch (err) {
      handleAuthError(err); // This will display the error
    } finally {
      // Enable form and clear password only if not redirected
      if (window.location.pathname.endsWith('login.html')) { // Or a more robust check
         clearPasswordField();
         enableForm();
      }
    }
  }

  // ======================
  // RESEND VERIFICATION
  // ======================
  async function handleResendVerification() {
    clearResendMessage();
    disableResendButton();
    displayResendMessage('Sending verification email...');
    const API_URL = getApiBaseUrl();

    try {
      // ***** MODIFIED SECUREFETCH URL *****
      const response = await secureFetch(`${API_URL}/api/resend-verification-email`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
            // 'X-CSRF-Token': state.csrfToken
        },
        body: JSON.stringify({ email: elements.emailInput.value.trim() }),
        // credentials: 'include'
      });

      const data = await parseResponse(response); // parseResponse expects response.ok

      // Backend sends {success:true, message: '...'} on 200
      // parseResponse will throw if not response.ok, so if we reach here, it's a success from backend perspective
      displayResendMessage(data.message || 'Verification email sent if account exists and is unverified.');

    } catch (err) {
      // err.message might come from parseResponse or secureFetch itself
      displayResendMessage(err.message || 'Network error or server issue. Please try again.');
    } finally {
      enableResendButton();
    }
  }

  // ...

  // ======================
  // FETCH & RESPONSE UTILS
  // ======================
  async function secureFetch(url, options, retryCount = 0) {
    // ... your existing secureFetch ...
    // Ensure Authorization header is added if state.authToken exists and is needed for the request
    // For resend-verification, it's likely unauthenticated, so no token needed.
    const fetchOptions = { ...options };
    // if (state.authToken && !options.headers?.Authorization) { // Example: Add token if not already present
    //   fetchOptions.headers = { ...fetchOptions.headers, 'Authorization': `Bearer ${state.authToken}` };
    // }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), CONFIG.REQUEST_TIMEOUT);

    const requestId = generateRequestId();
    state.pendingRequests.set(requestId, controller);

    try {
      const response = await fetch(url, { ...fetchOptions, signal: controller.signal });

      clearTimeout(timeoutId); // Clear timeout as soon as response starts
      state.pendingRequests.delete(requestId);


      // This check might be too broad for 401 if a specific request can return 401 for other reasons
      // For login/register, a 401 is an expected error, not a session expiry.
      // if (response.status === 401 && url !== `${getApiBaseUrl()}/api/login`) { // Don't clear session on login 401
      //   clearSession(); // This would log the user out if any authenticated request gets a 401
      //   throw new Error('Session expired or unauthorized.');
      // }

      // Server error check is good
      if (response.status >= 500) {
        throw new Error(`Server error: ${response.status}`);
      }

      return response; // Return the raw response for parseResponse to handle
    } catch (err) {
      clearTimeout(timeoutId); // Ensure timeout is cleared on error too
      state.pendingRequests.delete(requestId);
      if ((err.name === 'AbortError' || err.message.includes('NetworkError')) && retryCount < CONFIG.MAX_RETRIES) { // More specific retry
        console.warn(`Retrying request to ${url}, attempt ${retryCount + 1}`);
        await new Promise(resolve => setTimeout(resolve, 1000 * (retryCount + 1))); // Exponential backoff
        return secureFetch(url, options, retryCount + 1);
      }
      throw err; // Re-throw other errors
    }
  }

  async function parseResponse(response) {
    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      // For non-JSON error pages from server (e.g. HTML error page for 500)
      const text = await response.text();
      throw new Error(`Invalid server response (not JSON): ${response.status}. Body: ${text.substring(0,100)}`);
    }

    const data = await response.json();

    if (!response.ok) { // e.g. 400, 401, 403 from backend sending JSON error
      throw new Error(data.message || `Request failed with status ${response.status}`);
    }
    // If response.ok, data should be the success payload
    return data;
  }


  // ======================
  // SESSION MANAGEMENT
  // ======================
  function storeSession({ token, user }) { // token and user come directly from backend response
    state.authToken = token; // Store token in JS memory (state)
    state.userData = user;

    // Store minimal, non-sensitive info needed for quick UI updates or session checks in sessionStorage
    localStorage.setItem('cryptohub_auth_token', token); // Or use CONFIG.AUTH_STORAGE_KEY
    localStorage.setItem('cryptohub_user_info', JSON.stringify({
      userId: user._id, // ***** Use user._id from backend *****
      email: user.email,
      username: user.username, // You might want to store username too
      verified: user.verified,
      expires: Date.now() + CONFIG.SESSION_TIMEOUT
    }));

    // The actual JWT token is NOT stored in sessionStorage/localStorage here, it's in state.authToken.
    // If you need the token across page loads without re-login, sessionStorage for the token is an option,
    // but be aware of security implications. In-memory (state.authToken) is more secure but lost on page refresh.
    // For a Single Page App (SPA) that doesn't do full page reloads, in-memory is fine.
    // For traditional multi-page apps, you'd typically use HttpOnly cookies for session management or store JWT in sessionStorage.
    // Given this is `login.js`, it's usually followed by a redirect, so `state.authToken` will be lost
    // unless other scripts on subsequent pages re-establish it or you use a different token storage strategy.
    // For now, this script redirects to dashboard, which would likely have its own auth check.
  }

  function clearSession() {
    state.authToken = null;
    state.userData = null;
    sessionStorage.removeItem(CONFIG.USER_STORAGE_KEY);
    // sessionStorage.removeItem(CONFIG.AUTH_STORAGE_KEY); // If you were storing the token itself

    const API_URL = getApiBaseUrl();
    // Optional: notify backend. This endpoint doesn't exist on your server yet.
    if (API_URL) { // Check if API_URL is defined before making the call
        secureFetch(`${API_URL}/api/logout`, { // Path needs to match backend if you implement it
          method: 'POST',
          // credentials: 'include'
        }).catch((err) => {
            console.warn("Logout notification to backend failed or not implemented:", err.message)
        });
    }
  }


  // ... (rest of your script: validateCredentials, UI helpers, error handling, session check, security utils) ...
  // Ensure redirectToDashboard points to the correct path (e.g. 'dashboard.html' if it's a file)
  function redirectToDashboard() {
    window.location.href = 'dashboard.html'; // Or '/dashboard' if routes are set up for that
  }

})();