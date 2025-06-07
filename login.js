// --- public/js/login.js (Cleaned and Rewritten) ---

document.addEventListener('DOMContentLoaded', () => {
    console.log("DEBUG [login.js]: DOMContentLoaded triggered.");

    // --- Element References ---
    const loginForm = document.getElementById('loginForm');
    const emailInput = document.getElementById('email');
    const passwordInput = document.getElementById('password');
    const submitBtn = document.getElementById('submitBtn');
    const loginMessageDiv = document.getElementById('loginMessage');
    const otpSection = document.getElementById('otpSection');
    const resendVerificationSection = document.getElementById('resendVerificationSection');
    const resendVerificationBtn = document.getElementById('resendVerificationBtn');
    const resendMessageDiv = document.getElementById('resendMessage');

    // --- Initial State ---
    if (otpSection) otpSection.style.display = 'none';
    if (resendVerificationSection) resendVerificationSection.style.display = 'none';

    if (!loginForm || !emailInput || !passwordInput || !submitBtn || !loginMessageDiv) {
        console.error("CRITICAL ERROR [login.js]: Missing essential form elements.");
        if (loginMessageDiv) {
            loginMessageDiv.textContent = 'Login form is not correctly configured.';
            loginMessageDiv.className = 'form-message error';
        }
        if (submitBtn) submitBtn.disabled = true;
        return;
    }

    console.log("DEBUG [login.js]: All essential elements present.");

    // --- Handle URL Parameters for Feedback ---
    try {
        const params = new URLSearchParams(window.location.search);
        const message = params.get('message');
        const error = params.get('error');
        const reason = params.get('reason');

        if (reason === 'auth_required') {
            loginMessageDiv.textContent = 'Please log in to access the requested page.';
            loginMessageDiv.className = 'form-message warning';
        } else if (message) {
            loginMessageDiv.textContent = decodeURIComponent(message);
            loginMessageDiv.className = 'form-message success';
        } else if (error) {
            loginMessageDiv.textContent = decodeURIComponent(error);
            loginMessageDiv.className = 'form-message error';
        }

        console.log("DEBUG [login.js]: URL parameters processed.");
    } catch (e) {
        console.error("ERROR [login.js]: Failed to parse URL parameters.", e);
    }

    // --- Form Submit Handler ---
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        console.log("DEBUG [login.js]: Login form submitted.");

        const email = emailInput.value.trim();
        const password = passwordInput.value.trim();

        loginMessageDiv.textContent = '';
        loginMessageDiv.className = 'form-message';
        if (resendMessageDiv) resendMessageDiv.textContent = '';
        if (resendVerificationSection) resendVerificationSection.style.display = 'none';

        const originalBtnHtml = submitBtn.innerHTML;
        submitBtn.disabled = true;
        submitBtn.innerHTML = `<i class="fas fa-spinner fa-spin"></i> Logging in...`;

        try {
            if (!email || !password) throw new Error('Please fill in both email and password.');
            if (!/\S+@\S+\.\S+/.test(email)) throw new Error('Enter a valid email address.');

            const apiBase = window.APP_KEYS?.API_BASE_URL || 'https://rapidcrypto.org/';
            const loginUrl = `${apiBase}/login`;

            const response = await fetch(loginUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password })
            });

            const result = await response.json();

            if (!response.ok || !result.success) {
                console.warn("WARN [login.js]: Login failed response.", result);

                if (result.needsVerification === true && resendVerificationSection) {
                    resendVerificationSection.style.display = 'block';
                    console.log("DEBUG [login.js]: Email verification required.");
                }

                throw new Error(result.message || 'Login failed. Check your credentials.');
            }

            // --- Success ---
            console.log("SUCCESS [login.js]: Login successful.");

            const tokenKey = window.APP_KEYS?.AUTH_TOKEN_KEY || 'cryptohub_auth_token';
            const userKey = window.APP_KEYS?.USER_INFO_KEY || 'cryptohub_user_info';

            localStorage.setItem(tokenKey, result.token);
            localStorage.setItem(userKey, JSON.stringify({
                _id: result.user?._id,
                username: result.user?.username,
                email: result.user?.email,
                verified: result.user?.verified
            }));

            loginMessageDiv.textContent = result.message || 'Login successful! Redirecting...';
            loginMessageDiv.className = 'form-message success';

            setTimeout(() => {
                const redirectedFrom = new URLSearchParams(window.location.search).get('redirectedFrom');
                const fallbackPage = 'dashboard.html';

                if (redirectedFrom && !['login.html', 'register.html'].includes(redirectedFrom)) {
                    window.location.href = redirectedFrom;
                } else {
                    window.location.href = fallbackPage;
                }
            }, 1500);
        } catch (err) {
            console.error("ERROR [login.js]: Login attempt failed.", err);
            loginMessageDiv.textContent = err.message || 'Unexpected error during login.';
            loginMessageDiv.className = 'form-message error';
        } finally {
            submitBtn.disabled = false;
            submitBtn.innerHTML = originalBtnHtml;
        }
    });

    // --- Resend Verification Handler ---
    if (resendVerificationBtn && resendMessageDiv) {
        resendVerificationBtn.addEventListener('click', async () => {
            console.log("DEBUG [login.js]: Resend verification clicked.");

            const email = emailInput.value.trim();
            if (!email) {
                resendMessageDiv.textContent = 'Enter your email address above.';
                resendMessageDiv.className = 'form-message error';
                return;
            }

            if (!/\S+@\S+\.\S+/.test(email)) {
                resendMessageDiv.textContent = 'Enter a valid email address.';
                resendMessageDiv.className = 'form-message error';
                return;
            }

            const originalText = resendVerificationBtn.textContent;
            resendVerificationBtn.disabled = true;
            resendVerificationBtn.textContent = 'Sending...';
            resendMessageDiv.textContent = '';
            resendMessageDiv.className = 'form-message';

            try {
                const apiBase = window.APP_KEYS?.API_BASE_URL || 'https://rapidcrypto.org/';
                const resendUrl = `${apiBase}/resend-verification-email`;

                const response = await fetch(resendUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email })
                });

                const result = await response.json();

                if (!response.ok || !result.success) {
                    console.warn("WARN [login.js]: Resend verification failed.", result);
                    throw new Error(result.message || 'Failed to resend verification email.');
                }

                console.log("SUCCESS [login.js]: Verification email sent.");
                resendMessageDiv.textContent = result.message;
                resendMessageDiv.className = 'form-message success';
            } catch (err) {
                console.error("ERROR [login.js]: Resend error.", err);
                resendMessageDiv.textContent = err.message || 'Error sending verification email.';
                resendMessageDiv.className = 'form-message error';
            } finally {
                resendVerificationBtn.disabled = false;
                resendVerificationBtn.textContent = originalText;
            }
        });

        console.log("DEBUG [login.js]: Resend listener attached.");
    } else {
        if (!resendVerificationBtn) console.warn("WARN [login.js]: Resend button not found.");
        if (!resendMessageDiv) console.warn("WARN [login.js]: Resend message container not found.");
    }
});
