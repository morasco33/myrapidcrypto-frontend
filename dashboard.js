// --- START OF SIMPLIFIED dashboard.js ---
document.addEventListener('DOMContentLoaded', () => {
  console.log("DASHBOARD.JS: DOMContentLoaded");

  // Constants for localStorage keys - ensure these match auth.js and login.js
  const USER_INFO_KEY_FOR_DASH = 'cryptohub_user_info'; 
  const AUTH_TOKEN_KEY_FOR_DASH = 'cryptohub_auth_token'; 

  // Retrieve auth token and user info
  const authToken = localStorage.getItem(AUTH_TOKEN_KEY_FOR_DASH);
  const userInfoString = localStorage.getItem(USER_INFO_KEY_FOR_DASH);

  // At this point, the inline script in dashboard.html's <head> AND auth.js's finalizePageSetupBasedOnAuth
  // should have already ensured that if these are missing, the user would have been redirected.
  // If we reach here, we assume the token and user info SHOULD exist.
  // A failure here indicates a deeper problem or an unexpected state.

  if (!authToken || !userInfoString) {
    console.error("DASHBOARD.JS: CRITICAL - Auth token or user info missing DESPITE earlier checks. This shouldn't happen. Halting dashboard script.");
    // Display an error message to the user on the dashboard itself, as redirecting again might perpetuate a loop if the root cause isn't fixed.
    const mainContent = document.querySelector('main');
    if (mainContent) {
        mainContent.innerHTML = `<h1>Authentication Error</h1><p>Could not load dashboard. Your session may be invalid. Please try <a href="login.html?action=relogin">logging in again</a>.</p>`;
    }
    // Remove the loading spinner if it's still there, as we are stopping.
    const loadingSpinnerOverlay = document.querySelector('.loading-spinner-overlay');
    if (loadingSpinnerOverlay) loadingSpinnerOverlay.style.display = 'none';
    document.body.classList.remove('auth-loading');
    document.documentElement.style.visibility = 'visible'; // Ensure page is visible to show error
    document.documentElement.style.opacity = '1';
    return; // Stop further execution of dashboard.js
  }

  let user;
  try {
    user = JSON.parse(userInfoString);
  } catch (e) {
    console.error("DASHBOARD.JS: CRITICAL - Failed to parse user info from localStorage.", e);
    // Similar error display as above
    const mainContent = document.querySelector('main');
    if (mainContent) mainContent.innerHTML = `<h1>Data Error</h1><p>Could not load user data. Please try <a href="login.html?action=relogin">logging in again</a>.</p>`;
    const loadingSpinnerOverlay = document.querySelector('.loading-spinner-overlay');
    if (loadingSpinnerOverlay) loadingSpinnerOverlay.style.display = 'none';
    document.body.classList.remove('auth-loading');
    document.documentElement.style.visibility = 'visible';
    document.documentElement.style.opacity = '1';
    return;
  }

  // Ensure user object has an identifier (e.g., _id from your backend)
  if (!user || !user._id) { 
    console.error("DASHBOARD.JS: CRITICAL - User info object is invalid or missing essential ID.", user);
    const mainContent = document.querySelector('main');
    if (mainContent) mainContent.innerHTML = `<h1>User Data Error</h1><p>User information is incomplete. Please try <a href="login.html?action=relogin">logging in again</a>.</p>`;
    const loadingSpinnerOverlay = document.querySelector('.loading-spinner-overlay');
    if (loadingSpinnerOverlay) loadingSpinnerOverlay.style.display = 'none';
    document.body.classList.remove('auth-loading');
    document.documentElement.style.visibility = 'visible';
    document.documentElement.style.opacity = '1';
    return;
  }
  
  // If all checks pass, proceed with dashboard setup
  console.log("DASHBOARD.JS: User confirmed and data parsed. User:", user.username || user.email);
  const userNameEl = document.getElementById('userName');
  if (userNameEl) {
    userNameEl.textContent = user.username || user.email || 'User';
  } else {
    console.warn("DASHBOARD.JS: userName element not found.");
  }

  const DASH_API_BASE_URL = window.API_BASE_URL || 'https://rapidcrypto-backend.onrender.com/api';

  // --- Modal Functions ---
  // ... (Keep your modal functions: showModal, hideModal, and their event listeners)
  const modal = document.getElementById('appModal');
  const modalTitle = document.getElementById('modalTitle');
  const modalBody = document.getElementById('modalBody');
  const modalCloseBtn = document.getElementById('modalCloseBtn');
  
  function showModal(title, bodyContent = '', footerContent = '') {
      if (!modal || !modalTitle || !modalBody) {
          console.error("Modal elements not found for showModal");
          return;
      }
      modalTitle.textContent = title;
      if (typeof bodyContent === 'string') {
          modalBody.innerHTML = bodyContent;
      } else if (bodyContent instanceof HTMLElement) {
          modalBody.innerHTML = ''; 
          modalBody.appendChild(bodyContent);
      }
      modal.style.display = 'flex';
  }
  function hideModal() {
      if (modal) modal.style.display = 'none';
  }
  if (modalCloseBtn) modalCloseBtn.addEventListener('click', hideModal);
  if (modal) {
    modal.addEventListener('click', (event) => {
        if (event.target === modal) { hideModal(); }
    });
  }

  // --- Event Listeners for Quick Actions ---
  // ... (Keep your quick action button listeners)
  const mainDepositButton = document.getElementById('mainDepositBtn');
  if (mainDepositButton) {
    mainDepositButton.addEventListener('click', () => {
      console.log('DASHBOARD.JS: Main Deposit Button Clicked');
      showModal('Deposit Funds', '<p>Deposit functionality coming soon. Please use plan investments for now.</p>');
    });
  } else {
    console.warn('DASHBOARD.JS: Main Deposit Button (mainDepositBtn) not found');
  }

  const mainWithdrawButton = document.getElementById('mainWithdrawBtn');
  if (mainWithdrawButton) {
    mainWithdrawButton.addEventListener('click', () => {
      console.log('DASHBOARD.JS: Main Withdraw Button Clicked');
      showModal('Withdraw Funds', '<p>Withdrawal functionality for main balance coming soon. Withdraw from matured plans.</p>');
    });
  } else {
    console.warn('DASHBOARD.JS: Main Withdraw Button (mainWithdrawBtn) not found');
  }
  
  // --- Balance and Asset Rendering ---
  // ... (Keep your renderAssets function and its call, but consider fetching REAL balance from backend)
  // For now, using mock:
  const balances = JSON.parse(localStorage.getItem('cryptohub_balances_mock') || '{}');
  if (!balances[user._id]) { 
    balances[user._id] = { USD: 10000, BTC: 0, ETH: 0, USDT: 0 };
    localStorage.setItem('cryptohub_balances_mock', JSON.stringify(balances));
  }
  function renderAssets() { 
    const container = document.getElementById('assetsList');
    if (!container) return;
    const userBalances = balances[user._id] || { USD: 0 }; 
    let totalUSD = 0;
    container.innerHTML = '';

    Object.entries(userBalances).forEach(([currency, amount]) => {
      const el = document.createElement('div');
      el.className = 'asset-item';
      const numericAmount = parseFloat(amount);
      el.innerHTML = `<strong>${currency}:</strong> $${isNaN(numericAmount) ? '0.00' : numericAmount.toFixed(2)}`;
      container.appendChild(el);
      if (!isNaN(numericAmount)) totalUSD += numericAmount;
    });
    
    const balanceEl = document.querySelector('#availableBalance'); // Ensure this ID exists
    const portfolioValueEl = document.getElementById('portfolioValue');

    if (balanceEl) balanceEl.textContent = `$${totalUSD.toFixed(2)}`;
    if (portfolioValueEl) portfolioValueEl.textContent = `$${totalUSD.toFixed(2)}`;
  }
  renderAssets();

  // --- Investment Plan Data Fetch ---
  // ... (Keep your fetchInvestmentPlans function and its call)
  async function fetchInvestmentPlans() { 
    try {
        const response = await fetch(`${DASH_API_BASE_URL}/investment-plans`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        if (!response.ok) throw new Error(`Failed to fetch plans: ${response.statusText} (${response.status})`);
        const data = await response.json();
        if (data.success && data.plans) {
            console.log("DASHBOARD.JS: Fetched investment plans:", data.plans);
        } else {
          console.error("DASHBOARD.JS: Failed to parse investment plans:", data.message || "Unknown error");
        }
    } catch (error) {
        console.error("DASHBOARD.JS: Error fetching investment plans:", error);
    }
  }
  fetchInvestmentPlans();

  // --- Active Investments Fetch ---
  // ... (Keep your loadActiveInvestments function and its call)
  async function loadActiveInvestments() { 
    const investmentDetailsContainers = document.querySelectorAll('.investment-details-container');
    investmentDetailsContainers.forEach(c => c.innerHTML = '<p>Loading active investments for this plan...</p>');
    
    try {
        const response = await fetch(`${DASH_API_BASE_URL}/investments`, {
            method: 'GET',
            headers: { 'Authorization': `Bearer ${authToken}`, 'Content-Type': 'application/json' }
        });
        if (!response.ok) {
            let errorMsg = `Failed to fetch investments: ${response.statusText} (${response.status})`;
            try { const errData = await response.json(); errorMsg = errData.message || errorMsg; } catch (_) {}
            throw new Error(errorMsg);
        }
        const data = await response.json();

        if (data.success && Array.isArray(data.investments)) {
            console.log("DASHBOARD.JS: Active investments:", data.investments);
            investmentDetailsContainers.forEach(c => c.innerHTML = ''); 

            data.investments.forEach(inv => {
                const planCard = document.querySelector(`.investment-options[data-plan-id="${inv.planId}"]`);
                if (planCard) {
                    const container = planCard.querySelector('.investment-details-container');
                    if (container) {
                        const el = document.createElement('div');
                        el.className = 'investment-details';
                        el.innerHTML = `
                            <p><strong>Active: ${inv.planName}</strong></p>
                            <p>Invested: $${inv.initialAmount.toFixed(2)} | Current Value: $${inv.currentValue.toFixed(2)}</p>
                            <p>Status: ${inv.status} | Matures: ${new Date(inv.maturityDate).toLocaleDateString()}</p>
                            ${(inv.status === 'active' || inv.status === 'matured') && new Date() >= new Date(inv.withdrawalUnlockTime) ? // Check unlock time
                                `<button class="withdraw-btn-plan" data-investment-id="${inv._id}">Withdraw</button>` : 
                                (inv.status === 'active' || inv.status === 'matured' ? `<small>Locked until ${new Date(inv.withdrawalUnlockTime).toLocaleDateString()}</small>` : '')}
                        `;
                        container.appendChild(el);
                    }
                }
            });
            document.querySelectorAll('.withdraw-btn-plan').forEach(btn => {
                btn.addEventListener('click', handlePlanWithdrawClick);
            });
        } else {
            investmentDetailsContainers.forEach(c => c.innerHTML = `<p>${data.message || 'No active investments or failed to load.'}</p>`);
        }
    } catch (err) {
        console.error('DASHBOARD.JS: Failed to load active investments:', err);
        investmentDetailsContainers.forEach(c => c.innerHTML = `<p style="color:red;">Error loading investments: ${err.message}</p>`);
    }
  }
  loadActiveInvestments();

  // --- Handle Investment Button Clicks ---
  // ... (Keep your investment button click handler)
  document.querySelectorAll('.invest-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const planId = btn.dataset.plan; 
      const minAmount = parseFloat(btn.dataset.min);
      const maxAmount = parseFloat(btn.dataset.max);
      
      console.log(`DASHBOARD.JS: Invest button clicked for plan: ${planId}`);
      const amountString = prompt(`Enter amount to invest in ${planId} plan ($${minAmount} - $${maxAmount}):`);
      if (!amountString) { console.log("DASHBOARD.JS: Investment cancelled by user."); return; }

      const investAmount = parseFloat(amountString);

      if (isNaN(investAmount) || investAmount < minAmount || investAmount > maxAmount) {
        alert(`Please enter a valid amount between $${minAmount} and $${maxAmount}.`);
        return;
      }
      
      console.log(`DASHBOARD.JS: Attempting to invest $${investAmount} in plan ${planId}`);
      try {
        showModal('Processing Investment...', 'Please wait while we set up your investment plan.');
        const response = await fetch(`${DASH_API_BASE_URL}/investments`, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${authToken}`
           },
          body: JSON.stringify({
            planId: planId, 
            amount: investAmount
          })
        });
        
        const data = await response.json(); // Always try to parse
        hideModal(); 

        if (!response.ok) { // Check response.ok for HTTP errors (4xx, 5xx)
            console.error("DASHBOARD.JS: Investment API call HTTP error.", {status: response.status, responseData: data});
            throw new Error(data.message || `Investment request failed with status ${response.status}.`);
        }
        if (!data.success) { // Check the success flag in the JSON payload
             console.error("DASHBOARD.JS: Investment API call returned success:false.", {responseData: data});
            throw new Error(data.message || "Investment processing failed on server.");
        }
        
        alert(data.message || 'Investment successful!');
        if(data.newBalance !== undefined) {
            // Here you would update the displayed balance, e.g., by re-fetching user profile or updating mock balance
            console.log("New balance from server:", data.newBalance);
            // Example for mock balance:
            // balances[user._id].USD = data.newBalance;
            // localStorage.setItem('cryptohub_balances_mock', JSON.stringify(balances));
            // renderAssets();
        }
        loadActiveInvestments(); 
      } catch(error) {
        hideModal(); 
        alert(`Investment Error: ${error.message}`);
        console.error("DASHBOARD.JS: Catch block for investment error:", error);
        if (error.message && error.message.toLowerCase().includes("unexpected server error")) {
            alert("An unexpected error occurred on the server. Please check server logs or contact support.");
        }
      }
    });
  });

  // --- Handle Plan Withdrawal Click ---
  // ... (Keep your withdrawal click handler)
  async function handlePlanWithdrawClick(event) { 
    const investmentId = event.target.dataset.investmentId;
    console.log(`DASHBOARD.JS: Withdraw button clicked for investment ID: ${investmentId}`);
    const withdrawalPin = prompt("Enter your 5-digit withdrawal PIN:");

    if (!withdrawalPin || !/^\d{5}$/.test(withdrawalPin)) {
        alert("Invalid PIN format. Please enter a 5-digit PIN.");
        return;
    }

    showModal('Processing Withdrawal...', 'Please wait...');
    try {
        const response = await fetch(`${DASH_API_BASE_URL}/investments/${investmentId}/withdraw`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({ withdrawalPin })
        });
        const data = await response.json(); // Always parse
        hideModal();

        if (!response.ok) {
             console.error("DASHBOARD.JS: Withdrawal API call HTTP error.", {status: response.status, responseData: data});
            throw new Error(data.message || `Withdrawal request failed with status ${response.status}.`);
        }
        if(!data.success) {
            console.error("DASHBOARD.JS: Withdrawal API call returned success:false.", {responseData: data});
            throw new Error(data.message || "Withdrawal processing failed on server.");
        }

        alert(data.message || "Withdrawal successful!");
        if(data.newBalance !== undefined) {
             console.log("New balance from server after withdrawal:", data.newBalance);
            // Update displayed balance
        }
        loadActiveInvestments(); 
    } catch (error) {
        hideModal();
        alert(`Withdrawal Error: ${error.message}`);
        console.error("DASHBOARD.JS: Catch block for withdrawal error:", error);
    }
  }
  
  // --- Chart.js Examples ---
  // ... (Keep your Chart.js setup)
  const portfolioCtx = document.getElementById('portfolioChart')?.getContext('2d');
  if (portfolioCtx) { new Chart(portfolioCtx, { type: 'line', data: { labels: ['Jan', 'Feb', 'Mar', 'Apr'], datasets: [{ label: 'Portfolio Value', data: [65, 59, 80, 81], tension: 0.1 }] }, options: { responsive: true, maintainAspectRatio: false } }); }
  const marketTrendsCtx = document.getElementById('marketTrendsChart')?.getContext('2d');
  if (marketTrendsCtx) { new Chart(marketTrendsCtx, { type: 'bar', data: { labels: ['BTC', 'ETH', 'SOL', 'DOGE'], datasets: [{ label: 'Price Change (24h %)', data: [2.5, -1.2, 5.0, 0.5], backgroundColor:['green','red','green','green'] }] }, options: { responsive: true, maintainAspectRatio: false } });}

});
// --- END OF SIMPLIFIED dashboard.js ---