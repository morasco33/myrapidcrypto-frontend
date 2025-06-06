// auth.js (Safe, Hardened V2.2 - Corrected API_BASE_URL)

// 1. DEFINE GLOBAL APP_KEYS FOR OTHER SCRIPTS
// These are the actual string values for localStorage/sessionStorage keys and the API base.
// This definition will be used by other scripts.
(function defineGlobalAppKeys() {
    let determinedApiBaseUrl;
    let determinedFrontendUrl; // For potential use by other scripts if backend needs it

    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        // LOCAL DEVELOPMENT
        determinedApiBaseUrl = "http://localhost:3001/api"; // Local backend runs on 3001, AND path includes /api
        determinedFrontendUrl = "http://localhost:5500";    // Example local frontend server port
    } else {
        // PRODUCTION (Netlify frontend, Render backend)
        determinedApiBaseUrl = "https://rapidcrypto-backend.onrender.com/api"; // Render URL WITH /api
        determinedFrontendUrl = "https://rapidcrypto.org";                   // Live frontend URL
    }

    window.APP_KEYS = {
        USER_INFO_KEY: 'rapidcrypto_user_info_v1',    // Standardized key name
        AUTH_TOKEN_KEY: 'rapidcrypto_auth_token_v1', // Standardized key name
        API_BASE_URL: determinedApiBaseUrl,          // Correctly determined API base URL with /api
        FRONTEND_URL: determinedFrontendUrl          // For email links, etc.
        // Add other global keys if needed by other scripts
    };

    // Log to confirm APP_KEYS is set when auth.js executes
    console.log('DEBUG [auth.js]: window.APP_KEYS defined:', JSON.parse(JSON.stringify(window.APP_KEYS)));
})();


// 2. CONSTANTS FOR INTERNAL USE WITHIN AUTH.JS
// These can now directly reference the globally defined keys for consistency.
const API_BASE_URL = window.APP_KEYS.API_BASE_URL; // This will now be correct (e.g., http://localhost:3001/api)
const AUTH_TOKEN_KEY = window.APP_KEYS.AUTH_TOKEN_KEY;
const USER_INFO_KEY = window.APP_KEYS.USER_INFO_KEY;

// These keys are specific to dashboard data, potentially cleared on logout.
const DASHBOARD_AVAILABLE_BALANCE_KEY = 'availableBalance_cs_v2';
const DASHBOARD_ACTIVE_INVESTMENTS_KEY = 'activeInvestments_cs_v2';
// Add other specific cache keys if this script manages them
const TRANSACTIONS_CACHE_KEY = 'rapidcrypto_transactions_cache_v1'; // From transactions.js


document.addEventListener('DOMContentLoaded', () => {
    const currentPage = window.location.pathname.split('/').pop() || 'index.html';
    console.log(`DEBUG [auth.js]: DOMContentLoaded on ${currentPage}`);

    // This check is a safeguard; APP_KEYS should be defined by the IIFE above before DOMContentLoaded.
    if (!window.APP_KEYS || !window.APP_KEYS.API_BASE_URL) {
        console.error("CRITICAL [auth.js]: window.APP_KEYS or API_BASE_URL did not initialize correctly. This is a bug.");
        showAlert('Application configuration error. Please try again later or contact support.', 'error');
        return; // Halt further auth processing if config is broken
    }

    // Specific event listeners for login/register forms if auth.js is handling them
    // If login.js and register.js are separate and handle their own forms, this section can be removed from auth.js.
    // Assuming for now that auth.js might be the SOLE handler for these forms if other scripts are not present.
    const registerForm = document.getElementById('registerForm');
    if (registerForm && currentPage === 'register.html') { // Ensure we are on the register page
        if (!registerForm.dataset.listenerAttachedByAuthJs) {
            registerForm.addEventListener('submit', handleAuthJsRegister);
            registerForm.dataset.listenerAttachedByAuthJs = 'true';
            console.log("DEBUG [auth.js]: Attached registerForm listener.");
        }
    }

    const loginForm = document.getElementById('loginForm');
    if (loginForm && currentPage === 'login.html') { // Ensure we are on the login page
        if (!loginForm.dataset.listenerAttachedByAuthJs) {
            loginForm.addEventListener('submit', handleAuthJsLogin);
            loginForm.dataset.listenerAttachedByAuthJs = 'true';
            console.log("DEBUG [auth.js]: Attached loginForm listener.");
        }
    }
    // --- End of form-specific listeners ---

    checkAuthState(); // Check auth state on all pages
    updateNavFooterBasedOnAuth(); // Update UI on all pages

    const logoutButton = document.getElementById('logoutBtn');
    const footerLogoutButton = document.getElementById('footerLogoutBtn'); // From index.html

    if (logoutButton && !logoutButton.dataset.listenerAttachedByAuthJs) {
        logoutButton.addEventListener('click', handleLogout);
        logoutButton.dataset.listenerAttachedByAuthJs = 'true';
        console.log("DEBUG [auth.js]: Attached logoutBtn listener.");
    }
    if (footerLogoutButton && !footerLogoutButton.dataset.listenerAttachedByAuthJs) {
        footerLogoutButton.addEventListener('click', handleLogout); // Same handler
        footerLogoutButton.dataset.listenerAttachedByAuthJs = 'true';
        console.log("DEBUG [auth.js]: Attached footerLogoutBtn listener.");
    }
});

// --- Form Handlers (handleAuthJsRegister, handleAuthJsLogin) ---
// These will use the API_BASE_URL defined at the top of this script, which now includes /api.
// So, the fetch URLs should be `${API_BASE_URL}/register` and `${API_BASE_URL}/login`.

async function handleAuthJsRegister(e) {
    e.preventDefault();
    const form = e.target;
    const btn = form.querySelector('button[type="submit"]');
    const originalBtnHtml = btn ? btn.innerHTML : 'Create Account'; // Match button text
    const messageContainer = document.getElementById('message') || form.querySelector('.form-message') || form; // More robust message element finding

    try {
        // --- Collect all fields from register.html ---
        const firstname = form.querySelector('#firstname')?.value.trim();
        const lastname = form.querySelector('#lastname')?.value.trim();
        const username = form.querySelector('#username')?.value.trim();
        const email = form.querySelector('#email')?.value.trim();
        const password = form.querySelector('#password')?.value;
        const confirmPassword = form.querySelector('#confirmPassword')?.value;
        const termsCheckbox = form.querySelector('#terms');

        // --- Validations (from register.js) ---
        if (!firstname || !lastname || !username || !email || !password || !confirmPassword) {
            showAlert('Please fill in all required fields.', 'error', messageContainer); return;
        }
        if (password !== confirmPassword) {
            showAlert('Passwords do not match.', 'error', messageContainer); return;
        }
        if (password.length < 6) { // Match your backend's requirement
            showAlert('Password must be at least 6 characters.', 'error', messageContainer); return;
        }
        if (username.length < 3) {
            showAlert('Username must be at least 3 characters.', 'error', messageContainer); return;
        }
        if (!/\S+@\S+\.\S+/.test(email)) {
            showAlert('Enter a valid email address.', 'error', messageContainer); return;
        }
        if (termsCheckbox && !termsCheckbox.checked) {
            showAlert('You must agree to the Terms and Conditions.', 'error', messageContainer); return;
        }
        // --- End Validations ---

        if (btn) {
            btn.disabled = true;
            btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Creating Account...';
        }

        // API_BASE_URL already includes /api, so just append /register
        const response = await fetch(`${API_BASE_URL}/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            // Send all necessary fields including firstname and lastname
            body: JSON.stringify({ firstname, lastname, username, email, password }),
        });

        const data = await response.json();
        if (!response.ok || !data.success) { // Backend sends {success: false, message: "..."}
            throw new Error(data.message || 'Registration failed. Please try again.');
        }

        // Backend sends {success: true, message: "Registered! Verification email sent."}
        showAlert(data.message || 'Registration successful! Please check your email to verify.', 'success', messageContainer);
        form.reset(); // Clear form on success
    } catch (error) {
        const msg = error.message && error.message.includes('Failed to fetch')
            ? 'Cannot connect to the registration server. Please check your internet connection.'
            : error.message;
        showAlert(msg, 'error', messageContainer);
        console.error("ERROR [auth.js handleAuthJsRegister]:", error);
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = originalBtnHtml;
        }
    }
}

async function handleAuthJsLogin(e) {
    e.preventDefault();
    const form = e.target;
    const btn = form.querySelector('button[type="submit"]');
    const originalBtnHtml = btn ? btn.innerHTML : 'Login'; // Match button text
    const messageContainer = document.getElementById('loginMessage') || form.querySelector('.form-message') || form;
    const resendVerificationSection = document.getElementById('resendVerificationSection'); // From login.html

    try {
        // Use 'email' and 'password' IDs as per login.html
        const email = form.querySelector('#email')?.value.trim();
        const password = form.querySelector('#password')?.value;

        if (!email || !password) {
            showAlert('Please enter both email and password.', 'error', messageContainer); return;
        }
        if (!/\S+@\S+\.\S+/.test(email)) {
            showAlert('Please enter a valid email address.', 'error', messageContainer); return;
        }

        if (btn) {
            btn.disabled = true;
            btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Logging in...';
        }

        // API_BASE_URL already includes /api, so just append /login
        const response = await fetch(`${API_BASE_URL}/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password }),
        });

        const data = await response.json(); // Parse JSON regardless of status

        if (!response.ok) { // Handle 4xx, 5xx errors
            if (response.status === 403 && data.needsVerification) {
                showAlert(data.message || 'Email not verified. Please check your email or resend verification.', 'error', messageContainer);
                if (resendVerificationSection) resendVerificationSection.style.display = 'block';
                 // Setup resend button listener if not already (or ensure login.js handles it)
                const resendBtn = document.getElementById('resendVerificationBtn');
                if(resendBtn && !resendBtn.dataset.authJsListener) {
                    resendBtn.addEventListener('click', () => handleResendVerificationEmail(email));
                    resendBtn.dataset.authJsListener = 'true';
                }
            } else {
                throw new Error(data.message || 'Login failed. Please check your credentials.');
            }
            return; // Stop further processing on error
        }

        // If response.ok (e.g., 200) and backend sends {success: true, token, user}
        if (data.success && data.token && data.user) {
            // --- ALIGNMENT: Use sessionStorage for token, localStorage for user info if preferred by other scripts ---
            sessionStorage.setItem(AUTH_TOKEN_KEY, data.token); // Store token in sessionStorage
            localStorage.setItem(USER_INFO_KEY, JSON.stringify(data.user)); // User info for display

            showAlert('Login successful! Redirecting to your dashboard...', 'success', messageContainer);
            setTimeout(() => {
                window.location.href = 'dashboard.html'; // Or use a redirect parameter if available
            }, 1500);
        } else {
            // Should not happen if backend sends correct 200 success response
            throw new Error(data.message || 'Login successful, but server response was incomplete.');
        }

    } catch (error) {
        const msg = error.message && error.message.includes('Failed to fetch')
            ? 'Cannot connect to the login server. Please check your internet connection.'
            : error.message;
        showAlert(msg, 'error', messageContainer);
        console.error("ERROR [auth.js handleAuthJsLogin]:", error);
    } finally {
        if (btn && !(messageContainer.className.includes('success'))) { // Don't reset button if redirecting
            btn.disabled = false;
            btn.innerHTML = originalBtnHtml;
        }
    }
}

async function handleResendVerificationEmail(emailForResend) {
    const resendMessageEl = document.getElementById('resendMessage');
    const resendBtn = document.getElementById('resendVerificationBtn');
    if (!emailForResend && document.getElementById('email')) { // Get email from input if not passed
        emailForResend = document.getElementById('email').value.trim();
    }

    if (!emailForResend) {
        if (resendMessageEl) resendMessageEl.textContent = 'Email address not found to resend verification.';
        return;
    }

    if (resendMessageEl) resendMessageEl.textContent = 'Sending...';
    if (resendBtn) resendBtn.disabled = true;

    try {
        const response = await fetch(`${API_BASE_URL}/resend-verification-email`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: emailForResend }),
        });
        const data = await response.json();
        if (!response.ok || !data.success) {
            throw new Error(data.message || 'Failed to resend verification email.');
        }
        if (resendMessageEl) resendMessageEl.textContent = data.message || 'Verification email resent successfully.';
    } catch (error) {
        if (resendMessageEl) resendMessageEl.textContent = error.message || 'Error resending verification.';
        console.error("Error resending verification:", error);
    } finally {
        if (resendBtn) resendBtn.disabled = false;
    }
}


// --- Auth State Management (checkAuthState, updateNavFooterBasedOnAuth, handleLogout) ---
function checkAuthState() {
    const protectedPages = ['dashboard.html', 'wallet.html', 'transactions.html', 'transfer.html', 'deposit.html', 'withdraw.html', /* add other protected pages */];
    const authFlowPages = ['login.html', 'register.html', 'forgot-password.html', 'reset-password.html', 'verify-email.html'];

    let currentPage = window.location.pathname.split('/').pop() || 'index.html';
    // --- ALIGNMENT: Use sessionStorage for token check ---
    const token = sessionStorage.getItem(AUTH_TOKEN_KEY);
    const validToken = token && token !== 'undefined' && token !== 'null'; // Basic check

    console.log(`DEBUG [auth.js checkAuthState]: Page='${currentPage}' | Token in sessionStorage=${!!validToken}`);

    if (protectedPages.includes(currentPage)) {
        if (!validToken) {
            console.warn(`Redirecting from protected page '${currentPage}' to login due to missing/invalid token.`);
            // Clear any potentially stale user info if token is bad
            localStorage.removeItem(USER_INFO_KEY);
            window.location.href = `login.html?redirectTo=${encodeURIComponent(currentPage)}&reason=auth_required`;
        }
    } else if (authFlowPages.includes(currentPage)) {
        if (validToken && currentPage !== 'verify-email.html') { // Allow verify-email even if logged in, though unusual
            console.log(`User already authenticated, redirecting from auth page '${currentPage}' to dashboard.`);
            window.location.href = 'dashboard.html?reason=already_authenticated';
        }
    }
}

function updateNavFooterBasedOnAuth() {
    // --- ALIGNMENT: Use sessionStorage for token check ---
    const token = sessionStorage.getItem(AUTH_TOKEN_KEY);
    const validToken = token && token !== 'undefined' && token !== 'null';
    const navUl = document.getElementById('mainNavUl'); // Assuming ID on main nav UL from index.html

    if (!navUl) {
        // console.log("DEBUG [auth.js updateNav]: Main navigation <ul> (id: mainNavUl) not found, skipping nav update.");
        return;
    }

    // More robust selectors for nav items, assuming they have consistent classes or structure
    const navLoginLink = document.getElementById('navLoginLink');
    const navRegisterLink = document.getElementById('navRegisterLink');
    const navDashboardLink = navUl.querySelector('a[href="dashboard.html"]')?.closest('li');
    const navWalletLink = navUl.querySelector('a[href="wallet.html"]')?.closest('li');
    const navTransactionsLink = navUl.querySelector('a[href="transactions.html"]')?.closest('li');
    const navLogoutItem = document.getElementById('logoutNavItem'); // The <li> containing the logout button
    const footerLogoutLi = document.getElementById('footerLogoutLi'); // From index.html

    if (navLoginLink) navLoginLink.style.display = validToken ? 'none' : '';
    if (navRegisterLink) navRegisterLink.style.display = validToken ? 'none' : '';
    if (navDashboardLink) navDashboardLink.style.display = validToken ? '' : 'none';
    if (navWalletLink) navWalletLink.style.display = validToken ? '' : 'none';
    if (navTransactionsLink) navTransactionsLink.style.display = validToken ? '' : 'none';
    if (navLogoutItem) navLogoutItem.style.display = validToken ? '' : 'none';
    if (footerLogoutLi) footerLogoutLi.style.display = validToken ? '' : 'none';

    console.log(`DEBUG [auth.js updateNav]: Navigation updated. LoggedIn=${validToken}`);
}

function handleLogout() {
    console.log("DEBUG [auth.js]: Logging out...");
    // --- ALIGNMENT: Clear from sessionStorage ---
    sessionStorage.removeItem(AUTH_TOKEN_KEY);
    localStorage.removeItem(USER_INFO_KEY); // User display info can remain in localStorage if preferred
    
    // Clear other cached data
    localStorage.removeItem(DASHBOARD_AVAILABLE_BALANCE_KEY);
    localStorage.removeItem(DASHBOARD_ACTIVE_INVESTMENTS_KEY);
    localStorage.removeItem(TRANSACTIONS_CACHE_KEY); // Clear transactions cache

    // Optionally, call a backend logout endpoint if you implement one (e.g., to invalidate refresh tokens)
    // fetch(`${API_BASE_URL}/logout`, { method: 'POST', headers: {'Authorization': `Bearer ${tokenFromBeforeClear}`}}).catch(err => console.warn("Backend logout call failed", err));

    updateNavFooterBasedOnAuth(); // Update UI immediately
    window.location.href = 'login.html?logout=success'; // Redirect to login or home after logout
}

// --- showAlert Utility --- (Generally good, ensure CSS classes .alert-success, .alert-error etc. are defined)
function showAlert(message, type = 'info', targetElement = null) {
    // Remove any existing alert first
    const existingAlert = document.querySelector('.app-global-alert');
    if (existingAlert) existingAlert.remove();

    const alertDiv = document.createElement('div');
    alertDiv.className = `app-global-alert alert-${type}`; // e.g., alert-success, alert-error

    const icons = {
        success: 'fa-check-circle', error: 'fa-exclamation-circle',
        warning: 'fa-exclamation-triangle', info: 'fa-info-circle',
    };
    alertDiv.innerHTML = `<i class="fas ${icons[type] || icons.info}" style="margin-right: 8px;"></i> <span>${message}</span>`;

    // Basic inline styles for visibility, can be enhanced with CSS classes
    const typeStyles = {
        error: { color: '#721c24', backgroundColor: '#f8d7da', borderColor: '#f5c6cb' },
        success: { color: '#155724', backgroundColor: '#d4edda', borderColor: '#c3e6cb' },
        warning: { color: '#856404', backgroundColor: '#fff3cd', borderColor: '#ffeeba' },
        info: { color: '#004085', backgroundColor: '#cce5ff', borderColor: '#b8daff' }
    };
    Object.assign(alertDiv.style, {
        padding: '12px 18px', marginBottom: '15px', border: '1px solid transparent',
        borderRadius: '5px', textAlign: 'left', fontSize: '0.95em', wordWrap: 'break-word',
        ...typeStyles[type],
    });

    if (targetElement && targetElement.offsetParent !== null) { // Check if targetElement is visible and in DOM
        // Insert before the targetElement if it's a form, or as its first child
        if (targetElement.tagName === 'FORM') {
            targetElement.parentNode.insertBefore(alertDiv, targetElement);
        } else {
            targetElement.prepend(alertDiv);
        }
    } else { // Fallback to a fixed global alert
        Object.assign(alertDiv.style, {
            position: 'fixed', top: '20px', left: '50%',
            transform: 'translateX(-50%)', zIndex: '10000',
            minWidth: '300px', maxWidth: 'calc(100% - 40px)', boxShadow: '0 3px 10px rgba(0,0,0,0.15)',
        });
        document.body.insertBefore(alertDiv, document.body.firstChild);
    }

    // Auto-dismiss
    setTimeout(() => {
        alertDiv.style.transition = 'opacity 0.5s ease-out';
        alertDiv.style.opacity = '0';
        setTimeout(() => alertDiv.remove(), 500);
    }, 4500);
}