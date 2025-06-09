// --- START OF UPDATED dashboard.js ---
document.addEventListener('DOMContentLoaded', () => {
    console.log("DASHBOARD.JS: DOMContentLoaded");
  
    const USER_INFO_KEY_FOR_DASH = 'cryptohub_user_info'; 
    const AUTH_TOKEN_KEY_FOR_DASH = 'cryptohub_auth_token'; 
  
    const authToken = localStorage.getItem(AUTH_TOKEN_KEY_FOR_DASH);
    const userInfoString = localStorage.getItem(USER_INFO_KEY_FOR_DASH);
  
    if (!authToken || !userInfoString) {
      const mainContent = document.querySelector('main');
      if (mainContent) {
        mainContent.innerHTML = `<h1>Authentication Error</h1><p>Please <a href="login.html">log in again</a>.</p>`;
      }
      document.body.classList.remove('auth-loading');
      document.documentElement.style.visibility = 'visible';
      document.documentElement.style.opacity = '1';
      return;
    }
  
    let user;
    try {
      user = JSON.parse(userInfoString);
    } catch (e) {
      const mainContent = document.querySelector('main');
      if (mainContent) {
        mainContent.innerHTML = `<h1>Data Error</h1><p>User data corrupted. Please <a href="login.html">log in again</a>.</p>`;
      }
      document.body.classList.remove('auth-loading');
      document.documentElement.style.visibility = 'visible';
      document.documentElement.style.opacity = '1';
      return;
    }
  
    if (!user || !user._id) {
      const mainContent = document.querySelector('main');
      if (mainContent) {
        mainContent.innerHTML = `<h1>User Data Error</h1><p>Invalid user data. Please <a href="login.html">log in again</a>.</p>`;
      }
      document.body.classList.remove('auth-loading');
      document.documentElement.style.visibility = 'visible';
      document.documentElement.style.opacity = '1';
      return;
    }
  
    const userNameEl = document.getElementById('userName');
    if (userNameEl) {
      userNameEl.textContent = user.username || user.email || 'User';
    }
  
    const DASH_API_BASE_URL = window.API_BASE_URL || 'https://rapidcrypto-backend.onrender.com/api';
  
    // --- Fetch Real Wallet Balance ---
    async function fetchAndRenderBalance() {
      try {
        const response = await fetch(`${DASH_API_BASE_URL}/wallet/balance`, {
          headers: { 'Authorization': `Bearer ${authToken}` }
        });
        const data = await response.json();
  
        if (!response.ok || !data.success || typeof data.balance !== 'number') {
          console.warn("Failed to get real balance. Showing $0.00");
          updateBalanceUI(0);
          return;
        }
  
        updateBalanceUI(data.balance);
      } catch (err) {
        console.error("Error fetching balance:", err);
        updateBalanceUI(0);
      }
    }
  
    function updateBalanceUI(usdBalance) {
      const balanceEl = document.getElementById('availableBalance');
      const portfolioValueEl = document.getElementById('portfolioValue');
  
      if (balanceEl) balanceEl.textContent = `$${usdBalance.toFixed(2)}`;
      if (portfolioValueEl) portfolioValueEl.textContent = `$${usdBalance.toFixed(2)}`;
    }
  
    fetchAndRenderBalance();
  
    // --- Modal Functions ---
    const modal = document.getElementById('appModal');
    const modalTitle = document.getElementById('modalTitle');
    const modalBody = document.getElementById('modalBody');
    const modalCloseBtn = document.getElementById('modalCloseBtn');
  
    function showModal(title, bodyContent = '', footerContent = '') {
      if (!modal || !modalTitle || !modalBody) return;
      modalTitle.textContent = title;
      modalBody.innerHTML = typeof bodyContent === 'string' ? bodyContent : '';
      modal.style.display = 'flex';
    }
  
    function hideModal() {
      if (modal) modal.style.display = 'none';
    }
  
    if (modalCloseBtn) modalCloseBtn.addEventListener('click', hideModal);
    if (modal) {
      modal.addEventListener('click', (event) => {
        if (event.target === modal) hideModal();
      });
    }
  
    // --- Deposit & Withdraw Buttons ---
    const mainDepositButton = document.getElementById('mainDepositBtn');
    if (mainDepositButton) {
      mainDepositButton.addEventListener('click', () => {
        showModal('Deposit Funds', '<p>Deposit functionality coming soon.</p>');
      });
    }
  
    const mainWithdrawButton = document.getElementById('mainWithdrawBtn');
    if (mainWithdrawButton) {
      mainWithdrawButton.addEventListener('click', () => {
        showModal('Withdraw Funds', '<p>Withdrawal functionality coming soon.</p>');
      });
    }
  
    // --- Investment Plans ---
    async function fetchInvestmentPlans() {
      try {
        const response = await fetch(`${DASH_API_BASE_URL}/investment-plans`, {
          headers: { 'Authorization': `Bearer ${authToken}` }
        });
        const data = await response.json();
        if (data.success && data.plans) {
          console.log("Fetched plans:", data.plans);
        } else {
          console.error("Failed to load plans:", data.message);
        }
      } catch (err) {
        console.error("Error fetching plans:", err);
      }
    }
  
    fetchInvestmentPlans();
  
    // --- Load Active Investments ---
    async function loadActiveInvestments() {
      const containers = document.querySelectorAll('.investment-details-container');
      containers.forEach(c => c.innerHTML = 'Loading...');
  
      try {
        const response = await fetch(`${DASH_API_BASE_URL}/investments`, {
          headers: {
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json'
          }
        });
        const data = await response.json();
  
        if (!response.ok || !data.success) throw new Error(data.message);
  
        containers.forEach(c => c.innerHTML = '');
        data.investments.forEach(inv => {
          const planCard = document.querySelector(`.investment-options[data-plan-id="${inv.planId}"]`);
          if (planCard) {
            const container = planCard.querySelector('.investment-details-container');
            if (container) {
              const el = document.createElement('div');
              el.className = 'investment-details';
              el.innerHTML = `
                <p><strong>${inv.planName}</strong></p>
                <p>Invested: $${inv.initialAmount.toFixed(2)} | Current: $${inv.currentValue.toFixed(2)}</p>
                <p>Status: ${inv.status} | Matures: ${new Date(inv.maturityDate).toLocaleDateString()}</p>
              `;
              container.appendChild(el);
            }
          }
        });
      } catch (err) {
        containers.forEach(c => c.innerHTML = `<p style="color:red;">${err.message}</p>`);
      }
    }
  
    loadActiveInvestments();
  
    // --- Handle Investments ---
    document.querySelectorAll('.invest-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const planId = btn.dataset.plan;
        const min = parseFloat(btn.dataset.min);
        const max = parseFloat(btn.dataset.max);
        const input = prompt(`Enter amount to invest ($${min} - $${max}):`);
        const amount = parseFloat(input);
  
        if (isNaN(amount) || amount < min || amount > max) {
          alert(`Amount must be between $${min} and $${max}`);
          return;
        }
  
        showModal('Processing...', 'Please wait...');
        try {
          const res = await fetch(`${DASH_API_BASE_URL}/investments`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${authToken}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ planId, amount })
          });
          const data = await res.json();
          hideModal();
  
          if (!res.ok || !data.success) throw new Error(data.message);
          alert(data.message || 'Investment successful!');
          fetchAndRenderBalance();
          loadActiveInvestments();
        } catch (err) {
          hideModal();
          alert(`Investment failed: ${err.message}`);
        }
      });
    });
  
    // --- Chart Setup (Optional) ---
    const portfolioCtx = document.getElementById('portfolioChart')?.getContext('2d');
    if (portfolioCtx) {
      new Chart(portfolioCtx, {
        type: 'line',
        data: {
          labels: ['Jan', 'Feb', 'Mar', 'Apr'],
          datasets: [{
            label: 'Portfolio Value',
            data: [65, 59, 80, 81],
            tension: 0.1
          }]
        },
        options: { responsive: true, maintainAspectRatio: false }
      });
    }
  
    const marketTrendsCtx = document.getElementById('marketTrendsChart')?.getContext('2d');
    if (marketTrendsCtx) {
      new Chart(marketTrendsCtx, {
        type: 'bar',
        data: {
          labels: ['BTC', 'ETH', 'SOL', 'DOGE'],
          datasets: [{
            label: '24h Change (%)',
            data: [2.5, -1.2, 5.0, 0.5],
            backgroundColor: ['green', 'red', 'green', 'green']
          }]
        },
        options: { responsive: true, maintainAspectRatio: false }
      });
    }
  
  });
  // --- END OF UPDATED dashboard.js ---
  