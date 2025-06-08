// --- START OF REWRITTEN auth.js ---
/**
 * CryptoHub Authentication Utilities & State Management
 * Manages global auth state, logout, and UI updates based on auth.
 */

// Use API_BASE_URL from window if set by HTML, otherwise default.
// Ensure this default matches the one potentially used by page-specific scripts if window.API_BASE_URL isn't set.
const AUTH_API_BASE_URL = window.API_BASE_URL || 'https://rapidcrypto-backend.onrender.com/api'; // Ensure /api
const AUTH_TOKEN_KEY = 'cryptohub_auth_token'; // Used by login.js to SET
const USER_INFO_KEY = 'cryptohub_user_info';   // Used by login.js to SET

document.addEventListener('DOMContentLoaded', function() {
    console.log("AUTH.JS: DOMContentLoaded");
    const currentPage = window.location.pathname.split('/').pop() || 'index.html';

    // Registration form on register.html
    if (currentPage === 'register.html' && document.getElementById('registerForm')) {
        document.getElementById('registerForm').addEventListener('submit', handleAuthJsRegister);
    }

    // Call auth state check AFTER other potential initializations
    // to give login.js a chance to set localStorage if it's a fresh login.
    // A small timeout can help ensure login.js finishes its redirect logic or storage ops.
    setTimeout(() => {
        checkAuthState(); 
        updateNavFooterBasedOnAuth();
    }, 0); // Execute in next event loop tick

    const logoutButton = document.getElementById('logoutBtn');
    if (logoutButton) {
        logoutButton.addEventListener('click', handleLogout);
    }
});

async function handleAuthJsRegister(e) {
    e.preventDefault();
    const form = e.target;
    const btn = form.querySelector('button[type="submit"]');
    const originalBtnText = btn ? btn.innerHTML : 'Register';
    const alertContainer = form.querySelector('.form-message') || form;

    try {
        const usernameInput = form.querySelector('#username');
        const emailInput = form.querySelector('#email');
        const passwordInput = form.querySelector('#password');
        const confirmPasswordInput = form.querySelector('#confirmPassword');

        if(!usernameInput || !emailInput || !passwordInput || !confirmPasswordInput) {
            showAlert("Registration form fields are missing.", 'error', alertContainer); return;
        }
        const username = usernameInput.value.trim();
        const email = emailInput.value.trim();
        const password = passwordInput.value;
        const confirmPassword = confirmPasswordInput.value;

        if (password !== confirmPassword) { showAlert('Passwords do not match.', 'error', alertContainer); return; }
        if (password.length < 6) { showAlert('Password must be at least 6 characters long.', 'error', alertContainer); return; }

        if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Registering...'; }

        // Using AUTH_API_BASE_URL which should include /api
        const response = await fetch(`${AUTH_API_BASE_URL}/register`, { // Ensure this endpoint is correct
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, email, password })
        });
        const data = await response.json();

        if (!response.ok || !data.success) { throw new Error(data.message || 'Registration failed.'); }
        
        showAlert(data.message || 'Registration successful! Please check your email to verify.', 'success', alertContainer);
        form.reset();
    } catch (error) {
        console.error('Registration error in auth.js:', error);
        showAlert(error.message === 'Failed to fetch' ? 'Cannot connect.' : error.message, 'error', alertContainer);
    } finally {
        if (btn) { btn.disabled = false; btn.innerHTML = originalBtnText; }
    }
}

function checkAuthState() {
    console.log("AUTH.JS: checkAuthState running");
    const protectedPages = ['dashboard.html', 'wallet.html', 'transactions.html']; // Add all protected pages
    const authPages = ['login.html', 'register.html'];
    const currentPage = window.location.pathname.split('/').pop() || 'index.html';

    const token = localStorage.getItem(AUTH_TOKEN_KEY);
    console.log(`AUTH.JS: Current page: ${currentPage}, Token found: ${!!token}`);

    if (protectedPages.includes(currentPage)) {
        if (!token) {
            console.log(`AUTH.JS: Not authenticated on protected page (${currentPage}). Redirecting to login.html.`);
            window.location.href = 'login.html'; 
        } else {
            console.log(`AUTH.JS: Authenticated on protected page (${currentPage}). Allowing access.`);
        }
    } else if (authPages.includes(currentPage)) {
        if (token) {
            console.log(`AUTH.JS: Authenticated on auth page (${currentPage}). Redirecting to dashboard.html.`);
            window.location.href = 'dashboard.html';
        } else {
            console.log(`AUTH.JS: Not authenticated on auth page (${currentPage}). Allowing access.`);
        }
    }
}

function updateNavFooterBasedOnAuth() {
    console.log("AUTH.JS: updateNavFooterBasedOnAuth running");
    const token = localStorage.getItem(AUTH_TOKEN_KEY);
    const navUl = document.querySelector('header nav ul');
    if (!navUl) return;

    // More robust query selectors
    const showWhenLoggedIn = navUl.querySelectorAll('a[href="dashboard.html"], a[href="wallet.html"], a[href="transactions.html"], #logoutBtn');
    const showWhenLoggedOut = navUl.querySelectorAll('a[href="login.html"], a[href="register.html"]');

    if (token) { // User is LOGGED IN
        showWhenLoggedIn.forEach(el => el.parentElement.style.display = '');
        showWhenLoggedOut.forEach(el => el.parentElement.style.display = 'none');
    } else { // User is LOGGED OUT
        showWhenLoggedIn.forEach(el => el.parentElement.style.display = 'none');
        showWhenLoggedOut.forEach(el => el.parentElement.style.display = '');
    }
}

function showAlert(message, type = 'info', targetElement = null) { /* ... (keep your existing showAlert) ... */ 
    const existingAlert = document.querySelector('.app-global-alert');
    if (existingAlert) existingAlert.remove();
    const alertDiv = document.createElement('div');
    alertDiv.className = `app-global-alert alert-${type}`; 
    let iconClass = 'fa-info-circle';
    if (type === 'success') iconClass = 'fa-check-circle';
    if (type === 'error') iconClass = 'fa-exclamation-circle';
    if (type === 'warning') iconClass = 'fa-exclamation-triangle';
    alertDiv.innerHTML = `<i class="fas ${iconClass}"></i> <span>${message}</span>`;
    alertDiv.style.padding = '10px 15px'; alertDiv.style.marginBottom = '15px'; alertDiv.style.border = '1px solid transparent'; alertDiv.style.borderRadius = '4px'; alertDiv.style.textAlign = 'center';
    if (type === 'error') { alertDiv.style.color = '#721c24'; alertDiv.style.backgroundColor = '#f8d7da'; alertDiv.style.borderColor = '#f5c6cb'; } 
    else if (type === 'success') { alertDiv.style.color = '#155724'; alertDiv.style.backgroundColor = '#d4edda'; alertDiv.style.borderColor = '#c3e6cb'; } 
    else { alertDiv.style.color = '#004085'; alertDiv.style.backgroundColor = '#cce5ff'; alertDiv.style.borderColor = '#b8daff';}
    if (targetElement && targetElement.prepend) { targetElement.prepend(alertDiv); } 
    else { alertDiv.style.position = 'fixed'; alertDiv.style.top = '20px'; alertDiv.style.left = '50%'; alertDiv.style.transform = 'translateX(-50%)'; alertDiv.style.zIndex = '10000'; alertDiv.style.boxShadow = '0 2px 10px rgba(0,0,0,0.2)'; document.body.insertBefore(alertDiv, document.body.firstChild); }
    setTimeout(() => { alertDiv.style.transition = 'opacity 0.5s ease-out'; alertDiv.style.opacity = '0'; setTimeout(() => alertDiv.remove(), 500); }, 4500);
}

function handleLogout() {
    console.log("AUTH.JS: handleLogout running");
    localStorage.removeItem(AUTH_TOKEN_KEY);
    localStorage.removeItem(USER_INFO_KEY);
    // Clear any other app-specific local/session storage if needed
    // localStorage.removeItem('availableBalance'); // Example
    // localStorage.removeItem('activeInvestments'); // Example
    
    updateNavFooterBasedOnAuth(); 
    window.location.href = 'index.html'; 
}
// --- END OF REWRITTEN auth.js ---