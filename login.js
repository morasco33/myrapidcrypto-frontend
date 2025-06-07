// --- public/js/login.js (Updated to include inline script logic) ---

document.addEventListener('DOMContentLoaded', () => {
    console.log("DEBUG [login.js]: DOMContentLoaded event fired.");

    // --- Get elements ---
    const loginForm = document.getElementById('loginForm');
    const emailInput = document.getElementById('loginEmail');
    const passwordInput = document.getElementById('loginPassword');
    const submitBtn = document.getElementById('submitBtn'); // Assuming this is your main login/submit button
    const loginMessageDiv = document.getElementById('loginMessage'); // For general messages
    
    // OTP section is not used in this flow, but keep reference if HTML has it
    const otpSection = document.getElementById('otpSection');
    if (otpSection) otpSection.style.display = 'none'; // Ensure it's hidden if not used

    const resendVerificationSection = document.getElementById('resendVerificationSection');
    const resendVerificationBtn = document.getElementById('resendVerificationBtn');
    const resendMessageDiv = document.getElementById('resendMessage'); // For messages specific to resend action

    // --- Check for missing essential elements ---
    if (!loginForm || !emailInput || !passwordInput || !submitBtn || !loginMessageDiv) {
        console.error('CRITICAL ERROR [login.js]: One or more essential login form elements are missing from the HTML.');
        if (loginMessageDiv) { // Try to display an error if possible
            loginMessageDiv.textContent = 'Login form is not correctly set up. Please contact support.';
            loginMessageDiv.className = 'form-message error'; // Use classes for styling
        }
        // Potentially disable the form or submit button to prevent further errors
        if (submitBtn) submitBtn.disabled = true;
        return; // Stop further execution if form is broken
    }
    console.log("DEBUG [login.js]: All essential login form elements found.");


    // --- Handle messages from URL parameters (moved from inline script) ---
    try {
        const urlParams = new URLSearchParams(window.location.search);
        const messageParam = urlParams.get('message'); // For general success messages (e.g., after registration)
        const errorParam = urlParams.get('error');     // For general error messages
        const reasonParam = urlParams.get('reason');   // For specific reasons like 'auth_required'

        if (reasonParam === 'auth_required') {
            loginMessageDiv.textContent = 'Please log in to access the requested page.';
            loginMessageDiv.className = 'form-message warning'; // Use a warning style
        } else if (messageParam) {
            loginMessageDiv.textContent = decodeURIComponent(messageParam);
            loginMessageDiv.className = 'form-message success';
        } else if (errorParam) {
            loginMessageDiv.textContent = decodeURIComponent(errorParam);
            loginMessageDiv.className = 'form-message error';
        }
        // Clear the message from URL to prevent re-display on refresh, if desired
        // if (messageParam || errorParam || reasonParam) {
        //     window.history.replaceState({}, document.title, window.location.pathname);
        // }
        console.log("DEBUG [login.js]: Processed URL parameters for messages.");
    } catch(e) {
        console.error("ERROR [login.js]: Processing URL parameters -", e);
    }


    // --- Hide resend verification section initially ---
    if (resendVerificationSection) {
        resendVerificationSection.style.display = 'none';
    }


    // --- Login Form submission listener ---
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        console.log("DEBUG [login.js]: Login form submitted.");

        const email = emailInput.value.trim();
        const password = passwordInput.value.trim(); // No need to get password again if already obtained

        // Clear previous messages
        loginMessageDiv.textContent = '';
        loginMessageDiv.className = 'form-message'; // Reset class
        if (resendMessageDiv) resendMessageDiv.textContent = ''; // Clear resend message too
        if (resendVerificationSection) resendVerificationSection.style.display = 'none'; // Hide resend section

        // Disable button and show loading state
        const originalBtnHtml = submitBtn.innerHTML; // Store full HTML for icon
        submitBtn.disabled = true;
        submitBtn.innerHTML = `<i class="fas fa-spinner fa-spin"></i> Logging in...`;

        try {
            if (!email || !password) {
                throw new Error('Please fill in both email and password fields.');
            }
            if (!/\S+@\S+\.\S+/.test(email)) { // Basic email format check
                throw new Error('Please enter a valid email address.');
            }

            // Use API_BASE_URL from window.APP_KEYS if available (defined by auth.js)
            const apiBase = window.APP_KEYS?.API_BASE_URL || 'http://localhost:3000/api'; // Fallback
            const loginApiUrl = `${apiBase}/login`;
            console.log(`DEBUG [login.js]: Attempting login to ${loginApiUrl}`);


            const response = await fetch(loginApiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password })
            });

            const result = await response.json(); // Always try to parse JSON response

            if (!response.ok || !result.success) {
                console.warn("WARN [login.js]: Login API call failed or success:false.", result);
                // Handle needsVerification specifically
                if (result.needsVerification === true) { // Check explicitly for true
                    if (resendVerificationSection) {
                        resendVerificationSection.style.display = 'block';
                        console.log("DEBUG [login.js]: needsVerification is true, showing resend section.");
                    }
                    // Display the main error message as well
                    throw new Error(result.message || 'Your email needs verification. Please use the link below or check your email.');
                }
                throw new Error(result.message || 'Login failed. Please check your credentials.');
            }

            // SUCCESSFUL LOGIN
            console.log("SUCCESS [login.js]: Login successful. API Result:", result);

            // Use keys from window.APP_KEYS for consistency (defined by auth.js)
            const authTokenKey = window.APP_KEYS?.AUTH_TOKEN_KEY || 'cryptohub_auth_token';
            const userInfoKey = window.APP_KEYS?.USER_INFO_KEY || 'cryptohub_user_info';

            localStorage.setItem(authTokenKey, result.token);
            // Store only necessary, non-sensitive user info. Backend is source of truth.
            const userToStore = {
                _id: result.user?._id, // Make sure user object and _id exist
                username: result.user?.username,
                email: result.user?.email,
                // balance: result.user?.balance, // Avoid storing balance if fetched fresh on dashboard
                verified: result.user?.verified
            };
            localStorage.setItem(userInfoKey, JSON.stringify(userToStore));
            console.log(`DEBUG [login.js]: Token stored in localStorage with key '${authTokenKey}'.`);
            console.log(`DEBUG [login.js]: User info stored in localStorage with key '${userInfoKey}'.`);


            loginMessageDiv.textContent = result.message || 'Login successful! Redirecting...';
            loginMessageDiv.className = 'form-message success';

            setTimeout(() => {
                const urlParams = new URLSearchParams(window.location.search); // Re-check params for redirect
                const redirectedFrom = urlParams.get('redirectedFrom');
                if (redirectedFrom && redirectedFrom !== 'login.html' && redirectedFrom !== 'register.html') {
                    console.log(`DEBUG [login.js]: Redirecting to original page: ${redirectedFrom}`);
                    window.location.href = redirectedFrom;
                } else {
                    console.log("DEBUG [login.js]: Redirecting to dashboard.html");
                    window.location.href = 'dashboard.html';
                }
            }, 1500); // Delay for user to see success message

        } catch (err) {
            console.error("ERROR [login.js]: During login attempt -", err);
            loginMessageDiv.textContent = err.message || 'An unexpected error occurred during login.';
            loginMessageDiv.className = 'form-message error';
        } finally {
            submitBtn.disabled = false;
            submitBtn.innerHTML = originalBtnHtml; // Restore original button HTML (with icon)
        }
    });


    // --- Resend Verification Email button listener ---
    if (resendVerificationBtn && resendMessageDiv) { // Ensure resendMessageDiv also exists
        resendVerificationBtn.addEventListener('click', async () => {
            console.log("DEBUG [login.js]: Resend verification button clicked.");
            const email = emailInput.value.trim(); // Get email from the input field

            if (!email) {
                resendMessageDiv.textContent = 'Please enter your email address in the field above.';
                resendMessageDiv.className = 'form-message error'; // Use class for styling
                return;
            }
            if (!/\S+@\S+\.\S+/.test(email)) {
                resendMessageDiv.textContent = 'Please enter a valid email address.';
                resendMessageDiv.className = 'form-message error';
                return;
            }

            // Disable button and show loading state
            const originalResendBtnText = resendVerificationBtn.textContent;
            resendVerificationBtn.disabled = true;
            resendVerificationBtn.textContent = 'Sending...';
            resendMessageDiv.textContent = ''; // Clear previous resend message
            resendMessageDiv.className = 'form-message'; // Reset class


            try {
                const apiBase = window.APP_KEYS?.API_BASE_URL || 'http://localhost:3000/api';
                const resendApiUrl = `${apiBase}/resend-verification-email`;
                console.log(`DEBUG [login.js]: Attempting to resend verification to ${resendApiUrl} for email: ${email}`);

                const response = await fetch(resendApiUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email })
                });

                const result = await response.json(); // Always try to parse

                if (!response.ok || !result.success) {
                    console.warn("WARN [login.js]: Resend verification API call failed or success:false.", result);
                    throw new Error(result.message || 'Failed to resend verification email.');
                }

                console.log("SUCCESS [login.js]: Resend verification email successful.", result);
                resendMessageDiv.textContent = result.message;
                resendMessageDiv.className = 'form-message success';

            } catch (err) {
                console.error("ERROR [login.js]: During resend verification -", err);
                resendMessageDiv.textContent = err.message || 'Could not resend verification link. Please try again later.';
                resendMessageDiv.className = 'form-message error';
            } finally {
                resendVerificationBtn.disabled = false;
                resendVerificationBtn.textContent = originalResendBtnText;
            }
        });
        console.log("DEBUG [login.js]: Resend verification button listener initialized.");
    } else {
        if (!resendVerificationBtn) console.warn("WARN [login.js]: Resend verification button not found.");
        if (!resendMessageDiv) console.warn("WARN [login.js]: Resend message div not found.");
    }

});