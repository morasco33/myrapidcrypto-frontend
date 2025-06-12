// --- START OF MODIFIED auth.js ---
const AUTH_API_BASE_URL = window.API_BASE_URL || 'https://rapidcrypto-backend.onrender.com/api';
const AUTH_TOKEN_KEY = 'cryptohub_auth_token'; 
const USER_INFO_KEY = 'cryptohub_user_info';   

document.addEventListener('DOMContentLoaded', function() {
    console.log("AUTH.JS: DOMContentLoaded");
    
    // This function will re-verify and then set up the page.
    // The inline script in <head> provides the first line of defense.
    finalizePageSetupBasedOnAuth(); 

    const logoutButton = document.getElementById('logoutBtn');
    if (logoutButton) {
        logoutButton.addEventListener('click', handleLogout);
    }

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

    console.log(`AUTH.JS (finalize): Current page: ${currentPagePath}, Token found: ${!!token}`);
    if (window.REQUIRES_AUTH) {
        const token = sessionStorage.getItem('cryptohub_auth_token');
        if (!token) {
          const currentPath = window.location.pathname;
          window.location.href = 'login.html?redirectTo=' + encodeURIComponent(currentPath);
        }
      }
      

    let allowPageRender = true; // Assume true initially

    if (protectedPagesPaths.includes(currentPagePath)) {
        if (!token) {
            console.log("AUTH.JS (finalize): No token on protected page. Inline script should have redirected. Forcing redirect.");
            allowPageRender = false;
            if (loadingSpinnerOverlay) loadingSpinnerOverlay.style.display = 'none'; // Hide spinner before redirect
            window.location.replace('login.html'); 
            return; 
        }
    } else if (authPagePaths.includes(currentPagePath)) {
        if (token) {
            console.log("AUTH.JS (finalize): Token found on auth page. Inline script should have redirected. Forcing redirect.");
            allowPageRender = false;
            if (loadingSpinnerOverlay) loadingSpinnerOverlay.style.display = 'none'; // Hide spinner before redirect
            window.location.replace('dashboard.html');
            return; 
        }
    }
    // Else, it's a public page or a page where the token state matches the page type correctly.

    if (allowPageRender) {
        if (document.documentElement.style.visibility === 'hidden') {
            console.log("AUTH.JS (finalize): Page was hidden by inline script, making it visible now.");
            document.documentElement.style.visibility = 'visible';
            document.documentElement.style.opacity = '1';
        }
        if (body.classList.contains('auth-loading')) {
            console.log("AUTH.JS (finalize): Removing 'auth-loading' class from body.");
            body.classList.remove('auth-loading');
        }
        if (loadingSpinnerOverlay) {
            console.log("AUTH.JS (finalize): Hiding full page spinner.");
            loadingSpinnerOverlay.style.display = 'none';
        }
        updateNavFooterBasedOnAuth(); // Update nav links
    }
}

// --- Keep your other functions from auth.js: ---
// handleAuthJsRegister(e) { ... }
// updateNavFooterBasedOnAuth() { ... }
// showAlert(message, type, targetElement) { ... }
// handleLogout() { ... }
// (Copy them from the previous version of auth.js I provided - they were mostly fine)
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

function updateNavFooterBasedOnAuth() {
    console.log("AUTH.JS: updateNavFooterBasedOnAuth running");
    const token = localStorage.getItem(AUTH_TOKEN_KEY);
    const navUl = document.querySelector('header nav ul');
    if (!navUl) {
        console.warn("AUTH.JS: Nav UL not found for UI update.");
        return;
    }

    const showWhenLoggedIn = navUl.querySelectorAll('a[href="dashboard.html"], a[href="wallet.html"], a[href="transactions.html"], #logoutBtn');
    const showWhenLoggedOut = navUl.querySelectorAll('a[href="login.html"], a[href="register.html"]');

    if (token) { 
        showWhenLoggedIn.forEach(el => { if(el && el.parentElement) el.parentElement.style.display = ''; });
        showWhenLoggedOut.forEach(el => { if(el && el.parentElement) el.parentElement.style.display = 'none'; });
    } else { 
        showWhenLoggedIn.forEach(el => { if(el && el.parentElement) el.parentElement.style.display = 'none'; });
        showWhenLoggedOut.forEach(el => { if(el && el.parentElement) el.parentElement.style.display = ''; });
    }
}

function showAlert(message, type = 'info', targetElement = null) { 
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
    updateNavFooterBasedOnAuth(); 
    window.location.replace('index.html'); // Use replace here too
}
// --- END OF MODIFIED auth.js ---