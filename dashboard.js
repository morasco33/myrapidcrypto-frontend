// --- START OF REWRITTEN AND UPDATED dashboard.js ---
document.addEventListener('DOMContentLoaded', () => {
  console.log("DASHBOARD.JS: DOMContentLoaded");

  const USER_INFO_KEY_FOR_DASH = 'cryptohub_user_info';
  const AUTH_TOKEN_KEY_FOR_DASH = 'cryptohub_auth_token';

  const authToken = localStorage.getItem(AUTH_TOKEN_KEY_FOR_DASH);
  const userInfoString = localStorage.getItem(USER_INFO_KEY_FOR_DASH);

  // --- Initial Auth and User Info Checks (Critical Path) ---
  if (!authToken || !userInfoString) {
    console.error("DASHBOARD.JS: CRITICAL - Auth token or user info missing. Halting.");
    displayCriticalError("Authentication Error", "Your session may be invalid. Please try <a href='login.html?action=relogin'>logging in again</a>.");
    return;
  }

  let user;
  try {
    user = JSON.parse(userInfoString);
  } catch (e) {
    console.error("DASHBOARD.JS: CRITICAL - Failed to parse user info.", e);
    displayCriticalError("Data Error", "Could not load user data. Please try <a href='login.html?action=relogin'>logging in again</a>.");
    return;
  }

  if (!user || !user._id) {
    console.error("DASHBOARD.JS: CRITICAL - User info object is invalid or missing ID.", user);
    displayCriticalError("User Data Error", "User information is incomplete. Please try <a href='login.html?action=relogin'>logging in again</a>.");
    return;
  }

  console.log("DASHBOARD.JS: User confirmed. User:", user.username || user.email);
  const userNameEl = document.getElementById('userName');
  if (userNameEl) {
    userNameEl.textContent = user.username || user.email || 'User';
  } else {
    console.warn("DASHBOARD.JS: userName element not found.");
  }

  // --- Global Variables & API Config ---
  const DASH_API_BASE_URL = window.API_BASE_URL || 'https://rapidcrypto-backend.onrender.com/api';

  // --- Modal Elements & Functions ---
  const modal = document.getElementById('appModal');
  const modalTitle = document.getElementById('modalTitle');
  const modalBody = document.getElementById('modalBody');
  const modalCloseBtn = document.getElementById('modalCloseBtn');

  function showModal(title, bodyContent = '', footerContent = '') {
    if (!modal || !modalTitle || !modalBody) {
      console.error("Modal elements not found for showModal");
      alert(title + "\n" + (typeof bodyContent === 'string' ? bodyContent : 'Please check console for details.'));
      return;
    }
    modalTitle.textContent = title;
    if (typeof bodyContent === 'string') {
      modalBody.innerHTML = bodyContent;
    } else if (bodyContent instanceof HTMLElement) {
      modalBody.innerHTML = '';
      modalBody.appendChild(bodyContent);
    }
    // Note: Footer content not used in your original, but good to have a placeholder
    modal.classList.add('active');
  }

  function hideModal() {
    if (modal) modal.classList.remove('active');
  }

  if (modalCloseBtn) modalCloseBtn.addEventListener('click', hideModal);
  if (modal) {
    modal.addEventListener('click', (event) => {
      if (event.target === modal) { hideModal(); }
    });
  }

  // --- Helper for Critical Errors (stops script and shows message) ---
  function displayCriticalError(title, message) {
    const mainContent = document.querySelector('main');
    if (mainContent) {
      mainContent.innerHTML = `<h1>${title}</h1><p>${message}</p>`;
    }
    const loadingSpinnerOverlay = document.querySelector('.loading-spinner-overlay');
    if (loadingSpinnerOverlay) loadingSpinnerOverlay.style.display = 'none';
    document.body.classList.remove('auth-loading');
    document.documentElement.style.visibility = 'visible';
    document.documentElement.style.opacity = '1';
  }

  // --- Main Action Buttons ---
  const mainDepositButton = document.getElementById('mainDepositBtn');
  if (mainDepositButton) {
    mainDepositButton.addEventListener('click', () => window.location.href = 'deposit.html');
  }

  const mainWithdrawButton = document.getElementById('mainWithdrawBtn');
  if (mainWithdrawButton) {
    mainWithdrawButton.addEventListener('click', () => window.location.href = 'withdraw.html');
  }

  // --- NEW: Fetch Market Trends ---
  async function fetchMarketTrends() {
    const trendsContainer = document.getElementById('marketTrendsContainer');
    if (!trendsContainer) {
      console.warn("DASHBOARD.JS: 'marketTrendsContainer' element not found. Skipping market trends.");
      return;
    }
    trendsContainer.innerHTML = '<p class="loading-text">Loading market trends...</p>';

    try {
      // Assuming an endpoint like /api/market-data or similar
      // Replace with your actual market data endpoint
      const response = await fetch(`${DASH_API_BASE_URL}/market-data`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      const data = await response.json();

      if (!response.ok || !data.success || !Array.isArray(data.trends)) {
        throw new Error(data.message || 'Failed to load market trends');
      }

      trendsContainer.innerHTML = ''; // Clear loading message
      if (data.trends.length > 0) {
        const ul = document.createElement('ul');
        ul.className = 'market-trends-list';
        data.trends.forEach(trend => {
          const li = document.createElement('li');
          li.className = 'market-trend-item';
          // Adjust HTML structure based on your actual trend data
          li.innerHTML = `
            <span class="trend-name">${trend.name} (${trend.symbol.toUpperCase()})</span>
            <span class="trend-price">$${parseFloat(trend.price).toFixed(2)}</span>
            <span class="trend-change ${parseFloat(trend.change24h) >= 0 ? 'positive' : 'negative'}">
              ${parseFloat(trend.change24h).toFixed(2)}%
            </span>
          `;
          ul.appendChild(li);
        });
        trendsContainer.appendChild(ul);
      } else {
        trendsContainer.innerHTML = '<p>No market trends available at the moment.</p>';
      }
    } catch (err) {
      console.error('DASHBOARD.JS: Error loading market trends:', err.message);
      if (trendsContainer) trendsContainer.innerHTML = '<p class="error-text">Could not load market trends. Please try again later.</p>';
    }
  }

  // --- Fetch User Balance, Assets, and then Active Investments ---
  async function fetchUserFinancialData() {
    const balanceEl = document.getElementById('availableBalance');
    const portfolioValueEl = document.getElementById('portfolioValue');
    const assetsContainer = document.getElementById('assetsList');

    // Set initial loading states
    if (balanceEl) balanceEl.textContent = 'Loading...';
    if (portfolioValueEl) portfolioValueEl.textContent = 'Loading...';
    if (assetsContainer) assetsContainer.innerHTML = '<p class="loading-text">Loading your assets...</p>';

    try {
      const response = await fetch(`${DASH_API_BASE_URL}/profile`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });

      const data = await response.json();
      if (!response.ok || !data.success || !data.user) { // Ensure user object exists
        throw new Error(data.message || 'Failed to load user profile');
      }

      const balance = data.user.balance || 0;
      const userAssets = data.user.assets || []; // Ensure assets is an array

      if (balanceEl) balanceEl.textContent = `$${balance.toFixed(2)}`;
      if (portfolioValueEl) portfolioValueEl.textContent = `$${balance.toFixed(2)}`; // Or calculate portfolio value differently if assets have values

      // Display Assets - ENHANCED
      if (assetsContainer) {
        assetsContainer.innerHTML = ''; // Clear loading
        if (userAssets.length > 0) {
          userAssets.forEach((asset) => {
            const div = document.createElement('div');
            div.className = 'asset-item'; // Add class for styling
            // Assuming asset object might have: symbol, amount, name, value (USD value of holding)
            // Adjust based on your actual asset object structure from the backend
            div.innerHTML = `
              <div class="asset-info">
                <span class="asset-name">${asset.name || asset.symbol.toUpperCase()}</span>
                <span class="asset-symbol">(${asset.symbol.toUpperCase()})</span>
              </div>
              <div class="asset-details">
                <span class="asset-amount">Amount: ${asset.amount.toFixed(asset.decimals || 8)}</span>
                ${asset.value ? `<span class="asset-value">Value: $${asset.value.toFixed(2)}</span>` : ''}
              </div>
            `;
            // Example: Add a link or button if needed
            // const viewChartButton = document.createElement('button');
            // viewChartButton.textContent = 'View Chart';
            // viewChartButton.onclick = () => showAssetChart(asset.symbol);
            // div.appendChild(viewChartButton);
            assetsContainer.appendChild(div);
          });
        } else {
          assetsContainer.innerHTML = '<p>You do not hold any assets currently.</p>';
        }
      } else {
        console.warn("DASHBOARD.JS: 'assetsList' element not found in the DOM.");
      }

      // After fetching balance and assets, load active investments
      await loadActiveInvestments();

    } catch (err) {
      console.error('DASHBOARD.JS: Error loading user financial data:', err.message);
      if (balanceEl) balanceEl.textContent = '$0.00';
      if (portfolioValueEl) portfolioValueEl.textContent = '$0.00';
      if (assetsContainer) assetsContainer.innerHTML = '<p class="error-text">Could not load your assets.</p>';
      // Also clear investment details if financial data fails
      const investmentDetailsContainers = document.querySelectorAll('.investment-details-container');
      investmentDetailsContainers.forEach(c => c.innerHTML = '<p class="error-text">Could not load investments.</p>');
    }
  }

  // --- Load Active Investments ---
  async function loadActiveInvestments() {
    const investmentDetailsContainers = document.querySelectorAll('.investment-details-container');
    investmentDetailsContainers.forEach(c => c.innerHTML = '<p class="loading-text">Loading active investments for this plan...</p>');

    try {
      const response = await fetch(`${DASH_API_BASE_URL}/investments`, {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${authToken}`, 'Content-Type': 'application/json' }
      });
      const data = await response.json();

      if (!response.ok || !data.success || !Array.isArray(data.investments)) {
        throw new Error(data.message || 'Failed to load investments');
      }

      // Clear all containers first
      investmentDetailsContainers.forEach(c => c.innerHTML = '<p>No active investments in this plan.</p>');

      if (data.investments.length === 0) {
        console.log("DASHBOARD.JS: No active investments found for the user.");
        // Message "No active investments in this plan" is already set above.
        return;
      }
      
      data.investments.forEach(inv => {
        // IMPORTANT: Ensure your HTML plan cards have `data-plan-id` matching `inv.planId`
        const planCard = document.querySelector(`.investment-options[data-plan-id="${inv.planId}"]`);
        if (planCard) {
          const container = planCard.querySelector('.investment-details-container');
          if (container) {
            if (container.innerHTML.includes('No active investments in this plan.')) {
              container.innerHTML = ''; // Clear the 'no investments' message if we found one
            }
            const el = document.createElement('div');
            el.className = 'investment-details-item'; // Use a more specific class
            el.innerHTML = `
              <p><strong>Active: ${inv.planName || inv.planId}</strong></p>
              <p>Invested: $${inv.initialAmount.toFixed(2)} | Current Value: $${inv.currentValue.toFixed(2)}</p>
              <p>Status: <span class="status-${inv.status.toLowerCase()}">${inv.status}</span> | Matures: ${new Date(inv.maturityDate).toLocaleDateString()}</p>
              ${(inv.status === 'active' || inv.status === 'matured') && new Date() >= new Date(inv.withdrawalUnlockTime)
                ? `<button class="withdraw-btn-plan" data-investment-id="${inv._id}">Withdraw Funds</button>`
                : `<small class="lock-info">Withdrawal locked until ${new Date(inv.withdrawalUnlockTime).toLocaleDateString()}</small>`}
            `;
            container.appendChild(el);
          } else {
            console.warn(`DASHBOARD.JS: Could not find .investment-details-container for planId: ${inv.planId}`);
          }
        } else {
          console.warn(`DASHBOARD.JS: Could not find plan card with data-plan-id: ${inv.planId} for an active investment. Ensure HTML matches.`);
        }
      });

      // Re-bind withdrawal buttons after new elements are added
      document.querySelectorAll('.withdraw-btn-plan').forEach(btn => {
        btn.removeEventListener('click', handlePlanWithdrawClick); // Remove old listener if any
        btn.addEventListener('click', handlePlanWithdrawClick);
      });

    } catch (err) {
      console.error('DASHBOARD.JS: Failed to load active investments:', err);
      investmentDetailsContainers.forEach(c => c.innerHTML = '<p class="error-text">Error loading investments for this plan.</p>');
    }
  }

  // --- Handle Plan Withdrawal Click ---
  async function handlePlanWithdrawClick(event) {
    const investmentId = event.target.dataset.investmentId;
    const withdrawalPin = prompt("Enter your 5-digit withdrawal PIN:");

    if (!withdrawalPin) { // User cancelled
        return;
    }
    if (!/^\d{5}$/.test(withdrawalPin)) {
      alert("Invalid PIN format. Please enter a 5-digit PIN.");
      return;
    }

    showModal('Processing Withdrawal...', 'Please wait, attempting to withdraw funds...');
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

      if (!response.ok || !data.success) {
        throw new Error(data.message || 'Withdrawal failed. Please check your PIN or try again later.');
      }

      hideModal();
      alert(data.message || 'Withdrawal successful! Your balance will be updated.');
      fetchUserFinancialData(); // Refresh all financial data

    } catch (error) {
      hideModal();
      alert(`Withdrawal Error: ${error.message}`);
      console.error("DASHBOARD.JS: Plan withdrawal error:", error);
    }
  }

  // --- Investment Button Handlers ---
  document.querySelectorAll('.invest-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const planId = btn.dataset.plan;
      const minAmount = parseFloat(btn.dataset.min);
      const maxAmount = parseFloat(btn.dataset.max);
      const planName = btn.closest('.investment-options')?.querySelector('h3')?.textContent || planId;


      const amountString = prompt(`Enter amount to invest in ${planName} plan ($${minAmount} - $${maxAmount}):`);
      if (amountString === null) return; // User cancelled

      const investAmount = parseFloat(amountString);
      if (isNaN(investAmount) || investAmount < minAmount || investAmount > maxAmount) {
        alert(`Invalid amount. Please enter a value between $${minAmount} and $${maxAmount}.`);
        return;
      }

      showModal('Processing Investment...', `Investing $${investAmount.toFixed(2)} into ${planName}. Please wait...`);
      try {
        const response = await fetch(`${DASH_API_BASE_URL}/investments`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${authToken}`
          },
          body: JSON.stringify({ planId, amount: investAmount })
        });

        const data = await response.json();

        if (!response.ok || !data.success) {
          throw new Error(data.message || 'Investment failed. Your balance might be insufficient or the plan details are incorrect.');
        }

        hideModal();
        alert(data.message || 'Investment successful! Your new investment is now active.');
        fetchUserFinancialData(); // Refresh balance, assets, and active investments

      } catch (error) {
        hideModal();
        alert(`Investment Error: ${error.message}`);
        console.error("DASHBOARD.JS: Investment processing error:", error);
      }
    });
  });

  // --- Initial Data Fetch on Load ---
  // Call all primary data fetching functions
  fetchMarketTrends(); // Fetch market trends
  fetchUserFinancialData(); // Fetches balance, assets, and then active investments

  // Optional: Auto-refresh data every N minutes
  // const REFRESH_INTERVAL = 5 * 60 * 1000; // 5 minutes
  // setInterval(() => {
  //   console.log("DASHBOARD.JS: Auto-refreshing data...");
  //   fetchMarketTrends();
  //   fetchUserFinancialData();
  // }, REFRESH_INTERVAL);

});
// --- END OF REWRITTEN AND UPDATED dashboard.js ---