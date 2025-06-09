// --- START OF SIMPLIFIED dashboard.js ---
document.addEventListener('DOMContentLoaded', () => {
  console.log("DASHBOARD.JS: DOMContentLoaded");

  const USER_INFO_KEY_FOR_DASH = 'cryptohub_user_info'; 
  const AUTH_TOKEN_KEY_FOR_DASH = 'cryptohub_auth_token'; 

  const authToken = localStorage.getItem(AUTH_TOKEN_KEY_FOR_DASH);
  const userInfoString = localStorage.getItem(USER_INFO_KEY_FOR_DASH);

  if (!authToken || !userInfoString) {
    console.error("DASHBOARD.JS: CRITICAL - Auth token or user info missing.");
    const mainContent = document.querySelector('main');
    if (mainContent) {
        mainContent.innerHTML = `<h1>Authentication Error</h1><p>Could not load dashboard. Please <a href="login.html?action=relogin">log in again</a>.</p>`;
    }
    const loadingSpinnerOverlay = document.querySelector('.loading-spinner-overlay');
    if (loadingSpinnerOverlay) loadingSpinnerOverlay.style.display = 'none';
    document.body.classList.remove('auth-loading');
    document.documentElement.style.visibility = 'visible';
    document.documentElement.style.opacity = '1';
    return;
  }

  let user;
  try {
    user = JSON.parse(userInfoString);
  } catch (e) {
    console.error("DASHBOARD.JS: CRITICAL - Failed to parse user info.", e);
    const mainContent = document.querySelector('main');
    if (mainContent) mainContent.innerHTML = `<h1>Data Error</h1><p>Try <a href="login.html?action=relogin">logging in again</a>.</p>`;
    const loadingSpinnerOverlay = document.querySelector('.loading-spinner-overlay');
    if (loadingSpinnerOverlay) loadingSpinnerOverlay.style.display = 'none';
    document.body.classList.remove('auth-loading');
    document.documentElement.style.visibility = 'visible';
    document.documentElement.style.opacity = '1';
    return;
  }

  if (!user || !user._id) {
    console.error("DASHBOARD.JS: Invalid user object.", user);
    const mainContent = document.querySelector('main');
    if (mainContent) mainContent.innerHTML = `<h1>User Data Error</h1><p>Try <a href="login.html?action=relogin">logging in again</a>.</p>`;
    const loadingSpinnerOverlay = document.querySelector('.loading-spinner-overlay');
    if (loadingSpinnerOverlay) loadingSpinnerOverlay.style.display = 'none';
    document.body.classList.remove('auth-loading');
    document.documentElement.style.visibility = 'visible';
    document.documentElement.style.opacity = '1';
    return;
  }

  const DASH_API_BASE_URL = window.API_BASE_URL || 'https://rapidcrypto-backend.onrender.com/api';

  const userNameEl = document.getElementById('userName');
  if (userNameEl) userNameEl.textContent = user.username || user.email || 'User';

  const modal = document.getElementById('appModal');
  const modalTitle = document.getElementById('modalTitle');
  const modalBody = document.getElementById('modalBody');
  const modalCloseBtn = document.getElementById('modalCloseBtn');

  function showModal(title, bodyContent = '') {
    if (!modal || !modalTitle || !modalBody) return;
    modalTitle.textContent = title;
    modalBody.innerHTML = typeof bodyContent === 'string' ? bodyContent : '';
    modal.classList.add('active');
  }
  function hideModal() {
    modal.classList.remove('active');
  }
  if (modalCloseBtn) modalCloseBtn.addEventListener('click', hideModal);
  if (modal) modal.addEventListener('click', (e) => { if (e.target === modal) hideModal(); });

  const mainDepositButton = document.getElementById('mainDepositBtn');
  if (mainDepositButton) mainDepositButton.addEventListener('click', () => window.location.href = 'deposit.html');

  const mainWithdrawButton = document.getElementById('mainWithdrawBtn');
  if (mainWithdrawButton) mainWithdrawButton.addEventListener('click', () => window.location.href = 'withdraw.html');

  async function fetchRealUserBalance() {
    try {
      const response = await fetch(`${DASH_API_BASE_URL}/profile`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.message || 'Failed to load profile');

      const balance = data.user.balance || 0;
      const assets = data.user.assets || [];

      const balanceEl = document.getElementById('availableBalance');
      const portfolioValueEl = document.getElementById('portfolioValue');
      if (balanceEl) balanceEl.textContent = `$${balance.toFixed(2)}`;
      if (portfolioValueEl) portfolioValueEl.textContent = `$${balance.toFixed(2)}`;

      const container = document.getElementById('assetsList');
      if (container) {
        container.innerHTML = '';
        if (assets.length) {
          assets.forEach(asset => {
            const div = document.createElement('div');
            div.className = 'asset-item';
            div.innerHTML = `<strong>${asset.symbol}:</strong> ${asset.amount}`;
            container.appendChild(div);
          });
        } else {
          container.innerHTML = '<p>No assets available.</p>';
        }
      }
    } catch (err) {
      console.error('DASHBOARD.JS: Failed to load balance:', err);
      const balanceEl = document.getElementById('availableBalance');
      if (balanceEl) balanceEl.textContent = '$0.00';
    }
  }

  async function fetchInvestmentPlans() {
    try {
      const response = await fetch(`${DASH_API_BASE_URL}/investment-plans`, {
        headers: { Authorization: `Bearer ${authToken}` }
      });
      const data = await response.json();
      if (data.success && data.plans) {
        data.plans.forEach(plan => {
          const card = document.querySelector(`.investment-options[data-plan-id="${plan.id}"]`);
          if (card) {
            const investBtn = card.querySelector('.invest-btn');
            if (investBtn) {
              investBtn.dataset.plan = plan.id;
              investBtn.dataset.min = plan.minAmount;
              investBtn.dataset.max = plan.maxAmount;
              investBtn.addEventListener('click', () => handleInvest(plan));
            }
          }
        });
      }
    } catch (err) {
      console.error('DASHBOARD.JS: Failed to fetch investment plans:', err);
    }
  }

  async function handleInvest(plan) {
    const amountString = prompt(`Enter amount to invest in ${plan.name} ($${plan.minAmount} - $${plan.maxAmount}):`);
    if (!amountString) return;
    const amount = parseFloat(amountString);
    if (isNaN(amount) || amount < plan.minAmount || amount > plan.maxAmount) {
      alert(`Invalid amount. Enter between $${plan.minAmount} and $${plan.maxAmount}.`);
      return;
    }
    showModal('Processing Investment...', 'Please wait...');
    try {
      const response = await fetch(`${DASH_API_BASE_URL}/investments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({ planId: plan.id, amount })
      });
      const data = await response.json();
      hideModal();
      if (!response.ok || !data.success) throw new Error(data.message || 'Investment failed.');
      alert(data.message || 'Investment successful!');
      fetchRealUserBalance();
    } catch (err) {
      hideModal();
      alert(`Investment Error: ${err.message}`);
    }
  }

  fetchRealUserBalance();
  fetchInvestmentPlans();
});
// --- END OF SIMPLIFIED dashboard.js ---
