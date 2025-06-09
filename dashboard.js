document.addEventListener('DOMContentLoaded', () => {
  console.log("DASHBOARD.JS: DOMContentLoaded");

  // Constants for localStorage keys
  const USER_INFO_KEY = 'cryptohub_user_info'; 
  const AUTH_TOKEN_KEY = 'cryptohub_auth_token'; 

  // Retrieve auth token and user info
  const authToken = localStorage.getItem(AUTH_TOKEN_KEY);
  const userInfoString = localStorage.getItem(USER_INFO_KEY);

  // Authentication check
  if (!authToken || !userInfoString) {
    console.error("CRITICAL: Auth token or user info missing");
    const mainContent = document.querySelector('main');
    if (mainContent) {
      mainContent.innerHTML = `
        <div class="auth-error">
          <h1>Authentication Error</h1>
          <p>Could not load dashboard. Please <a href="login.html">login again</a>.</p>
        </div>
      `;
    }
    document.querySelector('.loading-spinner-overlay')?.remove();
    document.body.classList.remove('auth-loading');
    return;
  }

  // Parse user info
  let user;
  try {
    user = JSON.parse(userInfoString);
    if (!user?._id) throw new Error("Invalid user data");
  } catch (e) {
    console.error("Failed to parse user info:", e);
    document.querySelector('main').innerHTML = `
      <div class="data-error">
        <h1>Data Error</h1>
        <p>Invalid user data. Please <a href="login.html">login again</a>.</p>
      </div>
    `;
    return;
  }

  // API Configuration
  const API_BASE_URL = window.API_BASE_URL || 'https://rapidcrypto-backend.onrender.com/api';

  // UI Elements
  const userNameEl = document.getElementById('userName');
  if (userNameEl) {
    userNameEl.textContent = user.username || user.email || 'User';
  }

  // ----------------------------
  // MODAL SYSTEM
  // ----------------------------
  const modal = document.getElementById('appModal');
  const modalTitle = document.getElementById('modalTitle');
  const modalBody = document.getElementById('modalBody');

  function showModal(title, content = '') {
    if (!modal || !modalTitle || !modalBody) return;
    modalTitle.textContent = title;
    modalBody.innerHTML = content;
    modal.classList.add('active');
  }

  function hideModal() {
    modal?.classList.remove('active');
  }

  document.getElementById('modalCloseBtn')?.addEventListener('click', hideModal);
  modal?.addEventListener('click', (e) => {
    if (e.target === modal) hideModal();
  });

  // ----------------------------
  // QUICK ACTION BUTTONS
  // ----------------------------
  document.getElementById('mainDepositBtn')?.addEventListener('click', () => {
    window.location.href = 'deposit.html';
  });

  document.getElementById('mainWithdrawBtn')?.addEventListener('click', () => {
    window.location.href = 'withdraw.html';
  });

  // ----------------------------
  // ASSET MANAGEMENT
  // ----------------------------
  async function loadAssets() {
    try {
      const response = await fetch(`${API_BASE_URL}/user/profile`, {
        headers: { Authorization: `Bearer ${authToken}` }
      });

      if (!response.ok) throw new Error('Failed to fetch assets');
      
      const { success, user: userData } = await response.json();
      if (!success) throw new Error('Invalid response');

      // Update balance displays
      const balance = userData.balance || 0;
      document.getElementById('availableBalance').textContent = `$${balance.toFixed(2)}`;
      document.getElementById('portfolioValue').textContent = `$${balance.toFixed(2)}`;

      // Render asset list
      const container = document.getElementById('assetsList');
      if (container) {
        container.innerHTML = '';
        
        // Always show USD balance
        const usdEl = document.createElement('div');
        usdEl.className = 'asset-item';
        usdEl.innerHTML = `<strong>USD:</strong> $${balance.toFixed(2)}`;
        container.appendChild(usdEl);

        // Show other assets if available
        if (userData.assets?.length > 0) {
          userData.assets.forEach(asset => {
            const el = document.createElement('div');
            el.className = 'asset-item';
            el.innerHTML = `<strong>${asset.symbol}:</strong> ${parseFloat(asset.amount).toFixed(8)}`;
            container.appendChild(el);
          });
        }
      }
    } catch (error) {
      console.error('Error loading assets:', error);
      document.getElementById('assetsList').innerHTML = `
        <div class="error-message">Failed to load assets. Please try again later.</div>
      `;
    }
  }

  // ----------------------------
  // INVESTMENT SYSTEM
  // ----------------------------
  async function loadActiveInvestments() {
    const containers = document.querySelectorAll('.investment-details-container');
    containers.forEach(c => c.innerHTML = '<p>Loading investments...</p>');

    try {
      const response = await fetch(`${API_BASE_URL}/investments`, {
        headers: { Authorization: `Bearer ${authToken}` }
      });

      if (!response.ok) throw new Error('Failed to fetch investments');
      
      const { success, investments } = await response.json();
      if (!success) throw new Error('Invalid response');

      containers.forEach(c => c.innerHTML = '');

      if (investments?.length > 0) {
        investments.forEach(investment => {
          const container = document.querySelector(`[data-plan-id="${investment.planId}"] .investment-details-container`);
          if (container) {
            const canWithdraw = investment.status === 'active' && 
                              new Date() >= new Date(investment.withdrawalUnlockTime);

            container.innerHTML = `
              <div class="investment-details">
                <p><strong>${investment.planName}</strong></p>
                <p>Amount: $${investment.initialAmount.toFixed(2)}</p>
                <p>Current: $${investment.currentValue.toFixed(2)}</p>
                <p>Status: ${investment.status}</p>
                <p>Matures: ${new Date(investment.maturityDate).toLocaleDateString()}</p>
                ${canWithdraw 
                  ? `<button class="withdraw-btn-plan" data-investment-id="${investment._id}">Withdraw</button>`
                  : `<small>Locked until ${new Date(investment.withdrawalUnlockTime).toLocaleDateString()}</small>`
                }
              </div>
            `;
          }
        });

        // Add event listeners to new withdraw buttons
        document.querySelectorAll('.withdraw-btn-plan').forEach(btn => {
          btn.addEventListener('click', handleWithdrawal);
        });
      } else {
        containers.forEach(c => c.innerHTML = '<p>No active investments found.</p>');
      }
    } catch (error) {
      console.error('Error loading investments:', error);
      containers.forEach(c => c.innerHTML = `
        <div class="error-message">Failed to load investments: ${error.message}</div>
      `);
    }
  }

  // Investment button handler
  document.querySelectorAll('.invest-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const planId = btn.dataset.plan;
      const minAmount = parseFloat(btn.dataset.min);
      const maxAmount = parseFloat(btn.dataset.max);

      const amount = prompt(`Enter amount ($${minAmount}-$${maxAmount}):`);
      if (!amount) return;

      const numericAmount = parseFloat(amount);
      if (isNaN(numericAmount) || numericAmount < minAmount || numericAmount > maxAmount) {
        alert(`Please enter amount between $${minAmount} and $${maxAmount}`);
        return;
      }

      try {
        showModal('Processing', 'Creating your investment...');
        
        const response = await fetch(`${API_BASE_URL}/investments`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${authToken}`
          },
          body: JSON.stringify({
            planId,
            amount: numericAmount
          })
        });

        const data = await response.json();
        if (!response.ok || !data.success) {
          throw new Error(data.message || 'Investment failed');
        }

        alert('Investment created successfully!');
        await Promise.all([loadAssets(), loadActiveInvestments()]);
      } catch (error) {
        alert(`Investment error: ${error.message}`);
        console.error('Investment error:', error);
      } finally {
        hideModal();
      }
    });
  });

  // Withdrawal handler
  async function handleWithdrawal(event) {
    const investmentId = event.target.dataset.investmentId;
    const pin = prompt('Enter your 5-digit withdrawal PIN:');
    
    if (!pin || !/^\d{5}$/.test(pin)) {
      alert('Please enter a valid 5-digit PIN');
      return;
    }

    try {
      showModal('Processing', 'Processing withdrawal...');
      
      const response = await fetch(`${API_BASE_URL}/investments/${investmentId}/withdraw`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({ withdrawalPin: pin })
      });

      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.message || 'Withdrawal failed');
      }

      alert('Withdrawal successful!');
      await Promise.all([loadAssets(), loadActiveInvestments()]);
    } catch (error) {
      alert(`Withdrawal error: ${error.message}`);
      console.error('Withdrawal error:', error);
    } finally {
      hideModal();
    }
  }

  // ----------------------------
  // MARKET TRENDS CHARTS
  // ----------------------------
  function initializeCharts() {
    // Portfolio Chart
    const portfolioCtx = document.getElementById('portfolioChart')?.getContext('2d');
    if (portfolioCtx) {
      new Chart(portfolioCtx, {
        type: 'line',
        data: {
          labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
          datasets: [{
            label: 'Portfolio Value',
            data: [5000, 7500, 8200, 9300, 10500, 12000],
            borderColor: '#4CAF50',
            tension: 0.1,
            fill: true
          }]
        },
        options: {
          responsive: true,
          plugins: {
            legend: { display: false }
          }
        }
      });
    }

    // Market Trends Chart
    const marketCtx = document.getElementById('marketTrendsChart')?.getContext('2d');
    if (marketCtx) {
      new Chart(marketCtx, {
        type: 'bar',
        data: {
          labels: ['BTC', 'ETH', 'SOL', 'XRP', 'ADA'],
          datasets: [{
            label: '24h Change (%)',
            data: [2.5, -1.2, 5.0, 0.8, -0.5],
            backgroundColor: [
              '#4CAF50', '#F44336', '#4CAF50', '#4CAF50', '#F44336'
            ]
          }]
        },
        options: {
          responsive: true,
          plugins: {
            legend: { display: false }
          },
          scales: {
            y: {
              beginAtZero: true
            }
          }
        }
      });
    }
  }

  // ----------------------------
  // INITIALIZE DASHBOARD
  // ----------------------------
  async function initializeDashboard() {
    try {
      await Promise.all([
        loadAssets(),
        loadActiveInvestments()
      ]);
      initializeCharts();
    } catch (error) {
      console.error('Dashboard initialization error:', error);
    } finally {
      // Remove loading spinner
      document.querySelector('.loading-spinner-overlay')?.remove();
      document.body.classList.remove('auth-loading');
    }
  }

  initializeDashboard();
});