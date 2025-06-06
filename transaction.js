// transactions.js
document.addEventListener('DOMContentLoaded', async () => {
    console.log("DEBUG [transactions.js]: DOMContentLoaded event fired.");

    const transactionTableBody = document.getElementById('transactionsTable')?.getElementsByTagName('tbody')[0];
    const transactionFilter = document.getElementById('transactionFilter');
    const transactionSearch = document.getElementById('transactionSearch');
    const logoutButton = document.getElementById('logoutBtn'); // Assuming this is in a shared header included on the page
    const loadingIndicator = document.getElementById('loadingIndicator');
    const errorMessageDiv = document.getElementById('errorMessage');

    const TRANSACTIONS_CACHE_KEY = 'rapidcrypto_transactions_cache_v1'; // More specific cache key

    let API_BASE_URL;
    let AUTH_TOKEN_KEY = 'cryptohub_auth_token'; // Default, will be overridden by APP_KEYS
    // USER_INFO_KEY is not directly used in this script for fetching, only for logout clearing

    // --- Use API_BASE_URL from global configuration (e.g., window.APP_KEYS or window.GLOBAL_KEYS) ---
    if (window.APP_KEYS && typeof window.APP_KEYS === 'object' && window.APP_KEYS.API_BASE_URL) {
        API_BASE_URL = window.APP_KEYS.API_BASE_URL;
        AUTH_TOKEN_KEY = window.APP_KEYS.AUTH_TOKEN_KEY || AUTH_TOKEN_KEY;
    } else if (window.GLOBAL_KEYS && typeof window.GLOBAL_KEYS === 'object' && window.GLOBAL_KEYS.API_BASE_URL) {
        API_BASE_URL = window.GLOBAL_KEYS.API_BASE_URL;
        // AUTH_TOKEN_KEY might be part of GLOBAL_KEYS too if you standardize
    } else {
        console.warn("WARN [transactions.js]: Global API_BASE_URL not found. Using fallback for local dev.");
        API_BASE_URL = 'http://localhost:3001'; // Fallback for local dev (NO /api suffix)
    }
    console.log(`DEBUG [transactions.js]: Effective API_BASE_URL: '${API_BASE_URL}'`);


    // --- Get auth token from sessionStorage (align with login.js recommendation) ---
    const authToken = sessionStorage.getItem(AUTH_TOKEN_KEY);

    if (!authToken) {
        console.log("DEBUG [transactions.js]: User not authenticated, redirecting to login.");
        // Redirect to login, passing current page for redirection after login
        window.location.href = `login.html?reason=session_expired_or_not_logged_in&redirectTo=${encodeURIComponent(window.location.pathname + window.location.search)}`;
        return; // Stop further execution
    }

    // Logout functionality (if logout button is on this page, e.g., in a shared header)
    if (logoutButton) {
        logoutButton.addEventListener('click', (e) => {
            e.preventDefault();
            console.log("DEBUG [transactions.js]: Logout clicked.");
            sessionStorage.removeItem(AUTH_TOKEN_KEY);
            // Clear other relevant sessionStorage or localStorage items
            sessionStorage.removeItem(window.APP_KEYS?.USER_INFO_KEY || 'cryptohub_user_info'); // Use the correct user info key
            localStorage.removeItem(TRANSACTIONS_CACHE_KEY);
            // Add any other app-specific keys you use for caching or session state
            // e.g., localStorage.removeItem('availableBalance_cs_v2'); 
            window.location.href = 'login.html?message=' + encodeURIComponent('You have been successfully logged out.');
        });
    }

    let allTransactions = []; // Holds all fetched transactions

    // --- Updated getStatusAndAsset to match backend transaction types ---
    function getStatusAndAsset(tx) {
        let status = tx.status || 'Completed'; // Default status
        let asset = tx.currency || 'USD';      // Default currency/asset
        let readableType = tx.type;            // Start with raw type

        // Customize based on your backend's TransactionSchema types
        switch (tx.type) {
            case 'deposit_main_balance':
                readableType = 'Deposit to Balance';
                status = tx.status || 'Credited';
                asset = tx.meta?.source || tx.currency || 'N/A'; // e.g., From External Wallet
                break;
            case 'withdrawal_main_balance':
                readableType = 'Withdrawal from Balance';
                status = tx.status || 'Processed';
                asset = tx.meta?.destination || tx.currency || 'N/A'; // e.g., To Bank Account
                break;
            case 'plan_investment':
                readableType = `Investment in ${tx.meta?.planName || 'Plan'}`;
                status = tx.status || 'Active';
                asset = tx.meta?.planName || tx.currency || 'N/A';
                break;
            case 'plan_withdrawal_return':
                readableType = `Return from ${tx.meta?.planName || 'Plan'}`;
                status = tx.status || 'Credited';
                asset = tx.meta?.planName || tx.currency || 'N/A';
                break;
            case 'interest_accrued_to_plan_value':
                readableType = `Interest for ${tx.meta?.planName || 'Plan'}`;
                status = tx.status || 'Accrued';
                asset = tx.meta?.planName || tx.currency || 'N/A';
                break;
            case 'fee':
                readableType = `Service Fee (${tx.description || ''})`;
                status = tx.status || 'Charged';
                asset = tx.currency || 'N/A';
                break;
            case 'admin_credit':
                readableType = `Admin Credit (${tx.description || ''})`;
                status = tx.status || 'Credited';
                asset = tx.currency || 'N/A';
                break;
            case 'admin_debit':
                readableType = `Admin Debit (${tx.description || ''})`;
                status = tx.status || 'Debited';
                asset = tx.currency || 'N/A';
                break;
            default:
                readableType = tx.type.replace(/_/g, ' ').replace(/^\w|\s\w/g, c => c.toUpperCase());
        }
        return { status, asset, readableType };
    }

    function renderTransactions(transactionsToRender) {
        if (!transactionTableBody) {
            console.error("ERROR [transactions.js]: Transaction table body not found.");
            return;
        }
        transactionTableBody.innerHTML = ''; // Clear existing rows

        if (!transactionsToRender || transactionsToRender.length === 0) {
            const row = transactionTableBody.insertRow();
            const cell = row.insertCell();
            cell.colSpan = 5; // Ensure this matches your table's column count
            cell.textContent = 'No transactions found matching your criteria.';
            cell.style.textAlign = 'center';
            cell.style.padding = '20px';
            return;
        }

        // Sort by newest first (if backend doesn't already do it)
        transactionsToRender.sort((a, b) => new Date(b.timestamp || b.createdAt) - new Date(a.timestamp || a.createdAt));

        transactionsToRender.forEach(tx => {
            const row = transactionTableBody.insertRow();
            const { status, asset, readableType } = getStatusAndAsset(tx);

            row.insertCell().textContent = new Date(tx.timestamp || tx.createdAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
            row.insertCell().textContent = readableType;
            row.insertCell().textContent = asset; // What was affected (e.g., plan name, currency)

            const amountCell = row.insertCell();
            const amountValue = parseFloat(tx.amount);
            let sign = '';
            let color = 'var(--text-color, inherit)';

            // Determine sign and color based on transaction type and amount
            // These types should align with your backend `TransactionSchema` types
            const positiveTypes = ['deposit_main_balance', 'plan_withdrawal_return', 'interest_accrued_to_plan_value', 'admin_credit'];
            const negativeTypes = ['plan_investment', 'withdrawal_main_balance', 'fee', 'admin_debit'];

            if (positiveTypes.includes(tx.type) || (amountValue > 0 && !negativeTypes.includes(tx.type))) {
                sign = '+';
                color = 'var(--success-color, green)';
            } else if (negativeTypes.includes(tx.type) || (amountValue < 0 && !positiveTypes.includes(tx.type))) {
                sign = (amountValue < 0) ? '' : '-'; // Use existing sign if amount is negative, else add minus
                color = 'var(--danger-color, red)';
            }
            
            amountCell.textContent = `${sign}${Math.abs(amountValue).toFixed(2)} ${tx.currency || 'USD'}`;
            amountCell.style.color = color;
            amountCell.style.fontWeight = '500';

            const statusCell = row.insertCell();
            // Ensure you have CSS for these status badges
            statusCell.innerHTML = `<span class="status-badge status-${status.toLowerCase().replace(/\s+/g, '-')}">${status}</span>`;
        });
        console.log(`DEBUG [transactions.js]: Rendered ${transactionsToRender.length} transactions.`);
    }

    function filterAndSearchTransactions() {
        if (!allTransactions) {
            console.warn("WARN [transactions.js]: allTransactions is not populated yet.");
            renderTransactions([]); // Render empty state
            return;
        }
        const filterValue = transactionFilter ? transactionFilter.value : 'all';
        const searchTerm = transactionSearch ? transactionSearch.value.toLowerCase().trim() : '';
        let filtered = [...allTransactions];

        // Updated filter logic based on backend types
        if (filterValue !== 'all') {
            filtered = filtered.filter(tx => {
                const positiveTypes = ['deposit_main_balance', 'plan_withdrawal_return', 'interest_accrued_to_plan_value', 'admin_credit'];
                const negativeTypes = ['plan_investment', 'withdrawal_main_balance', 'fee', 'admin_debit'];

                if (filterValue === 'sent') return negativeTypes.includes(tx.type);
                if (filterValue === 'received') return positiveTypes.includes(tx.type);
                // For specific type filters like 'deposit', 'investment', 'withdrawal'
                // This requires filterValue to be part of the tx.type string or a direct match
                return tx.type.includes(filterValue); 
            });
        }

        if (searchTerm) {
            filtered = filtered.filter(tx => {
                const { status, asset, readableType } = getStatusAndAsset(tx);
                return (
                    (tx.description && tx.description.toLowerCase().includes(searchTerm)) ||
                    readableType.toLowerCase().includes(searchTerm) ||
                    asset.toLowerCase().includes(searchTerm) ||
                    status.toLowerCase().includes(searchTerm) ||
                    (tx.currency && tx.currency.toLowerCase().includes(searchTerm)) ||
                    parseFloat(tx.amount).toFixed(2).includes(searchTerm) ||
                    new Date(tx.timestamp || tx.createdAt).toLocaleString().toLowerCase().includes(searchTerm)
                );
            });
        }
        renderTransactions(filtered);
    }

    async function loadAllTransactions() {
        if (!API_BASE_URL) {
            console.error("ERROR [transactions.js]: API_BASE_URL is not configured.");
            if (errorMessageDiv) errorMessageDiv.textContent = "Service configuration error. Cannot load transactions.";
            if (errorMessageDiv) errorMessageDiv.style.display = 'block';
            allTransactions = JSON.parse(localStorage.getItem(TRANSACTIONS_CACHE_KEY)) || [];
            filterAndSearchTransactions(); // Attempt to render from cache
            return;
        }
        
        if (loadingIndicator) loadingIndicator.style.display = 'block';
        if (errorMessageDiv) errorMessageDiv.style.display = 'none'; // Hide previous errors

        try {
            // --- Ensure API endpoint is correct ---
            const fetchURL = `${API_BASE_URL}/api/transactions`; // Added /api prefix
            console.log(`DEBUG [transactions.js]: Fetching transactions from ${fetchURL}`);
            
            const response = await fetch(fetchURL, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${authToken}`,
                    'Content-Type': 'application/json'
                }
            });

            if (response.status === 401) { // Unauthorized
                console.warn("WARN [transactions.js]: Unauthorized (401). Token might be expired or invalid. Redirecting to login.");
                sessionStorage.removeItem(AUTH_TOKEN_KEY); // Clear potentially bad token
                window.location.href = `login.html?reason=session_expired&redirectTo=${encodeURIComponent(window.location.pathname + window.location.search)}`;
                return;
            }

            const data = await response.json(); // Try to parse JSON for all responses

            if (!response.ok) { // Handles 4xx (except 401 handled above) and 5xx errors
                throw new Error(data.message || `Failed to fetch transactions. Server responded with status: ${response.status}`);
            }

            // Expecting backend to send { success: true, transactions: [...] }
            if (data.success && Array.isArray(data.transactions)) {
                allTransactions = data.transactions;
                localStorage.setItem(TRANSACTIONS_CACHE_KEY, JSON.stringify(allTransactions));
                console.log(`DEBUG [transactions.js]: Successfully fetched and cached ${allTransactions.length} transactions.`);
            } else {
                console.warn("WARN [transactions.js]: API response format unexpected or success:false.", data);
                // Fallback to cache or empty if API response is not as expected but was 'ok' (e.g. 200 with success:false)
                allTransactions = JSON.parse(localStorage.getItem(TRANSACTIONS_CACHE_KEY)) || [];
                if (errorMessageDiv && data.message) {
                     errorMessageDiv.textContent = `Could not load transactions: ${data.message}`;
                     errorMessageDiv.style.display = 'block';
                } else if (errorMessageDiv) {
                    errorMessageDiv.textContent = "Transactions loaded, but data might be incomplete or in an unexpected format.";
                    errorMessageDiv.style.display = 'block';
                }
            }
        } catch (error) {
            console.error("ERROR [transactions.js]: Fetching transactions failed -", error);
            if (errorMessageDiv) {
                errorMessageDiv.textContent = `Error loading transactions: ${error.message}. Displaying cached data if available.`;
                errorMessageDiv.style.display = 'block';
            }
            allTransactions = JSON.parse(localStorage.getItem(TRANSACTIONS_CACHE_KEY)) || []; // Fallback to cache
        } finally {
            if (loadingIndicator) loadingIndicator.style.display = 'none';
            filterAndSearchTransactions(); // Render data (from server or cache)
        }
    }

    // Event listeners for filter and search
    if (transactionFilter) {
        transactionFilter.addEventListener('change', filterAndSearchTransactions);
    }
    if (transactionSearch) {
        let searchTimeout;
        transactionSearch.addEventListener('input', () => {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(filterAndSearchTransactions, 300); // Debounce
        });
    }

    // Initial load
    if (transactionTableBody) {
        await loadAllTransactions(); // Call the async function and await its completion
    } else {
        console.error("CRITICAL [transactions.js]: Cannot initialize. transactionsTable or its tbody not found.");
        if (errorMessageDiv) {
            errorMessageDiv.textContent = "Transaction display area not found on this page. Please contact support.";
            errorMessageDiv.style.display = 'block';
        }
    }
});