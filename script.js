// --- public/js/script.js (ADAPTED Version for New Setup - CORRECTED) ---
(() => {
    // Define your Render Backend Base URL here
    const API_URL = 'https://rapidcrypto-backend.onrender.com'; // << IMPORTANT: ENSURE THIS IS YOUR ACTUAL RENDER URL

    // --- DOMContentLoaded Initialization ---
    document.addEventListener('DOMContentLoaded', () => {
        console.log("DEBUG [script.js]: DOM fully loaded.");

        const isHomePage = Boolean(document.getElementById('heroChart')); // Check for an element unique to the homepage
        const isLoginPage = Boolean(document.getElementById('loginForm')); // Assumes login form has this ID

        try {
            handleAuthUIUpdates(); // Call this regardless of page to update nav/footer

            if (isLoginPage) {
                console.log("DEBUG [script.js]: Login page/section detected.");
                initLoginFormHandler();
            }

            if (isHomePage) {
                console.log("DEBUG [script.js]: Homepage detected.");
                // initSentenceRotator(); // Uncomment if #sentenceElement exists in your HTML
                // initPlatformStats();   // Uncomment if stat elements (e.g., #activeUsersStat) exist
            } else {
                // console.log("DEBUG [script.js]: Not on homepage (or homepage elements not found).");
            }

        } catch (err) {
            console.error("ERROR [script.js]: Initialization failed -", err);
            displayGlobalErrorBanner(`An error occurred during initialization: ${err.message}`);
        }
    });

    // --- Login Form Handler ---
    function initLoginFormHandler() {
        const form = document.getElementById('loginForm');
        if (!form) {
            console.warn("WARN [script.js]: Login form (#loginForm) not found.");
            return;
        }

        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const emailInput = document.getElementById('email'); // Assuming input ID is 'email'
            const passwordInput = document.getElementById('password'); // Assuming input ID is 'password'

            if (!emailInput || !passwordInput) {
                console.error("ERROR [script.js]: Email or password input field not found on login form.");
                alert('Login form elements are missing. Please contact support.');
                return;
            }

            const email = emailInput.value || '';
            const password = passwordInput.value || '';

            // Clear previous error messages for login
            const errorDisplay = document.getElementById('loginErrorDisplay'); // You need an element with this ID in your login form HTML
            if (errorDisplay) errorDisplay.textContent = '';


            try {
                // *** CORRECTED: Use the defined API_URL ***
                const res = await fetch(`${API_URL}/login`, { // Or your specific login endpoint, e.g., /api/v1/auth/login
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email, password }),
                });

                const data = await res.json(); // Try to parse JSON regardless of res.ok for error messages

                if (res.ok) {
                    // alert(data.message || 'Login successful!'); // Or use a more subtle notification
                    console.log("DEBUG [script.js]: Login successful, token:", data.token);

                    // Save token to localStorage and redirect
                    // Ensure APP_KEYS are defined, or use hardcoded keys directly
                    const { AUTH_TOKEN_KEY = 'cryptohub_auth_token' } = window.APP_KEYS || { AUTH_TOKEN_KEY: 'cryptohub_auth_token' };
                    if (data.token) {
                        localStorage.setItem(AUTH_TOKEN_KEY, data.token);
                        // Optionally save user info if backend sends it
                        // const { USER_INFO_KEY = 'cryptohub_user_info' } = window.APP_KEYS || { USER_INFO_KEY: 'cryptohub_user_info' };
                        // if(data.user) localStorage.setItem(USER_INFO_KEY, JSON.stringify(data.user));

                        // Redirect based on query param or default to dashboard
                        const urlParams = new URLSearchParams(window.location.search);
                        const redirectUrl = urlParams.get('redirect') || 'dashboard.html';
                        window.location.href = redirectUrl;
                    } else {
                        console.warn("WARN [script.js]: Login successful but no token received.");
                        if (errorDisplay) errorDisplay.textContent = 'Login succeeded but no token was provided.';
                        else alert('Login succeeded but no token was provided.');
                    }
                } else {
                    console.error("ERROR [script.js]: Login API error -", data.message || res.statusText);
                    if (errorDisplay) errorDisplay.textContent = 'Login failed: ' + (data.message || 'Invalid credentials or server error.');
                    else alert('Login failed: ' + (data.message || 'Invalid credentials or server error.'));
                }
            } catch (err) {
                console.error("ERROR [script.js]: Login request failed -", err);
                if (errorDisplay) errorDisplay.textContent = 'Something went wrong during login: ' + err.message;
                else alert('Something went wrong during login: ' + err.message);
            }
        });

        console.log("DEBUG [script.js]: Login form handler attached.");
    }

    // --- Auth-Based UI Updates ---
    function handleAuthUIUpdates() {
        console.log("DEBUG [script.js]: Updating nav/footer for auth.");

        const { AUTH_TOKEN_KEY = 'cryptohub_auth_token', USER_INFO_KEY = 'cryptohub_user_info' } = window.APP_KEYS || { AUTH_TOKEN_KEY: 'cryptohub_auth_token', USER_INFO_KEY: 'cryptohub_user_info' };
        const token = localStorage.getItem(AUTH_TOKEN_KEY);

        // Navigation Links
        const navLoginLink = document.getElementById('navLoginLink');
        const navRegisterLink = document.getElementById('navRegisterLink');
        const logoutNavItem = document.getElementById('logoutNavItem'); // The <li> element
        const authRequiredLinks = document.querySelectorAll('.auth-required'); // Links that need auth

        // Footer Logout
        const footerLogoutLi = document.getElementById('footerLogoutLi'); // The <li> for footer logout
        
        // Buttons
        const heroGetStartedBtn = document.getElementById('heroGetStartedBtn');


        if (token) {
            // User is logged in
            if (navLoginLink) navLoginLink.style.display = 'none';
            if (navRegisterLink) navRegisterLink.style.display = 'none';
            if (logoutNavItem) logoutNavItem.style.display = ''; // Show nav logout item
            if (footerLogoutLi) footerLogoutLi.style.display = ''; // Show footer logout item

            if (heroGetStartedBtn && heroGetStartedBtn.href.includes('register.html')) {
                heroGetStartedBtn.href = 'dashboard.html'; // Change "Get Started" to go to dashboard
                heroGetStartedBtn.textContent = 'Go to Dashboard';
            }

            // Remove auth protection from links if user is logged in
            // This part is handled by the inline script in HTML, but good to be aware
        } else {
            // User is not logged in
            if (navLoginLink) navLoginLink.style.display = '';
            if (navRegisterLink) navRegisterLink.style.display = '';
            if (logoutNavItem) logoutNavItem.style.display = 'none';
            if (footerLogoutLi) footerLogoutLi.style.display = 'none';

            if (heroGetStartedBtn && heroGetStartedBtn.href.includes('dashboard.html')) {
                 heroGetStartedBtn.href = 'register.html'; // Ensure "Get Started" goes to register
                 heroGetStartedBtn.textContent = 'Get Started Free';
            }

            // Auth protection (redirect to login) is handled by the inline script in your HTML
            // for .auth-required links when clicked by a non-logged-in user.
        }
        
        // Always ensure logout buttons have handlers if they are visible
        const mainLogoutBtn = document.getElementById('logoutBtn'); // In nav
        const footerLogoutBtn = document.getElementById('footerLogoutBtn'); // In footer
        
        if (mainLogoutBtn && logoutNavItem && logoutNavItem.style.display !== 'none') {
            attachLogoutHandler(mainLogoutBtn, AUTH_TOKEN_KEY, USER_INFO_KEY);
        }
        if (footerLogoutBtn && footerLogoutLi && footerLogoutLi.style.display !== 'none') {
            attachLogoutHandler(footerLogoutBtn, AUTH_TOKEN_KEY, USER_INFO_KEY);
        }

        console.log("DEBUG [script.js]: Auth UI updated based on token:", token ? "Found" : "Not Found");
    }

    // --- Attach Logout Event ---
    function attachLogoutHandler(button, tokenKey, userKey) {
        if (!button) {
            // console.warn("WARN [script.js]: Attempted to attach logout handler to a null button.");
            return;
        }
        // Basic check to prevent multiple listeners if script re-runs or elements are re-evaluated
        if (button.dataset.logoutListenerAttached === 'true') return;

        button.addEventListener('click', (e) => {
            e.preventDefault();
            console.log("DEBUG [script.js]: Logout button clicked.");
            localStorage.removeItem(tokenKey);
            localStorage.removeItem(userKey); // Also remove user info if stored
            // Optional: Call an API endpoint to invalidate session/token on the server
            // await fetch(`${API_URL}/logout`, { method: 'POST', headers: {'Authorization': `Bearer ${tokenFromSomewhere}` } });
            window.location.href = 'login.html'; // Redirect to login page
        });

        button.dataset.logoutListenerAttached = 'true'; // Mark as attached
        console.log(`DEBUG [script.js]: Logout handler attached to button: ${button.id || 'Unnamed button'}`);
    }

    // --- Homepage: Sentence Rotator (Example - uncomment if needed) ---
    function initSentenceRotator() {
        const el = document.querySelector('.rotating-sentence'); // Using class from your HTML
        if (!el) {
            // console.warn("WARN [script.js]: .rotating-sentence element not found. Skipping rotator.");
            return;
        }

        const sentences = [
            "Trade. Track. Thrive. Your crypto journey starts here.",
            "Real-time market data at your fingertips.",
            "Securely manage your digital assets with ease.",
            "Join thousands of users building their crypto portfolio.",
            "Discover the next big investment opportunity."
        ];

        let index = 0;
        const rotate = () => {
            el.style.opacity = 0;
            setTimeout(() => {
                el.textContent = sentences[index]; // Set textContent directly
                el.style.opacity = 1;
                index = (index + 1) % sentences.length;
            }, 300); // Match CSS transition for fade
        };
        
        el.style.transition = 'opacity 0.3s ease-in-out'; // For smooth fade

        rotate(); // Initial call
        setInterval(rotate, 5000); // Rotate every 5 seconds
        console.log("DEBUG [script.js]: Sentence rotator active for .rotating-sentence.");
    }

    // --- Homepage: Static Stats (Example - uncomment if needed and elements exist) ---
    function initPlatformStats() {
        // console.log("DEBUG [script.js]: Initializing homepage stats (example).");
        // This function would populate elements like:
        // document.getElementById('activeUsersStat').textContent = "10K+";
        // document.getElementById('totalVolumeStat').textContent = "$1B+";
        // Ensure these IDs exist in your HTML if you use this.
        // Example:
        const statsData = {
            //  "activeUsersStat": "10,000+", // Example: if you have <span id="activeUsersStat"></span>
            //  "tradedVolumeStat": "$500M+",
            //  "supportedCoinsStat": "100+"
        };

        let foundAnyStat = false;
        for (const [id, value] of Object.entries(statsData)) {
            const el = document.getElementById(id);
            if (el) {
                el.textContent = value;
                foundAnyStat = true;
            }
        }
        if (foundAnyStat) console.log("DEBUG [script.js]: Homepage stats populated.");
    }

    // --- Utility: Error Banner ---
    function displayGlobalErrorBanner(message) {
        let banner = document.getElementById('globalErrorBannerFromScriptJs');
        if (banner) {
            banner.innerText = message; // Update existing
            banner.style.opacity = '1'; // Make sure it's visible again
        } else {
            banner = document.createElement('div');
            banner.id = 'globalErrorBannerFromScriptJs';
            banner.style.cssText = `
                background-color: #dc3545; /* Red for error */
                color: white;
                padding: 12px 20px;
                text-align: center;
                font-size: 0.9em;
                font-weight: bold;
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                z-index: 100000; /* Ensure it's on top */
                box-shadow: 0 2px 5px rgba(0,0,0,0.2);
                opacity: 1; /* Start visible */
                transition: opacity 0.5s ease-out 6.5s; /* Start fading out after 6.5s */
            `;
            banner.innerText = message;
            document.body.prepend(banner); // Prepend to make it appear at the top
        }

        // Auto-remove after some time
        // Clear any existing timeout to prevent multiple fades if called rapidly
        if (banner.dataset.hideTimeout) {
            clearTimeout(parseInt(banner.dataset.hideTimeout));
        }

        const timeoutId = setTimeout(() => {
            banner.style.opacity = '0'; // Trigger fade out
            setTimeout(() => {
                if (banner && banner.parentElement) { // Check if still in DOM
                    banner.remove();
                }
            }, 500); // Remove after fade out transition (0.5s)
        }, 7000); // Total visible time including fade out start
        banner.dataset.hideTimeout = timeoutId.toString();
    }

    // Call init for homepage specific functions if on homepage
    // This is now handled within DOMContentLoaded based on isHomePage flag
    if (document.getElementById('heroChart')) { // A more robust check for homepage
        initSentenceRotator();
        // initPlatformStats(); // If you have these elements
    }

})();