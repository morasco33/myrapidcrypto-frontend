document.addEventListener('DOMContentLoaded', () => {
  console.log("Dashboard initialized");

  // Constants
  const USER_INFO_KEY = 'cryptohub_user_info';
  const AUTH_TOKEN_KEY = 'cryptohub_auth_token';
  const API_BASE_URL = window.API_BASE_URL || 'https://rapidcrypto-backend.onrender.com/api';

  // Authentication check
  const authToken = localStorage.getItem(AUTH_TOKEN_KEY);
  const userInfoString = localStorage.getItem(USER_INFO_KEY);

  if (!authToken || !userInfoString) {
    handleAuthError();
    return;
  }

  // Parse user info
  let user;
  try {
    user = JSON.parse(userInfoString);
    if (!user?._id) throw new Error("Invalid user data");
  } catch (e) {
    handleDataError();
    return;
  }

  // ----------------------------
  // CORE FUNCTIONS
  // ----------------------------

  async function fetchWithAuth(endpoint, method = 'GET', body = null) {
    const headers = {
      'Authorization': `Bearer ${authToken}`,
      'Content-Type': 'application/json'
    };

    const config = {
      method,
      headers,
      body: body ? JSON.stringify(body) : null
    };

    try {
      const response = await fetch(`${API_BASE_URL}${endpoint}`, config);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error(`API Error (${endpoint}):`, error);
      throw error;
    }
  }

  async function loadAssets() {
    try {
      const data = await fetchWithAuth('/users/balance');
      
      // Update balance displays
      document.getElementById('availableBalance').textContent = `$${data.balance.toFixed(2)}`;
      document.getElementById('portfolioValue').textContent = `$${data.balance.toFixed(2)}`;

      // Render asset list
      const container = document.getElementById('assetsList');
      container.innerHTML = '';
      
      // USD balance
      const usdEl = document.createElement('div');
      usdEl.className = 'asset-item';
      usdEl.innerHTML = `<strong>USD:</strong> $${data.balance.toFixed(2)}`;
      container.appendChild(usdEl);

      // Crypto assets
      if (data.assets?.length > 0) {
        data.assets.forEach(asset => {
          const el = document.createElement('div');
          el.className = 'asset-item';
          el.innerHTML = `<strong>${asset.symbol}:</strong> ${parseFloat(asset.amount).toFixed(8)}`;
          container.appendChild(el);
        });
      }
    } catch (error) {
      console.error('Asset load error:', error);
      document.getElementById('assetsList').innerHTML = `
        <div class="error">Failed to load assets. ${error.message}</div>
      `;
    }
  }

  async function loadActiveInvestments() {
    const containers = document.querySelectorAll('.investment-details-container');
    containers.forEach(c => c.innerHTML = '<div class="loading">Loading...</div>');

    try {
      const data = await fetchWithAuth('/users/investments');
      
      if (data.investments?.length > 0) {
        renderInvestments(data.investments);
      } else {
        containers.forEach(c => c.innerHTML = '<div class="empty">No active investments</div>');
      }
    } catch (error) {
      console.error('Investment load error:', error);
      containers.forEach(c => c.innerHTML = `
        <div class="error">Failed to load investments. ${error.message}</div>
      `);
    }
  }

  function renderInvestments(investments) {
    const containers = document.querySelectorAll('.investment-details-container');
    containers.forEach(c => c.innerHTML = '');

    investments.forEach(investment => {
      const container = document.querySelector(`[data-plan-id="${investment.planId}"] .investment-details-container`);
      if (!container) return;

      const canWithdraw = investment.status === 'active' && 
                        new Date() >= new Date(investment.withdrawalUnlockTime);

      container.innerHTML = `
        <div class="investment-details">
          <h4>${investment.planName}</h4>
          <p><strong>Invested:</strong> $${investment.initialAmount.toFixed(2)}</p>
          <p><strong>Current:</strong> $${investment.currentValue.toFixed(2)}</p>
          <p><strong>Status:</strong> <span class="status-${investment.status}">${investment.status}</span></p>
          <p><strong>Matures:</strong> ${new Date(investment.maturityDate).toLocaleDateString()}</p>
          ${canWithdraw ? 
            `<button class="withdraw-btn" data-investment-id="${investment._id}">Withdraw</button>` :
            `<small class="locked">Locked until ${new Date(investment.withdrawalUnlockTime).toLocaleDateString()}</small>`
          }
        </div>
      `;
    });

    // Add event listeners to new withdraw buttons
    document.querySelectorAll('.withdraw-btn').forEach(btn => {
      btn.addEventListener('click', handleWithdrawal);
    });
  }

  // ----------------------------
  // EVENT HANDLERS
  // ----------------------------

  async function handleInvestment(e) {
    const button = e.currentTarget;
    const planId = button.dataset.plan;
    const minAmount = parseFloat(button.dataset.min);
    const maxAmount = parseFloat(button.dataset.max);

    const amount = prompt(`Enter amount to invest ($${minAmount}-$${maxAmount}):`);
    if (!amount) return;

    const numericAmount = parseFloat(amount);
    if (isNaN(numericAmount) {
      alert("Please enter a valid number");
      return;
    }

    if (numericAmount < minAmount || numericAmount > maxAmount) {
      alert(`Amount must be between $${minAmount} and $${maxAmount}`);
      return;
    }

    try {
      showLoading("Creating investment...");
      
      const data = await fetchWithAuth('/investments/create', 'POST', {
        planId,
        amount: numericAmount
      });

      alert(`Success! ${data.message}`);
      await refreshDashboard();
    } catch (error) {
      alert(`Error: ${error.message}`);
    } finally {
      hideLoading();
    }
  }

  async function handleWithdrawal(e) {
    const investmentId = e.currentTarget.dataset.investmentId;
    const pin = prompt("Enter your 5-digit withdrawal PIN:");
    
    if (!pin || pin.length !== 5 || !/^\d+$/.test(pin)) {
      alert("Please enter a valid 5-digit PIN");
      return;
    }

    try {
      showLoading("Processing withdrawal...");
      
      const data = await fetchWithAuth(`/investments/${investmentId}/withdraw`, 'POST', {
        withdrawalPin: pin
      });

      alert(`Success! ${data.message}`);
      await refreshDashboard();
    } catch (error) {
      alert(`Error: ${error.message}`);
    } finally {
      hideLoading();
    }
  }

  // ----------------------------
  // UI HELPERS
  // ----------------------------

  function showLoading(message) {
    const modal = document.getElementById('loadingModal');
    if (modal) {
      document.getElementById('loadingMessage').textContent = message;
      modal.style.display = 'flex';
    }
  }

  function hideLoading() {
    const modal = document.getElementById('loadingModal');
    if (modal) modal.style.display = 'none';
  }

  function handleAuthError() {
    document.querySelector('main').innerHTML = `
      <div class="auth-error">
        <h1>Session Expired</h1>
        <p>Please <a href="login.html">login again</a> to continue.</p>
      </div>
    `;
    document.querySelector('.loading-spinner-overlay')?.remove();
  }

  function handleDataError() {
    document.querySelector('main').innerHTML = `
      <div class="data-error">
        <h1>Data Error</h1>
        <p>Invalid user data. Please <a href="login.html">login again</a>.</p>
      </div>
    `;
    document.querySelector('.loading-spinner-overlay')?.remove();
  }

  async function refreshDashboard() {
    await Promise.all([
      loadAssets(),
      loadActiveInvestments()
    ]);
  }

  function initializeCharts() {
    // Portfolio Chart
    const portfolioCtx = document.getElementById('portfolioChart');
    if (portfolioCtx) {
      new Chart(portfolioCtx.getContext('2d'), {
        type: 'line',
        data: {
          labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May'],
          datasets: [{
            label: 'Portfolio Value',
            data: [5000, 7500, 8200, 9300, 10500],
            borderColor: '#4CAF50',
            tension: 0.1
          }]
        },
        options: {
          responsive: true,
          plugins: { legend: { display: false } }
        }
      });
    }

    // Market Trends Chart
    const marketCtx = document.getElementById('marketTrendsChart');
    if (marketCtx) {
      new Chart(marketCtx.getContext('2d'), {
        type: 'bar',
        data: {
          labels: ['BTC', 'ETH', 'SOL', 'XRP'],
          datasets: [{
            label: '24h Change (%)',
            data: [2.5, -1.2, 5.0, 0.8],
            backgroundColor: ['#4CAF50', '#F44336', '#4CAF50', '#4CAF50']
          }]
        },
        options: {
          responsive: true,
          plugins: { legend: { display: false } }
        }
      });
    }
  }

  // ----------------------------
  // INITIALIZATION
  // ----------------------------

  // Set up event listeners
  document.querySelectorAll('.invest-btn').forEach(btn => {
    btn.addEventListener('click', handleInvestment);
  });

  // Quick action buttons
  document.getElementById('mainDepositBtn')?.addEventListener('click', () => {
    window.location.href = 'deposit.html';
  });

  document.getElementById('mainWithdrawBtn')?.addEventListener('click', () => {
    window.location.href = 'withdraw.html';
  });

  // Initialize dashboard
  async function initialize() {
    try {
      await refreshDashboard();
      initializeCharts();
      
      // Update user display
      const userNameEl = document.getElementById('userName');
      if (userNameEl) {
        userNameEl.textContent = user.username || user.email || 'User';
      }
    } catch (error) {
      console.error("Initialization error:", error);
    } finally {
      document.querySelector('.loading-spinner-overlay')?.remove();
    }
  }

  initialize();
});