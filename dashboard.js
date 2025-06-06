// dashboard.js (Hardened Production Version v4.0)

// ======================
// INITIALIZATION & CONFIG
// ======================
(function initDashboard() {
    // 1. Configuration with versioning
    const CONFIG = {
        VERSION: '4.0',
        API_BASE_URL: window.APP_KEYS?.API_BASE_URL || '',
        AUTH_TOKEN_KEY: window.APP_KEYS?.AUTH_TOKEN_KEY || 'cryptohub_auth_token_v4',
        USER_INFO_KEY: window.APP_KEYS?.USER_INFO_KEY || 'cryptohub_user_info_v4',
        DATA_KEYS: {
            BALANCE: 'dashboard_balance_v4',
            INVESTMENTS: 'dashboard_investments_v4'
        },
        SESSION_TIMEOUT: 30 * 60 * 1000 // 30 minutes
    };

    // 2. State management
    const state = {
        fetchCount: 0,
        charts: {
            portfolio: null,
            marketTrends: null
        },
        currentUser: null
    };

    // ======================
    // CORE FUNCTIONS
    // ======================

    function initialize() {
        console.log(`[Dashboard v${CONFIG.VERSION}] Initializing...`);
        document.addEventListener('DOMContentLoaded', handleDOMReady);
    }

    function handleDOMReady() {
        console.log(`[Dashboard v${CONFIG.VERSION}] DOM Ready`);
        
        // Verify critical configuration
        if (!CONFIG.API_BASE_URL) {
            showCriticalError('API configuration missing');
            return;
        }

        // Load user session
        loadUserSession();
        
        // Initialize UI components
        initUIComponents();
        
        // Fetch data
        fetchInitialData();
    }

    // ======================
    // SESSION MANAGEMENT
    // ======================

    function loadUserSession() {
        try {
            const tokenData = localStorage.getItem(CONFIG.AUTH_TOKEN_KEY);
            const userData = localStorage.getItem(CONFIG.USER_INFO_KEY);
            
            if (tokenData && userData) {
                state.currentUser = JSON.parse(userData);
                console.log(`[Dashboard] User loaded: ${state.currentUser.username}`);
                updateUserUI();
            } else {
                console.warn('[Dashboard] No active session found');
                handleUnauthenticated();
            }
        } catch (e) {
            console.error('[Dashboard] Session load error:', e);
            clearSession();
            handleUnauthenticated();
        }
    }

    function clearSession() {
        localStorage.removeItem(CONFIG.AUTH_TOKEN_KEY);
        localStorage.removeItem(CONFIG.USER_INFO_KEY);
        localStorage.removeItem(CONFIG.DATA_KEYS.BALANCE);
        localStorage.removeItem(CONFIG.DATA_KEYS.INVESTMENTS);
    }

    // ======================
    // UI MANAGEMENT
    // ======================

    function initUIComponents() {
        // Navigation
        initLogoutButton();
        initQuickActionButtons();
        
        // Charts
        initCharts();
        
        // Event listeners
        initEventDelegation();
    }

    function updateUserUI() {
        // Update username display
        const userNameElement = getElement('#userName');
        if (userNameElement && state.currentUser) {
            userNameElement.textContent = state.currentUser.username;
        }
        
        // Update balance display
        updateBalanceDisplay();
    }

    // ======================
    // DATA FETCHING
    // ======================

    function fetchInitialData() {
        state.fetchCount++;
        const fetchId = state.fetchCount;
        
        console.log(`[Dashboard] Fetching data (ID: ${fetchId})`);
        
        if (state.currentUser) {
            Promise.all([
                fetchUserProfile(fetchId),
                fetchInvestmentPlans(fetchId),
                fetchUserInvestments(fetchId)
            ]).catch(error => {
                console.error(`[Dashboard] Initial data fetch error (ID: ${fetchId}):`, error);
            });
        } else {
            fetchInvestmentPlans(fetchId)
                .catch(error => {
                    console.error(`[Dashboard] Plans fetch error (ID: ${fetchId}):`, error);
                });
        }
    }

    // ======================
    // API COMMUNICATION
    // ======================

    async function apiRequest(endpoint, options = {}) {
        const url = `${CONFIG.API_BASE_URL}${endpoint}`;
        const headers = {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            ...options.headers
        };

        // Add auth token if available
        const token = localStorage.getItem(CONFIG.AUTH_TOKEN_KEY);
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }

        try {
            const response = await fetch(url, {
                method: options.method || 'GET',
                headers,
                body: options.body ? JSON.stringify(options.body) : undefined,
                credentials: 'include'
            });

            // Handle non-JSON responses
            const contentType = response.headers.get('content-type');
            if (!contentType || !contentType.includes('application/json')) {
                const text = await response.text();
                throw new Error(text || `HTTP error ${response.status}`);
            }

            const data = await response.json();

            if (!response.ok) {
                if (response.status === 401) {
                    clearSession();
                    window.location.href = 'login.html';
                    return null;
                }
                throw new Error(data.message || `API error ${response.status}`);
            }

            return data;
        } catch (error) {
            console.error('[Dashboard] API request failed:', error);
            throw error;
        }
    }

    // ======================
    // COMPONENT INITIALIZERS
    // ======================

    function initLogoutButton() {
        const logoutBtn = getElement('#logoutBtn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', (e) => {
                e.preventDefault();
                console.log('[Dashboard] Logout initiated');
                clearSession();
                window.location.href = 'login.html';
            });
        }
    }

    function initQuickActionButtons() {
        // Deposit button
        const depositBtn = getElement('#mainDepositBtn');
        if (depositBtn) {
            depositBtn.addEventListener('click', () => {
                window.location.href = 'deposit.html';
            });
        }

        // Withdraw button
        const withdrawBtn = getElement('#mainWithdrawBtn');
        if (withdrawBtn) {
            withdrawBtn.addEventListener('click', () => {
                window.location.href = 'withdraw.html';
            });
        }
    }

    function initCharts() {
        if (typeof Chart === 'undefined') {
            console.error('[Dashboard] Chart.js not loaded');
            return;
        }

        // Portfolio chart
        const portfolioCtx = getElement('#portfolioChart')?.getContext('2d');
        if (portfolioCtx) {
            state.charts.portfolio = new Chart(portfolioCtx, {
                type: 'line',
                data: getPortfolioChartData(),
                options: getChartOptions('Portfolio Value')
            });
        }

        // Market trends chart
        const trendsCtx = getElement('#marketTrendsChart')?.getContext('2d');
        if (trendsCtx) {
            state.charts.marketTrends = new Chart(trendsCtx, {
                type: 'bar',
                data: getMarketTrendsData(),
                options: getChartOptions('Market Trends')
            });
        }
    }

    // ======================
    // HELPER FUNCTIONS
    // ======================

    function getElement(selector) {
        const el = document.querySelector(selector);
        if (!el) console.warn(`[Dashboard] Element not found: ${selector}`);
        return el;
    }

    function showCriticalError(message) {
        console.error(`[Dashboard] CRITICAL: ${message}`);
        const errorEl = document.createElement('div');
        errorEl.className = 'dashboard-error';
        errorEl.innerHTML = `
            <h3>Application Error</h3>
            <p>${message}</p>
            <p>Please contact support</p>
        `;
        document.body.prepend(errorEl);
    }

    // ======================
    // INITIALIZATION
    // ======================
    initialize();
})();
