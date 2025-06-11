// --- START OF dashboard.js (Full Version with Modified PIN Prompt) ---
document.addEventListener('DOMContentLoaded', () => {
  console.log("DASHBOARD.JS: DOMContentLoaded");

  const USER_INFO_KEY_FOR_DASH = 'cryptohub_user_info';
  const AUTH_TOKEN_KEY_FOR_DASH = 'cryptohub_auth_token';

  const authToken = localStorage.getItem(AUTH_TOKEN_KEY_FOR_DASH);
  const userInfoString = localStorage.getItem(USER_INFO_KEY_FOR_DASH);

  if (!authToken || !userInfoString) {
    console.error("DASHBOARD.JS: CRITICAL - Auth token or user info missing. Redirecting to login.");
    // This redirect should ideally be handled by auth.js or inline scripts,
    // but as a fallback if user lands here without auth.
    window.location.href = 'login.html?reason=session_expired_dashboard_check';
    return;
  }

  let user;
  try {
    user = JSON.parse(userInfoString);
  } catch (e) {
    console.error("DASHBOARD.JS: CRITICAL - Failed to parse user info from localStorage.", e);
    const mainContent = document.querySelector('main');
    if (mainContent) mainContent.innerHTML = `<h1>Data Error</h1><p>Could not load user data. Please try <a href="login.html?action=relogin">logging in again</a>.</p>`;
    // Clean up loading state if this error occurs after DOM is partially ready
    const loadingSpinnerOverlay = document.querySelector('.loading-spinner-overlay');
    if (loadingSpinnerOverlay) loadingSpinnerOverlay.style.display = 'none';
    document.body.classList.remove('auth-loading');
    document.documentElement.style.visibility = 'visible';
    document.documentElement.style.opacity = '1';
    return;
  }

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
      // Assuming you have CSS to show the modal when 'active' class is present
      // If not, use: modal.style.display = 'flex';
      if (modal) modal.style.display = 'flex'; // More direct way if no active class CSS
  }
  function hideModal() {
      // if (modal) modal.classList.remove('active');
      if (modal) modal.style.display = 'none'; // More direct way
  }
  if (modalCloseBtn) modalCloseBtn.addEventListener('click', hideModal);
  if (modal) {
    modal.addEventListener('click', (event) => {
        if (event.target === modal) { hideModal(); }
    });
  }

  // --- Event Listeners for Quick Actions (Deposit/Withdraw main balance) ---
  const mainDepositButton = document.getElementById('mainDepositBtn');
  if (mainDepositButton) {
    mainDepositButton.addEventListener('click', () => {
      console.log('DASHBOARD.JS: Main Deposit Button Clicked');
      // Replace with actual navigation or modal for deposit
      // window.location.href = 'deposit.html'; 
      showModal('Deposit Funds', '<p>Main balance deposit functionality is under development. Please use plan investments.</p>');
    });
  } else {
      console.warn('DASHBOARD.JS: mainDepositBtn not found.');
  }

  const mainWithdrawButton = document.getElementById('mainWithdrawBtn');
  if (mainWithdrawButton) {
    mainWithdrawButton.addEventListener('click', () => {
      console.log('DASHBOARD.JS: Main Withdraw Button Clicked');
      // Replace with actual navigation or modal for withdrawal
      // window.location.href = 'withdraw.html';
      showModal('Withdraw Funds', '<p>Main balance withdrawal functionality is under development. You can withdraw from matured/unlocked investment plans.</p>');
    });
  } else {
      console.warn('DASHBOARD.JS: mainWithdrawBtn not found.');
  }

  // --- Fetch Real User Profile Data (Balance, Assets) ---
  async function fetchRealUserProfileData() {
    console.log("DASHBOARD.JS: Fetching real user profile data...");
    if (!authToken) {
        console.error("DASHBOARD.JS: No auth token available for fetching profile.");
        // Potentially show an error or prompt re-login
        showModal('Error', 'Session data missing. Cannot load profile. Please try logging in again.');
        return;
    }
    try {
      const response = await fetch(`${DASH_API_BASE_URL}/profile`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });

      const data = await response.json();
      if (!response.ok) { // Check HTTP status code
        throw new Error(data.message || `Failed to load user profile (HTTP ${response.status})`);
      }
      if(!data.success) { // Check success flag in payload
        throw new Error(data.message || 'Failed to load user profile (API Error)');
      }


      console.log("DASHBOARD.JS: User profile data received:", data.user);

      const fetchedUser = data.user;
      const balance = fetchedUser.balance !== undefined ? fetchedUser.balance : 0; // Default to 0 if undefined
      const assets = fetchedUser.assets || []; 

      const balanceEl = document.getElementById('availableBalance');
      const portfolioValueEl = document.getElementById('portfolioValue'); // Assuming portfolio value is same as main balance for now
      
      if (balanceEl) balanceEl.textContent = `$${parseFloat(balance).toFixed(2)}`;
      if (portfolioValueEl) portfolioValueEl.textContent = `$${parseFloat(balance).toFixed(2)}`;

      const assetsContainer = document.getElementById('assetsList');
      if (assetsContainer) {
        assetsContainer.innerHTML = ''; // Clear previous
        if (assets.length > 0) {
          assets.forEach((asset) => {
            const div = document.createElement('div');
            div.className = 'asset-item'; // For styling
            const amount = parseFloat(asset.amount);
            div.innerHTML = `<strong>${asset.symbol || asset.name}:</strong> ${isNaN(amount) ? 'N/A' : amount.toFixed(asset.symbol === 'BTC' || asset.symbol === 'ETH' ? 8 : 2)}`; // More precision for BTC/ETH
            assetsContainer.appendChild(div);
          });
        } else {
          assetsContainer.innerHTML = '<p><small>No distinct crypto assets recorded.</small></p>';
        }
      }
    } catch (err) {
      console.error('DASHBOARD.JS: Error loading user profile data:', err.message);
      const balanceEl = document.getElementById('availableBalance');
      const portfolioValueEl = document.getElementById('portfolioValue');
      if (balanceEl) balanceEl.textContent = '$ Error';
      if (portfolioValueEl) portfolioValueEl.textContent = '$ Error';

      // If auth related error, guide user to re-login
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
            // Default message for all plan containers if no specific investments are found for them
            document.querySelectorAll('.investment-options .investment-details-container').forEach(container => {
                container.innerHTML = '<p class="info-text"><small>No active investments in this specific plan.</small></p>';
            });

            if (data.investments.length > 0) {
                data.investments.forEach(inv => {
                    const planCard = document.querySelector(`.investment-options[data-plan-id="${inv.planId}"]`);
                    if (planCard) {
                        const container = planCard.querySelector('.investment-details-container');
                        if (container) {
                            // Clear default "No active..." message for this specific plan if we have an investment for it
                            if (container.querySelector('.info-text')) {
                                container.innerHTML = '';
                            }
                            const el = document.createElement('div');
                            el.className = 'investment-details-item'; // Use a distinct class
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
                                ( (inv.status === 'active' || inv.status === 'matured') ? `<small style="color: #orange;">Withdrawal Locked until ${unlockDate}</small>` : '<small>This investment is not currently withdrawable.</small>')
                            }
                            `; // Added some styling to button
                            container.appendChild(el);
                        }
                    } else {
                        console.warn(`DASHBOARD.JS: No HTML card found for planId "${inv.planId}" to display investment details.`);
                    }
                });
            }
            // else, the default "No active investments in this specific plan." message remains for plans without investments.

            // Re-attach event listeners for withdraw buttons (important if list is rebuilt)
            document.querySelectorAll('.withdraw-btn-plan').forEach(btn => {
                btn.removeEventListener('click', handlePlanWithdrawClick); // Remove old listener first
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
        // After successful investment, refresh user profile (for balance) and investments list
        if (typeof fetchRealUserProfileData === 'function') await fetchRealUserProfileData();
        if (typeof loadActiveInvestments === 'function') await loadActiveInvestments();

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

  // --- ✨ MODIFIED: Handle Plan Withdrawal Click (for individual investment plan withdrawals) ---
  async function handlePlanWithdrawClick(event) {
    const investmentId = event.target.dataset.investmentId;
    console.log(`DASHBOARD.JS: Withdraw button clicked for investment ID: ${investmentId}`);
    
    // Updated prompt message
    const withdrawalPin = prompt("Enter the 5-digit PIN to confirm withdrawal. If you don't know the PIN, please contact an administrator.");

    if (withdrawalPin === null) { // User clicked cancel on the prompt
        console.log("DASHBOARD.JS: Withdrawal PIN entry cancelled by user.");
        return; 
    }

    if (!/^\d{5}$/.test(withdrawalPin)) { // Basic check for 5 digits
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
            body: JSON.stringify({ withdrawalPin }) // Send the entered PIN
        });
        const data = await response.json(); // Always attempt to parse response
        hideModal();

        if (!response.ok) {
             console.error("DASHBOARD.JS: Withdrawal API call HTTP error.", {status: response.status, responseData: data});
             throw new Error(data.message || `Withdrawal request failed with status ${response.status}.`);
        }
        if(!data.success) { // Check for success:false in payload
            console.error("DASHBOARD.JS: Withdrawal API call returned success:false.", {responseData: data});
            throw new Error(data.message || "Withdrawal processing failed by server.");
        }

        alert(data.message || "Withdrawal successful!");
        // After successful withdrawal, refresh user profile (for balance) and investments list
        if (typeof fetchRealUserProfileData === 'function') await fetchRealUserProfileData();
        if (typeof loadActiveInvestments === 'function') await loadActiveInvestments();

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
    // Fetch profile first, then investments, as investments might depend on user context
    await fetchRealUserProfileData(); 
    await loadActiveInvestments();

    // Remove loading overlay once initial data fetches are attempted
    // This should happen after auth.js has already made the page visible if auth is okay.
    const loadingSpinnerOverlay = document.querySelector('.loading-spinner-overlay');
    if (loadingSpinnerOverlay) {
        console.log("DASHBOARD.JS: Hiding loading spinner after initial data load attempt.");
        loadingSpinnerOverlay.style.display = 'none';
    }
    // Ensure body class is removed if auth.js didn't catch it for some reason
    document.body.classList.remove('auth-loading'); 
    // Ensure html is visible (should be handled by inline script or auth.js)
    document.documentElement.style.visibility = 'visible';
    document.documentElement.style.opacity = '1';
    
    console.log("DASHBOARD.JS: Initial dashboard data load sequence complete.");
  }

  // Call the initialization sequence
  initializeDashboard();

});
// --- END OF dashboard.js (Full Version with Modified PIN Prompt) ---