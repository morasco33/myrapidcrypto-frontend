/**
 * CryptoHub Portfolio Asset Management (investment.js)
 * Manages display and storage of held crypto assets (BTC, ETH, etc.)
 * Reads the main USD Available Balance for display.
 * Includes fetching portfolio assets from a server.
 */

document.addEventListener('DOMContentLoaded', async function() {
    // ======================
    // CONFIGURATION & DOM ELEMENTS
    // ======================
    const USER_INFO_KEY = 'cryptohub_user_info'; // Standardized key for user info
    const AUTH_TOKEN_KEY = 'cryptohub_auth_token';
    const PORTFOLIO_ASSETS_KEY = 'cryptohub_portfolio_assets'; // For BTC, ETH, etc.
    const MAIN_USD_BALANCE_KEY = 'availableBalance'; // Key used by dashboard.js for USD

    let API_BASE_URL = null;
    if (window.APP_KEYS && window.APP_KEYS.API_BASE_URL) {
        API_BASE_URL = window.APP_KEYS.API_BASE_URL;
        console.log('Investment.js: API_BASE_URL found via window.APP_KEYS.');
    } else {
        console.warn('Investment.js: window.APP_KEYS.API_BASE_URL not found. Fetching portfolio assets will be skipped. Local storage will be used/initialized.');
        // You could also try to set a default API_BASE_URL here if applicable
        // API_BASE_URL = 'http://localhost:3000/api'; // Example fallback
    }

    // DOM Elements for displaying these other assets
    const btcBalanceDisplayElement = document.getElementById('btcBalanceDisplay');
    const ethBalanceDisplayElement = document.getElementById('ethBalanceDisplay');
    const usdtBalanceDisplayElement = document.getElementById('usdtBalanceDisplay');
    
    // DOM Element to display the main USD Available Balance
    const mainUsdBalanceDisplayElements = document.querySelectorAll('.balance, #availableBalance');


    // ======================
    // INITIALIZATION & STATE
    // ======================
    let currentUser = null;
    let token = null;
    
    try {
        currentUser = JSON.parse(localStorage.getItem(USER_INFO_KEY));
    } catch (e) {
        console.error('Investment.js: Error parsing user info from localStorage.', e);
    }
    token = localStorage.getItem(AUTH_TOKEN_KEY);
    
    let portfolioAssets = {};
    try {
        portfolioAssets = JSON.parse(localStorage.getItem(PORTFOLIO_ASSETS_KEY)) || {};
    } catch (e) {
        console.error('Investment.js: Error parsing portfolio assets from localStorage.', e);
        portfolioAssets = {}; // Fallback to empty object
    }

    /**
     * Initialize the module
     */
    async function initialize() {
        if (!currentUser || !token) {
            console.warn('Investment.js: User not authenticated. Investment.js will not initialize fully.');
            // Display zero balances or 'N/A' if elements exist
            displayPortfolioAssetBalances(); // Will show 0 if no user context
            displayMainUsdBalance();       // Will show 0 if no data
            return;
        }

        console.log('Investment.js: Initializing for user:', currentUser.email);

        // Attempt to fetch assets from server first
        if (API_BASE_URL) {
            await fetchUserPortfolioAssets(); 
        } else {
            // If no API_BASE_URL, ensure local assets are initialized (original behavior)
            initializeLocalPortfolioAssetDefaults();
        }
        
        displayPortfolioAssetBalances();    // Display BTC, ETH, etc.
        displayMainUsdBalance();            // Display the main USD available balance
    }

    // ======================
    // HELPER FUNCTIONS
    // ======================

    function redirectToLogin() {
        if (!window.location.pathname.endsWith('login.html')) {
            // alert('Session may have expired or user not found. Please login again.'); // showAlert is better
            showAlert('Session may have expired. Please login.', 'warning');
            setTimeout(() => { window.location.href = 'login.html'; }, 2000);
        }
    }

    // --- Portfolio Asset (BTC, ETH, etc.) Management ---

    /**
     * Fetches user's non-USD portfolio assets from the server.
     */
    async function fetchUserPortfolioAssets() {
        if (!API_BASE_URL || !currentUser?.email || !token) {
            console.warn('Investment.js: Cannot fetch portfolio assets. Missing API_URL, user info, or token.');
            initializeLocalPortfolioAssetDefaults(); // Fallback to local initialization
            return;
        }

        console.log(`Investment.js: Fetching portfolio assets for ${currentUser.email} from ${API_BASE_URL}/user/portfolio-assets`);
        try {
            const response = await fetch(`${API_BASE_URL}/user/portfolio-assets`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            if (response.status === 401) {
                console.warn('Investment.js: Unauthorized (401) fetching portfolio assets. Token might be invalid.');
                // redirectToLogin(); // Or let dashboard.js handle this
                initializeLocalPortfolioAssetDefaults(); // Fallback
                return;
            }

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ message: `HTTP error ${response.status}` }));
                throw new Error(errorData.message || `Failed to fetch portfolio assets. Status: ${response.status}`);
            }

            const data = await response.json();

            if (data.success && data.assets) {
                console.log('Investment.js: Successfully fetched portfolio assets:', data.assets);
                // Update local storage with server data
                if (!portfolioAssets[currentUser.email]) {
                    portfolioAssets[currentUser.email] = {};
                }
                // Merge fetched assets with existing local ones, server assets take precedence
                // Or replace entirely: portfolioAssets[currentUser.email] = data.assets;
                for (const assetSymbol in data.assets) {
                    portfolioAssets[currentUser.email][assetSymbol.toUpperCase()] = parseFloat(data.assets[assetSymbol]);
                }
                savePortfolioAssetBalances();
            } else {
                console.warn('Investment.js: Fetched portfolio assets, but API indicated no success or assets missing.', data.message || '');
                initializeLocalPortfolioAssetDefaults(); // Fallback if API returns success:false or no assets
            }
        } catch (error) {
            console.error('Investment.js: Error fetching portfolio assets:', error);
            showAlert(`Could not load portfolio assets: ${error.message}`, 'error');
            initializeLocalPortfolioAssetDefaults(); // Fallback on any error
        }
    }
    
    /**
     * Initializes local default portfolio assets if they don't exist for the current user.
     * This is a fallback or initial setup if server data isn't available/fetched.
     */
    function initializeLocalPortfolioAssetDefaults() {
        if (!currentUser?.email) return;

        if (!portfolioAssets[currentUser.email]) {
            portfolioAssets[currentUser.email] = { 
                BTC: 0.00, 
                ETH: 0.00,
                USDT: 0.00 
            };
            // Optionally, set some non-zero defaults for new users if API fails
            // portfolioAssets[currentUser.email] = { BTC: 0.05, ETH: 0.2, USDT: 100 };
            savePortfolioAssetBalances();
            console.log('Investment.js: Initialized local default (or empty) portfolio assets for user:', currentUser.email);
        } else {
            console.log('Investment.js: Existing local portfolio assets found for user:', currentUser.email);
        }
    }

    function getPortfolioAssetBalance(assetSymbol) {
        if (!currentUser?.email || !portfolioAssets[currentUser.email]) {
            return 0;
        }
        return parseFloat(portfolioAssets[currentUser.email][assetSymbol.toUpperCase()] || 0);
    }

    function setPortfolioAssetBalance(assetSymbol, newValue) {
        if (!currentUser?.email) {
            console.warn("Investment.js: Cannot set portfolio asset balance, no current user.");
            return;
        }

        if (!portfolioAssets[currentUser.email]) {
            portfolioAssets[currentUser.email] = {}; 
        }
        const cleanNewValue = parseFloat(newValue);
        if (isNaN(cleanNewValue)) {
            console.error(`Investment.js: Invalid value provided for ${assetSymbol}: ${newValue}`);
            return;
        }

        console.log(`Investment.js: Setting ${assetSymbol} balance to:`, cleanNewValue);
        portfolioAssets[currentUser.email][assetSymbol.toUpperCase()] = cleanNewValue;
        savePortfolioAssetBalances();
        displayPortfolioAssetBalances(); 
        // TODO: If this function is used to *change* balances (e.g., after a trade),
        // you might want to also send an update to the server here via a POST/PUT fetch request.
    }
    
    function savePortfolioAssetBalances() {
        localStorage.setItem(PORTFOLIO_ASSETS_KEY, JSON.stringify(portfolioAssets));
        console.log('Investment.js: Saved portfolio assets to localStorage.');
    }

    function displayPortfolioAssetBalances() {
        const btcBalance = getPortfolioAssetBalance('BTC');
        const ethBalance = getPortfolioAssetBalance('ETH');
        const usdtBalance = getPortfolioAssetBalance('USDT');

        if (btcBalanceDisplayElement) {
            btcBalanceDisplayElement.textContent = btcBalance.toFixed(4);
        }
        if (ethBalanceDisplayElement) {
            ethBalanceDisplayElement.textContent = ethBalance.toFixed(3);
        }
        if (usdtBalanceDisplayElement) {
            usdtBalanceDisplayElement.textContent = usdtBalance.toFixed(2);
        }
        console.log(`Investment.js: Updated portfolio asset displays. BTC: ${btcBalance}, ETH: ${ethBalance}, USDT: ${usdtBalance}`);
    }

    // --- Main USD Available Balance Display (Read-Only from this script) ---
    function getMainUsdBalance() {
        const storedBalance = localStorage.getItem(MAIN_USD_BALANCE_KEY);
        return parseFloat(storedBalance) || 0;
    }

    function displayMainUsdBalance() {
        const balance = getMainUsdBalance();
        // console.log('Investment.js: Displaying main USD available balance:', balance);
        mainUsdBalanceDisplayElements.forEach(el => {
            if (el) el.textContent = `$${balance.toFixed(2)}`;
        });
    }

    // --- General Utilities ---
    function showAlert(message, type = 'info') { 
        const existingAlert = document.querySelector('.app-alert-dynamic-investment');
        if (existingAlert) existingAlert.remove();

        const alertBox = document.createElement('div');
        alertBox.className = `app-alert-dynamic-investment alert-${type}`; 
        alertBox.style.position = 'fixed';
        alertBox.style.top = '70px'; // Adjusted slightly lower to avoid overlap with other potential alerts
        alertBox.style.left = '50%';
        alertBox.style.transform = 'translateX(-50%)';
        alertBox.style.padding = '10px 20px';
        alertBox.style.borderRadius = '5px';
        alertBox.style.zIndex = '9999'; // Slightly lower z-index if dashboard alerts are 10000
        alertBox.style.boxShadow = '0 2px 10px rgba(0,0,0,0.2)';
        
        let bgColor, textColor, borderColor, iconClass;

        switch(type) {
            case 'success':
                bgColor = '#d4edda'; textColor = '#155724'; borderColor = '#c3e6cb'; iconClass = 'fa-check-circle';
                break;
            case 'error':
                bgColor = '#f8d7da'; textColor = '#721c24'; borderColor = '#f5c6cb'; iconClass = 'fa-exclamation-circle';
                break;
            case 'warning':
                bgColor = '#fff3cd'; textColor = '#856404'; borderColor = '#ffeeba'; iconClass = 'fa-exclamation-triangle';
                break;
            default: // info
                bgColor = '#e2e3e5'; textColor = '#383d41'; borderColor = '#d6d8db'; iconClass = 'fa-info-circle';
        }
        
        alertBox.style.backgroundColor = bgColor;
        alertBox.style.color = textColor;
        alertBox.style.border = `1px solid ${borderColor}`;
        
        alertBox.innerHTML = `<i class="fas ${iconClass}" style="margin-right: 8px;"></i> <span>${message}</span>`;
        
        document.body.appendChild(alertBox);
        
        setTimeout(() => {
            alertBox.style.opacity = '0';
            alertBox.style.transition = 'opacity 0.5s ease-out';
            setTimeout(() => alertBox.remove(), 500);
        }, 4500);
    }

    // Initialize the module
    // Using await here ensures that initialization (including async fetch) completes
    // before any subsequent code in this DOMContentLoaded listener might run (if any).
    await initialize();


    // Expose functions if needed by other scripts or for debugging in console
    window.investmentModule = {
        getPortfolioAssetBalance,
        setPortfolioAssetBalance, // Be cautious if exposing this, as it now only updates local state unless modified to also POST to server
        getMainUsdBalance,
        displayPortfolioAssetBalances, // Useful for manual refresh from console
        displayMainUsdBalance,
        fetchUserPortfolioAssets, // Expose for manual re-fetch
        showAlert
    };
});
