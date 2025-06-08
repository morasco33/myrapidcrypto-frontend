// --- START OF REWRITTEN auth.js ---
/**
 * CryptoHub Authentication Utilities & State Management
 * Manages global auth state, logout, and UI updates based on auth.
 */

const AUTH_API_BASE_URL = window.API_BASE_URL || 'https://rapidcrypto-backend.onrender.com/api';
const AUTH_TOKEN_KEY = 'cryptohub_auth_token'; 
const USER_INFO_KEY = 'cryptohub_user_info';   

document.addEventListener('DOMContentLoaded', function() {
    console.log("AUTH.JS: DOMContentLoaded");
    const currentPage = window.location.pathname.split('/').pop() || 'index.html';

    if (currentPage === 'register.html' && document.getElementById('registerForm')) {
        document.getElementById('registerForm').addEventListener('submit', handleAuthJsRegister);
    }

    // Run auth check logic. If on a page that uses the 'auth-loading' class,
    // this function will be responsible for removing it if authenticated.
    checkAuthStateAndRevealContent(); 
    
    // updateNavFooterBasedOnAuth might run before checkAuthState fully decides on redirect.
    // It's generally okay as it just updates link visibility based on token.
    updateNavFooterBasedOnAuth();

    const logoutButton = document.getElementById('logoutBtn');
    if (logoutButton) {
        logoutButton.addEventListener('click', handleLogout);
    }
});

async function handleAuthJsRegister(e) {
    // ... (keep your existing handleAuthJsRegister function - no changes needed for this issue)
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

        const response = await fetch(`${AUTH_API_BASE_URL}/register`, { 
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

function checkAuthStateAndRevealContent() {
    console.log("AUTH.JS: checkAuthStateAndRevealContent running");
    const protectedPages = ['dashboard.html', 'wallet.html', 'transactions.html']; 
    const authPages = ['login.html', 'register.html'];
    const currentPage = window.location.pathname.split('/').pop() || 'index.html';
    const token = localStorage.getItem(AUTH_TOKEN_KEY);
    const body = document.body;
    const loadingSpinnerOverlay = document.querySelector('.loading-spinner-overlay');

    console.log(`AUTH.JS: Current page: ${currentPage}, Token found: ${!!token}`);

    let isAuthenticatedPage = false;

    if (protectedPages.includes(currentPage)) {
        if (!token) {
            console.log(`AUTH.JS: Not authenticated on protected page (${currentPage}). Redirecting to login.html.`);
            if (loadingSpinnerOverlay) loadingSpinnerOverlay.style.display = 'none'; // Hide spinner before redirect
            window.location.href = 'login.html'; 
            return; // Stop further execution
        } else {
            console.log(`AUTH.JS: Authenticated on protected page (${currentPage}). Allowing access.`);
            isAuthenticatedPage = true;
        }
    } else if (authPages.includes(currentPage)) {
        if (token) {
            console.log(`AUTH.JS: Authenticated on auth page (${currentPage}). Redirecting to dashboard.html.`);
            if (loadingSpinnerOverlay) loadingSpinnerOverlay.style.display = 'none'; // Hide spinner before redirect
            window.location.href = 'dashboard.html';
            return; // Stop further execution
        } else {
            console.log(`AUTH.JS: Not authenticated on auth page (${currentPage}). Allowing access.`);
            // No specific auth action needed, but content should be revealed
        }
    } else {
        // Public page, or page not in protected/auth lists
        console.log(`AUTH.JS: Public page or unlisted (${currentPage}). Allowing access.`);
    }

    // If execution reaches here, the user is allowed to be on the current page.
    // Reveal content if it was hidden.
    if (body.classList.contains('auth-loading')) {
        console.log("AUTH.JS: Removing 'auth-loading' class from body.");
        body.classList.remove('auth-loading');
    }
    if (loadingSpinnerOverlay) {
        console.log("AUTH.JS: Hiding full page spinner.");
        loadingSpinnerOverlay.style.display = 'none';
    }
}

function updateNavFooterBasedOnAuth() {
    // ... (keep your existing updateNavFooterBasedOnAuth function)
    console.log("AUTH.JS: updateNavFooterBasedOnAuth running");
    const token = localStorage.getItem(AUTH_TOKEN_KEY);
    const navUl = document.querySelector('header nav ul');
    if (!navUl) return;

    const showWhenLoggedIn = navUl.querySelectorAll('a[href="dashboard.html"], a[href="wallet.html"], a[href="transactions.html"], #logoutBtn');
    const showWhenLoggedOut = navUl.querySelectorAll('a[href="login.html"], a[href="register.html"]');

    if (token) { 
        showWhenLoggedIn.forEach(el => el.parentElement.style.display = '');
        showWhenLoggedOut.forEach(el => el.parentElement.style.display = 'none');
    } else { 
        showWhenLoggedIn.forEach(el => el.parentElement.style.display = 'none');
        showWhenLoggedOut.forEach(el => el.parentElement.style.display = '');
    }
}

function showAlert(message, type = 'info', targetElement = null) { 
    // ... (keep your existing showAlert function)
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
    // ... (keep your existing handleLogout function)
    console.log("AUTH.JS: handleLogout running");
    localStorage.removeItem(AUTH_TOKEN_KEY);
    localStorage.removeItem(USER_INFO_KEY);    
    updateNavFooterBasedOnAuth(); 
    window.location.href = 'index.html'; 
}
// --- END OF REWRITTEN auth.js ---