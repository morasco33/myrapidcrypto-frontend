// --- COMPLETE AUTH.JS WITH FOOTER FIX ---
const AUTH_API_BASE_URL = window.API_BASE_URL || 'https://rapidcrypto-backend.onrender.com/api';
const AUTH_TOKEN_KEY = 'cryptohub_auth_token';
const USER_INFO_KEY = 'cryptohub_user_info';

document.addEventListener('DOMContentLoaded', function () {
    console.log("AUTH.JS: DOMContentLoaded. Starting authentication check.");

    // Get current page path without parameters
    const currentPagePath = window.location.pathname.split('?')[0].toLowerCase();
    
    // 1. Define all page types
    const protectedPages = [
        '/dashboard.html', 
        '/wallet.html', 
        '/transactions.html', 
        '/transfer.html', 
        '/deposit.html', 
        '/receive.html',
        '/withdraw.html'
    ];
    
    const authPages = [
        '/login.html',
        '/register.html'
    ];
    
    const publicFooterPages = [
        '/products.html',
        '/investment.html',
        '/about.html',
        '/contact.html',
        '/help.html'
    ];

    // 2. Check authentication status
    const token = localStorage.getItem(AUTH_TOKEN_KEY);
    const userInfo = localStorage.getItem(USER_INFO_KEY);

    // 3. SPECIAL CASE: Footer pages load immediately
    if (publicFooterPages.some(path => currentPagePath.endsWith(path))) {
        console.log("AUTH.JS: Loading public footer page without auth checks");
        renderPageContent();
        return;
    }

    // 4. Normal auth flow for other pages
    if (protectedPages.some(path => currentPagePath.endsWith(path)) && !token) {
        console.warn("AUTH.JS: Redirecting to login from protected page");
        window.location.replace(`login.html?redirect=${encodeURIComponent(window.location.pathname)}`);
        return;
    }

    if (authPages.some(path => currentPagePath.endsWith(path)) && token) {
        console.log("AUTH.JS: Already logged in - redirecting to dashboard");
        const redirectUrl = new URLSearchParams(window.location.search).get('redirect');
        window.location.replace(redirectUrl || 'dashboard.html');
        return;
    }

    // 5. Initialize page
    renderPageContent();

    // 6. Set up event listeners
    const logoutButton = document.getElementById('logoutBtn');
    if (logoutButton) {
        logoutButton.addEventListener('click', handleLogout);
    }

    if (currentPagePath.endsWith('/register.html')) {
        const registerForm = document.getElementById('registerForm');
        if (registerForm) {
            registerForm.addEventListener('submit', handleRegister);
        }
    }

    if (currentPagePath.endsWith('/login.html')) {
        const loginForm = document.getElementById('loginForm');
        if (loginForm) {
            loginForm.addEventListener('submit', handleLogin);
        }
    }
});

// ============ KEEP ALL ORIGINAL FUNCTIONS BELOW ============

async function handleLogin(e) {
    e.preventDefault();
    const form = e.target;
    const btn = form.querySelector('button[type="submit"]');
    const alertContainer = form.querySelector('.form-message') || form;

    const email = form.querySelector('#email')?.value.trim();
    const password = form.querySelector('#password')?.value;

    if (!email || !password) {
        showAlert("Email and password are required.", 'error', alertContainer);
        return;
    }

    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Logging in...';
    
    try {
        const res = await fetch(`${AUTH_API_BASE_URL}/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });
        const data = await res.json();
        
        if (!res.ok || !data.success) {
            throw new Error(data.message || 'Login failed.');
        }

        localStorage.setItem(AUTH_TOKEN_KEY, data.token);
        localStorage.setItem(USER_INFO_KEY, JSON.stringify(data.user));
        
        showAlert(data.message || 'Login successful!', 'success', alertContainer);
        
        const redirectUrl = new URLSearchParams(window.location.search).get('redirect');
        setTimeout(() => {
            window.location.replace(redirectUrl || 'dashboard.html');
        }, 1500);
        
    } catch (err) {
        console.error("AUTH.JS: Login error", err);
        showAlert(err.message || 'Error logging in.', 'error', alertContainer);
    } finally {
        btn.disabled = false;
        btn.innerHTML = 'Login';
    }
}

async function handleRegister(e) {
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

function renderPageContent() {
    document.documentElement.style.visibility = 'visible';
    document.documentElement.style.opacity = '1';

    const loadingSpinnerOverlay = document.querySelector('.loading-spinner-overlay');
    if (loadingSpinnerOverlay) loadingSpinnerOverlay.style.display = 'none';
    
    document.body.classList.remove('auth-loading');
    updateNavBasedOnAuth();
}

function updateNavBasedOnAuth() {
    const token = localStorage.getItem(AUTH_TOKEN_KEY);
    const navUl = document.querySelector('header nav ul');
    if (!navUl) return;

    const loggedInLinks = navUl.querySelectorAll('a[href="dashboard.html"], a[href="wallet.html"], a[href="transactions.html"], #logoutBtn');
    const loggedOutLinks = navUl.querySelectorAll('a[href="login.html"], a[href="register.html"]');

    loggedInLinks.forEach(el => { if (el?.parentElement) el.parentElement.style.display = token ? 'list-item' : 'none'; });
    loggedOutLinks.forEach(el => { if (el?.parentElement) el.parentElement.style.display = token ? 'none' : 'list-item'; });
}

function handleLogout() {
    console.log("AUTH.JS: Logging out...");
    localStorage.removeItem(AUTH_TOKEN_KEY);
    localStorage.removeItem(USER_INFO_KEY);
    window.location.replace('index.html');
}

function showAlert(message, type = 'info', targetElement = null) {
    const existingAlert = document.querySelector('.app-global-alert');
    if (existingAlert) existingAlert.remove();
    
    const alertDiv = document.createElement('div');
    alertDiv.className = `app-global-alert alert-${type}`;
    alertDiv.innerHTML = `<span>${message}</span>`;
    
    // Apply your original styling exactly as before
    alertDiv.style.padding = '10px';
    alertDiv.style.margin = '10px auto';
    alertDiv.style.borderRadius = '4px';
    alertDiv.style.textAlign = 'center';
    alertDiv.style.maxWidth = '500px';
    alertDiv.style.backgroundColor = type === 'error' ? '#f8d7da' : (type === 'success' ? '#d4edda' : '#cce5ff');
    alertDiv.style.color = type === 'error' ? '#721c24' : (type === 'success' ? '#155724' : '#004085');
    alertDiv.style.border = type === 'error' ? '1px solid #f5c6cb' : (type === 'success' ? '1px solid #c3e6cb' : '1px solid #b8daff');

    (targetElement || document.body).prepend(alertDiv);
    
    setTimeout(() => {
        alertDiv.style.transition = 'opacity 0.5s ease';
        alertDiv.style.opacity = '0';
        setTimeout(() => alertDiv.remove(), 500);
    }, 4500);
}