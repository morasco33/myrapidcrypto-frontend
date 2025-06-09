// --- START OF COMBINED AND UPDATED dashboard.js ---
document.addEventListener('DOMContentLoaded', () => {
  console.log("DASHBOARD.JS: DOMContentLoaded");

  const USER_INFO_KEY_FOR_DASH = 'cryptohub_user_info';
  const AUTH_TOKEN_KEY_FOR_DASH = 'cryptohub_auth_token';

  const authToken = localStorage.getItem(AUTH_TOKEN_KEY_FOR_DASH);
  const userInfoString = localStorage.getItem(USER_INFO_KEY_FOR_DASH);

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

  if (!authToken || !userInfoString) {
    console.error("DASHBOARD.JS: CRITICAL - Auth token or user info missing DESPITE earlier checks. Halting.");
    displayCriticalError("Authentication Error", "Could not load dashboard. Your session may be invalid. Please try <a href='login.html?action=relogin'>logging in again</a>.");
    return;
  }

  let user;
  try {
    user = JSON.parse(userInfoString);
  } catch (e) {
    console.error("DASHBOARD.JS: CRITICAL - Failed to parse user info from localStorage.", e);
    displayCriticalError("Data Error", "Could not load user data. Please try <a href='login.html?action=relogin'>logging in again</a>.");
    return;
  }

  if (!user || !user._id) {
    console.error("DASHBOARD.JS: CRITICAL - User info object is invalid or missing essential ID.", user);
    displayCriticalError("User Data Error", "User information is incomplete. Please try <a href='login.html?action=relogin'>logging in again</a>.");
    return;
  }

  console.log("DASHBOARD.JS: User confirmed and data parsed. User:", user.username || user.email);
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

  // --- Event Listeners for Quick Actions ---
  const mainDepositButton = document.getElementById('mainDepositBtn');
  if (mainDepositButton) {
    mainDepositButton.addEventListener('click', () => {
      window.location.href = 'deposit.html';
    });
  }

  const mainWithdrawButton = document.getElementById('mainWithdrawBtn');
  if (mainWithdrawButton) {
    mainWithdrawButton.addEventListener('click', () => {
      window.location.href = 'withdraw.html';
    });
  }

  // --- NEW: Fetch Market Trends (API Driven) ---
  async function fetchMarketTrends() {
    const trendsContainer = document.getElementById('marketTrendsContainer'); // Ensure this div exists in your HTML
    if (!trendsContainer) {
      console.warn("DASHBOARD.JS: 'marketTrendsContainer' element not found for dynamic trends. Skipping.");
      return;
    }
    trendsContainer.innerHTML = '<p class="loading-text">Loading market trends...</p>';
    console.log('DEBUG: fetchMarketTrends: Attempting to fetch from API.');

    try {
      const response = await fetch(`${DASH_API_BASE_URL}/market-data`, { // Ensure this endpoint is correct
        headers: { Authorization: `Bearer ${authToken}` },
      });
      console.log('DEBUG: Market Trends API Response Status:', response.status);
      const data = await response.json();
      console.log('DEBUG: Market Trends API Data:', data);

      if (!response.ok || !data.success || !Array.isArray(data.trends)) {
        console.error('DEBUG: Market Trends: API response not OK or data structure incorrect', data);
        throw new Error(data.message || 'Failed to load market trends - check API response structure.');
      }

      trendsContainer.innerHTML = ''; // Clear loading message
      if (data.trends.length > 0) {
        console.log('DEBUG: Market Trends: Rendering trends from API', data.trends);
        const ul = document.createElement('ul');
        ul.className = 'market-trends-list'; // Add class for styling
        data.trends.forEach(trend => {
          const li = document.createElement('li');
          li.className = 'market-trend-item'; // Add class for styling
          // Adjust HTML structure based on your actual trend data from backend
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
        console.log('DEBUG: Market Trends: No trends data to render (API returned empty trends array).');
        trendsContainer.innerHTML = '<p>No market trends available at the moment.</p>';
      }
    } catch (err) {
      console.error('DASHBOARD.JS: Error loading market trends:', err.message, err);
      if (trendsContainer) trendsContainer.innerHTML = '<p class="error-text">Could not load market trends. Please try again later.</p>';
    }
  }

  // --- Fetch REAL User Balance and Assets ---
  async function fetchRealUserBalanceAndAssets() { // Renamed for clarity, combines balance and assets
    const balanceEl = document.getElementById('availableBalance');
    const portfolioValueEl = document.getElementById('portfolioValue');
    const assetsContainer = document.getElementById('assetsList'); // Ensure this div exists

    // Initial loading states
    if (balanceEl) balanceEl.textContent = 'Loading...';
    if (portfolioValueEl) portfolioValueEl.textContent = 'Loading...';
    if (assetsContainer) assetsContainer.innerHTML = '<p class="loading-text">Loading your assets...</p>';
    console.log('DEBUG: fetchRealUserBalanceAndAssets: Attempting to fetch from API.');

    try {
      // The endpoint /user/profile seems specific; often it's just /profile
      // Verify this endpoint: `${DASH_API_BASE_URL}/profile` or `${DASH_API_BASE_URL}/user/profile`
      const response = await fetch(`${DASH_API_BASE_URL}/profile`, { // Using /profile as it's more common
        headers: { Authorization: `Bearer ${authToken}` },
      });
      console.log('DEBUG: User Profile/Assets API Response Status:', response.status);
      const data = await response.json();
      console.log('DEBUG: User Profile/Assets API Data:', data);

      if (!response.ok || !data.success || !data.user) {
        console.error('DEBUG: User Profile/Assets: API response not OK or data.user missing', data);
        throw new Error(data.message || 'Failed to load user profile and assets');
      }

      const balance = data.user.balance || 0;
      const userAssets = data.user.assets || []; // Ensure assets is an array

      if (balanceEl) balanceEl.textContent = `$${balance.toFixed(2)}`;
      if (portfolioValueEl) portfolioValueEl.textContent = `$${balance.toFixed(2)}`; // Or calculate portfolio value from assets if they have individual values

      // Display Assets - ENHANCED
      if (assetsContainer) {
        assetsContainer.innerHTML = ''; // Clear loading
        if (userAssets.length > 0) {
          console.log('DEBUG: User Assets: Rendering assets from API', userAssets);
          userAssets.forEach((asset) => {
            const div = document.createElement('div');
            div.className = 'asset-item'; // Add class for styling
            // Assuming asset object might have: symbol, amount, name, value (USD value of holding), decimals
            div.innerHTML = `
              <div class="asset-info">
                <span class="asset-name">${asset.name || asset.symbol.toUpperCase()}</span>
                <span class="asset-symbol">(${asset.symbol.toUpperCase()})</span>
              </div>
              <div class="asset-details">
                <span class="asset-amount">Amount: ${parseFloat(asset.amount).toFixed(asset.decimals || 8)}</span>
                ${asset.value ? `<span class="asset-value">Value: $${parseFloat(asset.value).toFixed(2)}</span>` : ''}
              </div>
            `;
            assetsContainer.appendChild(div);
          });
        } else {
          console.log('DEBUG: User Assets: No assets to render from API.');
          assetsContainer.innerHTML = '<p>You do not hold any assets currently.</p>';
        }
      } else {
        console.warn("DASHBOARD.JS: 'assetsList' element not found in the DOM for displaying assets.");
      }

    } catch (err) {
      console.error('DASHBOARD.JS: Error loading user balance and assets:', err.message, err);
      if (balanceEl) balanceEl.textContent = '$0.00';
      if (portfolioValueEl) portfolioValueEl.textContent = '$0.00';
      if (assetsContainer) assetsContainer.innerHTML = '<p class="error-text">Could not load your assets.</p>';
    }
  }


  // --- Active Investments Fetch ---
  async function loadActiveInvestments() {
    const investmentDetailsContainers = document.querySelectorAll('.investment-details-container');
    investmentDetailsContainers.forEach(c => c.innerHTML = '<p class="loading-text">Loading active investments for this plan...</p>');
    console.log('DEBUG: loadActiveInvestments: Found investment details containers:', investmentDetailsContainers.length);

    try {
      const response = await fetch(`${DASH_API_BASE_URL}/investments`, {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${authToken}`, 'Content-Type': 'application/json' }
      });
      console.log('DEBUG: Investments API Response Status:', response.status);
      const rawResponseText = await response.text(); // Get raw text first for debugging
      console.log('DEBUG: Investments API Raw Response Text:', rawResponseText);

      let data;
      try {
        data = JSON.parse(rawResponseText); // Now try to parse
      } catch (jsonError) {
        console.error('DEBUG: Investments: Failed to parse API response as JSON.', jsonError, rawResponseText);
        throw new Error(`Failed to parse investments data. Server sent: ${rawResponseText.substring(0, 100)}...`);
      }
      console.log('DEBUG: Investments API Parsed Data:', data);


      if (!response.ok) { // Check HTTP status after parsing attempts
          let errorMsg = `Failed to fetch investments: ${response.statusText} (${response.status})`;
          errorMsg = data.message || errorMsg; // Use message from parsed JSON if available
          console.error('DEBUG: Investments: API response not OK.', {status: response.status, data});
          throw new Error(errorMsg);
      }

      if (data.success && Array.isArray(data.investments)) {
        console.log("DASHBOARD.JS: Active investments from API:", data.investments);
        investmentDetailsContainers.forEach(c => c.innerHTML = '<p>No active investments in this plan.</p>'); // Default message

        if (data.investments.length === 0) {
            console.log("DASHBOARD.JS: No active investments found for the user from API.");
        }

        data.investments.forEach(inv => {
          console.log(`DEBUG: Investments: Processing investment with planId: ${inv.planId}`, inv);
          const planCardSelector = `.investment-options[data-plan-id="${inv.planId}"]`;
          const planCard = document.querySelector(planCardSelector);
          console.log(`DEBUG: Investments: Looking for plan card with selector: ${planCardSelector}. Found:`, planCard ? 'YES' : 'NO', planCard);

          if (planCard) {
            const container = planCard.querySelector('.investment-details-container');
            console.log(`DEBUG: Investments: Found .investment-details-container for plan ${inv.planId}:`, container ? 'YES' : 'NO', container);
            if (container) {
              if (container.innerHTML.includes('No active investments in this plan.')) {
                container.innerHTML = ''; // Clear the 'no investments' message if we found one
              }
              const el = document.createElement('div');
              el.className = 'investment-details-item'; // More specific class
              el.innerHTML = `
                <p><strong>Active: ${inv.planName || inv.planId}</strong></p>
                <p>Invested: $${parseFloat(inv.initialAmount).toFixed(2)} | Current Value: $${parseFloat(inv.currentValue).toFixed(2)}</p>
                <p>Status: <span class="status-${inv.status.toLowerCase()}">${inv.status}</span> | Matures: ${new Date(inv.maturityDate).toLocaleDateString()}</p>
                ${(inv.status === 'active' || inv.status === 'matured') && new Date() >= new Date(inv.withdrawalUnlockTime)
                  ? `<button class="withdraw-btn-plan" data-investment-id="${inv._id}">Withdraw Funds</button>`
                  : `<small class="lock-info">Withdrawal locked until ${new Date(inv.withdrawalUnlockTime).toLocaleDateString()}</small>`}
              `;
              container.appendChild(el);
              console.log(`DEBUG: Investments: Appended investment details for planId ${inv.planId} to its container.`);
            } else {
               console.warn(`DASHBOARD.JS: Could not find .investment-details-container for planId: ${inv.planId} within the found plan card.`);
            }
          } else {
            console.warn(`DASHBOARD.JS: Could not find plan card with data-plan-id: ${inv.planId}. Ensure HTML data-plan-id attributes EXACTLY match the planId from the backend.`);
          }
        });
        document.querySelectorAll('.withdraw-btn-plan').forEach(btn => {
          btn.removeEventListener('click', handlePlanWithdrawClick); // Avoid multiple listeners
          btn.addEventListener('click', handlePlanWithdrawClick);
        });
        console.log('DEBUG: Investments: Re-bound withdrawal buttons.');
      } else {
        console.warn('DASHBOARD.JS: Investments API call did not return success:true or investments is not an array.', data);
        investmentDetailsContainers.forEach(c => c.innerHTML = `<p>${data.message || 'No active investments or failed to load.'}</p>`);
      }
    } catch (err) {
      console.error('DASHBOARD.JS: Failed to load active investments (in catch block):', err.message, err);
      investmentDetailsContainers.forEach(c => c.innerHTML = `<p class="error-text">Error loading investments for this plan: ${err.message}. Check console.</p>`);
    }
  }

  // --- Handle Investment Button Clicks ---
  document.querySelectorAll('.invest-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const planId = btn.dataset.plan;
      const minAmount = parseFloat(btn.dataset.min);
      const maxAmount = parseFloat(btn.dataset.max);
      const planName = btn.closest('.investment-options')?.querySelector('h3')?.textContent || planId;

      console.log(`DASHBOARD.JS: Invest button clicked for plan: ${planId}`);
      const amountString = prompt(`Enter amount to invest in ${planName} plan ($${minAmount} - $${maxAmount}):`);
      if (amountString === null) { console.log("DASHBOARD.JS: Investment cancelled by user."); return; }

      const investAmount = parseFloat(amountString);

      if (isNaN(investAmount) || investAmount < minAmount || investAmount > maxAmount) {
        alert(`Please enter a valid amount between $${minAmount} and $${maxAmount}.`);
        return;
      }

      console.log(`DASHBOARD.JS: Attempting to invest $${investAmount} in plan ${planId}`);
      showModal('Processing Investment...', `Investing $${investAmount.toFixed(2)} into ${planName}. Please wait...`);
      try {
        const response = await fetch(`${DASH_API_BASE_URL}/investments`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${authToken}`
          },
          body: JSON.stringify({ planId, amount: investAmount }) // Corrected: planId, not plan_id
        });

        const data = await response.json();
        hideModal();
        console.log('DEBUG: Investment Creation API Response:', data, 'Status:', response.status);


        if (!response.ok) {
          console.error("DASHBOARD.JS: Investment API call HTTP error.", { status: response.status, responseData: data });
          throw new Error(data.message || `Investment request failed with status ${response.status}.`);
        }
        if (!data.success) {
          console.error("DASHBOARD.JS: Investment API call returned success:false.", { responseData: data });
          throw new Error(data.message || "Investment processing failed on server.");
        }

        alert(data.message || 'Investment successful!');
        // Refresh financial data and active investments
        fetchRealUserBalanceAndAssets(); // Call the combined function
        loadActiveInvestments(); // Also specifically reload investments

      } catch (error) {
        hideModal();
        alert(`Investment Error: ${error.message}`);
        console.error("DASHBOARD.JS: Catch block for investment error:", error);
      }
    });
  });

  // --- Handle Plan Withdrawal Click ---
  async function handlePlanWithdrawClick(event) {
    const investmentId = event.target.dataset.investmentId;
    console.log(`DASHBOARD.JS: Withdraw button clicked for investment ID: ${investmentId}`);
    const withdrawalPin = prompt("Enter your 5-digit withdrawal PIN:");

    if (!withdrawalPin) return; // User cancelled
    if (!/^\d{5}$/.test(withdrawalPin)) {
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
      console.log('DEBUG: Plan Withdrawal API Response:', data, 'Status:', response.status);

      if (!response.ok) {
        console.error("DASHBOARD.JS: Withdrawal API call HTTP error.", { status: response.status, responseData: data });
        throw new Error(data.message || `Withdrawal request failed with status ${response.status}.`);
      }
      if (!data.success) {
        console.error("DASHBOARD.JS: Withdrawal API call returned success:false.", { responseData: data });
        throw new Error(data.message || "Withdrawal processing failed on server.");
      }

      alert(data.message || "Withdrawal successful!");
      // Refresh financial data and active investments
      fetchRealUserBalanceAndAssets(); // Call the combined function
      loadActiveInvestments(); // Also specifically reload investments

    } catch (error) {
      hideModal();
      alert(`Withdrawal Error: ${error.message}`);
      console.error("DASHBOARD.JS: Catch block for withdrawal error:", error);
    }
  }

  // --- Chart.js Example for Portfolio ---
  // This is static data. You'd need to fetch real data to make this dynamic.
  const portfolioCtx = document.getElementById('portfolioChart')?.getContext('2d');
  if (portfolioCtx) {
    console.log("DASHBOARD.JS: Setting up portfolioChart (with static data).");
    new Chart(portfolioCtx, {
      type: 'line',
      data: {
        labels: ['Jan', 'Feb', 'Mar', 'Apr'],
        datasets: [{ label: 'Portfolio Value', data: [65, 59, 80, 81], tension: 0.1, borderColor: 'rgb(75, 192, 192)' }]
      },
      options: { responsive: true, maintainAspectRatio: false }
    });
  } else {
    console.warn("DASHBOARD.JS: 'portfolioChart' canvas element not found.");
  }

  // --- Initial Data Fetch on Load ---
  console.log("DASHBOARD.JS: Starting initial data fetch...");
  fetchMarketTrends(); // For dynamic market trends
  fetchRealUserBalanceAndAssets(); // For balance and user's specific assets
  loadActiveInvestments(); // For active investment plans

});
// --- END OF COMBINED AND UPDATED dashboard.js ---