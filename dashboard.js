document.addEventListener('DOMContentLoaded', () => {
  const user = JSON.parse(localStorage.getItem('cryptohub_current_user'));
  if (!user) return window.location.href = 'login.html';

  // Display user name
  document.getElementById('userName').textContent = user.username;

  // Initialize or load balances
  const balances = JSON.parse(localStorage.getItem('cryptohub_balances') || '{}');
  if (!balances[user.email]) {
    balances[user.email] = { USD: 10000, BTC: 0, ETH: 0, USDT: 0 }; // Preload test money
    localStorage.setItem('cryptohub_balances', JSON.stringify(balances));
  }

  // Render wallet
  function renderAssets() {
    const container = document.getElementById('assetsList');
    const userBalances = balances[user.email];
    let totalUSD = 0;
    container.innerHTML = '';

    Object.entries(userBalances).forEach(([currency, amount]) => {
      const el = document.createElement('div');
      el.className = 'asset-item';
      el.innerHTML = `<strong>${currency}:</strong> $${parseFloat(amount).toFixed(2)}`;
      container.appendChild(el);
      totalUSD += parseFloat(amount);
    });

    document.querySelector('.balance').textContent = `$${totalUSD.toFixed(2)}`;
    document.getElementById('portfolioValue').textContent = `$${totalUSD.toFixed(2)}`;
  }

  renderAssets();

  // Load investments
  async function loadInvestments() {
    const list = document.getElementById('investmentList');
    list.innerHTML = 'Loading your investments...';

    try {
      const res = await fetch(`https://famous-scone-fcd9cb.netlify.app/investments/${user._id}`);
      const data = await res.json();

      if (!Array.isArray(data) || data.length === 0) {
        list.innerHTML = '<p>No investments yet.</p>';
        return;
      }

      list.innerHTML = '';
      data.forEach(inv => {
        const profit = ((inv.amount * inv.profitRate) / 100).toFixed(2);
        const completed = new Date(inv.endDate) <= new Date();
        const el = document.createElement('div');
        el.className = 'investment-entry';
        el.innerHTML = `
          <p><strong>${inv.plan.toUpperCase()} Plan</strong></p>
          <p>Amount: $${inv.amount}</p>
          <p>Profit: $${profit}</p>
          <p>Status: ${completed ? '✅ Completed' : '⏳ Ongoing'}</p>
        `;
        list.appendChild(el);
      });
    } catch (err) {
      list.innerHTML = '<p>Failed to load investments.</p>';
      console.error(err);
    }
  }

  loadInvestments();

  // Handle investment actions
  document.querySelectorAll('.invest-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const plan = btn.dataset.plan;
      const profitRate = parseFloat(btn.dataset.profit);
      const amount = prompt(`Enter amount to invest in ${plan} plan:`);

      if (!amount || isNaN(amount) || parseFloat(amount) <= 0) {
        return alert('Please enter a valid amount.');
      }

      const investAmount = parseFloat(amount);
      const currentUSD = balances[user.email].USD || 0;

      if (investAmount > currentUSD) {
        return alert('❌ Insufficient balance. Please deposit first.');
      }

      // Deduct from balance
      balances[user.email].USD -= investAmount;
      localStorage.setItem('cryptohub_balances', JSON.stringify(balances));
      renderAssets();

      // Send to backend
      const res = await fetch('https://rapidcrypto-backend.onrender.com', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user._id,
          plan,
          amount: investAmount,
          profitRate
        })
      });

      const data = await res.json();
      alert(data.message || 'Investment submitted.');
      loadInvestments();
    });
  });

  // Logout
  document.getElementById('logoutBtn')?.addEventListener('click', () => {
    localStorage.removeItem('cryptohub_current_user');
    localStorage.removeItem('cryptohub_auth_token');
    window.location.href = 'login.html';
  });
});
