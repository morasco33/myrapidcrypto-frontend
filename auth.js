// --- START OF FIXED auth.js ---
const AUTH_API_BASE_URL = window.API_BASE_URL || 'https://rapidcrypto-backend.onrender.com/api';
const AUTH_TOKEN_KEY = 'cryptohub_auth_token';
const USER_INFO_KEY = 'cryptohub_user_info';

document.addEventListener('DOMContentLoaded', function () {
  console.log("AUTH.JS: DOMContentLoaded");

  finalizePageSetupBasedOnAuth();

  const logoutButton = document.getElementById('logoutBtn');
  if (logoutButton) logoutButton.addEventListener('click', handleLogout);

  const currentPagePath = window.location.pathname;
  if (currentPagePath.endsWith('/register.html') && document.getElementById('registerForm')) {
    document.getElementById('registerForm').addEventListener('submit', handleAuthJsRegister);
  }
});

function finalizePageSetupBasedOnAuth() {
  console.log("AUTH.JS: finalizePageSetupBasedOnAuth running");
  const token = localStorage.getItem(AUTH_TOKEN_KEY);
  const body = document.body;
  const loadingSpinnerOverlay = document.querySelector('.loading-spinner-overlay');
  const currentPagePath = window.location.pathname;
  const protectedPagesPaths = ['/dashboard.html', '/wallet.html', '/transactions.html', '/transfer.html'];
  const authPagePaths = ['/login.html', '/register.html'];

  let allowPageRender = true;

  if (window.REQUIRES_AUTH || protectedPagesPaths.includes(currentPagePath)) {
    if (!token) {
      console.warn("AUTH.JS: Protected page but no token. Redirecting to login.");
      allowPageRender = false;
      if (loadingSpinnerOverlay) loadingSpinnerOverlay.style.display = 'none';
      window.location.href = 'login.html?redirectTo=' + encodeURIComponent(currentPagePath);
      return;
    }
  } else if (authPagePaths.includes(currentPagePath) && token) {
    console.log("AUTH.JS: Already logged in and on login/register page. Redirecting to dashboard.");
    allowPageRender = false;
    if (loadingSpinnerOverlay) loadingSpinnerOverlay.style.display = 'none';
    window.location.replace('dashboard.html');
    return;
  }

  if (allowPageRender) {
    if (document.documentElement.style.visibility === 'hidden') {
      document.documentElement.style.visibility = 'visible';
      document.documentElement.style.opacity = '1';
    }
    if (body.classList.contains('auth-loading')) {
      body.classList.remove('auth-loading');
    }
    if (loadingSpinnerOverlay) loadingSpinnerOverlay.style.display = 'none';
    updateNavFooterBasedOnAuth();
  }
}

async function handleAuthJsRegister(e) {
  e.preventDefault();
  const form = e.target;
  const btn = form.querySelector('button[type="submit"]');
  const alertContainer = form.querySelector('.form-message') || form;

  const username = form.querySelector('#username')?.value.trim();
  const email = form.querySelector('#email')?.value.trim();
  const password = form.querySelector('#password')?.value;
  const confirmPassword = form.querySelector('#confirmPassword')?.value;

  if (!username || !email || !password || !confirmPassword) {
    showAlert("All fields are required.", 'error', alertContainer);
    return;
  }

  if (password !== confirmPassword) {
    showAlert("Passwords do not match.", 'error', alertContainer);
    return;
  }

  if (password.length < 6) {
    showAlert("Password must be at least 6 characters.", 'error', alertContainer);
    return;
  }

  btn.disabled = true;
  btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Registering...';

  try {
    const res = await fetch(`${AUTH_API_BASE_URL}/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, email, password })
    });
    const data = await res.json();
    if (!res.ok || !data.success) throw new Error(data.message || 'Registration failed.');
    showAlert(data.message || 'Registered! Check your email to verify.', 'success', alertContainer);
    form.reset();
  } catch (err) {
    console.error("AUTH.JS: Registration error", err);
    showAlert(err.message || 'Error registering.', 'error', alertContainer);
  } finally {
    btn.disabled = false;
    btn.innerHTML = 'Register';
  }
}

function updateNavFooterBasedOnAuth() {
  const token = localStorage.getItem(AUTH_TOKEN_KEY);
  const navUl = document.querySelector('header nav ul');
  if (!navUl) return;

  const showWhenLoggedIn = navUl.querySelectorAll('a[href="dashboard.html"], a[href="wallet.html"], a[href="transactions.html"], #logoutBtn');
  const showWhenLoggedOut = navUl.querySelectorAll('a[href="login.html"], a[href="register.html"]');

  showWhenLoggedIn.forEach(el => { if (el?.parentElement) el.parentElement.style.display = token ? '' : 'none'; });
  showWhenLoggedOut.forEach(el => { if (el?.parentElement) el.parentElement.style.display = token ? 'none' : ''; });
}

function handleLogout() {
  console.log("AUTH.JS: Logging out...");
  localStorage.removeItem(AUTH_TOKEN_KEY);
  localStorage.removeItem(USER_INFO_KEY);
  updateNavFooterBasedOnAuth();
  window.location.replace('index.html');
}

function showAlert(message, type = 'info', targetElement = null) {
  const existingAlert = document.querySelector('.app-global-alert');
  if (existingAlert) existingAlert.remove();
  const alertDiv = document.createElement('div');
  alertDiv.className = `app-global-alert alert-${type}`;
  alertDiv.innerHTML = `<span>${message}</span>`;
  alertDiv.style.padding = '10px';
  alertDiv.style.margin = '10px auto';
  alertDiv.style.borderRadius = '4px';
  alertDiv.style.textAlign = 'center';
  alertDiv.style.maxWidth = '500px';
  alertDiv.style.backgroundColor = type === 'error' ? '#f8d7da' : (type === 'success' ? '#d4edda' : '#cce5ff');
  alertDiv.style.color = type === 'error' ? '#721c24' : (type === 'success' ? '#155724' : '#004085');
  alertDiv.style.border = type === 'error' ? '1px solid #f5c6cb' : (type === 'success' ? '1px solid #c3e6cb' : '1px solid #b8daff');

  if (targetElement && targetElement.prepend) {
    targetElement.prepend(alertDiv);
  } else {
    document.body.insertBefore(alertDiv, document.body.firstChild);
  }

  setTimeout(() => {
    alertDiv.style.opacity = '0';
    setTimeout(() => alertDiv.remove(), 500);
  }, 4500);
}
// --- END OF FIXED auth.js ---
