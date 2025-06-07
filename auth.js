// auth.js (Safe, Hardened V2.2 - Updated for APP_KEYS and Debugging)

// 1. DEFINE GLOBAL APP_KEYS FOR OTHER SCRIPTS
window.APP_KEYS = {
    USER_INFO_KEY: 'cryptohub_user_info',
    AUTH_TOKEN_KEY: 'cryptohub_auth_token',
    API_BASE_URL: 'https://rapidcrypto-backend.onrender.com'
};
console.log('DEBUG [auth.js]: window.APP_KEYS defined:', JSON.parse(JSON.stringify(window.APP_KEYS)));

// 2. CONSTANTS FOR LOCAL USE
const API_BASE_URL = window.APP_KEYS.API_BASE_URL;
const AUTH_TOKEN_KEY = window.APP_KEYS.AUTH_TOKEN_KEY;
const USER_INFO_KEY = window.APP_KEYS.USER_INFO_KEY;
const DASHBOARD_AVAILABLE_BALANCE_KEY = 'availableBalance_cs_v2';
const DASHBOARD_ACTIVE_INVESTMENTS_KEY = 'activeInvestments_cs_v2';

document.addEventListener('DOMContentLoaded', () => {
    const currentPage = window.location.pathname.split('/').pop() || 'index.html';
    console.log(`DEBUG [auth.js]: DOMContentLoaded on ${currentPage}`);

    if (!window.APP_KEYS?.USER_INFO_KEY) {
        console.error("CRITICAL [auth.js]: APP_KEYS failed to initialize.");
    }

    // --- Register Form ---
    const registerForm = document.getElementById('registerForm');
    if (currentPage === 'register.html' && registerForm && !registerForm.dataset.listenerAttachedByAuthJs) {
        registerForm.addEventListener('submit', handleAuthJsRegister);
        registerForm.dataset.listenerAttachedByAuthJs = 'true';
        console.log("DEBUG [auth.js]: Attached registerForm listener.");
    }

    // --- Login Form ---
    const loginForm = document.getElementById('loginForm');
    if (currentPage === 'login.html' && loginForm && !loginForm.dataset.listenerAttachedByAuthJs) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            console.log("DEBUG [auth.js login]: Login form submitted");

            const loginMessageDiv = document.getElementById('loginMessage');
            if (loginMessageDiv) loginMessageDiv.textContent = '';

            const email = loginForm.email?.value.trim();
            const password = loginForm.password?.value;

            if (!email || !password) {
                loginMessageDiv.textContent = 'Please enter email and password.';
                return;
            }

            const submitBtn = loginForm.querySelector('button[type="submit"]');
            const originalBtnText = submitBtn?.innerHTML;
            if (submitBtn) {
                submitBtn.disabled = true;
                submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Logging in...';
            }

            try {
                const res = await fetch(`${API_BASE_URL}/login`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email, password })
                });

                const data = await res.json();
                console.log("DEBUG [auth.js login]: Response:", data);

                if (!res.ok || !data.success || !data.token) {
                    const msg = data?.message || 'Login failed. Please try again.';
                    loginMessageDiv.textContent = msg;
                    return;
                }

                localStorage.setItem(AUTH_TOKEN_KEY, data.token);
                localStorage.setItem(USER_INFO_KEY, JSON.stringify(data.user || {}));
                console.log("DEBUG [auth.js login]: Login success. Token saved.");

                const urlParams = new URLSearchParams(window.location.search);
                const redirectTo = urlParams.get('redirectedFrom') || 'dashboard.html';
                window.location.href = redirectTo;

            } catch (err) {
                console.error("ERROR [auth.js login]:", err);
                loginMessageDiv.textContent = 'Network error. Please try again later.';
            } finally {
                if (submitBtn) {
                    submitBtn.disabled = false;
                    submitBtn.innerHTML = originalBtnText;
                }
            }
        });

        loginForm.dataset.listenerAttachedByAuthJs = 'true';
        console.log("DEBUG [auth.js]: Attached loginForm listener.");
    }

    // --- Logout Button ---
    const logoutButton = document.getElementById('logoutBtn');
    if (logoutButton && !logoutButton.dataset.listenerAttachedByAuthJs) {
        logoutButton.addEventListener('click', handleLogout);
        logoutButton.dataset.listenerAttachedByAuthJs = 'true';
        console.log("DEBUG [auth.js]: Attached logoutBtn listener.");
    }

    // Run auth checks
    checkAuthState();
    updateNavFooterBasedOnAuth();
});

// ----------- Functions -----------

function checkAuthState() {
    const protectedPages = ['dashboard.html', 'wallet.html', 'transactions.html', 'deposit.html', 'withdraw.html'];
    const authFlowPages = ['login.html', 'register.html', 'forgot-password.html', 'verify-email.html'];
    const currentPage = window.location.pathname.split('/').pop() || 'index.html';

    const token = localStorage.getItem(AUTH_TOKEN_KEY);
    const validToken = token && token !== 'undefined' && token !== 'null';

    console.log(`DEBUG [auth.js checkAuthState]: Page='${currentPage}' | Token Exists=${!!validToken}`);

    if (protectedPages.includes(currentPage) && !validToken) {
        console.warn(`Redirecting to login from '${currentPage}' due to missing token.`);
        window.location.href = `login.html?redirectedFrom=${encodeURIComponent(currentPage)}&reason=auth_required`;
    } else if (authFlowPages.includes(currentPage) && validToken) {
        console.log(`User already logged in, redirecting from '${currentPage}' to dashboard.`);
        window.location.href = 'dashboard.html?reason=already_authenticated';
    }
}

function updateNavFooterBasedOnAuth() {
    const token = localStorage.getItem(AUTH_TOKEN_KEY);
    const validToken = token && token !== 'undefined' && token !== 'null';
    const navUl = document.querySelector('header nav ul');

    if (!navUl) {
        console.log("DEBUG [auth.js updateNav]: No <ul> in <nav>.");
        return;
    }

    const toggleDisplay = (selector, show) => {
        const el = navUl.querySelector(selector);
        if (!el) return;
        const parent = el.closest('li') || el;
        parent.style.display = show ? '' : 'none';
    };

    const toggleBtnDisplay = (btnId, show) => {
        const btn = document.getElementById(btnId);
        if (!btn) return;
        const parent = btn.closest('li') || btn;
        parent.style.display = show ? '' : 'none';
    };

    toggleDisplay('a[href="dashboard.html"]', validToken);
    toggleDisplay('a[href="wallet.html"]', validToken);
    toggleDisplay('a[href="transactions.html"]', validToken);
    toggleDisplay('a[href="deposit.html"]', validToken);
    toggleDisplay('a[href="withdraw.html"]', validToken);
    toggleDisplay('a[href="login.html"]', !validToken);
    toggleDisplay('a[href="register.html"]', !validToken);

    toggleBtnDisplay('logoutBtn', validToken);
    console.log(`DEBUG [auth.js updateNav]: Nav updated for ${validToken ? 'logged in' : 'logged out'} user.`);
}

function handleLogout() {
    localStorage.removeItem(AUTH_TOKEN_KEY);
    localStorage.removeItem(USER_INFO_KEY);
    localStorage.removeItem(DASHBOARD_AVAILABLE_BALANCE_KEY);
    localStorage.removeItem(DASHBOARD_ACTIVE_INVESTMENTS_KEY);
    window.location.href = 'login.html?reason=logout_success';
}

async function handleAuthJsRegister(e) {
    e.preventDefault();
    const form = e.target;
    const btn = form.querySelector('button[type="submit"]');
    const messageContainer = form.querySelector('#registerMessage') || form;
    const originalBtnText = btn?.innerHTML || 'Register';

    try {
        const username = form.querySelector('#username')?.value.trim();
        const email = form.querySelector('#email')?.value.trim();
        const password = form.querySelector('#password')?.value;
        const confirmPassword = form.querySelector('#confirmPassword')?.value;

        if (!username || !email || !password || !confirmPassword) {
            showAlert('Please fill in all required fields.', 'error', messageContainer);
            return;
        }

        if (password !== confirmPassword) {
            showAlert('Passwords do not match.', 'error', messageContainer);
            return;
        }

        if (password.length < 6) {
            showAlert('Password must be at least 6 characters.', 'error', messageContainer);
            return;
        }

        if (!/\S+@\S+\.\S+/.test(email)) {
            showAlert('Enter a valid email address.', 'error', messageContainer);
            return;
        }

        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Registering...';

        const response = await fetch(`${API_BASE_URL}/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, email, password })
        });

        const data = await response.json();
        if (!response.ok || !data.success) {
            throw new Error(data.message || 'Registration failed.');
        }

        showAlert(data.message || 'Registration successful. Check your email.', 'success', messageContainer);
        form.reset();

    } catch (error) {
        const msg = error.message === 'Failed to fetch'
            ? 'Cannot connect to server. Check your connection.'
            : error.message;
        showAlert(msg, 'error', messageContainer);
        console.error("ERROR [auth.js handleAuthJsRegister]:", error);
    } finally {
        btn.disabled = false;
        btn.innerHTML = originalBtnText;
    }
}

function showAlert(message, type = 'info', container = document.body) {
    const existingAlert = container.querySelector('.auth-alert');
    if (existingAlert) existingAlert.remove();

    const alertDiv = document.createElement('div');
    alertDiv.className = `auth-alert alert-${type}`;
    alertDiv.textContent = message;

    alertDiv.style.padding = '12px 15px';
    alertDiv.style.margin = '10px 0';
    alertDiv.style.borderRadius = '4px';
    alertDiv.style.color = type === 'error' ? '#a94442' : (type === 'success' ? '#3c763d' : '#31708f');
    alertDiv.style.backgroundColor = type === 'error' ? '#f2dede' : (type === 'success' ? '#dff0d8' : '#d9edf7');
    alertDiv.style.border = `1px solid ${type === 'error' ? '#ebccd1' : (type === 'success' ? '#d6e9c6' : '#bce8f1')}`;

    container.prepend(alertDiv);

    setTimeout(() => alertDiv.remove(), 5000);
}
