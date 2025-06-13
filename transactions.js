document.addEventListener('DOMContentLoaded', async () => {
    console.log("TRANSACTIONS: Initializing transaction history");

    // DOM Elements
    const transactionTableBody = document.getElementById('transactionsTable')?.querySelector('tbody');
    const transactionFilter = document.getElementById('transactionFilter');
    const transactionSearch = document.getElementById('transactionSearch');
    const filterButtons = document.querySelectorAll('.transaction-filters button');
    const logoutButton = document.getElementById('logoutBtn');

    // Configuration
    const API_BASE_URL = window.APP_KEYS?.API_BASE_URL || 'https://rapidcrypto-backend.onrender.com/api';
    const AUTH_TOKEN_KEY = window.APP_KEYS?.AUTH_TOKEN_KEY || 'cryptohub_auth_token';
    const TRANSACTIONS_CACHE_KEY = 'rapidcrypto_transactions_cache_v2';

    // State
    let allTransactions = [];
    let currentFilter = 'all';
    let currentSearch = '';

    // Get auth token
    const authToken = localStorage.getItem(AUTH_TOKEN_KEY);
    if (!authToken) {
        console.warn("No auth token found, redirecting to login");
        window.location.href = `login.html?redirect=${encodeURIComponent(window.location.pathname)}`;
        return;
    }

    // Helper Functions
    const formatDate = (dateString) => {
        const date = new Date(dateString);
        return date.toLocaleString([], { 
            year: 'numeric', 
            month: 'short', 
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const getTransactionDetails = (tx) => {
        let typeDisplay = '';
        let assetDisplay = '';
        let statusClass = '';
        
        // Match these to your backend's TransactionSchema types
        switch (tx.type) {
            case 'deposit_main_balance':
                typeDisplay = 'Deposit';
                assetDisplay = tx.meta?.source || 'Main Balance';
                statusClass = 'completed';
                break;
                
            case 'withdrawal_main_balance':
                typeDisplay = 'Withdrawal';
                assetDisplay = tx.meta?.destination || 'Main Balance';
                statusClass = 'completed';
                break;
                
            case 'plan_investment':
                typeDisplay = 'Investment';
                assetDisplay = tx.meta?.planName || 'Investment Plan';
                statusClass = tx.status || 'active';
                break;
                
            case 'plan_withdrawal_return':
                typeDisplay = 'Investment Payout';
                assetDisplay = tx.meta?.planName || 'Investment Plan';
                statusClass = 'completed';
                break;
                
            case 'interest_accrued_to_plan_value':
                typeDisplay = 'Interest Earned';
                assetDisplay = tx.meta?.planName || 'Investment Plan';
                statusClass = 'completed';
                break;
                
            case 'admin_credit':
                typeDisplay = 'Admin Credit';
                assetDisplay = tx.currency || 'System';
                statusClass = 'completed';
                break;
                
            case 'admin_debit':
                typeDisplay = 'Admin Debit';
                assetDisplay = tx.currency || 'System';
                statusClass = 'completed';
                break;
                
            case 'fee':
                typeDisplay = 'Fee';
                assetDisplay = tx.description || 'Service';
                statusClass = 'completed';
                break;
                
            default:
                typeDisplay = tx.type.replace(/_/g, ' ');
                assetDisplay = tx.currency || 'N/A';
                statusClass = tx.status || 'completed';
        }

        return { typeDisplay, assetDisplay, statusClass };
    };

    const renderTransactions = (transactions) => {
        if (!transactionTableBody) return;

        transactionTableBody.innerHTML = '';

        if (!transactions || transactions.length === 0) {
            const row = transactionTableBody.insertRow();
            const cell = row.insertCell();
            cell.colSpan = 5;
            cell.textContent = 'No transactions found';
            cell.style.textAlign = 'center';
            cell.style.padding = '20px';
            return;
        }

        transactions.forEach(tx => {
            const { typeDisplay, assetDisplay, statusClass } = getTransactionDetails(tx);
            const amount = parseFloat(tx.amount);
            const isNegative = amount < 0;
            const absAmount = Math.abs(amount);
            
            const row = transactionTableBody.insertRow();
            
            // Date
            const dateCell = row.insertCell();
            dateCell.textContent = formatDate(tx.timestamp || tx.createdAt);
            
            // Type
            const typeCell = row.insertCell();
            typeCell.textContent = typeDisplay;
            
            // Asset
            const assetCell = row.insertCell();
            assetCell.textContent = assetDisplay;
            
            // Amount
            const amountCell = row.insertCell();
            amountCell.textContent = `${isNegative ? '-' : '+'}${absAmount.toFixed(2)} ${tx.currency || 'USD'}`;
            amountCell.style.color = isNegative ? '#f44336' : '#4CAF50';
            amountCell.style.fontWeight = '500';
            
            // Status
            const statusCell = row.insertCell();
            const statusBadge = document.createElement('span');
            statusBadge.className = `status-badge status-${statusClass}`;
            statusBadge.textContent = tx.status || 'completed';
            statusCell.appendChild(statusBadge);
        });
    };

    const filterTransactions = () => {
        let filtered = [...allTransactions];
        
        // Apply type filter
        if (currentFilter !== 'all') {
            filtered = filtered.filter(tx => {
                switch (currentFilter) {
                    case 'investment':
                        return tx.type.includes('plan_') || 
                               tx.type.includes('investment');
                    case 'sent':
                        return ['withdrawal_main_balance', 'plan_investment', 'fee', 'admin_debit']
                            .includes(tx.type) || tx.amount < 0;
                    case 'received':
                        return ['deposit_main_balance', 'plan_withdrawal_return', 
                                'interest_accrued_to_plan_value', 'admin_credit']
                            .includes(tx.type) || tx.amount > 0;
                    case 'buy':
                        return tx.type === 'deposit_main_balance';
                    case 'sell':
                        return tx.type === 'withdrawal_main_balance';
                    default:
                        return true;
                }
            });
        }
        
        // Apply search
        if (currentSearch) {
            const searchTerm = currentSearch.toLowerCase();
            filtered = filtered.filter(tx => {
                const { typeDisplay, assetDisplay } = getTransactionDetails(tx);
                return (
                    typeDisplay.toLowerCase().includes(searchTerm) ||
                    assetDisplay.toLowerCase().includes(searchTerm) ||
                    tx.amount.toString().includes(searchTerm) ||
                    tx.currency?.toLowerCase().includes(searchTerm) ||
                    tx.description?.toLowerCase().includes(searchTerm) ||
                    formatDate(tx.timestamp || tx.createdAt).toLowerCase().includes(searchTerm)
                );
            });
        }
        
        renderTransactions(filtered);
    };

    const loadTransactions = async () => {
        try {
            const response = await fetch(`${API_BASE_URL}/transactions`, {
                headers: {
                    'Authorization': `Bearer ${authToken}`,
                    'Content-Type': 'application/json'
                }
            });

            if (response.status === 401) {
                // Token expired or invalid
                localStorage.removeItem(AUTH_TOKEN_KEY);
                window.location.href = 'login.html';
                return;
            }

            const data = await response.json();
            
            if (!response.ok) {
                throw new Error(data.message || 'Failed to fetch transactions');
            }

            if (data.success && Array.isArray(data.transactions)) {
                allTransactions = data.transactions;
                localStorage.setItem(TRANSACTIONS_CACHE_KEY, JSON.stringify(allTransactions));
                filterTransactions();
            } else {
                throw new Error('Invalid response format from server');
            }
        } catch (error) {
            console.error("Error loading transactions:", error);
            // Fallback to cached data
            const cached = localStorage.getItem(TRANSACTIONS_CACHE_KEY);
            if (cached) {
                allTransactions = JSON.parse(cached);
                filterTransactions();
            }
            alert(`Error loading transactions: ${error.message}`);
        }
    };

    // Event Listeners
    if (transactionFilter) {
        transactionFilter.addEventListener('change', (e) => {
            currentFilter = e.target.value;
            filterTransactions();
        });
    }

    if (transactionSearch) {
        transactionSearch.addEventListener('input', (e) => {
            currentSearch = e.target.value.trim().toLowerCase();
            filterTransactions();
        });
    }

    filterButtons.forEach(button => {
        button.addEventListener('click', () => {
            currentFilter = button.dataset.type;
            filterButtons.forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');
            filterTransactions();
        });
    });

    if (logoutButton) {
        logoutButton.addEventListener('click', () => {
            localStorage.removeItem(AUTH_TOKEN_KEY);
            localStorage.removeItem(TRANSACTIONS_CACHE_KEY);
            window.location.href = 'login.html';
        });
    }

    // Initial Load
    await loadTransactions();
});