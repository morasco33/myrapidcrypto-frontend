// frontend/script.js
document.addEventListener('DOMContentLoaded', () => {
    const fetchDataBtn = document.getElementById('fetchDataBtn');
    const cryptoContainer = document.getElementById('crypto-container');
    const errorMessageDiv = document.getElementById('error-message');

    // IMPORTANT: This URL will be your DEPLOYED Railway backend URL
    // For now, we can use the local one if you're testing locally.
    // We will update this to the Railway URL once it's deployed.
    const API_URL = 'myrapidcrypto-backend-production.up.railway.app'; // Placeholder, will change

    fetchDataBtn.addEventListener('click', async () => {
        cryptoContainer.innerHTML = 'Loading...';
        errorMessageDiv.textContent = ''; // Clear previous errors

        try {
            // Replace API_URL with your actual Railway backend URL once deployed
            // const actualApiUrl = 'YOUR_RAILWAY_BACKEND_URL/api/crypto-data';
            const response = await fetch(API_URL); // Using placeholder for now

            if (!response.ok) {
                // If server responds with an error status (4xx, 5xx)
                const errorData = await response.text(); // or response.json() if backend sends JSON error
                throw new Error(`Network response was not ok: ${response.status} ${response.statusText}. Server says: ${errorData}`);
            }

            const data = await response.json();
            displayCryptoData(data);
        } catch (error) {
            console.error('Fetch error:', error);
            errorMessageDiv.textContent = `Failed to fetch data. ${error.message}. Check browser console for more details. Make sure backend is running and CORS is configured.`;
            cryptoContainer.innerHTML = ''; // Clear loading message
        }
    });

    function displayCryptoData(cryptoArray) {
        cryptoContainer.innerHTML = ''; // Clear previous data or loading message
        if (cryptoArray.length === 0) {
            cryptoContainer.innerHTML = '<p>No data available.</p>';
            return;
        }
        cryptoArray.forEach(crypto => {
            const itemDiv = document.createElement('div');
            itemDiv.classList.add('crypto-item');
            itemDiv.innerHTML = `
                <strong>${crypto.name} (${crypto.symbol})</strong>: $${crypto.price}
            `;
            cryptoContainer.appendChild(itemDiv);
        });
    }
});