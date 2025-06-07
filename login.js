// Combined and fixed login.js and auth.js parts with backend/frontend config
(function secureAuthModule() {
  'use strict';

  const CONFIG = {
    IS_PRODUCTION: window.location.protocol === 'https:',
    AUTH_TOKEN_KEY: 'cryptohub_auth_token',
    USER_INFO_KEY: 'cryptohub_user_info',
    SESSION_TIMEOUT: 60 * 60 * 1000,
    REQUEST_TIMEOUT: 10000,
    MAX_RETRIES: 2,
    MIN_PASSWORD_LENGTH: 6
  };

  function getApiBaseUrl() {
    if (window.API_BASE_URL) return window.API_BASE_URL;
    console.error("CRITICAL: window.API_BASE_URL is not set!");
    return CONFIG.IS_PRODUCTION ? 'https://rapidcrypto-backend.onrender.com' : 'http://localhost:3001';
  }

  function storeSession({ token, user }) {
    sessionStorage.setItem(CONFIG.AUTH_TOKEN_KEY, token);
    sessionStorage.setItem(CONFIG.USER_INFO_KEY, JSON.stringify({
      userId: user._id,
      email: user.email,
      username: user.username,
      verified: user.verified,
      expires: Date.now() + CONFIG.SESSION_TIMEOUT
    }));
  }

  function clearSession() {
    sessionStorage.removeItem(CONFIG.AUTH_TOKEN_KEY);
    sessionStorage.removeItem(CONFIG.USER_INFO_KEY);
  }

  async function handleLogin(event) {
    event.preventDefault();

    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;

    if (!email || password.length < CONFIG.MIN_PASSWORD_LENGTH) {
      alert('Invalid email or password');
      return;
    }

    const API_URL = getApiBaseUrl();
    try {
      const response = await fetch(`${API_URL}/api/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const data = await response.json();

      if (!response.ok) throw new Error(data.message || 'Login failed');

      if (data.token && data.user) {
        storeSession(data);
        window.location.href = 'dashboard.html';
      } else {
        alert('Login successful but data missing');
      }
    } catch (err) {
      alert(err.message);
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('login-form');
    if (loginForm) {
      loginForm.addEventListener('submit', handleLogin);
    }
  });

  // On any page load, check auth state
  document.addEventListener('DOMContentLoaded', () => {
    const token = sessionStorage.getItem(CONFIG.AUTH_TOKEN_KEY);
    const page = window.location.pathname;
    console.debug(`DEBUG [auth.js checkAuthState]: Page='${page}' | Token Exists=${!!token}`);

    const navStatus = document.getElementById('nav-status');
    if (navStatus) {
      navStatus.textContent = token ? 'Logged in' : 'Logged out';
    }

    if (!token && page.includes('dashboard')) {
      // Not logged in and trying to access dashboard
      window.location.href = 'login.html';
    }
  });

  // Expose for other scripts
  window.clearSession = clearSession;
})();

// Set this at the top of your HTML before this script:
// <script>window.API_BASE_URL = "https://rapidcrypto-backend.onrender.com";</script>
