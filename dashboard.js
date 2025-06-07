// dashboard.js (complete, copy-paste ready)

const CONFIG = {
    APP_NAME: "RapidWealthHub",
    DATA_KEYS: {
      USER_NAME: "userName",
      BALANCE: "balance",
      INVESTMENTS: "userInvestments",
      ACCESS_TOKEN: "accessToken",
      USER_PROFILE: "userProfile",
    },
  };
  
  const API_BASE_URL = window.APP_KEYS?.API_BASE_URL || "";
  
  function getAuthHeaders() {
    const token = localStorage.getItem(CONFIG.DATA_KEYS.ACCESS_TOKEN);
    return token ? { "Authorization": `Bearer ${token}` } : {};
  }
  
  async function fetchUserProfile() {
    try {
      const res = await fetch(`${API_BASE_URL}/users/me`, {
        headers: getAuthHeaders(),
      });
      if (!res.ok) throw new Error("Failed to fetch user profile");
      const profile = await res.json();
      localStorage.setItem(CONFIG.DATA_KEYS.USER_PROFILE, JSON.stringify(profile));
      return profile;
    } catch (err) {
      console.error(err);
      return null;
    }
  }
  
  async function fetchUserInvestments() {
    try {
      const res = await fetch(`${API_BASE_URL}/investments/my`, {
        headers: getAuthHeaders(),
      });
      if (!res.ok) throw new Error("Failed to fetch investments");
      const investments = await res.json();
      localStorage.setItem(CONFIG.DATA_KEYS.INVESTMENTS, JSON.stringify(investments));
      return investments;
    } catch (err) {
      console.error(err);
      return [];
    }
  }
  
  async function fetchInvestmentPlans() {
    try {
      const res = await fetch(`${API_BASE_URL}/plans`, {
        headers: getAuthHeaders(),
      });
      if (!res.ok) throw new Error("Failed to fetch investment plans");
      const plans = await res.json();
      return plans;
    } catch (err) {
      console.error(err);
      return [];
    }
  }
  
  function updateBalanceDisplay() {
    const balanceEl = document.getElementById('availableBalance');
    const balance = localStorage.getItem(CONFIG.DATA_KEYS.BALANCE) || '0.00';
    if (balanceEl) balanceEl.textContent = `$${parseFloat(balance).toFixed(2)}`;
  }
  
  function renderUserName() {
    const userName = localStorage.getItem(CONFIG.DATA_KEYS.USER_NAME) || "User";
    const userNameEl = document.getElementById("userName");
    if (userNameEl) userNameEl.textContent = userName;
  }
  
  // Placeholder for portfolio chart data - replace with real data logic
  function getPortfolioChartData() {
    return {
      labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May'],
      datasets: [{
        label: 'Portfolio Value',
        data: [5000, 6000, 7000, 8000, 7500],
        backgroundColor: 'rgba(54, 162, 235, 0.5)',
        borderColor: 'rgba(54, 162, 235, 1)',
        borderWidth: 1,
        fill: true,
      }]
    };
  }
  
  // Placeholder for market trends chart data
  function getMarketTrendsChartData() {
    return {
      labels: ['BTC', 'ETH', 'XRP', 'LTC', 'BCH'],
      datasets: [{
        label: 'Price',
        data: [50000, 4000, 1.2, 200, 600],
        backgroundColor: [
          'rgba(247, 147, 26, 0.6)',
          'rgba(98, 126, 234, 0.6)',
          'rgba(128, 128, 128, 0.6)',
          'rgba(201, 71, 71, 0.6)',
          'rgba(255, 206, 86, 0.6)'
        ],
        borderWidth: 1
      }]
    };
  }
  
  function renderChart(ctx, data, options = {}) {
    return new Chart(ctx, {
      type: 'bar',
      data: data,
      options: options
    });
  }
  
  function logoutUser() {
    localStorage.removeItem(CONFIG.DATA_KEYS.ACCESS_TOKEN);
    localStorage.removeItem(CONFIG.DATA_KEYS.USER_PROFILE);
    localStorage.removeItem(CONFIG.DATA_KEYS.USER_NAME);
    localStorage.removeItem(CONFIG.DATA_KEYS.BALANCE);
    localStorage.removeItem(CONFIG.DATA_KEYS.INVESTMENTS);
    //window.location.href = "index.html"; // redirect to login/home page
  }
  
  // Modal helpers
  function openModal(title, bodyHTML, actions = []) {
    const modal = document.getElementById('appModal');
    document.getElementById('modalTitle').textContent = title;
    document.getElementById('modalBody').innerHTML = bodyHTML;
  
    const footer = document.getElementById('modalFooter');
    footer.innerHTML = '';
    actions.forEach(({ label, onClick, isPrimary }) => {
      const btn = document.createElement('button');
      btn.textContent = label;
      if (isPrimary) btn.classList.add('primary');
      btn.addEventListener('click', () => {
        onClick();
        closeModal();
      });
      footer.appendChild(btn);
    });
  
    modal.style.display = 'flex';
    document.getElementById('modalCloseBtn').onclick = closeModal;
  }
  
  function closeModal() {
    const modal = document.getElementById('appModal');
    modal.style.display = 'none';
  }
  
  function initCharts() {
    const portfolioCtx = document.getElementById('portfolioChart').getContext('2d');
    renderChart(portfolioCtx, getPortfolioChartData(), { responsive: true });
  
    const marketCtx = document.getElementById('marketTrendsChart').getContext('2d');
    renderChart(marketCtx, getMarketTrendsChartData(), { responsive: true });
  }
  
  function bindEvents() {
    document.getElementById('logoutBtn').addEventListener('click', (e) => {
      e.preventDefault();
      logoutUser();
    });
  
    document.getElementById('mainDepositBtn').addEventListener('click', () => {
      openModal("Deposit Funds", `<p>Deposit feature coming soon.</p>`, [{ label: 'Close', onClick: closeModal }]);
    });
  
    document.getElementById('mainWithdrawBtn').addEventListener('click', () => {
      openModal("Withdraw Funds", `<p>Withdraw feature coming soon.</p>`, [{ label: 'Close', onClick: closeModal }]);
    });
  
    document.querySelectorAll('.invest-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const plan = btn.dataset.plan;
        const profit = btn.dataset.profit;
        const min = btn.dataset.min;
        const max = btn.dataset.max;
        openModal(
          `Invest in ${plan.charAt(0).toUpperCase() + plan.slice(1)} Plan`,
          `<p>Profit: ${profit}%</p><p>Investment range: $${min} - $${max}</p>`,
          [
            { label: 'Cancel', onClick: closeModal },
            { label: 'Confirm Investment', onClick: () => {
              alert(`Investment confirmed for ${plan} plan.`);
              closeModal();
              // TODO: Add your investment logic here
            }, isPrimary: true }
          ]
        );
      });
    });
  }
  
  async function initializeDashboard() {
    // Fetch user profile and investments (you can await both concurrently)
    await fetchUserProfile();
    await fetchUserInvestments();
    // You could also fetch plans if you want dynamic plans
    // const plans = await fetchInvestmentPlans();
  
    renderUserName();
    updateBalanceDisplay();
    initCharts();
    bindEvents();
  }
  
  // Initialize dashboard on DOM load
  document.addEventListener('DOMContentLoaded', initializeDashboard);
  