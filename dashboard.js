// --- START OF REWRITTEN dashboard.js ---
document.addEventListener('DOMContentLoaded', () => {
  console.log("DASHBOARD.JS: DOMContentLoaded");
  const USER_INFO_KEY_FOR_DASH = 'cryptohub_user_info'; 
  const AUTH_TOKEN_KEY_FOR_DASH = 'cryptohub_auth_token'; 

  const userInfoString = localStorage.getItem(USER_INFO_KEY_FOR_DASH);
  const authToken = localStorage.getItem(AUTH_TOKEN_KEY_FOR_DASH);

  // Note: auth.js should have already handled redirection if token/user info is missing.
  // This is an additional safeguard or for direct access attempts.
  if (!authToken || !userInfoString) {
    console.warn("DASHBOARD.JS: Auth token or user info missing. auth.js should have redirected.");
    // If auth.js didn't redirect, force it here (should ideally not be needed)
    // window.location.href = 'login.html'; 
    return; 
  }

  let user;
  try {
    user = JSON.parse(userInfoString);
  } catch (e) {
    console.error("DASHBOARD.JS: Failed to parse user info. auth.js should have handled this scenario.", e);
    return;
  }

  if (!user || !user._id) { 
    console.error("DASHBOARD.JS: User info is invalid. auth.js should have handled this.", user);
    return;
  }
  
  console.log("DASHBOARD.JS: User authenticated:", user.username || user.email);
  const userNameEl = document.getElementById('userName');
  if (userNameEl) {
    userNameEl.textContent = user.username || user.email || 'User';
  } else {
    console.warn("DASHBOARD.JS: userName element not found.");
  }

  const DASH_API_BASE_URL = window.API_BASE_URL || 'https://rapidcrypto-backend.onrender.com/api';

  // --- Modal Functions ---
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
      // Handle footer similarly if needed (modalFooter element)
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

  // --- Mocked balances ---
  const balances = JSON.parse(localStorage.getItem('cryptohub_balances_mock') || '{}');
  if (!balances[user._id]) { 
    balances[user._id] = { USD: 10000, BTC: 0, ETH: 0, USDT: 0 };
    localStorage.setItem('cryptohub_balances_mock', JSON.stringify(balances));
  }
  function renderAssets() { /* ... (keep your renderAssets, ensure it uses correct element IDs like #availableBalance) ... */ 
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
    
    const balanceEl = document.querySelector('#availableBalance');
    const portfolioValueEl = document.getElementById('portfolioValue');

    if (balanceEl) balanceEl.textContent = `$${totalUSD.toFixed(2)}`;
    if (portfolioValueEl) portfolioValueEl.textContent = `$${totalUSD.toFixed(2)}`;
  }
  renderAssets();

  // --- Investment Plan Data Fetch ---
  async function fetchInvestmentPlans() { /* ... (keep your fetchInvestmentPlans) ... */ 
    try {
        const response = await fetch(`${DASH_API_BASE_URL}/investment-plans`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        if (!response.ok) throw new Error(`Failed to fetch plans: ${response.status}`);
        const data = await response.json();
        if (data.success && data.plans) {
            console.log("DASHBOARD.JS: Fetched investment plans:", data.plans);
        } else {
          console.error("DASHBOARD.JS: Failed to parse investment plans:", data.message);
        }
    } catch (error) {
        console.error("DASHBOARD.JS: Error fetching investment plans:", error);
    }
  }
  fetchInvestmentPlans();

  // --- Active Investments Fetch ---
  async function loadActiveInvestments() { /* ... (keep your loadActiveInvestments) ... */
    const investmentDetailsContainers = document.querySelectorAll('.investment-details-container');
    investmentDetailsContainers.forEach(c => c.innerHTML = '<p>Loading active investments for this plan...</p>');
    
    try {
        const response = await fetch(`${DASH_API_BASE_URL}/investments`, {
            method: 'GET',
            headers: { 'Authorization': `Bearer ${authToken}`, 'Content-Type': 'application/json' }
        });
        if (!response.ok) {
            const errData = await response.json();
            throw new Error(errData.message || `Failed to fetch investments: ${response.status}`);
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
                            ${inv.status === 'active' || inv.status === 'matured' ? 
                                `<button class="withdraw-btn-plan" data-investment-id="${inv._id}">Withdraw</button>` : ''}
                        `;
                        container.appendChild(el);
                    }
                }
            });
            document.querySelectorAll('.withdraw-btn-plan').forEach(btn => {
                btn.addEventListener('click', handlePlanWithdrawClick);
            });
        } else {
            investmentDetailsContainers.forEach(c => c.innerHTML = '<p>No active investments in this plan or failed to load.</p>');
        }
    } catch (err) {
        console.error('DASHBOARD.JS: Failed to load active investments:', err);
        investmentDetailsContainers.forEach(c => c.innerHTML = `<p style="color:red;">Error loading investments: ${err.message}</p>`);
    }
  }
  loadActiveInvestments();

  // --- Handle Investment Button Clicks ---
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
        
        // Always try to parse JSON, even for errors, as backend might send error details
        const data = await response.json();
        hideModal(); // Hide modal after response

        if (!response.ok || !data.success) {
            // Log the full error data from backend
            console.error("DASHBOARD.JS: Investment API call failed.", {status: response.status, responseData: data});
            throw new Error(data.message || `Investment failed with status ${response.status}. Check backend logs.`);
        }
        
        alert(data.message || 'Investment successful!');
        // Consider updating balance if API returns newBalance: data.newBalance
        loadActiveInvestments(); 
      } catch(error) {
        hideModal(); // Ensure modal is hidden on error too
        alert(`Investment Error: ${error.message}`);
        console.error("DASHBOARD.JS: Catch block for investment error:", error);
        // Advise user to check backend logs if it's an "Unexpected server error"
        if (error.message.toLowerCase().includes("unexpected server error")) {
            alert("An unexpected error occurred on the server. Please contact support or check server logs if you are an admin.");
        }
      }
    });
  });

  // --- Handle Plan Withdrawal Click ---
  async function handlePlanWithdrawClick(event) { /* ... (keep your handlePlanWithdrawClick, add logging) ... */ 
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
        const data = await response.json();
        hideModal();

        if (!response.ok || !data.success) {
            console.error("DASHBOARD.JS: Withdrawal API call failed.", {status: response.status, responseData: data});
            throw new Error(data.message || "Withdrawal failed.");
        }
        alert(data.message || "Withdrawal successful!");
        loadActiveInvestments(); 
    } catch (error) {
        hideModal();
        alert(`Withdrawal Error: ${error.message}`);
        console.error("DASHBOARD.JS: Catch block for withdrawal error:", error);
    }
  }
  
  // --- Chart.js Examples ---
  const portfolioCtx = document.getElementById('portfolioChart')?.getContext('2d');
  if (portfolioCtx) { /* ... */ }
  const marketTrendsCtx = document.getElementById('marketTrendsChart')?.getContext('2d');
  if (marketTrendsCtx) { /* ... */ }

});
// --- END OF REWRITTEN dashboard.js ---