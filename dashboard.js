// --- START OF REWRITTEN dashboard.js ---
document.addEventListener('DOMContentLoaded', () => {
  console.log("DASHBOARD.JS: DOMContentLoaded");
  // Use the same key as auth.js and login.js for user info
  const USER_INFO_KEY_FOR_DASH = 'cryptohub_user_info'; 
  const AUTH_TOKEN_KEY_FOR_DASH = 'cryptohub_auth_token'; // For making authenticated API calls

  const userInfoString = localStorage.getItem(USER_INFO_KEY_FOR_DASH);
  const authToken = localStorage.getItem(AUTH_TOKEN_KEY_FOR_DASH);

  // Auth check: If auth.js didn't redirect, this is a secondary check.
  // auth.js's checkAuthState should be the primary guard.
  if (!authToken || !userInfoString) {
    console.warn("DASHBOARD.JS: Auth token or user info missing from localStorage. Redirecting to login.");
    // window.location.href = 'login.html'; // auth.js should handle this redirect.
    // If it reaches here, it means auth.js failed or this script ran before auth.js's redirect.
    return; // Stop further execution if essential auth info is missing
  }

  let user;
  try {
    user = JSON.parse(userInfoString);
  } catch (e) {
    console.error("DASHBOARD.JS: Failed to parse user info from localStorage. Redirecting.", e);
    // localStorage.removeItem(USER_INFO_KEY_FOR_DASH); // Clean up corrupted
    // localStorage.removeItem(AUTH_TOKEN_KEY_FOR_DASH);
    // window.location.href = 'login.html'; // auth.js should handle this.
    return;
  }

  // If user object doesn't have an ID (or essential property), treat as invalid.
  // Your backend user object has _id.
  if (!user || !user._id) { 
    console.error("DASHBOARD.JS: User info is invalid (missing _id). Redirecting.");
    // window.location.href = 'login.html'; // auth.js should handle this.
    return;
  }
  
  console.log("DASHBOARD.JS: User authenticated:", user.username || user.email);
  document.getElementById('userName').textContent = user.username || user.email || 'User';

  // API Base URL (ensure it's consistent if not set globally via window)
  const DASH_API_BASE_URL = window.API_BASE_URL || 'https://rapidcrypto-backend.onrender.com/api';

  // Mocked balances for now, replace with API calls
  const balances = JSON.parse(localStorage.getItem('cryptohub_balances_mock') || '{}');
  if (!balances[user._id]) { // Use user._id as key for consistency
    balances[user._id] = { USD: 10000, BTC: 0, ETH: 0, USDT: 0 }; // Preload test money
    localStorage.setItem('cryptohub_balances_mock', JSON.stringify(balances));
  }

  function renderAssets() {
    const container = document.getElementById('assetsList');
    if (!container) return;
    const userBalances = balances[user._id] || { USD: 0 }; // Fallback
    let totalUSD = 0;
    container.innerHTML = '';

    Object.entries(userBalances).forEach(([currency, amount]) => {
      const el = document.createElement('div');
      el.className = 'asset-item';
      // Ensure amount is a number before toFixed
      const numericAmount = parseFloat(amount);
      el.innerHTML = `<strong>${currency}:</strong> $${isNaN(numericAmount) ? '0.00' : numericAmount.toFixed(2)}`;
      container.appendChild(el);
      if (!isNaN(numericAmount)) totalUSD += numericAmount;
    });
    
    const balanceEl = document.querySelector('#availableBalance'); // Changed from .balance
    const portfolioValueEl = document.getElementById('portfolioValue');

    if (balanceEl) balanceEl.textContent = `$${totalUSD.toFixed(2)}`;
    if (portfolioValueEl) portfolioValueEl.textContent = `$${totalUSD.toFixed(2)}`;
  }

  renderAssets(); // Initial render

  // --- Investment Plan Data Fetch (Example) ---
  // This should fetch from your backend /api/investment-plans
  // The plan data is already in dashboard.html as data-attributes, but this shows API way
  async function fetchInvestmentPlans() {
      try {
          const response = await fetch(`${DASH_API_BASE_URL}/investment-plans`, {
              headers: { 'Authorization': `Bearer ${authToken}` }
          });
          if (!response.ok) throw new Error(`Failed to fetch plans: ${response.status}`);
          const data = await response.json();
          if (data.success && data.plans) {
              console.log("Fetched investment plans:", data.plans);
              // You could dynamically generate plan cards here if they weren't hardcoded
              // Or update existing cards with live data if needed
          } else {
            console.error("Failed to parse investment plans:", data.message);
          }
      } catch (error) {
          console.error("Error fetching investment plans:", error);
          // display error to user
      }
  }
  fetchInvestmentPlans(); // Fetch plans on load

  // --- Active Investments Fetch (Example) ---
  async function loadActiveInvestments() {
    const investmentDetailsContainers = document.querySelectorAll('.investment-details-container');
    investmentDetailsContainers.forEach(c => c.innerHTML = '<p>Loading active investments for this plan...</p>');
    
    try {
        const response = await fetch(`${DASH_API_BASE_URL}/investments`, { // Backend endpoint for user's investments
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${authToken}`,
                'Content-Type': 'application/json'
            }
        });
        if (!response.ok) {
            const errData = await response.json();
            throw new Error(errData.message || `Failed to fetch investments: ${response.status}`);
        }
        const data = await response.json();

        if (data.success && Array.isArray(data.investments)) {
            console.log("Active investments:", data.investments);
            investmentDetailsContainers.forEach(c => c.innerHTML = ''); // Clear loading message

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

            // Add event listeners for new withdraw buttons
            document.querySelectorAll('.withdraw-btn-plan').forEach(btn => {
                btn.addEventListener('click', handlePlanWithdrawClick);
            });

        } else {
            investmentDetailsContainers.forEach(c => c.innerHTML = '<p>No active investments in this plan or failed to load.</p>');
        }
    } catch (err) {
        console.error('Failed to load active investments:', err);
        investmentDetailsContainers.forEach(c => c.innerHTML = `<p style="color:red;">Error loading investments: ${err.message}</p>`);
    }
  }
  loadActiveInvestments();

  // --- Handle Investment Actions (Invest Button Clicks) ---
  document.querySelectorAll('.invest-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const planId = btn.dataset.plan; // e.g., "silver"
      // const profitRate = parseFloat(btn.dataset.profit); // Not needed if backend uses planId
      const minAmount = parseFloat(btn.dataset.min);
      const maxAmount = parseFloat(btn.dataset.max);
      
      const amountString = prompt(`Enter amount to invest in ${planId} plan ($${minAmount} - $${maxAmount}):`);
      if (!amountString) return; // User cancelled

      const investAmount = parseFloat(amountString);

      if (isNaN(investAmount) || investAmount < minAmount || investAmount > maxAmount) {
        return alert(`Please enter a valid amount between $${minAmount} and $${maxAmount}.`);
      }
      
      // TODO: Check against actual user balance from API, not mock
      // const currentBalance = parseFloat(document.getElementById('availableBalance').textContent.replace('$', ''));
      // if (investAmount > currentBalance) {
      //   return alert('❌ Insufficient balance. Please deposit first.');
      // }

      try {
        showModal('Processing Investment...', 'Please wait while we set up your investment.');
        const response = await fetch(`${DASH_API_BASE_URL}/investments`, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${authToken}`
           },
          body: JSON.stringify({
            planId: planId, // Send planId
            amount: investAmount
          })
        });
        const data = await response.json();
        hideModal();

        if (!response.ok || !data.success) {
            throw new Error(data.message || 'Investment failed.');
        }
        
        alert(data.message || 'Investment successful!');
        // TODO: Update user balance from data.newBalance
        // renderAssets(); // This would need to reflect new balance
        loadActiveInvestments(); // Refresh active investments list

      } catch(error) {
        hideModal();
        alert(`Error: ${error.message}`);
        console.error("Investment error:", error);
      }
    });
  });

  // --- Handle Plan Withdrawal Click ---
  async function handlePlanWithdrawClick(event) {
    const investmentId = event.target.dataset.investmentId;
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
            throw new Error(data.message || "Withdrawal failed.");
        }
        alert(data.message || "Withdrawal successful!");
        // TODO: Update balance from data.newBalance
        // renderAssets();
        loadActiveInvestments(); // Refresh list
    } catch (error) {
        hideModal();
        alert(`Error: ${error.message}`);
        console.error("Withdrawal error:", error);
    }
  }

  // --- Modal Functions (basic implementation) ---
  const modal = document.getElementById('appModal');
  const modalTitle = document.getElementById('modalTitle');
  const modalBody = document.getElementById('modalBody');
  const modalCloseBtn = document.getElementById('modalCloseBtn');
  
  function showModal(title, bodyContent = '', footerContent = '') {
      if (!modal || !modalTitle || !modalBody) return;
      modalTitle.textContent = title;
      if (typeof bodyContent === 'string') {
          modalBody.innerHTML = bodyContent; // Use innerHTML if bodyContent is HTML string
      } else if (bodyContent instanceof HTMLElement) {
          modalBody.innerHTML = ''; // Clear previous content
          modalBody.appendChild(bodyContent); // Append if it's a DOM element
      }
      // Handle footer similarly if needed
      modal.style.display = 'flex';
  }
  function hideModal() {
      if (modal) modal.style.display = 'none';
  }
  if (modalCloseBtn) modalCloseBtn.addEventListener('click', hideModal);
  // Optional: Close modal if clicking outside modal-content
  if (modal) {
    modal.addEventListener('click', (event) => {
        if (event.target === modal) { // Clicked on overlay
            hideModal();
        }
    });
  }
  
  // Example for Main Deposit/Withdraw buttons (needs further implementation)
  document.getElementById('mainDepositBtn')?.addEventListener('click', () => {
    showModal('Deposit Funds', '<p>Deposit functionality coming soon. Please use plan investments for now.</p>');
  });
  document.getElementById('mainWithdrawBtn')?.addEventListener('click', () => {
    showModal('Withdraw Funds', '<p>Withdrawal functionality for main balance coming soon. Withdraw from matured plans.</p>');
  });


  // --- Chart.js Examples (keep your existing chart logic or adapt) ---
  // Portfolio Chart
  const portfolioCtx = document.getElementById('portfolioChart')?.getContext('2d');
  if (portfolioCtx) {
    new Chart(portfolioCtx, {
      type: 'line',
      data: { labels: ['Jan', 'Feb', 'Mar', 'Apr'], datasets: [{ label: 'Portfolio Value', data: [65, 59, 80, 81], tension: 0.1 }] },
      options: { responsive: true, maintainAspectRatio: false }
    });
  }
  // Market Trends Chart
  const marketTrendsCtx = document.getElementById('marketTrendsChart')?.getContext('2d');
  if (marketTrendsCtx) {
    new Chart(marketTrendsCtx, {
      type: 'bar',
      data: { labels: ['BTC', 'ETH', 'SOL', 'DOGE'], datasets: [{ label: 'Price Change (24h %)', data: [2.5, -1.2, 5.0, 0.5], backgroundColor:['green','red','green','green'] }] },
      options: { responsive: true, maintainAspectRatio: false }
    });
  }

  // No explicit logout here as auth.js handles it via the button in the nav
});
// --- END OF REWRITTEN dashboard.js ---