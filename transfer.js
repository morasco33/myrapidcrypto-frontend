// transfer.js
document.addEventListener('DOMContentLoaded', () => {
    console.log("DEBUG [transfer.js]: DOMContentLoaded event fired.");

    // --- Configuration ---
    let API_BASE_URL;
    let AUTH_TOKEN_KEY = 'cryptohub_auth_token'; // Default, will be overridden
    // USER_INFO_KEY is not strictly needed here if server infers user from token

    // Use API_BASE_URL from global configuration (e.g., window.APP_KEYS or window.GLOBAL_KEYS)
    if (window.APP_KEYS && typeof window.APP_KEYS === 'object' && window.APP_KEYS.API_BASE_URL) {
        API_BASE_URL = window.APP_KEYS.API_BASE_URL;
        AUTH_TOKEN_KEY = window.APP_KEYS.AUTH_TOKEN_KEY || AUTH_TOKEN_KEY;
    } else if (window.GLOBAL_KEYS && typeof window.GLOBAL_KEYS === 'object' && window.GLOBAL_KEYS.API_BASE_URL) {
        API_BASE_URL = window.GLOBAL_KEYS.API_BASE_URL;
        AUTH_TOKEN_KEY = window.GLOBAL_KEYS.AUTH_TOKEN_KEY || AUTH_TOKEN_KEY; // If you standardize this key too
    } else {
        console.warn("WARN [transfer.js]: Global API_BASE_URL not found. Using fallback for local dev.");
        API_BASE_URL = 'http://localhost:3001'; // Fallback for local dev (NO /api suffix)
    }
    console.log(`DEBUG [transfer.js]: Effective API_BASE_URL: '${API_BASE_URL}'`);


    // --- DOM Elements ---
    const assetOptions = document.querySelectorAll('.asset-option'); // Assuming these exist in your HTML
    const sendAmountDisplay = document.getElementById('sendAmount');
    const receiveAmountDisplay = document.getElementById('receiveAmount');
    const amountInput = document.getElementById('amount');
    const recipientAddressInput = document.getElementById('recipientAddress');
    const networkSelect = document.getElementById('network'); // Dropdown for network selection
    const noteInput = document.getElementById('note');
    const sendButton = document.getElementById('sendTransactionBtn');
    const transferMessageDiv = document.getElementById('transferMessage');
    const availableBalanceDisplay = document.getElementById('availableBalanceDisplay'); // For showing current asset balance

    let selectedAssetSymbol = null;
    let currentUserAssetBalance = 0; // To store the balance of the selected asset

    // --- Authentication Check ---
    const authToken = localStorage.getItem(AUTH_TOKEN_KEY); // --- ALIGNMENT: Get from sessionStorage ---
    if (!authToken) {
        console.log("DEBUG [transfer.js]: User not authenticated, redirecting.");
        window.location.href = `login.html?reason=auth_required&redirectTo=${encodeURIComponent(window.location.pathname + window.location.search)}`;
        return;
    }

    // --- Asset Selection Logic ---
    assetOptions.forEach(option => {
      option.addEventListener('click', async function () { // Make async to fetch balance
        assetOptions.forEach(o => o.classList.remove('active'));
        this.classList.add('active');
        
        selectedAssetSymbol = this.dataset.asset.toUpperCase();
        if (sendAmountDisplay) sendAmountDisplay.textContent = `0.00 ${selectedAssetSymbol}`;
        if (receiveAmountDisplay) receiveAmountDisplay.textContent = `≈ 0.00 ${selectedAssetSymbol}`; // Update later with fees/conversion
        if (amountInput) amountInput.placeholder = `Amount in ${selectedAssetSymbol}`;
        
        // Fetch and display balance for the newly selected asset
        await fetchUserAssetBalance(selectedAssetSymbol);
        updateNetworkOptions(selectedAssetSymbol); // Update network options based on asset
      });
    });

    // Select the first asset by default and fetch its balance
    if (assetOptions.length > 0 && !document.querySelector('.asset-option.active')) {
        assetOptions[0].click(); // This will trigger the click event listener, including fetchUserAssetBalance
    }


    // --- Handle Transaction Submission ---
    if (sendButton && amountInput && recipientAddressInput && networkSelect) {
        sendButton.addEventListener('click', async () => {
            const activeAssetOption = document.querySelector('.asset-option.active');
            // selectedAssetSymbol is already set by the click handler
            
            const amountStr = amountInput.value;
            const amount = parseFloat(amountStr);
            const toAddress = recipientAddressInput.value.trim();
            const network = networkSelect.value;
            const note = noteInput ? noteInput.value.trim() : '';

            displayTransferMessage("", "info"); // Clear previous messages

            // --- Client-side Validations ---
            if (!selectedAssetSymbol) {
                displayTransferMessage("Please select an asset to transfer.", "error");
                return;
            }
            if (isNaN(amount) || amount <= 0) {
                displayTransferMessage("Please enter a valid positive amount.", "error");
                amountInput.focus();
                return;
            }
            if (amount > currentUserAssetBalance) {
                displayTransferMessage(`Insufficient ${selectedAssetSymbol} balance. Available: ${currentUserAssetBalance.toFixed(8)}`, "error");
                amountInput.focus();
                return;
            }
            if (!toAddress) {
                displayTransferMessage("Please enter a recipient address or username/email.", "error");
                recipientAddressInput.focus();
                return;
            }
            // Basic address validation (can be improved)
            if (toAddress.length < 3 && !toAddress.includes('@')) { // Very basic check
                 displayTransferMessage("Recipient identifier seems too short.", "error");
                 recipientAddressInput.focus();
                 return;
            }
            // Network validation (example: required for ETH and tokens, optional for BTC internal)
            if (!network && needsNetwork(selectedAssetSymbol)) {
                displayTransferMessage(`Please select a network for ${selectedAssetSymbol} transfer.`, "error");
                networkSelect.focus();
                return;
            }
            
            const originalBtnHtml = sendButton.innerHTML;
            sendButton.disabled = true;
            sendButton.innerHTML = `<i class="fas fa-spinner fa-spin"></i> Sending...`;
            
            // --- Construct API URL ---
            const transferApiUrl = `${API_BASE_URL}/api/transfer`; // Added /api prefix
            console.log(`DEBUG [transfer.js]: Attempting transfer to ${transferApiUrl}`);

            try {
                const payload = {
                    toAddress, // Could be an external address or internal user identifier (e.g., email)
                    asset: selectedAssetSymbol.toLowerCase(), // Send asset symbol consistently
                    amount,
                    network: needsNetwork(selectedAssetSymbol) ? network : undefined, // Send network only if applicable
                    note
                };
                console.log("DEBUG [transfer.js]: Transfer payload:", payload);

                const res = await fetch(transferApiUrl, {
                    method: 'POST',
                    headers: { 
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${authToken}`
                    },
                    body: JSON.stringify(payload)
                });

                const data = await res.json();

                if (res.ok && data.success) { // Backend should send {success: true, message: "..."}
                    displayTransferMessage(data.message || "Transfer initiated successfully!", "success");
                    amountInput.value = '';
                    recipientAddressInput.value = '';
                    if (noteInput) noteInput.value = '';
                    await fetchUserAssetBalance(selectedAssetSymbol); // Refresh balance
                } else {
                    throw new Error(data.message || 'Transfer failed. Unknown server error.');
                }
            } catch (err) {
                console.error('ERROR [transfer.js]: Transfer operation failed -', err);
                const errorMessage = err.message && err.message.includes('Failed to fetch')
                    ? 'Network error. Please check connection.'
                    : (err.message || 'Error sending transaction.');
                displayTransferMessage(errorMessage, "error");
            } finally {
                sendButton.disabled = false;
                sendButton.innerHTML = originalBtnHtml;
            }
        });
    } else {
        console.warn("WARN [transfer.js]: One or more critical form elements (send button, amount, recipient, network) not found.");
        displayTransferMessage("Transfer form is not correctly set up. Contact support.", "error");
    }

    function displayTransferMessage(message, type = 'info') {
        if (transferMessageDiv) {
            transferMessageDiv.textContent = message;
            transferMessageDiv.className = `form-message ${type}`; // Assumes CSS for .form-message.error, .form-message.success
            transferMessageDiv.style.display = 'block';
        } else {
            alert(`${type.toUpperCase()}: ${message}`);
        }
    }

    // --- Function to fetch user asset balance ---
    async function fetchUserAssetBalance(assetSymbol) {
        if (!API_BASE_URL || !authToken || !assetSymbol) return;
        
        if (availableBalanceDisplay) availableBalanceDisplay.innerHTML = `Loading <i class="fas fa-spinner fa-spin"></i>`;

        try {
            // --- Ensure API endpoint is correct ---
            // Example: /api/wallet/balance/btc - backend needs to support this
            const balanceApiUrl = `${API_BASE_URL}/api/wallet/balance/${assetSymbol.toLowerCase()}`;
            console.log(`DEBUG [transfer.js]: Fetching balance from ${balanceApiUrl}`);
            
            const response = await fetch(balanceApiUrl, {
                headers: { 'Authorization': `Bearer ${authToken}` }
            });

            const data = await response.json();

            if (response.ok && data.success && typeof data.balance === 'number') {
                currentUserAssetBalance = parseFloat(data.balance);
                if (availableBalanceDisplay) {
                    availableBalanceDisplay.textContent = `Available: ${currentUserAssetBalance.toFixed(8)} ${assetSymbol.toUpperCase()}`;
                }
                // Also update the sendAmountDisplay if it's meant to show available balance initially
                if (sendAmountDisplay) sendAmountDisplay.textContent = `${currentUserAssetBalance.toFixed(8)} ${assetSymbol.toUpperCase()}`;
            } else {
                currentUserAssetBalance = 0;
                if (availableBalanceDisplay) availableBalanceDisplay.textContent = 'Balance: N/A';
                if (sendAmountDisplay) sendAmountDisplay.textContent = `0.00 ${assetSymbol.toUpperCase()}`;
                console.warn(`WARN [transfer.js]: Failed to fetch balance for ${assetSymbol} or unexpected response.`, data);
            }
        } catch (error) {
            currentUserAssetBalance = 0;
            console.error(`ERROR [transfer.js]: Fetching balance for ${assetSymbol} -`, error);
            if (availableBalanceDisplay) availableBalanceDisplay.textContent = 'Error loading balance.';
            if (sendAmountDisplay) sendAmountDisplay.textContent = `0.00 ${assetSymbol.toUpperCase()}`;
        }
    }

    // --- Helper to determine if network is needed and update options ---
    // This is a simplified example. Real-world would be more complex.
    function needsNetwork(assetSymbol) {
        const sym = assetSymbol.toLowerCase();
        // Example: BTC might allow internal transfers without explicit network,
        // but ETH and ERC20 tokens would require 'ERC20', etc.
        return !['btc', 'internal_usd'].includes(sym); // Add other non-network assets
    }

    function updateNetworkOptions(assetSymbol) {
        if (!networkSelect) return;
        // Clear existing options except the default placeholder
        while (networkSelect.options.length > 1) {
            networkSelect.remove(1);
        }
        networkSelect.value = ""; // Reset selection

        const sym = assetSymbol.toLowerCase();
        let networks = [];

        if (sym === 'btc') {
            networks = [{ value: 'bitcoin', text: 'Bitcoin Network' }];
        } else if (sym === 'eth' || sym === 'usdt' || sym === 'usdc') { // Assuming these are ERC20
            networks = [
                { value: 'erc20', text: 'Ethereum (ERC20)' },
                // If USDT also on TRC20, add that option
                // { value: 'trc20', text: 'Tron (TRC20)' } // Example for USDT
            ];
        } // Add more asset-specific network options here

        networks.forEach(net => {
            const option = document.createElement('option');
            option.value = net.value;
            option.textContent = net.text;
            networkSelect.appendChild(option);
        });
        
        // Show/hide network select based on whether it's needed
        const networkGroup = networkSelect.closest('.form-group'); // Assuming networkSelect is in a .form-group
        if (networkGroup) {
            networkGroup.style.display = needsNetwork(assetSymbol) ? 'block' : 'none';
        }
    }

});