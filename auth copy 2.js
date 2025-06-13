// --- START OF MODIFIED auth.js ---

// Define constants for keys and URLs used throughout the script.
const AUTH_API_BASE_URL = window.API_BASE_URL || 'https://rapidcrypto-backend.onrender.com/api';
const AUTH_TOKEN_KEY = 'cryptohub_auth_token';
const USER_INFO_KEY = 'cryptohub_user_info';

/**
 * This is the main function that runs when the page loads.
 * It handles all authentication, routing, and initial UI setup.
 */
document.addEventListener('DOMContentLoaded', function () {
    console.log("AUTH.JS: DOMContentLoaded. Starting authentication check.");

    // --- 1. DEFINE PAGE ROUTES ---
    const currentPagePath = window.location.pathname;
    // Pages that require a user to be logged in.
    const protectedPagesPaths = ['/dashboard.html', '/wallet.html', '/transactions.html', '/transfer.html', '/deposit.html', '/receive.html'];
    // Pages for logging in or registering.
    const authPagePaths = ['/login.html', '/register.html'];

    // --- 2. GET AUTHENTICATION STATUS ---
    const token = localStorage.getItem(AUTH_TOKEN_KEY);

    // --- 3. CORE ROUTING LOGIC ---

    // RULE A: If the user is on a protected page BUT has NO token...
    if (protectedPagesPaths.some(path => currentPagePath.endsWith(path)) && !token) {
        console.warn("AUTH.JS: Access Denied. No token for a protected page. Redirecting to login.");
        // ...redirect them to the login page and stop all further script execution.
        window.location.replace('login.html'); // Use .replace() to prevent "back" button issues.
        return; 
    }

    // RULE B: If the user is on a login/register page BUT ALREADY HAS a token...
    if (authPagePaths.some(path => currentPagePath.endsWith(path)) && token) {
        console.log("AUTH.JS: User is already logged in. Redirecting to dashboard.");
        // ...redirect them to the dashboard and stop all further script execution.
        window.location.replace('dashboard.html');
        return;
    }

    // --- 4. IF NO REDIRECTION, RENDER THE PAGE ---
    // If the script reaches this point, the user is allowed to be on the current page.
    console.log("AUTH.JS: Access Granted. Rendering page.");
    renderPageContent();

    // --- 5. SETUP PAGE-SPECIFIC EVENT LISTENERS ---
    // Universal listeners
    const logoutButton = document.getElementById('logoutBtn');
    if (logoutButton) logoutButton.addEventListener('click', handleLogout);

    // Registration form listener (only for register.html)
    if (currentPagePath.endsWith('/register.html')) {
        const registerForm = document.getElementById('registerForm');
        if (registerForm) {
            registerForm.addEventListener('submit', handleAuthJsRegister);
        }
    }
});


/**
 * Makes the page content visible and updates the navigation bar.
 */
function renderPageContent() {
    // Make the page visible
    document.documentElement.style.visibility = 'visible';
    document.documentElement.style.opacity = '1';

    // Hide the loading spinner
    const loadingSpinnerOverlay = document.querySelector('.loading-spinner-overlay');
    if (loadingSpinnerOverlay) {
        loadingSpinnerOverlay.style.display = 'none';
    }
    
    // Remove the loading class from the body
    document.body.classList.remove('auth-loading');

    // Update navigation links to show/hide based on login status
    updateNavBasedOnAuth();
}


/**
 * Handles the user registration form submission.
 * (This function is unchanged from your original file).
 */
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

/**
 * Shows or hides navigation links depending on the user's login status.
 */
function updateNavBasedOnAuth() {
  const token = localStorage.getItem(AUTH_TOKEN_KEY);
  const navUl = document.querySelector('header nav ul');
  if (!navUl) return;

  const loggedInLinks = navUl.querySelectorAll('a[href="dashboard.html"], a[href="wallet.html"], a[href="transactions.html"], #logoutBtn');
  const loggedOutLinks = navUl.querySelectorAll('a[href="login.html"], a[href="register.html"]');

  loggedInLinks.forEach(el => { if (el?.parentElement) el.parentElement.style.display = token ? 'list-item' : 'none'; });
  loggedOutLinks.forEach(el => { if (el?.parentElement) el.parentElement.style.display = token ? 'none' : 'list-item'; });
}

/**
 * Logs the user out by clearing localStorage and redirecting to the home page.
 */
function handleLogout() {
  console.log("AUTH.JS: Logging out...");
  localStorage.removeItem(AUTH_TOKEN_KEY);
  localStorage.removeItem(USER_INFO_KEY);
  // Redirect to a public page like index.html after logout.
  window.location.replace('index.html');
}

/**
 * A utility function to display temporary alerts to the user.
 * (This function is unchanged from your original file).
 */
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
    alertDiv.style.transition = 'opacity 0.5s ease';
    alertDiv.style.opacity = '0';
    setTimeout(() => alertDiv.remove(), 500);
  }, 4500);
}
// --- END OF MODIFIED auth.js ---