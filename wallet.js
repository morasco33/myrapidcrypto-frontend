// wallet.js - Specific script for wallet.html

document.addEventListener('DOMContentLoaded', async function () { // Made async for initial fetches
    console.log("DEBUG [wallet.js]: DOMContentLoaded event fired.");

    // Configuration Keys (prioritize APP_KEYS if available)
    let USER_INFO_KEY = 'cryptohub_user_info';
    let AUTH_TOKEN_KEY = 'cryptohub_auth_token';
    let API_BASE_URL = 'http://localhost:3000/api'; // Default

    if (window.APP_KEYS && typeof window.APP_KEYS === 'object') {
        console.log("DEBUG [wallet.js]: window.APP_KEYS found:", JSON.parse(JSON.stringify(window.APP_KEYS)));
        USER_INFO_KEY = window.APP_KEYS.USER_INFO_KEY || USER_INFO_KEY;
        AUTH_TOKEN_KEY = window.APP_KEYS.AUTH_TOKEN_KEY || AUTH_TOKEN_KEY;
        API_BASE_URL = window.APP_KEYS.API_BASE_URL || API_BASE_URL;
    } else {
        console.warn("WARN [wallet.js]: window.APP_KEYS not found. Using default keys and API endpoint.");
    }
    console.log(`DEBUG [wallet.js]: Effective API_BASE_URL: ${API_BASE_URL}`);
    console.log(`DEBUG [wallet.js]: Effective AUTH_TOKEN_KEY: ${AUTH_TOKEN_KEY}`);
    console.log(`DEBUG [wallet.js]: Effective USER_INFO_KEY: ${USER_INFO_KEY}`);


    // 1. Authentication Check
    const authToken = localStorage.getItem(AUTH_TOKEN_KEY);
    if (!authToken) {
        console.log("DEBUG [wallet.js]: User not authenticated, redirecting to login.");
        window.location.href = `login.html?reason=auth_required&redirectedFrom=${encodeURIComponent(window.location.pathname + window.location.search)}`;
        return; // Stop further execution
    }

    // 2. Get User Information
    const storedUserInfo = localStorage.getItem(USER_INFO_KEY);
    let currentUser = null;

    if (storedUserInfo) {
        try {
            currentUser = JSON.parse(storedUserInfo);
        } catch (error) {
            console.error('ERROR [wallet.js]: Parsing user info from localStorage:', error);
        }
    }

    if (!currentUser) {
        console.warn('WARN [wallet.js]: User information not found or invalid. Some features might use defaults.');
        // Potentially display a banner or partial content if currentUser is critical for everything
    }

    // 3. Update UI with User Data
    const userNameElement = document.getElementById('userName');
    if (userNameElement) {
        userNameElement.textContent = (currentUser && currentUser.username) ? currentUser.username : 'Valued User';
    } else {
        console.warn('WARN [wallet.js]: userName element not found.');
    }

    // 4. Setup Event Listeners for Wallet Actions
    const sendButton = document.getElementById('sendBtn');
    if (sendButton) {
        sendButton.addEventListener('click', function () {
            window.location.href = 'transfer.html?action=send';
        });
    } else {
        console.warn('WARN [wallet.js]: Send button (sendBtn) not found.');
    }

    const receiveButton = document.getElementById('receiveBtn');
    if (receiveButton) {
        receiveButton.addEventListener('click', () => {
            // Assuming deposit.html is the receive page
            window.location.href = 'deposit.html'; 
        });
    } else {
        console.warn('WARN [wallet.js]: Receive button (receiveBtn) not found.');
    }

    // Sections for deposit address and QR code are assumed to be removed or handled by deposit.html

    // 6. Fetch and Display General Wallet Balances
    // Pass API_BASE_URL and AUTH_TOKEN_KEY to the function
    await fetchGeneralBalances(API_BASE_URL, AUTH_TOKEN_KEY);

    // 7. Fetch and Display User Investments
    // Pass currentUser, API_BASE_URL, and AUTH_TOKEN_KEY
    await fetchWalletInvestments(currentUser, API_BASE_URL, AUTH_TOKEN_KEY);

    console.log('DEBUG [wallet.js]: DOMContentLoaded complete. UI setup and data fetching initiated.');
});

async function fetchGeneralBalances(apiBaseUrl, authTokenKey) {
    const token = localStorage.getItem(authTokenKey);
    // Define the assets you want to display balances for
    const assetsToDisplay = ['btc', 'eth', 'usdt', 'ada']; // Example assets
    const balancesLoadingIndicator = document.getElementById('balancesLoading'); // Optional loading indicator

    if (balancesLoadingIndicator) balancesLoadingIndicator.style.display = 'block';
    assetsToDisplay.forEach(asset => updateBalanceInTable(asset, 'Loading...', '...')); // Initial loading state

    if (!token) {
        console.warn("WARN [wallet.js - fetchGeneralBalances]: No auth token found.");
        assetsToDisplay.forEach(asset => updateBalanceInTable(asset, 'Auth Error', 'N/A'));
        if (balancesLoadingIndicator) balancesLoadingIndicator.style.display = 'none';
        return;
    }
    if (!apiBaseUrl) {
        console.error("ERROR [wallet.js - fetchGeneralBalances]: API_BASE_URL not configured.");
        assetsToDisplay.forEach(asset => updateBalanceInTable(asset, 'Config Error', 'N/A'));
        if (balancesLoadingIndicator) balancesLoadingIndicator.style.display = 'none';
        return;
    }

    try {
        const endpoint = `${apiBaseUrl}/wallet/balances`; // Example endpoint
        console.log(`DEBUG [wallet.js - fetchGeneralBalances]: Fetching from ${endpoint}`);
        
        const response = await fetch(endpoint, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        if (response.status === 401) {
            console.warn("WARN [wallet.js - fetchGeneralBalances]: Unauthorized (401).");
            assetsToDisplay.forEach(asset => updateBalanceInTable(asset, 'Auth Error', 'N/A'));
            // Optional: redirect to login
            // window.location.href = `login.html?reason=auth_required&redirectedFrom=${encodeURIComponent(window.location.pathname + window.location.search)}`;
            throw new Error('Unauthorized'); // Stop further processing
        }

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ message: `Server error ${response.status}` }));
            throw new Error(errorData.message || `API Error: ${response.status}`);
        }
        
        const result = await response.json(); 

        if (result.success && result.balances && typeof result.balances === 'object') {
            console.log("DEBUG [wallet.js - fetchGeneralBalances]: Balances data received:", result.balances);
            // Assuming result.balances is an object like: { btc: { balance: 0.1, valueUsd: 5000 }, eth: {...} }
            assetsToDisplay.forEach(asset => {
                const assetData = result.balances[asset.toLowerCase()];
                if (assetData) {
                    updateBalanceInTable(asset, assetData.balance, assetData.valueUsd !== undefined ? assetData.valueUsd : assetData.value); // Support valueUsd or value
                } else {
                    console.warn(`WARN [wallet.js - fetchGeneralBalances]: No balance data for ${asset} from API.`);
                    updateBalanceInTable(asset, 0, 0); // Show 0 if not present in API response
                }
            });
        } else {
            console.warn("WARN [wallet.js - fetchGeneralBalances]: API response format unexpected or success:false.", result);
            assetsToDisplay.forEach(asset => updateBalanceInTable(asset, 'Data Error', 'N/A'));
        }

    } catch (error) {
        console.error("ERROR [wallet.js - fetchGeneralBalances]:", error.message);
        if (error.message !== 'Unauthorized') { // Avoid double message if already handled
            assetsToDisplay.forEach(asset => updateBalanceInTable(asset, 'Load Error', 'N/A'));
        }
    } finally {
        if (balancesLoadingIndicator) balancesLoadingIndicator.style.display = 'none';
    }
}

function updateBalanceInTable(assetTicker, balance, usdValue) {
    const balanceCell = document.querySelector(`td[data-asset-balance="${assetTicker.toLowerCase()}"]`);
    const valueCell = document.querySelector(`td[data-asset-value="${assetTicker.toLowerCase()}"]`);

    const formatBalance = (bal) => {
        if (typeof bal === 'number') return bal.toFixed(8); // Increased precision for crypto
        if (typeof bal === 'string' && !isNaN(parseFloat(bal))) return parseFloat(bal).toFixed(8);
        return bal || '0.00000000';
    };
    const formatValue = (val) => {
        if (typeof val === 'number') return val.toFixed(2);
        if (typeof val === 'string' && !isNaN(parseFloat(val))) return parseFloat(val).toFixed(2);
        return val || '0.00';
    };

    if (balanceCell) {
        balanceCell.textContent = `${formatBalance(balance)} ${assetTicker.toUpperCase()}`;
    } else {
        // console.warn(`WARN [wallet.js - updateBalanceInTable]: Balance cell for ${assetTicker} not found.`);
    }

    if (valueCell) {
        valueCell.textContent = `$${formatValue(usdValue)}`;
    } else {
        // console.warn(`WARN [wallet.js - updateBalanceInTable]: Value cell for ${assetTicker} not found.`);
    }
}

async function fetchWalletInvestments(currentUser, apiBaseUrl, authTokenKey) {
    const investmentsContainer = document.getElementById('walletInvestments');
    if (!investmentsContainer) {
        console.log('INFO [wallet.js - fetchWalletInvestments]: Element "walletInvestments" not found. Skipping.');
        return;
    }

    investmentsContainer.innerHTML = '<p><i class="fas fa-spinner fa-spin"></i> Loading investments...</p>';

    const token = localStorage.getItem(authTokenKey);
    if (!token) {
        investmentsContainer.innerHTML = '<p>⚠️ Authentication required. Cannot load investments.</p>';
        console.warn('WARN [wallet.js - fetchWalletInvestments]: Auth token missing.');
        return;
    }
    if (!apiBaseUrl) {
        investmentsContainer.innerHTML = '<p>⚠️ System configuration error. Cannot load investments.</p>';
        console.error('ERROR [wallet.js - fetchWalletInvestments]: API_BASE_URL not configured.');
        return;
    }
    // currentUser might be null if localStorage was empty/invalid, but token is primary for auth
    // Backend should use token to identify user. currentUser._id might not be needed in URL
    // if backend /investments endpoint returns investments for the authenticated user.
    // For this example, we'll assume /investments returns all for the authenticated user.
    // const userIdSegment = (currentUser && currentUser._id) ? `/${currentUser._id}` : '';
    const endpoint = `${apiBaseUrl}/investments`; // Simpler endpoint if backend handles user context

    try {
        console.log(`DEBUG [wallet.js - fetchWalletInvestments]: Fetching from ${endpoint}`);
        const response = await fetch(endpoint, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        if (response.status === 401) {
             investmentsContainer.innerHTML = `<p>🚫 Session expired or unauthorized. Please log in again.</p>`;
             throw new Error('Unauthorized (401)');
        }
        if (!response.ok) {
            let errorMsg = `Error: ${response.status}`;
            try { const errorData = await response.json(); errorMsg = errorData.message || errorMsg; } catch (e) { /* ignore */ }
            investmentsContainer.innerHTML = `<p>❌ Failed to load investments. (${errorMsg})</p>`;
            throw new Error(`Failed to load investments: ${errorMsg}`);
        }

        const result = await response.json();

        if (result.success && Array.isArray(result.investments)) {
            const investments = result.investments;
            if (investments.length === 0) {
                investmentsContainer.innerHTML = '<p>No active investments found. Explore our investment plans!</p>';
            } else {
                investmentsContainer.innerHTML = investments.map(inv => {
                    const planName = inv.planName || inv.plan?.name || 'Investment Plan';
                    const amountInvested = typeof inv.initialAmount === 'number' ? inv.initialAmount.toFixed(2) : 'N/A';
                    const currentValue = typeof inv.currentValue === 'number' ? inv.currentValue.toFixed(2) : 'N/A';
                    const status = inv.status ? inv.status.charAt(0).toUpperCase() + inv.status.slice(1) : 'Unknown';
                    const startDate = inv.startDate ? new Date(inv.startDate).toLocaleDateString() : 'N/A';
                    
                    return `
                        <div class="investment-item card-style">
                            <h4>${planName}</h4>
                            <p><strong>Invested:</strong> $${amountInvested}</p>
                            <p><strong>Current Value:</strong> $${currentValue}</p>
                            <p><strong>Status:</strong> <span class="status-badge status-${status.toLowerCase()}">${status}</span></p>
                            <p><small>Started: ${startDate}</small></p>
                        </div>`;
                }).join('');
            }
             console.log(`DEBUG [wallet.js - fetchWalletInvestments]: Successfully displayed ${investments.length} investments.`);
        } else {
            console.error("ERROR [wallet.js - fetchWalletInvestments]: Fetched investments data format error or success:false.", result);
            investmentsContainer.innerHTML = '<p>⚠️ Error: Invalid data received for investments.</p>';
        }

    } catch (error) {
        console.error('ERROR [wallet.js - fetchWalletInvestments]:', error.message);
        // Error message might already be set in the container by specific checks
        if (investmentsContainer.innerHTML.includes('Loading investments')) { 
            investmentsContainer.innerHTML = `<p>❌ An error occurred while loading investments. Please try again.</p>`;
        }
    }
}
