// auth.js (Use this version - based on yours with slightly enhanced logging for login)
// This version will handle the login form submission.

// 1. DEFINE GLOBAL APP_KEYS FOR OTHER SCRIPTS
(function defineGlobalAppKeys() {
    let determinedApiBaseUrl;
    let determinedFrontendUrl;

    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        determinedApiBaseUrl = "http://localhost:3001/api";
        determinedFrontendUrl = "http://localhost:5500";
    } else {
        determinedApiBaseUrl = "https://rapidcrypto-backend.onrender.com/api";
        determinedFrontendUrl = "https://rapidcrypto.org";
    }

    window.APP_KEYS = {
        USER_INFO_KEY: 'rapidcrypto_user_info_v1',
        AUTH_TOKEN_KEY: 'rapidcrypto_auth_token_v1',
        API_BASE_URL: determinedApiBaseUrl,
        FRONTEND_URL: determinedFrontendUrl
    };
    console.log('DEBUG [auth.js]: window.APP_KEYS defined:', JSON.parse(JSON.stringify(window.APP_KEYS)));
})();

// 2. CONSTANTS FOR INTERNAL USE WITHIN AUTH.JS
const API_BASE_URL = window.APP_KEYS.API_BASE_URL;
const AUTH_TOKEN_KEY = window.APP_KEYS.AUTH_TOKEN_KEY;
const USER_INFO_KEY = window.APP_KEYS.USER_INFO_KEY;
const DASHBOARD_AVAILABLE_BALANCE_KEY = 'availableBalance_cs_v2';
const DASHBOARD_ACTIVE_INVESTMENTS_KEY = 'activeInvestments_cs_v2';
const TRANSACTIONS_CACHE_KEY = 'rapidcrypto_transactions_cache_v1';

document.addEventListener('DOMContentLoaded', () => {
    const currentPage = window.location.pathname.split('/').pop() || 'index.html';
    console.log(`DEBUG [auth.js]: DOMContentLoaded on ${currentPage}`);

    if (!window.APP_KEYS || !window.APP_KEYS.API_BASE_URL) {
        console.error("CRITICAL [auth.js]: window.APP_KEYS or API_BASE_URL did not initialize correctly. This is a bug.");
        showAlert('Application configuration error. Please try again later or contact support.', 'error');
        return;
    }

    const registerForm = document.getElementById('registerForm');
    if (registerForm && currentPage === 'register.html') {
        if (!registerForm.dataset.listenerAttachedByAuthJs) {
            registerForm.addEventListener('submit', handleAuthJsRegister);
            registerForm.dataset.listenerAttachedByAuthJs = 'true';
            console.log("DEBUG [auth.js]: Attached registerForm listener.");
        }
    }

    const loginForm = document.getElementById('loginForm');
    if (loginForm && currentPage === 'login.html') {
        if (!loginForm.dataset.listenerAttachedByAuthJs) {
            loginForm.addEventListener('submit', handleAuthJsLogin);
            loginForm.dataset.listenerAttachedByAuthJs = 'true';
            console.log("DEBUG [auth.js]: Attached loginForm listener to #loginForm."); // Specific log
        }
    }

    checkAuthState();
    updateNavFooterBasedOnAuth();

    const logoutButton = document.getElementById('logoutBtn');
    const footerLogoutButton = document.getElementById('footerLogoutBtn');

    if (logoutButton && !logoutButton.dataset.listenerAttachedByAuthJs) {
        logoutButton.addEventListener('click', handleLogout);
        logoutButton.dataset.listenerAttachedByAuthJs = 'true';
        console.log("DEBUG [auth.js]: Attached logoutBtn listener.");
    }
    if (footerLogoutButton && !footerLogoutButton.dataset.listenerAttachedByAuthJs) {
        footerLogoutButton.addEventListener('click', handleLogout);
        footerLogoutButton.dataset.listenerAttachedByAuthJs = 'true';
        console.log("DEBUG [auth.js]: Attached footerLogoutBtn listener.");
    }
});

async function handleAuthJsRegister(e) {
    e.preventDefault();
    const form = e.target;
    const btn = form.querySelector('button[type="submit"]');
    const originalBtnHtml = btn ? btn.innerHTML : 'Create Account';
    const messageContainer = document.getElementById('message') || form.querySelector('.form-message') || form;

    try {
        const firstname = form.querySelector('#firstname')?.value.trim();
        const lastname = form.querySelector('#lastname')?.value.trim();
        const username = form.querySelector('#username')?.value.trim();
        const email = form.querySelector('#email')?.value.trim();
        const password = form.querySelector('#password')?.value;
        const confirmPassword = form.querySelector('#confirmPassword')?.value;
        const termsCheckbox = form.querySelector('#terms');

        if (!firstname || !lastname || !username || !email || !password || !confirmPassword) {
            showAlert('Please fill in all required fields.', 'error', messageContainer); return;
        }
        if (password !== confirmPassword) {
            showAlert('Passwords do not match.', 'error', messageContainer); return;
        }
        if (password.length < 6) {
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

        if (btn) {
            btn.disabled = true;
            btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Creating Account...';
        }

        const response = await fetch(`${API_BASE_URL}/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ firstname, lastname, username, email, password }),
        });

        const data = await response.json();
        if (!response.ok || !data.success) {
            throw new Error(data.message || 'Registration failed. Please try again.');
        }

        showAlert(data.message || 'Registration successful! Please check your email to verify.', 'success', messageContainer);
        form.reset();
    } catch (error) {
        const msg = error.message && error.message.includes('Failed to fetch')
            ? 'Cannot connect to the registration server. Please check your internet connection.'
            : error.message;
        console.error("ERROR [auth.js handleAuthJsRegister - CAUGHT]:", error.message, error);
        showAlert(msg, 'error', messageContainer);
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = originalBtnHtml;
        }
    }
}

async function handleAuthJsLogin(e) {
    e.preventDefault(); // Prevent default form submission
    console.log("DEBUG [auth.js handleAuthJsLogin]: Function triggered by form submit.");

    const form = e.target; // This is the <form id="loginForm">
    const btn = form.querySelector('#submitBtn'); // Get the submit button by its ID from login.html
    const originalBtnHtml = btn ? btn.innerHTML : 'Login';
    const messageContainer = document.getElementById('loginMessage'); // Get the message div by its ID from login.html
    const resendVerificationSection = document.getElementById('resendVerificationSection');

    if (!form || !messageContainer) {
        console.error("CRITICAL [auth.js handleAuthJsLogin]: #loginForm or #loginMessage element not found in login.html.");
        // Optionally display a generic error if showAlert itself depends on these elements
        alert("A critical error occurred on the login page. Please contact support if this persists.");
        return;
    }
     if (!btn) {
        console.warn("WARN [auth.js handleAuthJsLogin]: Submit button #submitBtn not found. UI updates for button state will not work.");
    }


    try {
        const emailInput = form.querySelector('#email');
        const passwordInput = form.querySelector('#password');

        if (!emailInput || !passwordInput) {
            console.error("CRITICAL [auth.js handleAuthJsLogin]: Email (#email) or password (#password) input field not found in #loginForm.");
            showAlert('Internal error: Form fields missing.', 'error', messageContainer);
            return;
        }

        const email = emailInput.value.trim();
        const password = passwordInput.value;

        console.log(`DEBUG [auth.js handleAuthJsLogin]: Attempting login with Email: '${email}', Password is ${password ? 'present' : 'MISSING'}.`);

        if (!email || !password) {
            showAlert('Please enter both email and password.', 'error', messageContainer); return;
        }
        if (!/\S+@\S+\.\S+/.test(email)) {
            showAlert('Please enter a valid email address.', 'error', messageContainer); return;
        }

        if (btn) {
            btn.disabled = true;
            btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Logging in...';
        } else {
            console.log("DEBUG [auth.js handleAuthJsLogin]: Submit button not found, skipping disable/spinner.");
        }


        console.log(`DEBUG [auth.js handleAuthJsLogin]: Sending login request to: ${API_BASE_URL}/login`);
        const response = await fetch(`${API_BASE_URL}/login`, { // Path is /login (API_BASE_URL already has /api)
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password }),
        });

        console.log(`DEBUG [auth.js handleAuthJsLogin]: Response status: ${response.status}`);
        const data = await response.json();
        console.log("DEBUG [auth.js handleAuthJsLogin]: Response data:", data);

        if (!response.ok) { // Handles 4xx, 5xx
            if (response.status === 403 && data.needsVerification) {
                showAlert(data.message || 'Email not verified. Please check your email or resend verification.', 'error', messageContainer);
                if (resendVerificationSection) resendVerificationSection.style.display = 'block';
                const resendBtn = document.getElementById('resendVerificationBtn');
                if(resendBtn && !resendBtn.dataset.authJsListener) {
                    resendBtn.addEventListener('click', () => handleResendVerificationEmail(email));
                    resendBtn.dataset.authJsListener = 'true';
                }
            } else {
                throw new Error(data.message || `Login failed. Server responded with status ${response.status}.`);
            }
            // We need to return here if response was not .ok to prevent falling into success block
            // and to ensure the button is re-enabled in finally.
            // The 'finally' block will handle re-enabling the button if it's not a success.
            return; 
        }

        // If response.ok (e.g., 200) and backend sends {success: true, token, user}
        if (data.success && data.token && data.user) {
            sessionStorage.setItem(AUTH_TOKEN_KEY, data.token);
            localStorage.setItem(USER_INFO_KEY, JSON.stringify(data.user));
            showAlert('Login successful! Redirecting to your dashboard...', 'success', messageContainer);
            setTimeout(() => {
                window.location.href = 'dashboard.html';
            }, 1500);
        } else {
            // This case implies response.ok was true, but data was not as expected
            throw new Error(data.message || 'Login processed, but server response was incomplete or indicated failure.');
        }

    } catch (error) {
        console.error("ERROR [auth.js handleAuthJsLogin - CAUGHT]:", error.message, error);
        const msg = error.message && error.message.includes('Failed to fetch')
            ? 'Cannot connect to the login server. Please check your internet connection or API URL.'
            : error.message || "An unexpected error occurred during login.";
        showAlert(msg, 'error', messageContainer);
    } finally {
        // Only re-enable button if it exists AND if the message doesn't indicate success (which leads to redirect)
        if (btn && !(messageContainer && messageContainer.textContent && messageContainer.textContent.toLowerCase().includes('successful! redirecting'))) {
            if (btn.disabled) { // Check if it was actually disabled
                btn.disabled = false;
                btn.innerHTML = originalBtnHtml;
            }
        } else if (btn) {
            console.log("DEBUG [auth.js handleAuthJsLogin - finally]: Login was successful or message indicates success, button not re-enabled for redirection.");
        }
    }
}


async function handleResendVerificationEmail(emailForResend) {
    const resendMessageEl = document.getElementById('resendMessage');
    const resendBtn = document.getElementById('resendVerificationBtn');
    if (!emailForResend && document.getElementById('email')) {
        emailForResend = document.getElementById('email').value.trim();
    }

    if (!emailForResend) {
        if (resendMessageEl) resendMessageEl.textContent = 'Email address not found to resend verification.';
        return;
    }

    if (resendMessageEl) resendMessageEl.textContent = 'Sending...';
    if (resendBtn) resendBtn.disabled = true;

    try {
        const response = await fetch(`${API_BASE_URL}/resend-verification-email`, { // Path is /resend-verification-email
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
        console.error("ERROR [auth.js handleResendVerificationEmail - CAUGHT]:", error.message, error);
    } finally {
        if (resendBtn) resendBtn.disabled = false;
    }
}

function checkAuthState() {
    const protectedPages = ['dashboard.html', 'wallet.html', 'transactions.html', 'transfer.html', 'deposit.html', 'withdraw.html'];
    const authFlowPages = ['login.html', 'register.html', 'forgot-password.html', 'reset-password.html', 'verify-email.html'];
    let currentPage = window.location.pathname.split('/').pop() || 'index.html';
    const token = sessionStorage.getItem(AUTH_TOKEN_KEY);
    const validToken = token && token !== 'undefined' && token !== 'null';

    // console.log(`DEBUG [auth.js checkAuthState]: Page='${currentPage}' | Token in sessionStorage=${!!validToken}`);

    if (protectedPages.includes(currentPage)) {
        if (!validToken) {
            console.warn(`Redirecting from protected page '${currentPage}' to login due to missing/invalid token.`);
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
    const token = sessionStorage.getItem(AUTH_TOKEN_KEY);
    const validToken = token && token !== 'undefined' && token !== 'null';
    const navUl = document.getElementById('mainNavUl');

    // On login.html, the main nav (mainNavUl) doesn't exist, so navUl will be null.
    // We need to handle this gracefully or ensure selectors are only for elements present on the current page.
    // For now, the null checks for navUl dependent queries will prevent errors on login.html

    const navLoginLink = document.getElementById('navLoginLink'); // Exists on index.html
    const navRegisterLink = document.getElementById('navRegisterLink'); // Exists on index.html
    const navDashboardLink = navUl ? navUl.querySelector('a[href="dashboard.html"]')?.closest('li') : null;
    const navWalletLink = navUl ? navUl.querySelector('a[href="wallet.html"]')?.closest('li') : null;
    const navTransactionsLink = navUl ? navUl.querySelector('a[href="transactions.html"]')?.closest('li') : null;
    const navLogoutItem = document.getElementById('logoutNavItem'); // Exists on index.html
    const footerLogoutLi = document.getElementById('footerLogoutLi'); // Exists on index.html


    if (navLoginLink) navLoginLink.style.display = validToken ? 'none' : '';
    if (navRegisterLink) navRegisterLink.style.display = validToken ? 'none' : '';
    if (navDashboardLink) navDashboardLink.style.display = validToken ? '' : 'none';
    if (navWalletLink) navWalletLink.style.display = validToken ? '' : 'none';
    if (navTransactionsLink) navTransactionsLink.style.display = validToken ? '' : 'none';
    if (navLogoutItem) navLogoutItem.style.display = validToken ? '' : 'none';
    if (footerLogoutLi) footerLogoutLi.style.display = validToken ? '' : 'none';

    // console.log(`DEBUG [auth.js updateNav]: Navigation updated. LoggedIn=${validToken}`);
}

function handleLogout() {
    console.log("DEBUG [auth.js]: Logging out...");
    sessionStorage.removeItem(AUTH_TOKEN_KEY);
    localStorage.removeItem(USER_INFO_KEY);
    localStorage.removeItem(DASHBOARD_AVAILABLE_BALANCE_KEY);
    localStorage.removeItem(DASHBOARD_ACTIVE_INVESTMENTS_KEY);
    localStorage.removeItem(TRANSACTIONS_CACHE_KEY);
    updateNavFooterBasedOnAuth();
    window.location.href = 'login.html?logout=success';
}

function showAlert(message, type = 'info', targetElement = null) {
    // Try to find the specific message container on login/register pages first
    let specificMessageContainer = null;
    if (document.body.contains(document.getElementById('loginMessage'))) { // Check if #loginMessage is in the document body
        specificMessageContainer = document.getElementById('loginMessage');
    } else if (document.body.contains(document.getElementById('message'))) { // Check for #message (register page)
        specificMessageContainer = document.getElementById('message');
    }

    // Use the provided targetElement if it's valid, otherwise try the specific one found
    const actualTargetElement = (targetElement && targetElement.offsetParent !== null) ? targetElement : specificMessageContainer;

    // If still no valid target (e.g. on index.html without a dedicated spot), create a global alert.
    if (!actualTargetElement) {
        const existingGlobalAlert = document.querySelector('.app-global-alert.fixed-global');
        if (existingGlobalAlert) existingGlobalAlert.remove();

        const globalAlertDiv = document.createElement('div');
        globalAlertDiv.className = `app-global-alert alert-${type} fixed-global`;
        // ... (styling for fixed global alert as before)
        Object.assign(globalAlertDiv.style, {
            position: 'fixed', top: '20px', left: '50%',
            transform: 'translateX(-50%)', zIndex: '10000',
            minWidth: '300px', maxWidth: 'calc(100% - 40px)', boxShadow: '0 3px 10px rgba(0,0,0,0.15)',
            padding: '12px 18px', marginBottom: '15px', border: '1px solid transparent',
            borderRadius: '5px', textAlign: 'left', fontSize: '0.95em', wordWrap: 'break-word',
        });
         const icons = { success: 'fa-check-circle', error: 'fa-exclamation-circle', warning: 'fa-exclamation-triangle', info: 'fa-info-circle' };
        const typeStyles = { error: { color: '#721c24', backgroundColor: '#f8d7da', borderColor: '#f5c6cb' }, success: { color: '#155724', backgroundColor: '#d4edda', borderColor: '#c3e6cb' }, warning: { color: '#856404', backgroundColor: '#fff3cd', borderColor: '#ffeeba' }, info: { color: '#004085', backgroundColor: '#cce5ff', borderColor: '#b8daff' }};
        Object.assign(globalAlertDiv.style, typeStyles[type]);
        globalAlertDiv.innerHTML = `<i class="fas ${icons[type] || icons.info}" style="margin-right: 8px;"></i> <span>${message}</span>`;
        document.body.insertBefore(globalAlertDiv, document.body.firstChild);
        setTimeout(() => { globalAlertDiv.style.transition = 'opacity 0.5s ease-out'; globalAlertDiv.style.opacity = '0'; setTimeout(() => globalAlertDiv.remove(), 500); }, 4500);
        return;
    }

    // If we have a target element (like #loginMessage or #message)
    const alertDiv = document.createElement('div'); // Create a new inner div for the message content
    alertDiv.className = `alert-content alert-${type}`; // So actualTargetElement can have its own styles

    const icons = { success: 'fa-check-circle', error: 'fa-exclamation-circle', warning: 'fa-exclamation-triangle', info: 'fa-info-circle' };
    const typeStyles = { error: { color: '#721c24' }, success: { color: '#155724' }, warning: { color: '#856404' }, info: { color: '#004085' }}; // Only color matters here

    alertDiv.innerHTML = `<i class="fas ${icons[type] || icons.info}" style="margin-right: 8px;"></i> <span>${message}</span>`;
    alertDiv.style.color = typeStyles[type].color;
    alertDiv.style.textAlign = 'left'; // Ensure text is left-aligned within the message area
    alertDiv.style.fontSize = '0.9em';   // Consistent font size

    actualTargetElement.innerHTML = ''; // Clear previous content of #loginMessage or #message
    actualTargetElement.appendChild(alertDiv);
    actualTargetElement.style.display = 'block'; // Ensure the container is visible
    actualTargetElement.style.padding = '10px 0'; // Add some padding to the container
    actualTargetElement.style.border = 'none'; // No border on the container itself
    actualTargetElement.style.backgroundColor = 'transparent'; // Transparent background for container
}