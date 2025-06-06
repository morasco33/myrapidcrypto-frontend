// withdraw.js - Full withdrawal page logic

document.addEventListener('DOMContentLoaded', () => {
    console.log("DEBUG [withdraw.js]: DOMContentLoaded event fired.");

    // --- Configuration Keys (prioritize APP_KEYS if available) ---
    let API_BASE_URL = 'http://localhost:3000/api';
    let AUTH_TOKEN_KEY = 'cryptohub_auth_token';
    let USER_INFO_KEY = 'cryptohub_user_info';

    if (window.APP_KEYS && typeof window.APP_KEYS === 'object') {
        console.log("DEBUG [withdraw.js]: window.APP_KEYS found:", JSON.parse(JSON.stringify(window.APP_KEYS)));
        API_BASE_URL = window.APP_KEYS.API_BASE_URL || API_BASE_URL;
        AUTH_TOKEN_KEY = window.APP_KEYS.AUTH_TOKEN_KEY || AUTH_TOKEN_KEY;
        USER_INFO_KEY = window.APP_KEYS.USER_INFO_KEY || USER_INFO_KEY;
    } else {
        console.warn("WARN [withdraw.js]: window.APP_KEYS not found. Using default keys and API endpoint.");
    }
    console.log(`DEBUG [withdraw.js]: Effective API_BASE_URL: ${API_BASE_URL}`);
    console.log(`DEBUG [withdraw.js]: Effective AUTH_TOKEN_KEY: ${AUTH_TOKEN_KEY}`);
    console.log(`DEBUG [withdraw.js]: Effective USER_INFO_KEY: ${USER_INFO_KEY}`);

  
    // --- DOM Elements ---
    const withdrawMethodSelect = document.getElementById('withdrawMethod');
    const cryptoFields = document.getElementById('cryptoFields');
    const bankFields = document.getElementById('bankFields');
    const paypalFields = document.getElementById('paypalFields');
    const cryptoAssetSelect = document.getElementById('cryptoAsset');
    const withdrawAddressInput = document.getElementById('withdrawAddress');
    const cryptoNetworkSelect = document.getElementById('cryptoNetwork');
    const bankNameInput = document.getElementById('bankName');
    const accountNumberInput = document.getElementById('accountNumber');
    const routingNumberInput = document.getElementById('routingNumber');
    const paypalEmailInput = document.getElementById('paypalEmail');
    const withdrawAmountInput = document.getElementById('withdrawAmount');
    const amountCurrencySpan = document.getElementById('amountCurrency');
    const availableBalanceSpan = document.getElementById('availableBalanceDisplay');
    const networkFeeSpan = document.getElementById('networkFee');
    const receiveAmountSpan = document.getElementById('receiveAmount');
    const maxAmountBtn = document.getElementById('maxAmountBtn');
    const submitWithdrawalBtn = document.getElementById('submitWithdrawalBtn');
    const confirmationModal = document.getElementById('confirmationModal');
    const confirmationDetailsDiv = document.getElementById('confirmationDetails');
    const cancelWithdrawalBtn = document.getElementById('cancelWithdrawalBtn');
    const confirmWithdrawalBtn = document.getElementById('confirmWithdrawalBtn');
    const pageMessageDiv = document.getElementById('pageMessage'); // For general page messages
    const loadingOverlay = document.getElementById('loadingOverlay'); // For initial data load


    // --- Check for essential elements ---
    if (!withdrawMethodSelect || !submitWithdrawalBtn || !confirmationModal) {
        console.error("CRITICAL [withdraw.js]: Essential page elements are missing. Functionality will be impaired.");
        displayPageMessage("Page error: Core components missing. Please contact support.", "error");
        if(submitWithdrawalBtn) submitWithdrawalBtn.disabled = true;
        return;
    }
  
    // --- State ---
    let userAssetsAndFees = {};  // {symbol: {balance, withdrawalFee, feeRate, minWithdrawal, etc.}}
    let currentMethod = 'crypto'; // Default
  
    // --- Helper functions ---
    function getAuthToken() {
      return localStorage.getItem(AUTH_TOKEN_KEY);
    }
  
    // function getUserInfo() { /* Not directly used if server infers user from token */ }
  
    function displayPageMessage(msg, type = 'info') { // type can be 'info', 'success', 'error', 'warning'
        if (pageMessageDiv) {
            pageMessageDiv.textContent = msg;
            pageMessageDiv.className = `form-message ${type}`; // Assumes CSS classes
            pageMessageDiv.style.display = 'block';
            // Auto-hide after some time, except for errors
            if (type !== 'error') {
                setTimeout(() => {
                    if(pageMessageDiv.textContent === msg) pageMessageDiv.style.display = 'none';
                }, 5000);
            }
        } else {
            alert(msg); // Fallback
        }
    }
  
    function formatAmount(amount, currency = 'USD', precision = (currency === 'USD' ? 2 : 8)) {
      if (typeof amount !== 'number' || isNaN(amount)) return `0.${'0'.repeat(precision)}`;
      if (currency === 'USD') {
        return `$${amount.toFixed(precision)}`;
      }
      return `${amount.toFixed(precision)} ${currency.toUpperCase()}`;
    }

    function showLoading(show = true) {
        if (loadingOverlay) {
            loadingOverlay.style.display = show ? 'flex' : 'none';
        }
    }
  
    // --- Load user assets/balances/fees from API ---
    async function loadUserFinancialData() {
      showLoading(true);
      const token = getAuthToken();
      if (!token) {
        console.warn("WARN [withdraw.js]: No auth token, redirecting to login.");
        window.location.href = `login.html?reason=auth_required&redirectedFrom=${encodeURIComponent(window.location.pathname + window.location.search)}`;
        return;
      }
  
      try {
        // This endpoint should ideally return balances and withdrawal fee information
        const profileEndpoint = `${API_BASE_URL}/profile/financial-details`; // Or separate /wallet/balances-and-fees
        console.log(`DEBUG [withdraw.js]: Fetching user financial data from ${profileEndpoint}`);
        const res = await fetch(profileEndpoint, {
          headers: { Authorization: `Bearer ${token}` }
        });

        if (res.status === 401) {
             console.warn("WARN [withdraw.js]: Unauthorized (401) fetching financial data. Redirecting.");
             window.location.href = `login.html?reason=auth_required&redirectedFrom=${encodeURIComponent(window.location.pathname + window.location.search)}`;
             return;
        }
        if (!res.ok) {
            const errorData = await res.json().catch(() => ({ message: `Server error ${res.status}`}));
            throw new Error(errorData.message || 'Failed to load user financial data');
        }

        const data = await res.json();
        if (!data.success || !data.user) throw new Error(data.message || 'Invalid user data received');
  
        userAssetsAndFees = {}; // Reset
        // USD Balance (Main Balance)
        userAssetsAndFees['USD'] = { 
            balance: data.user.balance || 0, 
            // Fees for USD withdrawal methods should come from server
            withdrawalFeeBank: data.user.fees?.bankWithdrawalFixed || 25.00, // Example
            withdrawalFeeRatePaypal: data.user.fees?.paypalWithdrawalRate || 0.02, // Example
            minWithdrawalUSD: data.user.limits?.minUsdWithdrawal || 50.00 // Example
        };
  
        // Crypto Assets
        if (Array.isArray(data.user.assets)) {
          data.user.assets.forEach(asset => {
            userAssetsAndFees[asset.symbol.toUpperCase()] = {
              balance: asset.amount || 0,
              // Withdrawal fee for crypto should also come from server per asset
              withdrawalFee: asset.withdrawalFee || 0.0005, // Example: 0.0005 BTC
              minWithdrawal: asset.minWithdrawal || 0.001 // Example: 0.001 BTC
            };
          });
        }
        console.log("DEBUG [withdraw.js]: User financial data loaded:", userAssetsAndFees);
      } catch (err) {
        console.error("ERROR [withdraw.js]: Loading user data -", err);
        displayPageMessage('Error loading your financial data: ' + err.message, "error");
        // Potentially disable withdrawal form if data load fails critically
        if(submitWithdrawalBtn) submitWithdrawalBtn.disabled = true;
      } finally {
        showLoading(false);
      }
    }
  
    // --- Update UI when method changes ---
    function updateUIByMethod() {
      currentMethod = withdrawMethodSelect.value;
      console.log(`DEBUG [withdraw.js]: Withdrawal method changed to ${currentMethod}`);
  
      cryptoFields.style.display = currentMethod === 'crypto' ? 'block' : 'none';
      bankFields.style.display = currentMethod === 'bank' ? 'block' : 'none';
      paypalFields.style.display = currentMethod === 'paypal' ? 'block' : 'none';
  
      let currentAssetSymbol = 'USD';
      let currentBalance = 0;

      if (currentMethod === 'crypto') {
        populateCryptoAssets(); // Ensure dropdown is populated
        currentAssetSymbol = cryptoAssetSelect.value || Object.keys(userAssetsAndFees).find(s => s !== 'USD'); // Default to first crypto
        if(cryptoAssetSelect.value !== currentAssetSymbol && currentAssetSymbol) cryptoAssetSelect.value = currentAssetSymbol; // Sync dropdown
      }
      
      currentBalance = userAssetsAndFees[currentAssetSymbol]?.balance || 0;
      amountCurrencySpan.textContent = currentAssetSymbol.toUpperCase();
      availableBalanceSpan.textContent = formatAmount(currentBalance, currentAssetSymbol);
      
      if(withdrawAmountInput) withdrawAmountInput.value = '';
      if(networkFeeSpan) networkFeeSpan.textContent = formatAmount(0, currentAssetSymbol, currentMethod === 'crypto' ? 8 : 2);
      if(receiveAmountSpan) receiveAmountSpan.textContent = formatAmount(0, currentAssetSymbol, currentMethod === 'crypto' ? 8 : 2);
      if(submitWithdrawalBtn) submitWithdrawalBtn.disabled = true;

      updateFeeAndReceive(); // Recalculate with new method
    }
  
    // --- Populate crypto asset dropdown ---
    function populateCryptoAssets() {
      if (!cryptoAssetSelect) return;
      const previousSelection = cryptoAssetSelect.value;
      cryptoAssetSelect.innerHTML = '';
      const cryptoSymbols = Object.keys(userAssetsAndFees).filter(s => s !== 'USD' && userAssetsAndFees[s].balance > 0); // Only show assets with balance

      if (cryptoSymbols.length === 0) {
          const option = document.createElement('option');
          option.value = "";
          option.textContent = "No crypto assets available for withdrawal";
          option.disabled = true;
          cryptoAssetSelect.appendChild(option);
          if(submitWithdrawalBtn) submitWithdrawalBtn.disabled = true;
          return;
      }

      cryptoSymbols.forEach(symbol => {
        const option = document.createElement('option');
        option.value = symbol.toUpperCase();
        option.textContent = symbol.toUpperCase();
        cryptoAssetSelect.appendChild(option);
      });
      // Restore previous selection if still valid, or select first
      if (previousSelection && cryptoSymbols.includes(previousSelection.toUpperCase())) {
        cryptoAssetSelect.value = previousSelection;
      } else if (cryptoSymbols.length > 0) {
        cryptoAssetSelect.value = cryptoSymbols[0].toUpperCase();
      }
    }
  
    // --- Calculate fees and update UI ---
    function updateFeeAndReceive() {
        const amountStr = withdrawAmountInput ? withdrawAmountInput.value : '0';
        const amount = parseFloat(amountStr);

        if (!amount || amount <= 0) {
            if(networkFeeSpan) networkFeeSpan.textContent = formatAmount(0, amountCurrencySpan.textContent, currentMethod === 'crypto' ? 8 : 2);
            if(receiveAmountSpan) receiveAmountSpan.textContent = formatAmount(0, amountCurrencySpan.textContent, currentMethod === 'crypto' ? 8 : 2);
            if(submitWithdrawalBtn) submitWithdrawalBtn.disabled = true;
            return;
        }

        let fee = 0;
        let balance = 0;
        let minWithdrawal = 0;
        let displayCurrency = 'USD';
        let displayPrecision = 2;

        if (currentMethod === 'crypto') {
            const symbol = cryptoAssetSelect.value.toUpperCase();
            displayCurrency = symbol;
            displayPrecision = 8;
            fee = userAssetsAndFees[symbol]?.withdrawalFee || 0;
            balance = userAssetsAndFees[symbol]?.balance || 0;
            minWithdrawal = userAssetsAndFees[symbol]?.minWithdrawal || 0;
        } else { // Bank or PayPal (USD)
            displayCurrency = 'USD';
            displayPrecision = 2;
            balance = userAssetsAndFees['USD']?.balance || 0;
            minWithdrawal = userAssetsAndFees['USD']?.minWithdrawalUSD || 0;
            if (currentMethod === 'bank') {
                fee = userAssetsAndFees['USD']?.withdrawalFeeBank || 0;
            } else if (currentMethod === 'paypal') {
                const feeRate = userAssetsAndFees['USD']?.withdrawalFeeRatePaypal || 0;
                fee = amount * feeRate;
            }
        }

        if(networkFeeSpan) networkFeeSpan.textContent = formatAmount(fee, displayCurrency, displayPrecision);

        if (amount < minWithdrawal) {
            if(receiveAmountSpan) receiveAmountSpan.textContent = `Min: ${formatAmount(minWithdrawal, displayCurrency, displayPrecision)}`;
            if(submitWithdrawalBtn) submitWithdrawalBtn.disabled = true;
        } else if (amount + fee > balance) {
            if(receiveAmountSpan) receiveAmountSpan.textContent = 'Insufficient balance';
            if(submitWithdrawalBtn) submitWithdrawalBtn.disabled = true;
        } else {
            if(receiveAmountSpan) receiveAmountSpan.textContent = formatAmount(amount - (currentMethod === 'crypto' ? fee : 0), displayCurrency, displayPrecision); // For crypto, fee is deducted from amount. For USD, amount is what user gets, fee is separate. This might need clarification based on UX. Assuming amount is *before* USD fees.
            // If amount for USD methods is what user *wants to receive*, then calculation is different.
            // For this example, 'amount' is what user requests to withdraw, and fee is deducted from their balance.
            // User receives 'amount' for USD, but 'amount - fee' for crypto.
            if(submitWithdrawalBtn) submitWithdrawalBtn.disabled = false;
        }
    }
  
    // --- Max amount button handler ---
    function setMaxAmount() {
        let maxWithdraw = 0;
        let fee = 0;
        let assetSymbol = 'USD';
        let precision = 2;

        if (currentMethod === 'crypto') {
            assetSymbol = cryptoAssetSelect.value.toUpperCase();
            precision = 8;
            const assetData = userAssetsAndFees[assetSymbol];
            if (assetData) {
                fee = assetData.withdrawalFee || 0;
                maxWithdraw = (assetData.balance || 0) - fee;
            }
        } else { // Bank or PayPal
            assetSymbol = 'USD';
            precision = 2;
            const usdData = userAssetsAndFees['USD'];
            if (usdData) {
                if (currentMethod === 'bank') {
                    fee = usdData.withdrawalFeeBank || 0;
                } else if (currentMethod === 'paypal' && withdrawAmountInput && parseFloat(usdData.balance)) {
                    // This is tricky for percentage fee. Set amount to max balance, then fee is calculated.
                    // Simplified: assume max is balance minus fixed part of fee, then %age.
                    // A better UX might be to show "You will receive X after Y fee".
                    // For now, just set to balance and let updateFeeAndReceive show if insufficient.
                    // Max should be what they *can* withdraw, not what they *receive*.
                    // If fee is percentage based, user enters amount, then fee is calculated.
                    // If user clicks MAX, they want to withdraw the maximum possible.
                    // So, if B is balance, A is amount, F_rate is fee rate: A + A*F_rate <= B => A(1+F_rate) <= B => A <= B/(1+F_rate)
                    const feeRate = usdData.withdrawalFeeRatePaypal || 0;
                    maxWithdraw = (usdData.balance || 0) / (1 + feeRate);

                } else { // No PayPal fee rate or balance unknown, default fee
                    fee = 0;
                }
                // If there was a fixed fee component for PayPal, it would be subtracted here.
                 if (currentMethod === 'bank') maxWithdraw = (usdData.balance || 0) - fee;
            }
        }
        if(withdrawAmountInput) withdrawAmountInput.value = maxWithdraw > 0 ? maxWithdraw.toFixed(precision) : '0';
        updateFeeAndReceive();
    }
  
    // --- Validate withdrawal inputs ---
    function validateInputs() {
      const amountStr = withdrawAmountInput ? withdrawAmountInput.value : '0';
      const amount = parseFloat(amountStr);

      if (!amount || amount <= 0) {
        displayPageMessage('Please enter a valid withdrawal amount', 'error');
        return false;
      }
      // Min withdrawal check is now part of updateFeeAndReceive visual feedback
      // but good to double check here before submission.
      let minWithdrawal = 0;
      if (currentMethod === 'crypto') {
          minWithdrawal = userAssetsAndFees[cryptoAssetSelect.value.toUpperCase()]?.minWithdrawal || 0;
          if (amount < minWithdrawal) {
              displayPageMessage(`Minimum withdrawal for ${cryptoAssetSelect.value.toUpperCase()} is ${minWithdrawal}.`, 'error');
              return false;
          }
          if (!withdrawAddressInput || !withdrawAddressInput.value.trim()) {
            displayPageMessage('Please enter the withdrawal address.', 'error');
            return false;
          }
          if (!cryptoNetworkSelect || !cryptoNetworkSelect.value) {
            displayPageMessage('Please select a network.', 'error');
            return false;
          }
      } else { // Bank or PayPal
          minWithdrawal = userAssetsAndFees['USD']?.minWithdrawalUSD || 0;
           if (amount < minWithdrawal) {
              displayPageMessage(`Minimum withdrawal for USD is ${minWithdrawal}.`, 'error');
              return false;
          }
          if (currentMethod === 'bank') {
            if (!bankNameInput || !bankNameInput.value.trim() || 
                !accountNumberInput || !accountNumberInput.value.trim() || 
                !routingNumberInput || !routingNumberInput.value.trim()) {
              displayPageMessage('Please fill in all bank details.', 'error');
              return false;
            }
          } else if (currentMethod === 'paypal') {
            if (!paypalEmailInput || !paypalEmailInput.value.trim() || !paypalEmailInput.value.includes('@')) {
              displayPageMessage('Please enter a valid PayPal email.', 'error');
              return false;
            }
          }
      }
      return true;
    }
  
    // --- Show confirmation modal ---
    function showConfirmationModal() {
      if (!confirmationDetailsDiv || !confirmationModal) return;
      let detailsHTML = `<p><strong>Withdrawal Method:</strong> ${currentMethod.charAt(0).toUpperCase() + currentMethod.slice(1)}</p>`;
      const requestedAmount = withdrawAmountInput.value;
      const feeDisplay = networkFeeSpan.textContent;
      const receiveDisplay = receiveAmountSpan.textContent; // This is already calculated
      const currencyDisplay = amountCurrencySpan.textContent;

      detailsHTML += `<p><strong>Requested Amount:</strong> ${requestedAmount} ${currencyDisplay}</p>`;
      detailsHTML += `<p><strong>Network/Processing Fee:</strong> ${feeDisplay}</p>`; // No need to add currency again if already in feeDisplay
      detailsHTML += `<p><strong>You Will Receive (approx.):</strong> ${receiveDisplay}</p>`; // Same for receiveDisplay

      if (currentMethod === 'crypto') {
        detailsHTML += `<p><strong>Crypto Asset:</strong> ${cryptoAssetSelect.value.toUpperCase()}</p>`;
        detailsHTML += `<p><strong>Network:</strong> ${cryptoNetworkSelect.value}</p>`;
        detailsHTML += `<p><strong>To Address:</strong> ${withdrawAddressInput.value}</p>`;
      } else if (currentMethod === 'bank') {
        detailsHTML += `<p><strong>Bank Name:</strong> ${bankNameInput.value}</p>`;
        detailsHTML += `<p><strong>Account Number:</strong> ${accountNumberInput.value}</p>`;
        detailsHTML += `<p><strong>Routing Number:</strong> ${routingNumberInput.value}</p>`;
      } else if (currentMethod === 'paypal') {
        detailsHTML += `<p><strong>PayPal Email:</strong> ${paypalEmailInput.value}</p>`;
      }
  
      confirmationDetailsDiv.innerHTML = detailsHTML;
      confirmationModal.style.display = 'block';
    }
  
    // --- Send withdrawal request to backend ---
    async function sendWithdrawalRequest() {
      if (!validateInputs()) { // Double check validation
        if(confirmationModal) confirmationModal.style.display = 'none';
        return;
      }
  
      const token = getAuthToken();
      // Auth check already done at page load, but good for robustness if token expires mid-session
      if (!token) {
        displayPageMessage('User not authenticated. Please log in again.', 'error');
        if(confirmationModal) confirmationModal.style.display = 'none';
        setTimeout(() => window.location.href = 'login.html', 2000);
        return;
      }
  
      // Build payload
      const amount = parseFloat(withdrawAmountInput.value);
      let payload = {
        method: currentMethod,
        amount: amount,
        currency: currentMethod === 'crypto' ? cryptoAssetSelect.value.toUpperCase() : 'USD',
      };
  
      if (currentMethod === 'crypto') {
        payload.withdrawalAddress = withdrawAddressInput.value.trim();
        payload.network = cryptoNetworkSelect.value;
      } else if (currentMethod === 'bank') {
        payload.bankDetails = { // Nest bank details
            bankName: bankNameInput.value.trim(),
            accountNumber: accountNumberInput.value.trim(),
            routingNumber: routingNumberInput.value.trim()
        };
      } else if (currentMethod === 'paypal') {
        payload.paypalEmail = paypalEmailInput.value.trim();
      }
      
      const originalConfirmBtnHtml = confirmWithdrawalBtn ? confirmWithdrawalBtn.innerHTML : 'Confirm';
      if(confirmWithdrawalBtn) {
        confirmWithdrawalBtn.disabled = true;
        confirmWithdrawalBtn.innerHTML = `<i class="fas fa-spinner fa-spin"></i> Processing...`;
      }

      const withdrawApiUrl = `${API_BASE_URL}/withdraw`;
      console.log(`DEBUG [withdraw.js]: Sending withdrawal request to ${withdrawApiUrl}`, payload);
  
      try {
        const res = await fetch(withdrawApiUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify(payload)
        });
  
        const resultData = await res.json().catch(() => ({ message: "Received non-JSON response or network issue." }));

        if (!res.ok) {
          throw new Error(resultData.message || `Withdrawal request failed with status ${res.status}`);
        }
        if (!resultData.success) { // If API returns {success: false, message: "..."}
             throw new Error(resultData.message || 'Withdrawal processing failed on server.');
        }
  
        displayPageMessage(resultData.message || 'Withdrawal request submitted successfully! It will be processed shortly.', 'success');
        if(confirmationModal) confirmationModal.style.display = 'none';
  
        // Reload user data and update UI
        await loadUserFinancialData(); // This will update balances
        updateUIByMethod(); // This will reset form and update displays based on new balances
  
      } catch (err) {
        console.error("ERROR [withdraw.js]: Sending withdrawal request -", err);
        displayPageMessage('Error: ' + err.message, 'error');
        if(confirmationModal) confirmationModal.style.display = 'none';
      } finally {
        if(confirmWithdrawalBtn) {
            confirmWithdrawalBtn.disabled = false;
            confirmWithdrawalBtn.innerHTML = originalConfirmBtnHtml;
        }
      }
    }
  
    // --- Event Listeners ---
    if(withdrawMethodSelect) withdrawMethodSelect.addEventListener('change', updateUIByMethod);
    if(cryptoAssetSelect) cryptoAssetSelect.addEventListener('change', () => {
      if (currentMethod === 'crypto') {
        const selectedSymbol = cryptoAssetSelect.value.toUpperCase();
        if(amountCurrencySpan) amountCurrencySpan.textContent = selectedSymbol;
        const assetData = userAssetsAndFees[selectedSymbol];
        if(availableBalanceSpan) availableBalanceSpan.textContent = formatAmount(assetData?.balance || 0, selectedSymbol);
        if(withdrawAmountInput) withdrawAmountInput.value = ''; // Reset amount on asset change
        updateFeeAndReceive();
      }
    });
  
    if(withdrawAmountInput) withdrawAmountInput.addEventListener('input', updateFeeAndReceive);
    if(maxAmountBtn) maxAmountBtn.addEventListener('click', setMaxAmount);
    if(submitWithdrawalBtn) submitWithdrawalBtn.addEventListener('click', () => {
      if (!validateInputs()) return;
      showConfirmationModal();
    });
  
    if(cancelWithdrawalBtn) cancelWithdrawalBtn.addEventListener('click', () => {
      if(confirmationModal) confirmationModal.style.display = 'none';
    });
  
    if(confirmWithdrawalBtn) confirmWithdrawalBtn.addEventListener('click', sendWithdrawalRequest);
  
    // --- Initialization ---
    (async () => {
      await loadUserFinancialData();
      updateUIByMethod(); // Initial UI setup based on default method and loaded data
      // Ensure submit button state is correct after initial load
      if(withdrawAmountInput && withdrawAmountInput.value) updateFeeAndReceive(); else if(submitWithdrawalBtn) submitWithdrawalBtn.disabled = true;
    })();
});
