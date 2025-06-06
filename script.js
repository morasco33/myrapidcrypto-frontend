// --- public/js/script.js (ADAPTED Version for New Setup) ---
(() => {
    // Define your Render Backend Base URL here
    const API_URL = 'https://rapidcrypto-backend.onrender.com/api/crypto-data'; // << IMPORTANT: REPLACE WITH YOUR ACTUAL RENDER URL

    // --- DOMContentLoaded Initialization ---
    document.addEventListener('DOMContentLoaded', () => {
        console.log("DEBUG [script.js]: DOM fully loaded.");

        const isHomePage = Boolean(document.getElementById('heroChart'));
        const isLoginPage = Boolean(document.getElementById('loginForm')); // Assumes login form is on a separate page or section

        try {
            handleAuthUIUpdates(); // Call this regardless of page to update nav/footer

            if (isLoginPage) {
                console.log("DEBUG [script.js]: Login page/section detected.");
                initLoginFormHandler();
            }

            if (isHomePage) {
                console.log("DEBUG [script.js]: Homepage detected.");
                initSentenceRotator();
                initPlatformStats();
            } else {
                // This log might be noisy if you have many pages without these elements
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
            const emailInput = document.getElementById('email');
            const passwordInput = document.getElementById('password');

            if (!emailInput || !passwordInput) {
                console.error("ERROR [script.js]: Email or password input field not found.");
                alert('Login form elements are missing. Please contact support.');
                return;
            }

            const email = emailInput.value || '';
            const password = passwordInput.value || '';

            // Clear previous error messages for login
            const errorDisplay = document.getElementById('loginErrorDisplay'); // Assuming you have an element to show login errors
            if (errorDisplay) errorDisplay.textContent = '';


            try {
                // *** IMPORTANT: Use the RENDER_BACKEND_BASE_URL ***
                const res = await fetch(`${RENDER_BACKEND_BASE_URL}/login`, { // Or whatever your login endpoint is, e.g., /api/auth/login
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email, password }),
                });

                const data = await res.json(); // Try to parse JSON regardless of res.ok for error messages

                if (res.ok) {
                    alert(data.message || 'Login successful!'); // Or use a more subtle notification
                    console.log("DEBUG [script.js]: Login successful, token:", data.token);

                    // Save token to localStorage and redirect
                    // Ensure APP_KEYS are defined, or use hardcoded keys directly
                    const { AUTH_TOKEN_KEY = 'cryptohub_auth_token' } = window.APP_KEYS || {};
                    if (data.token) {
                        localStorage.setItem(AUTH_TOKEN_KEY, data.token);
                        // Optionally save user info if backend sends it
                        // const { USER_INFO_KEY = 'cryptohub_user_info' } = window.APP_KEYS || {};
                        // if(data.user) localStorage.setItem(USER_INFO_KEY, JSON.stringify(data.user));

                        window.location.href = 'dashboard.html'; // Or whatever your target page is
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
                if (errorDisplay) errorDisplay.textContent = 'Something went wrong: ' + err.message;
                else alert('Something went wrong: ' + err.message);
            }
        });

        console.log("DEBUG [script.js]: Login form handler attached.");
    }

    // --- Auth-Based UI Updates ---
    function handleAuthUIUpdates() {
        console.log("DEBUG [script.js]: Updating nav/footer for auth.");

        // Ensure APP_KEYS are defined, or use hardcoded keys directly if APP_KEYS is not set elsewhere
        const { AUTH_TOKEN_KEY = 'cryptohub_auth_token', USER_INFO_KEY = 'cryptohub_user_info' } = window.APP_KEYS || { AUTH_TOKEN_KEY: 'cryptohub_auth_token', USER_INFO_KEY: 'cryptohub_user_info' }; // Provide defaults if APP_KEYS might be undefined
        const token = localStorage.getItem(AUTH_TOKEN_KEY);

        const navList = document.querySelector('header nav ul');
        const loginItem = navList?.querySelector('li a[href="login.html"]')?.parentElement;
        const registerItem = navList?.querySelector('li a[href="register.html"]')?.parentElement;
        const logoutNavItem = document.getElementById('logoutNavItem'); // Assumes an <li> or <a> with this ID
        // Let's assume the logout button itself has the ID 'logoutBtn'
        const logoutBtn = document.getElementById('logoutBtn'); // Could be inside logoutNavItem or standalone
        const footerLogoutBtn = document.getElementById('footerLogoutBtn');

        if (token) {
            loginItem && (loginItem.style.display = 'none');
            registerItem && (registerItem.style.display = 'none');
            
            if (logoutNavItem) logoutNavItem.style.display = ''; // Show the nav item container
            if (logoutBtn) logoutBtn.style.display = ''; // Ensure the button itself is visible if separate
            
            attachLogoutHandler(logoutBtn, AUTH_TOKEN_KEY, USER_INFO_KEY); // Attach to the actual button

            if (footerLogoutBtn) footerLogoutBtn.style.display = '';
            attachLogoutHandler(footerLogoutBtn, AUTH_TOKEN_KEY, USER_INFO_KEY);
        } else {
            loginItem && (loginItem.style.display = '');
            registerItem && (registerItem.style.display = '');

            if (logoutNavItem) logoutNavItem.style.display = 'none';
            if (logoutBtn) logoutBtn.style.display = 'none';

            if (footerLogoutBtn) footerLogoutBtn.style.display = 'none';
        }

        console.log("DEBUG [script.js]: Auth UI updated based on token:", token ? "Found" : "Not Found");
    }

    // --- Attach Logout Event ---
    function attachLogoutHandler(button, tokenKey, userKey) {
        if (!button) {
            // console.warn("WARN [script.js]: Attempted to attach logout handler to a null button.");
            return;
        }
        if (button.dataset.listenerAttached === 'true') return; // Already attached

        button.addEventListener('click', (e) => {
            e.preventDefault();
            console.log("DEBUG [script.js]: Logout button clicked.");
            // Check if a global handleLogout function exists (e.g., from another script for more complex logout)
            if (typeof window.handleLogout === 'function') {
                console.log("DEBUG [script.js]: Calling window.handleLogout()");
                window.handleLogout(); // This function should handle token removal and redirection
            } else {
                // Basic logout: remove token and redirect
                console.log("DEBUG [script.js]: Performing basic logout (removing tokens, redirecting).");
                localStorage.removeItem(tokenKey);
                localStorage.removeItem(userKey); // Also remove user info if stored
                window.location.href = 'login.html'; // Redirect to login page
            }
        });

        button.dataset.listenerAttached = 'true'; // Mark as attached
        console.log(`DEBUG [script.js]: Logout handler attached to button: ${button.id || 'Unnamed button'}`);
    }

    // --- Homepage: Sentence Rotator ---
    function initSentenceRotator() {
        const el = document.getElementById('sentenceElement');
        if (!el) {
            // console.warn("WARN [script.js]: #sentenceElement not found. Skipping rotator.");
            return;
        }

        const sentences = [
            "Unlock Financial Freedom: RapidWealthHub offers you the unique opportunity to achieve massive income and passive earnings in just 48 hours, with no risk involved.",
            "Effortless Wealth Generation: Pool your resources and grow your investments exponentially.",
            "Join a Trusted Community: Collective success is our mission.",
            "Risk-Free Investments: Minimize risk while maximizing returns.",
            "Rapid Results: See real results within 48 hours.",
            "Expert Guidance: Proven strategies and real-time insights.",
            "Secure Your Future: Grow your wealth efficiently and safely.",
            "Empower Your Financial Journey: Smart investing made simple.",
            "Transformative Opportunities: Your gateway to financial breakthroughs.",
            "Start Today, Benefit Tomorrow: Begin your path to wealth now."
        ];

        let index = 0;
        const rotate = () => {
            // Basic fade effect (optional, can be enhanced with CSS transitions)
            el.style.opacity = 0;
            setTimeout(() => {
                el.innerHTML = `<p>${sentences[index]}</p>`;
                el.style.opacity = 1;
                index = (index + 1) % sentences.length;
            }, 300); // Short delay for fade out
        };
        
        el.style.transition = 'opacity 0.3s ease-in-out'; // For smooth fade

        rotate(); // Initial call
        setInterval(rotate, 6000); // Rotate every 6 seconds
        console.log("DEBUG [script.js]: Sentence rotator active.");
    }

    // --- Homepage: Static Stats ---
    function initPlatformStats() {
        // console.log("DEBUG [script.js]: Initializing homepage stats.");

        const stats = {
            activeUsersStat: "3.2K+",
            totalDepositsStat: "$5.3M+",
            totalWithdrawalsStat: "$15.2M+",
            countriesSupportedStat: "150+"
        };

        let foundAnyStat = false;
        for (const [id, value] of Object.entries(stats)) {
            const el = document.getElementById(id);
            if (el) {
                el.textContent = value;
                foundAnyStat = true;
            } else {
                // console.warn(`WARN [script.js]: Stat element #${id} not found.`);
            }
        }
        if (foundAnyStat) console.log("DEBUG [script.js]: Homepage stats initialized.");
    }

    // --- Utility: Error Banner ---
    function displayGlobalErrorBanner(message) {
        // Avoid creating multiple banners
        if (document.getElementById('globalErrorBannerFromScriptJs')) {
            document.getElementById('globalErrorBannerFromScriptJs').innerText = message; // Update existing
            return;
        }

        const banner = document.createElement('div');
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

        // Auto-remove after some time
        setTimeout(() => {
            banner.style.opacity = '0'; // Trigger fade out
            setTimeout(() => {
                if (banner.parentElement) { // Check if still in DOM
                    banner.remove();
                }
            }, 500); // Remove after fade out transition (0.5s)
        }, 7000); // Total visible time including fade out start
    }
})();