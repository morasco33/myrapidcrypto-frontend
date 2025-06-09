// --- START OF SIMPLIFIED dashboard.js ---
document.addEventListener('DOMContentLoaded', () => {
  console.log("DASHBOARD.JS: DOMContentLoaded");

  const USER_INFO_KEY_FOR_DASH = 'cryptohub_user_info';
  const AUTH_TOKEN_KEY_FOR_DASH = 'cryptohub_auth_token';

  const authToken = localStorage.getItem(AUTH_TOKEN_KEY_FOR_DASH);
  const userInfoString = localStorage.getItem(USER_INFO_KEY_FOR_DASH);

  if (!authToken || !userInfoString) {
    console.error("DASHBOARD.JS: CRITICAL - Auth token or user info missing. Redirecting to login.");
    // This check is a safeguard; auth.js should ideally handle redirection.
    window.location.href = 'login.html?reason=session_expired';
    return;
  }

  let user;
  try {
    user = JSON.parse(userInfoString);
  } catch (e) {
    console.error("DASHBOARD.JS: CRITICAL - Failed to parse user info from localStorage.", e);
    const mainContent = document.querySelector('main');
    if (mainContent) mainContent.innerHTML = `<h1>Data Error</h1><p>Could not load user data. Please try <a href="login.html?action=relogin">logging in again</a>.</p>`;
    // Hide loading indicators, make page visible to show error
    document.body.classList.remove('auth-loading');
    document.documentElement.style.visibility = 'visible';
    document.documentElement.style.opacity = '1';
    return;
  }

  if (!user || !user._id) {
    console.error("DASHBOARD.JS: CRITICAL - User info object is invalid or missing essential ID.", user);
    const mainContent = document.querySelector('main');
    if (mainContent) mainContent.innerHTML = `<h1>User Data Error</h1><p>User information is incomplete. Please try <a href="login.html?action=relogin">logging in again</a>.</p>`;
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

  // --- Balance and Asset Rendering ---
  async function fetchRealUserProfileData() {
    console.log("DASHBOARD.JS: Fetching real user profile data...");
    try {
      const response = await fetch(`${DASH_API_BASE_URL}/profile`, { // Corrected endpoint
        headers: { Authorization: `Bearer ${authToken}` },
      });

      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.message || 'Failed to load user profile');
      }

      console.log("DASHBOARD.JS: User profile data received:", data.user);

      const fetchedUser = data.user;
      const balance = fetchedUser.balance || 0;
      const assets = fetchedUser.assets || [];

      // Update UI for Balance
      const balanceEl = document.getElementById('availableBalance');
      const portfolioValueEl = document.getElementById('portfolioValue'); // Assuming portfolio value is same as main balance for now
      if (balanceEl) balanceEl.textContent = `$${balance.toFixed(2)}`;
      if (portfolioValueEl) portfolioValueEl.textContent = `$${balance.toFixed(2)}`;

      // Update UI for Assets List
      const assetsContainer = document.getElementById('assetsList');
      if (assetsContainer) {
        assetsContainer.innerHTML = ''; // Clear previous assets
        if (assets.length > 0) {
          assets.forEach((asset) => {
            const div = document.createElement('div');
            div.className = 'asset-item';
            // Adjust how you want to display asset name vs symbol
            div.innerHTML = `<strong>${asset.symbol || asset.name}:</strong> ${asset.amount}`;
            assetsContainer.appendChild(div);
          });
        } else {
          assetsContainer.innerHTML = '<p>No other assets held.</p>';
        }
      }
      // Update user info in localStorage if needed (e.g., balance changes)
      // Be careful with this, as frequent updates might not be necessary if profile is always fetched
      // localStorage.setItem(USER_INFO_KEY_FOR_DASH, JSON.stringify(fetchedUser));


    } catch (err) {
      console.error('DASHBOARD.JS: Error loading user profile data:', err.message);
      const balanceEl = document.getElementById('availableBalance');
      const portfolioValueEl = document.getElementById('portfolioValue');
      if (balanceEl) balanceEl.textContent = '$?.??'; // Indicate error
      if (portfolioValueEl) portfolioValueEl.textContent = '$?.??';

      if (err.message.toLowerCase().includes('auth error') || err.message.toLowerCase().includes('session expired') || err.message.toLowerCase().includes('invalid token')) {
         showModal('Session Expired', 'Your session has expired. Please <a href="login.html?action=relogin">log in again</a>.');
         // Optionally, redirect after a delay or user action
      }
    }
  }

  // --- Active Investments Fetch ---
  async function loadActiveInvestments() {
    console.log("DASHBOARD.JS: Loading active investments...");
    const investmentDetailsContainers = document.querySelectorAll('.investment-details-container');
    investmentDetailsContainers.forEach(c => c.innerHTML = '<p class="loading-text">Loading active investments...</p>');

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
            console.log("DASHBOARD.JS: Active investments received:", data.investments);
            // Clear all existing investment details before rendering new ones
            investmentDetailsContainers.forEach(c => c.innerHTML = '');

            if (data.investments.length === 0) {
                // If there are plan cards, but no investments for THIS user, indicate it.
                // This message might appear in each plan card's detail area if no specific investments match.
                // Consider a general "No active investments found." message in a dedicated area if more appropriate.
                investmentDetailsContainers.forEach(c => c.innerHTML = '<p class="info-text">No active investments in this plan.</p>');
            } else {
                data.investments.forEach(inv => {
                    const planCard = document.querySelector(`.investment-options[data-plan-id="${inv.planId}"]`);
                    if (planCard) {
                        const container = planCard.querySelector('.investment-details-container');
                        if (container) {
                            // If this is the first investment for this plan card, clear the "No active investments" message.
                            if (container.querySelector('.info-text')) {
                                container.innerHTML = '';
                            }
                            const el = document.createElement('div');
                            el.className = 'investment-details-item'; // More specific class
                            el.innerHTML = `
                            <p><strong>${inv.planName}</strong></p>
                            <p>Invested: $${inv.initialAmount.toFixed(2)} | Current Value: $${inv.currentValue.toFixed(2)}</p>
                            <p>Status: <span class="status-${inv.status.toLowerCase()}">${inv.status}</span> | Matures: ${new Date(inv.maturityDate).toLocaleDateString()}</p>
                            ${
                            (inv.status === 'active' || inv.status === 'matured') && new Date() >= new Date(inv.withdrawalUnlockTime)
                            ? `<button class="withdraw-btn-plan" data-investment-id="${inv._id}">Withdraw Funds</button>`
                            : `<small>Withdrawal locked until ${new Date(inv.withdrawalUnlockTime).toLocaleDateString()}</small>`
                            }
                            `;
                            container.appendChild(el);
                        }
                    } else {
                        console.warn(`DASHBOARD.JS: No plan card found for planId "${inv.planId}" to display investment details.`);
                    }
                });
            }
            // Add event listeners to newly created withdraw buttons
            document.querySelectorAll('.withdraw-btn-plan').forEach(btn => {
                btn.removeEventListener('click', handlePlanWithdrawClick); // Remove old listener if any
                btn.addEventListener('click', handlePlanWithdrawClick);
            });
        } else {
            const message = data.message || 'No active investments or failed to load.';
            console.warn("DASHBOARD.JS: " + message, data);
            investmentDetailsContainers.forEach(c => c.innerHTML = `<p class="info-text">${message}</p>`);
        }
    } catch (err) {
        console.error('DASHBOARD.JS: Failed to load active investments:', err);
        investmentDetailsContainers.forEach(c => c.innerHTML = `<p class="error-text">Error loading investments: ${err.message}</p>`);
    }
  }

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
        // Refresh user balance and active investments
        await fetchRealUserProfileData();
        await loadActiveInvestments();

      } catch(error) {
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
    const withdrawalPin = prompt("Enter your 5-digit withdrawal PIN to confirm withdrawal:");

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

        if (!response.ok) {
             console.error("DASHBOARD.JS: Withdrawal API call HTTP error.", {status: response.status, responseData: data});
            throw new Error(data.message || `Withdrawal request failed with status ${response.status}.`);
        }
        if(!data.success) {
            console.error("DASHBOARD.JS: Withdrawal API call returned success:false.", {responseData: data});
            throw new Error(data.message || "Withdrawal processing failed on server.");
        }

        alert(data.message || "Withdrawal successful!");
        // Refresh user balance and active investments
        await fetchRealUserProfileData();
        await loadActiveInvestments();

    } catch (error) {
        hideModal();
        alert(`Withdrawal Error: ${error.message}`);
        console.error("DASHBOARD.JS: Catch block for withdrawal error:", error);
    }
  }

  // --- Chart.js Examples (Keep as is or adapt with real data later) ---
  const portfolioCtx = document.getElementById('portfolioChart')?.getContext('2d');
  if (portfolioCtx) { new Chart(portfolioCtx, { type: 'line', data: { labels: ['Jan', 'Feb', 'Mar', 'Apr'], datasets: [{ label: 'Portfolio Value (Sample)', data: [65, 59, 80, 81], tension: 0.1 }] }, options: { responsive: true, maintainAspectRatio: false } }); }

  const marketTrendsCtx = document.getElementById('marketTrendsChart')?.getContext('2d');
  if (marketTrendsCtx) { new Chart(marketTrendsCtx, { type: 'bar', data: { labels: ['BTC', 'ETH', 'SOL', 'DOGE'], datasets: [{ label: 'Price Change (24h % Sample)', data: [2.5, -1.2, 5.0, 0.5], backgroundColor:['green','red','green','green'] }] }, options: { responsive: true, maintainAspectRatio: false } });}

  // --- Initial Data Load ---
  async function initializeDashboard() {
    await fetchRealUserProfileData(); // Fetch balance and assets
    await loadActiveInvestments(); // Fetch active investment plans

    // Remove loading spinner and show page content once data is loaded or attempted
    const loadingSpinnerOverlay = document.querySelector('.loading-spinner-overlay');
    if (loadingSpinnerOverlay) loadingSpinnerOverlay.style.display = 'none';
    document.body.classList.remove('auth-loading');
    document.documentElement.style.visibility = 'visible';
    document.documentElement.style.opacity = '1';
    console.log("DASHBOARD.JS: Initial data load complete.");
  }

  initializeDashboard();

});
// --- END OF SIMPLIFIED dashboard.js ---