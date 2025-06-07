/**
 * CryptoHub Authentication Utilities & State Management
 * Manages global auth state, logout, and UI updates based on auth.
 * Specific form submissions (login, register) might be handled by page-specific scripts.
 */

const API_BASE_URL = 'https://rapidcrypto-backend.onrender.com';
const AUTH_TOKEN_KEY = 'cryptohub_auth_token';
const USER_INFO_KEY = 'cryptohub_user_info'; // Standardized key

document.addEventListener('DOMContentLoaded', function() {
    const currentPage = window.location.pathname.split('/').pop() || 'index.html';

    // Setup registration form listener IF on register.html AND no other script handles it.
    if (currentPage === 'register.html' && document.getElementById('registerForm')) {
        // This assumes register.html doesn't have its own dedicated register.js
        // If it does, that script should handle its own form.
        document.getElementById('registerForm').addEventListener('submit', handleAuthJsRegister);
    }

    // The OTP-specific login.js should handle the loginForm on login.html.
    // If this auth.js were to handle a *direct* login, the listener would be here:
    // if (currentPage === 'login.html' && document.getElementById('loginForm') && !isOtpLoginUsed) {
    //     document.getElementById('loginForm').addEventListener('submit', handleAuthJsDirectLogin);
    // }

    checkAuthState(); // Handles page access and redirects
    updateNavFooterBasedOnAuth(); // Updates UI elements like nav links

    // Attach logout event listener if logout button exists on the current page
    const logoutButton = document.getElementById('logoutBtn');
    if (logoutButton) {
        logoutButton.addEventListener('click', handleLogout);
    }
});

// Registration logic (called if registerForm listener is active)
async function handleAuthJsRegister(e) {
    e.preventDefault();
    const form = e.target;
    const btn = form.querySelector('button[type="submit"]');
    const originalBtnText = btn ? btn.innerHTML : 'Register';

    // Ensure showAlert is available and works with the form context
    const alertContainer = form.querySelector('.form-message') || form;


    try {
        const usernameInput = form.querySelector('#username');
        const emailInput = form.querySelector('#email');
        const passwordInput = form.querySelector('#password');
        const confirmPasswordInput = form.querySelector('#confirmPassword');

        if(!usernameInput || !emailInput || !passwordInput || !confirmPasswordInput) {
            console.error("One or more registration form fields are missing.");
            showAlert("Registration form error. Please contact support.", 'error', alertContainer);
            return;
        }

        const username = usernameInput.value.trim();
        const email = emailInput.value.trim();
        const password = passwordInput.value;
        const confirmPassword = confirmPasswordInput.value;

        if (password !== confirmPassword) {
            showAlert('Passwords do not match.', 'error', alertContainer);
            return;
        }
        if (password.length < 6) { // Match backend validation
            showAlert('Password must be at least 6 characters long.', 'error', alertContainer);
            return;
        }

        if (btn) {
            btn.disabled = true;
            btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Registering...';
        }

        const response = await fetch(`${API_BASE_URL}/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, email, password })
        });

        const data = await response.json();

        if (!response.ok || !data.success) {
            throw new Error(data.message || 'Registration failed. Please try again.');
        }

        // Backend sends a verification link, does not log in user or return token here.
        showAlert(data.message || 'Registration successful! Please check your email to verify your account.', 'success', alertContainer);
        form.reset();
        // No automatic redirect to dashboard. User must verify email first.
        // Optional: redirect to login page after a delay
        // setTimeout(() => { window.location.href = `login.html?message=${encodeURIComponent(data.message)}`; }, 3000);

    } catch (error) {
        console.error('Registration error in auth.js:', error);
        const errorMsg = error.message === 'Failed to fetch'
            ? 'Cannot connect to server. Please check your network.'
            : error.message;
        showAlert(errorMsg, 'error', alertContainer);
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = originalBtnText;
        }
    }
}

//Direct Login function (IF NOT USING OTP FLOW FROM login.js)
// This would be used if login.js (OTP version) is NOT active for loginForm.

async function handleAuthJsDirectLogin(e) {
    e.preventDefault();
    const form = e.target;
    const btn = form.querySelector('button[type="submit"]');
    const originalBtnText = btn ? btn.innerHTML : 'Login';
    const alertContainer = form.querySelector('.form-message') || form;

    try {
        const emailInput = form.querySelector('#loginEmail');
        const passwordInput = form.querySelector('#loginPassword');

        if(!emailInput || !passwordInput){
            showAlert('Login form error.', 'error', alertContainer);
            return;
        }
        const email = emailInput.value.trim();
        const password = passwordInput.value;

        if (!email || !password) {
            showAlert('Please enter both email and password.', 'error', alertContainer);
            return;
        }

        if(btn) {
            btn.disabled = true;
            btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Logging in...';
        }

        const response = await fetch(`${API_BASE_URL}/login`, { // Assumes /api/login handles direct login
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });

        const data = await response.json();

        if (!response.ok || !data.success) {
            throw new Error(data.message || 'Login failed. Please check your credentials.');
        }

        localStorage.setItem(AUTH_TOKEN_KEY, data.token);
        localStorage.setItem(USER_INFO_KEY, JSON.stringify(data.user)); // Use standardized key

        showAlert('Login successful! Redirecting...', 'success', alertContainer);
        updateNavFooterBasedOnAuth(); // Update UI immediately
        setTimeout(() => window.location.href = 'dashboard.html', 1000);

    } catch (error) {
        console.error('Login error in auth.js:', error);
        const errorMsg = error.message === 'Failed to fetch'
            ? 'Network error. Please check your connection.'
            : error.message;
        showAlert(errorMsg, 'error', alertContainer);
    } finally {
        if(btn) {
            btn.disabled = false;
            btn.innerHTML = originalBtnText;
        }
    }
}
*/

function checkAuthState() {
    const protectedPages = ['dashboard.html', 'wallet.html', 'transactions.html'];
    const authPages = ['login.html', 'register.html'];
    // Assuming index.html is public or has its own logic
    const currentPage = window.location.pathname.split('/').pop() || 'index.html';

    const token = localStorage.getItem(AUTH_TOKEN_KEY);

    if (protectedPages.includes(currentPage)) {
        if (!token) {
            // console.log(`Auth check: Not authenticated on protected page ${currentPage}. Redirecting to login.`);
            window.location.href = 'login.html'; // No alert, direct redirect
        }
    } else if (authPages.includes(currentPage)) {
        if (token) {
            // console.log(`Auth check: Authenticated on auth page ${currentPage}. Redirecting to dashboard.`);
            window.location.href = 'dashboard.html';
        }
    }
}

function updateNavFooterBasedOnAuth() {
    const token = localStorage.getItem(AUTH_TOKEN_KEY);
    // Query for nav elements (make selectors more specific if needed)
    const navUl = document.querySelector('header nav ul');
    if (!navUl) return;

    const dashboardLink = navUl.querySelector('a[href="dashboard.html"]');
    const walletLink = navUl.querySelector('a[href="wallet.html"]');
    const transactionsLink = navUl.querySelector('a[href="transactions.html"]');
    const logoutLink = navUl.querySelector('#logoutBtn'); // Logout is an <a> with id in your HTML

    const loginLinkNav = navUl.querySelector('a[href="login.html"]');
    const registerLinkNav = navUl.querySelector('a[href="register.html"]');

    if (token) { // User is LOGGED IN
        if (dashboardLink) dashboardLink.parentElement.style.display = '';
        if (walletLink) walletLink.parentElement.style.display = '';
        if (transactionsLink) transactionsLink.parentElement.style.display = '';
        if (logoutLink) logoutLink.parentElement.style.display = '';

        if (loginLinkNav) loginLinkNav.parentElement.style.display = 'none';
        if (registerLinkNav) registerLinkNav.parentElement.style.display = 'none';
    } else { // User is LOGGED OUT
        if (dashboardLink) dashboardLink.parentElement.style.display = 'none';
        if (walletLink) walletLink.parentElement.style.display = 'none';
        if (transactionsLink) transactionsLink.parentElement.style.display = 'none';
        if (logoutLink) logoutLink.parentElement.style.display = 'none';

        if (loginLinkNav) loginLinkNav.parentElement.style.display = '';
        if (registerLinkNav) registerLinkNav.parentElement.style.display = '';
    }
    // Add similar logic for footer links if they also need to change based on auth state
}


function showAlert(message, type = 'error', targetElement = null) {
    const existingAlert = document.querySelector('.app-global-alert');
    if (existingAlert) existingAlert.remove();

    const alertDiv = document.createElement('div');
    alertDiv.className = `app-global-alert alert-${type}`; // Use a distinct class

    let iconClass = 'fa-info-circle';
    if (type === 'success') iconClass = 'fa-check-circle';
    if (type === 'error') iconClass = 'fa-exclamation-circle';
    if (type === 'warning') iconClass = 'fa-exclamation-triangle';

    alertDiv.innerHTML = `<i class="fas ${iconClass}"></i> <span>${message}</span>`;

    // Basic default styling (override with CSS for .app-global-alert and .alert-type)
    alertDiv.style.padding = '10px 15px';
    alertDiv.style.marginBottom = '15px';
    alertDiv.style.border = '1px solid transparent';
    alertDiv.style.borderRadius = '4px';
    alertDiv.style.textAlign = 'center';

    if (type === 'error') {
        alertDiv.style.color = '#721c24';
        alertDiv.style.backgroundColor = '#f8d7da';
        alertDiv.style.borderColor = '#f5c6cb';
    } else if (type === 'success') {
        alertDiv.style.color = '#155724';
        alertDiv.style.backgroundColor = '#d4edda';
        alertDiv.style.borderColor = '#c3e6cb';
    } else { // Info or warning
        alertDiv.style.color = '#004085';
        alertDiv.style.backgroundColor = '#cce5ff';
        alertDiv.style.borderColor = '#b8daff';
    }
    
    if (targetElement && targetElement.prepend) {
        targetElement.prepend(alertDiv);
    } else {
        // Fallback to a global, fixed alert if no target or target can't prepend
        alertDiv.style.position = 'fixed';
        alertDiv.style.top = '20px';
        alertDiv.style.left = '50%';
        alertDiv.style.transform = 'translateX(-50%)';
        alertDiv.style.zIndex = '10000';
        alertDiv.style.boxShadow = '0 2px 10px rgba(0,0,0,0.2)';
        document.body.insertBefore(alertDiv, document.body.firstChild);
    }

    setTimeout(() => {
        alertDiv.style.transition = 'opacity 0.5s ease-out';
        alertDiv.style.opacity = '0';
        setTimeout(() => alertDiv.remove(), 500);
    }, 4500);
}

function handleLogout() {
    localStorage.removeItem(AUTH_TOKEN_KEY);
    localStorage.removeItem(USER_INFO_KEY); // Use standardized key
    localStorage.removeItem('availableBalance'); // From dashboard.js
    localStorage.removeItem('activeInvestments'); // From dashboard.js
    
    // console.log("Logged out, redirecting to index.html");
    updateNavFooterBasedOnAuth(); // Update UI immediately before redirect
    window.location.href = 'index.html'; // Or your preferred public landing page
}