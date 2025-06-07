// auth.js (Safe, Hardened V2.1 - Updated for APP_KEYS)

// 1. DEFINE GLOBAL APP_KEYS FOR OTHER SCRIPTS (LIKE SCRIPT.JS)
// These are the actual string values for localStorage keys related to auth and API.
window.APP_KEYS = {
    USER_INFO_KEY: 'cryptohub_user_info',       // Used by script.js
    AUTH_TOKEN_KEY: 'cryptohub_auth_token',     // Used by script.js
    API_BASE_URL: 'https://rapidcrypto-backend.onrender.com'   // Exposing API base URL globally
};
// Log to confirm APP_KEYS is set when auth.js executes
console.log('DEBUG [auth.js]: window.APP_KEYS defined:', JSON.parse(JSON.stringify(window.APP_KEYS)));


// 2. CONSTANTS FOR INTERNAL USE WITHIN AUTH.JS
// These can now directly reference the globally defined keys for consistency.
const API_BASE_URL = window.APP_KEYS.API_BASE_URL;
const AUTH_TOKEN_KEY = window.APP_KEYS.AUTH_TOKEN_KEY;
const USER_INFO_KEY = window.APP_KEYS.USER_INFO_KEY;

// These keys are specific to dashboard data, potentially cleared on logout.
// They are not part of the APP_KEYS expected by script.js's initial validation.
const DASHBOARD_AVAILABLE_BALANCE_KEY = 'availableBalance_cs_v2';
const DASHBOARD_ACTIVE_INVESTMENTS_KEY = 'activeInvestments_cs_v2';

// --- REST OF YOUR AUTH.JS CODE (UNCHANGED FUNCTIONALLY, JUST ENSURING KEY CONSISTENCY) ---

document.addEventListener('DOMContentLoaded', () => {
    const currentPage = window.location.pathname.split('/').pop() || 'index.html';
    console.log(`DEBUG [auth.js]: DOMContentLoaded on ${currentPage}`);

    // Ensure APP_KEYS is available for any early checks if other scripts also run on DOMContentLoaded
    // and depend on it, though the main script.js error comes from its own internal check.
    if (!window.APP_KEYS || !window.APP_KEYS.USER_INFO_KEY) {
        console.error("CRITICAL [auth.js]: window.APP_KEYS did not initialize correctly within auth.js itself. This is a bug.");
        // Potentially show an error to the user here or halt further auth operations
    }


    if (currentPage === 'register.html' && document.getElementById('registerForm')) {
        const registerForm = document.getElementById('registerForm');
        if (!registerForm.dataset.listenerAttachedByAuthJs) {
            registerForm.addEventListener('submit', handleAuthJsRegister);
            registerForm.dataset.listenerAttachedByAuthJs = 'true';
            console.log("DEBUG [auth.js]: Attached registerForm listener.");
        }
    }
    // Note: If you have a login.html with a loginForm, you'd add its listener here too.

    checkAuthState();
    updateNavFooterBasedOnAuth();

    const logoutButton = document.getElementById('logoutBtn');
    if (logoutButton && !logoutButton.dataset.listenerAttachedByAuthJs) {
        logoutButton.addEventListener('click', handleLogout);
        logoutButton.dataset.listenerAttachedByAuthJs = 'true';
        console.log("DEBUG [auth.js]: Attached logoutBtn listener.");
    }
});

async function handleAuthJsRegister(e) {
    e.preventDefault();
    const form = e.target;
    const btn = form.querySelector('button[type="submit"]');
    const originalBtnText = btn ? btn.innerHTML : 'Register';
    const messageContainer = form.querySelector('#registerMessage') || form;

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

        if (btn) {
            btn.disabled = true;
            btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Registering...';
        }

        const response = await fetch(`${API_BASE_URL}/register`, { // Uses the defined API_BASE_URL
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, email, password }),
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
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = originalBtnText;
        }
    }
}

function checkAuthState() {
    const protectedPages = ['dashboard.html', 'wallet.html', 'transactions.html', 'deposit.html', 'withdraw.html'];
    const authFlowPages = ['login.html', 'register.html', 'forgot-password.html', 'verify-email.html'];

    let currentPage = window.location.pathname.split('/').pop() || 'index.html';
    const token = localStorage.getItem(AUTH_TOKEN_KEY); // Uses the defined AUTH_TOKEN_KEY
    const validToken = token && token !== 'undefined' && token !== 'null';

    console.log(`DEBUG [auth.js checkAuthState]: Page='${currentPage}' | Token Exists=${!!validToken}`);

    if (protectedPages.includes(currentPage)) {
        if (!validToken) {
            console.warn(`Redirecting from '${currentPage}' to login due to missing token.`);
            window.location.href = `login.html?redirectedFrom=${encodeURIComponent(currentPage)}&reason=auth_required`;
        }
    } else if (authFlowPages.includes(currentPage)) {
        if (validToken) {
            console.log(`User already logged in, redirecting from '${currentPage}' to dashboard.`);
            window.location.href = 'dashboard.html?reason=already_authenticated';
        }
    }
}

function updateNavFooterBasedOnAuth() {
    const token = localStorage.getItem(AUTH_TOKEN_KEY); // Uses the defined AUTH_TOKEN_KEY
    const validToken = token && token !== 'undefined' && token !== 'null';
    const navUl = document.querySelector('header nav ul');

    if (!navUl) {
        console.log("DEBUG [auth.js updateNav]: No <ul> found in <nav>, skipping nav update.");
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
        const parent = btn.closest('li') || btn; // Assuming button might be wrapped in an li for nav consistency
        parent.style.display = show ? '' : 'none';
    };

    toggleDisplay('a[href="dashboard.html"]', validToken);
    toggleDisplay('a[href="wallet.html"]', validToken);
    toggleDisplay('a[href="transactions.html"]', validToken);
    toggleDisplay('a[href="login.html"]', !validToken);
    toggleDisplay('a[href="register.html"]', !validToken);
    toggleBtnDisplay('logoutBtn', validToken);

    console.log(`DEBUG [auth.js updateNav]: Navigation updated. LoggedIn=${validToken}`);
}

function handleLogout() {
    console.log("DEBUG [auth.js]: Logging out...");
    localStorage.removeItem(AUTH_TOKEN_KEY); // Uses the defined AUTH_TOKEN_KEY
    localStorage.removeItem(USER_INFO_KEY);   // Uses the defined USER_INFO_KEY
    localStorage.removeItem(DASHBOARD_AVAILABLE_BALANCE_KEY);
    localStorage.removeItem(DASHBOARD_ACTIVE_INVESTMENTS_KEY);

    // Consider also clearing any data script.js might have stored that's user-specific
    // if script.js exposes a method for it, or if you know its localStorage keys.
    // Example:
    // if (window.clearScriptJSUserData) { window.clearScriptJSUserData(); }
    // Or directly:
    // localStorage.removeItem('script_js_user_assets_v3');
    // localStorage.removeItem('script_js_user_transactions_v3');
    // However, this couples auth.js to script.js's internal keys. Better if script.js handles its own cleanup on logout event if needed.

    updateNavFooterBasedOnAuth(); // Update nav before redirecting
    window.location.href = 'index.html'; // Redirect to home or login page
}

function showAlert(message, type = 'info', targetElement = null) {
    const existing = document.querySelector('.app-global-alert');
    if (existing) existing.remove();

    const alert = document.createElement('div');
    alert.className = `app-global-alert alert-${type}`; // Added app-global-alert for easier selection
    const icons = {
        success: 'fa-check-circle',
        error: 'fa-exclamation-circle',
        warning: 'fa-exclamation-triangle',
        info: 'fa-info-circle',
    };
    alert.innerHTML = `<i class="fas ${icons[type] || icons.info}"></i> <span>${message}</span>`;

    const typeStyles = {
        error: { color: '#721c24', backgroundColor: '#f8d7da', borderColor: '#f5c6cb' },
        success: { color: '#155724', backgroundColor: '#d4edda', borderColor: '#c3e6cb' },
        warning: { color: '#856404', backgroundColor: '#fff3cd', borderColor: '#ffeeba' },
        info: { color: '#004085', backgroundColor: '#cce5ff', borderColor: '#b8daff' }
    };
    Object.assign(alert.style, {
        padding: '12px 18px',
        marginBottom: '15px',
        border: '1px solid transparent',
        borderRadius: '5px',
        textAlign: 'left',
        fontSize: '0.95em',
        wordWrap: 'break-word',
        ...typeStyles[type],
    });

    const parentForAlert = targetElement || document.body;
    if (targetElement) {
        targetElement.prepend(alert);
    } else { // Global, fixed alert
        Object.assign(alert.style, {
            position: 'fixed',
            top: '20px',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: '10000',
            minWidth: '300px',
            maxWidth: '90%',
            boxShadow: '0 3px 10px rgba(0,0,0,0.15)',
        });
        document.body.insertBefore(alert, document.body.firstChild);
    }

    setTimeout(() => {
        alert.style.transition = 'opacity 0.5s ease-out';
        alert.style.opacity = '0';
        setTimeout(() => alert.remove(), 500);
    }, 4500);
}