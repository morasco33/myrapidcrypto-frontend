// --- START OF SIMPLIFIED dashboard.js ---
document.addEventListener('DOMContentLoaded', () => {
  console.log("DASHBOARD.JS: DOMContentLoaded");

  const USER_INFO_KEY_FOR_DASH = 'cryptohub_user_info'; 
  const AUTH_TOKEN_KEY_FOR_DASH = 'cryptohub_auth_token'; 

  const authToken = localStorage.getItem(AUTH_TOKEN_KEY_FOR_DASH);
  const userInfoString = localStorage.getItem(USER_INFO_KEY_FOR_DASH);

  if (!authToken || !userInfoString) {
    console.error("DASHBOARD.JS: CRITICAL - Auth token or user info missing DESPITE earlier checks. This shouldn't happen. Halting dashboard script.");
    const mainContent = document.querySelector('main');
    if (mainContent) {
        mainContent.innerHTML = `<h1>Authentication Error</h1><p>Could not load dashboard. Your session may be invalid. Please try <a href="login.html?action=relogin">logging in again</a>.</p>`;
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
    console.error("DASHBOARD.JS: CRITICAL - Failed to parse user info from localStorage.", e);
    const mainContent = document.querySelector('main');
    if (mainContent) mainContent.innerHTML = `<h1>Data Error</h1><p>Could not load user data. Please try <a href="login.html?action=relogin">logging in again</a>.</p>`;
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
      modal.classList.remove('active');
  }
  if (modalCloseBtn) modalCloseBtn.addEventListener('click', hideModal);
  if (modal) {
    modal.addEventListener('click', (event) => {
        if (event.target === modal) { hideModal(); }
    });
  }

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

  async function fetchRealUserBalance() {
    try {
      const response = await fetch(`${DASH_API_BASE_URL}/profile`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });

      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.message || 'Failed to load user profile');
      }

      const balance = data.user.balance || 0;
      const assets = data.user.assets || [];

      const balanceEl = document.getElementById('availableBalance');
      const portfolioValueEl = document.getElementById('portfolioValue');
      if (balanceEl) balanceEl.textContent = `$${balance.toFixed(2)}`;
      if (portfolioValueEl) portfolioValueEl.textContent = `$${balance.toFixed(2)}`;

      const container = document.getElementById('assetsList');
      if (container) {
        container.innerHTML = '';
        if (assets.length > 0) {
          assets.forEach((asset) => {
            const div = document.createElement('div');
            div.className = 'asset-item';
            div.innerHTML = `<strong>${asset.symbol}:</strong> ${asset.amount}`;
            container.appendChild(div);
          });
        } else {
          container.innerHTML = '<p>No assets available.</p>';
        }
      }

      await loadActiveInvestments();

    } catch (err) {
      console.error('DASHBOARD.JS: Error loading user balance:', err.message);
      document.getElementById('availableBalance').textContent = '$0.00';
    }
  }

  async function loadActiveInvestments() { 
    const investmentDetailsContainers = document.querySelectorAll('.investment-details-container');
    investmentDetailsContainers.forEach(c => c.innerHTML = '<p>Loading active investments for this plan...</p>');
    
    try {
        const response = await fetch(`${DASH_API_BASE_URL}/investments`, {
            method: 'GET',
            headers: { 'Authorization': `Bearer ${authToken}`, 'Content-Type': 'application/json' }
        });
        const data = await response.json();

        if (!response.ok || !data.success) {
          throw new Error(data.message || 'Failed to load investments');
        }

        investmentDetailsContainers.forEach(c => c.innerHTML = '');

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
                ${(inv.status === 'active' || inv.status === 'matured') && new Date() >= new Date(inv.withdrawalUnlockTime)
                  ? `<button class="withdraw-btn-plan" data-investment-id="${inv._id}">Withdraw</button>`
                  : `<small>Locked until ${new Date(inv.withdrawalUnlockTime).toLocaleDateString()}</small>`}
              `;
              container.appendChild(el);
            }
          }
        });

    } catch (err) {
      console.error('DASHBOARD.JS: Failed to load active investments:', err);
    }
  }

  fetchRealUserBalance();
});
// --- END OF SIMPLIFIED dashboard.js ---
