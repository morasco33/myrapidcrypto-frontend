// --- START OF dashboard.js (Corrected) ---
document.addEventListener('DOMContentLoaded', () => {
  console.log("DASHBOARD.JS: DOMContentLoaded");

  // --- 1. DEFINE KEYS AND GET AUTH DATA ---
  // These keys must match the ones used in auth.js and other scripts.
  const USER_INFO_KEY_FOR_DASH = 'cryptohub_user_info';
  const AUTH_TOKEN_KEY_FOR_DASH = 'cryptohub_auth_token';

  const authToken = localStorage.getItem(AUTH_TOKEN_KEY_FOR_DASH);
  const userInfoString = localStorage.getItem(USER_INFO_KEY_FOR_DASH);

  // --- 2. CRITICAL AUTHENTICATION CHECK ---
  // If the user somehow gets to the dashboard page without a token or user info,
  // they must be redirected to the login page immediately. This prevents unauthenticated access.
  if (!authToken || !userInfoString) {
    console.error("DASHBOARD.JS: CRITICAL - Auth token or user info missing. Redirecting to login.");
    window.location.href = 'login.html?reason=session_expired_dashboard_check';
    return; // Stop all further script execution on this page.
  }

  // --- 3. PARSE USER DATA ---
  let user;
  try {
    user = JSON.parse(userInfoString);
  } catch (e) {
    // This handles cases where the localStorage data is corrupted.
    console.error("DASHBOARD.JS: CRITICAL - Failed to parse user info from localStorage.", e);
    const mainContent = document.querySelector('main');
    if (mainContent) mainContent.innerHTML = `<h1>Data Error</h1><p>Could not load user data. Please try <a href="login.html?action=relogin">logging in again</a>.</p>`;
    // Manually unhide the page to show the error.
    document.querySelector('.loading-spinner-overlay')?.style.display = 'none';
    document.body.classList.remove('auth-loading');
    document.documentElement.style.visibility = 'visible';
    document.documentElement.style.opacity = '1';
    return;
  }

  // Ensure the parsed user object has the necessary data (_id).
  if (!user || !user._id) {
    console.error("DASHBOARD.JS: CRITICAL - User info object is invalid or missing essential ID.", user);
    const mainContent = document.querySelector('main');
    if (mainContent) mainContent.innerHTML = `<h1>User Data Error</h1><p>User information is incomplete. Please try <a href="login.html?action=relogin">logging in again</a>.</p>`;
    // Manually unhide the page to show the error.
    document.querySelector('.loading-spinner-overlay')?.style.display = 'none';
    document.body.classList.remove('auth-loading');
    document.documentElement.style.visibility = 'visible';
    document.documentElement.style.opacity = '1';
    return;
  }
  
  // --- 4. INITIALIZE UI WITH BASIC INFO ---
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

  function showModal(title, bodyContent = '') {
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
      if (modal) modal.style.display = 'flex';
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

  // --- Event Listeners for Quick Actions to Navigate to Pages ---
  document.getElementById('mainDepositBtn')?.addEventListener('click', () => {
    console.log('DASHBOARD.JS: Main Deposit Button Clicked, navigating to deposit.html');
    window.location.href = 'deposit.html';
  });
  document.getElementById('mainWithdrawBtn')?.addEventListener('click', () => {
    console.log('DASHBOARD.JS: Main Withdraw Button Clicked, navigating to withdraw.html');
    window.location.href = 'withdraw.html';
  });

  // --- Fetch Real User Profile Data (Balance, Assets) ---
  async function fetchRealUserProfileData() {
    console.log("DASHBOARD.JS: Fetching real user profile data...");
    if (!authToken) {
        console.error("DASHBOARD.JS: No auth token available for fetching profile.");
        showModal('Error', 'Session data missing. Cannot load profile. Please try logging in again.');
        return;
    }
    try {
      const response = await fetch(`${DASH_API_BASE_URL}/profile`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || `Failed to load user profile (HTTP ${response.status})`);
      }
      if(!data.success) {
        throw new Error(data.message || 'Failed to load user profile (API Error)');
      }

      console.log("DASHBOARD.JS: User profile data received:", data.user);

      const fetchedUser = data.user;
      const balance = fetchedUser.balance !== undefined ? fetchedUser.balance : 0;
      
      const balanceEl = document.getElementById('availableBalance');
      const portfolioValueEl = document.getElementById('portfolioValue');
      
      if (balanceEl) balanceEl.textContent = `$${parseFloat(balance).toFixed(2)}`;
      if (portfolioValueEl) portfolioValueEl.textContent = `$${parseFloat(balance).toFixed(2)}`;

      // ========================== ASSET DISPLAY LOGIC START (CORRECTED) ==========================
      const assetsContainer = document.getElementById('assetsList');
      if (assetsContainer) {
          assetsContainer.innerHTML = ''; // Clear previous assets, if any

          const userAssets = fetchedUser.assets || [];

          if (userAssets.length > 0) {
              // Loop through all assets returned from the API, not a hardcoded list.
              userAssets.forEach(asset => {
                  const div = document.createElement('div');
                  div.className = 'asset-item';
                  
                  const symbol = asset.symbol.toUpperCase();
                  const amount = asset.amount || 0;
                  
                  // Use a more robust rule for formatting decimal places.
                  const formattedAmount = parseFloat(amount).toFixed(symbol === 'BTC' || symbol === 'ETH' ? 8 : 2);

                  div.innerHTML = `<strong>${symbol}:</strong> ${formattedAmount}`;
                  assetsContainer.appendChild(div);
              });
          } else {
              // If the user has no assets, show a helpful message.
              assetsContainer.innerHTML = '<p class="info-text" style="padding: 10px 0;">No assets found in your portfolio.</p>';
          }
      }
      // =========================== ASSET DISPLAY LOGIC END (CORRECTED) ===========================

    } catch (err) {
      console.error('DASHBOARD.JS: Error loading user profile data:', err.message);
      const balanceEl = document.getElementById('availableBalance');
      const portfolioValueEl = document.getElementById('portfolioValue');
      if (balanceEl) balanceEl.textContent = '$ Error';
      if (portfolioValueEl) portfolioValueEl.textContent = '$ Error';

      if (err.message.toLowerCase().includes('auth error') || err.message.toLowerCase().includes('session expired') || err.message.toLowerCase().includes('invalid token')) {
         showModal('Session Issue', 'Your session may have expired or is invalid. Please <a href="login.html?action=relogin">log in again</a> to refresh your data.');
      } else {
         showModal('Profile Error', `Could not load your profile data: ${err.message}`);
      }
    }
  }

  // --- Load Active Investments ---
  async function loadActiveInvestments() {
    console.log("DASHBOARD.JS: Loading active investments...");
    const investmentDetailsContainers = document.querySelectorAll('.investment-details-container');
    investmentDetailsContainers.forEach(c => c.innerHTML = '<p class="loading-text"><small>Loading investments for this plan...</small></p>');

    if (!authToken) {
        console.error("DASHBOARD.JS: No auth token for loading investments.");
        investmentDetailsContainers.forEach(c => c.innerHTML = '<p class="error-text"><small>Authentication error. Cannot load investments.</small></p>');
        return;
    }

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
        console.log("DASHBOARD.JS: Data received from /investments:", data);

        if (data.success && Array.isArray(data.investments)) {
            document.querySelectorAll('.investment-options .investment-details-container').forEach(container => {
                container.innerHTML = '<p class="info-text"><small>No active investments in this specific plan.</small></p>';
            });

            if (data.investments.length > 0) {
                const displayableInvestments = data.investments.filter(inv =>
                    inv.status === 'active' || inv.status === 'matured'
                );

                displayableInvestments.forEach(inv => {
                    const planCard = document.querySelector(`.investment-options[data-plan-id="${inv.planId}"]`);
                    if (planCard) {
                        const container = planCard.querySelector('.investment-details-container');
                        if (container) {
                            if (container.querySelector('.info-text')) {
                                container.innerHTML = '';
                            }
                            const el = document.createElement('div');
                            el.className = 'investment-details-item';
                            const maturityDate = new Date(inv.maturityDate).toLocaleDateString();
                            const unlockDate = new Date(inv.withdrawalUnlockTime).toLocaleDateString();
                            const canWithdraw = (inv.status === 'active' || inv.status === 'matured') && new Date() >= new Date(inv.withdrawalUnlockTime);
                            
                            el.innerHTML = `
                            <p style="font-weight: bold; color: #333;">${inv.planName} (Status: <span class="status-${inv.status.toLowerCase()}">${inv.status}</span>)</p>
                            <p>Invested: <strong>$${parseFloat(inv.initialAmount).toFixed(2)}</strong></p>
                            <p>Current Value: <strong>$${parseFloat(inv.currentValue).toFixed(2)}</strong></p>
                            <p><small>Matures: ${maturityDate} | Unlocks for Withdrawal: ${unlockDate}</small></p>
                            ${canWithdraw ? 
                                `<button class="withdraw-btn-plan" data-investment-id="${inv._id}" style="background-color: #28a745; color:white; border:none; padding: 8px 12px; border-radius:4px; cursor:pointer;">Withdraw Funds</button>` :
                                `<small style="color: red; font-weight: bold;">Withdrawal Locked until ${unlockDate}</small>`
                            }
                            `;
                            container.appendChild(el);
                        }
                    } else {
                        console.warn(`DASHBOARD.JS: No HTML card found for planId "${inv.planId}" to display investment details.`);
                    }
                });
            }

            document.querySelectorAll('.withdraw-btn-plan').forEach(btn => {
                btn.removeEventListener('click', handlePlanWithdrawClick);
                btn.addEventListener('click', handlePlanWithdrawClick);
            });
        } else {
            const message = data.message || 'Could not retrieve investment data or data format is incorrect.';
            console.warn("DASHBOARD.JS: " + message, data);
            investmentDetailsContainers.forEach(c => c.innerHTML = `<p class="info-text"><small>${message}</small></p>`);
        }
    } catch (err) {
        console.error('DASHBOARD.JS: Exception while loading active investments:', err);
        investmentDetailsContainers.forEach(c => c.innerHTML = `<p class="error-text"><small>Error loading investments: ${err.message}</small></p>`);
    }
  }

  // --- Handle Investment Button Clicks ("Invest in X Plan") ---
  document.querySelectorAll('.invest-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const planId = btn.dataset.plan;
      const minAmount = parseFloat(btn.dataset.min);
      const maxAmount = parseFloat(btn.dataset.max);

      console.log(`DASHBOARD.JS: Invest button clicked for plan: ${planId}`);
      const amountString = prompt(`Enter amount to invest in ${planId} plan ($${minAmount} - $${maxAmount}):`);
      if (amountString === null) { console.log("DASHBOARD.JS: Investment cancelled by user."); return; }

      const investAmount = parseFloat(amountString);

      if (isNaN(investAmount) || investAmount < minAmount || investAmount > maxAmount) {
        alert(`Please enter a valid amount between $${minAmount} and $${maxAmount}.`);
        return;
      }

      console.log(`DASHBOARD.JS: Attempting to invest $${investAmount} in plan ${planId}`);
      showModal('Processing Investment...', 'Please wait while we set up your investment plan.');
      try {
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

        const data = await response.json();
        hideModal();

        if (!response.ok) {
            console.error("DASHBOARD.JS: Investment API call HTTP error.", {status: response.status, responseData: data});
            throw new Error(data.message || `Investment request failed with status ${response.status}.`);
        }
        if (!data.success) {
             console.error("DASHBOARD.JS: Investment API call returned success:false.", {responseData: data});
            throw new Error(data.message || "Investment processing failed on server.");
        }

        alert(data.message || 'Investment successful!');
        await fetchRealUserProfileData();
        await loadActiveInvestments();

      } catch(error) {
        hideModal();
        alert(`Investment Error: ${error.message}`);
        console.error("DASHBOARD.JS: Catch block for investment error:", error);
      }
    });
  });

  // --- Handle Plan Withdrawal Click (for individual investment plan withdrawals) ---
  async function handlePlanWithdrawClick(event) {
    const investmentId = event.target.dataset.investmentId;
    console.log(`DASHBOARD.JS: Withdraw button clicked for investment ID: ${investmentId}`);
    
    const withdrawalPin = prompt("Enter the 5-digit PIN to confirm withdrawal. If you don't know the PIN, please contact an administrator.");

    if (withdrawalPin === null) {
        console.log("DASHBOARD.JS: Withdrawal PIN entry cancelled by user.");
        return; 
    }

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

        if (!response.ok) {
             console.error("DASHBOARD.JS: Withdrawal API call HTTP error.", {status: response.status, responseData: data});
             throw new Error(data.message || `Withdrawal request failed with status ${response.status}.`);
        }
        if(!data.success) {
            console.error("DASHBOARD.JS: Withdrawal API call returned success:false.", {responseData: data});
            throw new Error(data.message || "Withdrawal processing failed by server.");
        }

        alert(data.message || "Withdrawal successful!");
        await fetchRealUserProfileData();
        await loadActiveInvestments();

    } catch (error) {
        hideModal();
        alert(`Withdrawal Error: ${error.message}`);
        console.error("DASHBOARD.JS: Catch block for withdrawal error:", error);
    }
  }

  // --- Chart.js Sample Data Initialization ---
  const portfolioCtx = document.getElementById('portfolioChart')?.getContext('2d');
  if (portfolioCtx) { 
    new Chart(portfolioCtx, { 
      type: 'line', 
      data: { labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May'], datasets: [{ label: 'Portfolio Value (Sample)', data: [100, 120, 110, 140, 130], tension: 0.1, borderColor: 'rgb(75, 192, 192)' }] }, 
      options: { responsive: true, maintainAspectRatio: false } 
    }); 
  }

  const marketTrendsCtx = document.getElementById('marketTrendsChart')?.getContext('2d');
  if (marketTrendsCtx) { 
    new Chart(marketTrendsCtx, { 
      type: 'bar', 
      data: { labels: ['BTC', 'ETH', 'SOL', 'ADA'], datasets: [{ label: 'Price Change (24h % Sample)', data: [1.5, -0.5, 3.0, 0.8], backgroundColor:['rgba(75, 192, 192, 0.6)','rgba(255, 99, 132, 0.6)','rgba(75, 192, 192, 0.6)','rgba(75, 192, 192, 0.6)'] }] }, 
      options: { responsive: true, maintainAspectRatio: false } 
    });
  }

  // --- Initial Dashboard Data Load ---
  async function initializeDashboard() {
    console.log("DASHBOARD.JS: Initializing dashboard data...");
    // Fetch data from the server
    await fetchRealUserProfileData(); 
    await loadActiveInvestments();

    // Once all data fetching is attempted, hide the loader and show the page
    const loadingSpinnerOverlay = document.querySelector('.loading-spinner-overlay');
    if (loadingSpinnerOverlay) {
        loadingSpinnerOverlay.style.display = 'none';
    }
    document.body.classList.remove('auth-loading'); 
    document.documentElement.style.visibility = 'visible';
    document.documentElement.style.opacity = '1';
    
    console.log("DASHBOARD.JS: Initial dashboard data load sequence complete.");
  }

  initializeDashboard();

});
// --- END OF dashboard.js (Corrected) ---