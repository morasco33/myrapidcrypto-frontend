// --- public/js/market-trends.js (V_TextOnlyMovers) ---

console.log("DEBUG [market-trends.js V_TextOnlyMovers]: Script execution started.");

// Constants
const MT_API_BASE_URL = 'https://api.coingecko.com/api/v3';
const MT_REFRESH_INTERVAL = 75000;
const MT_DEFAULT_COIN_ID = 'bitcoin';

// DOM Elements & Chart Instances
let mtHeroChartCanvas, mtMarketChartCanvas;
let mtHeroChartCtx, mtMarketChartCtx;
let mtHeroChartInstance = null;
let mtMarketChartInstance = null;

let mtTimeFilters;
let mtSearchInput;
let mtMoversContainer;
let mtCryptoTableBody;
let mtMarketChartTitleElement;

// State
let mtCurrentCoinId = MT_DEFAULT_COIN_ID;
let mtCurrentTimeRange = '24h';
let mtIsInitializingHero = false;
let mtIsInitializingMarket = false;
let mtIsFetchingCoinList = false;
let mtRefreshIntervalId = null;

document.addEventListener('DOMContentLoaded', async () => {
    console.log("DEBUG [market-trends.js V_TextOnlyMovers]: DOMContentLoaded event fired.");

    if (typeof Chart === 'undefined') {
        console.error("CRITICAL ERROR [market-trends.js V_TextOnlyMovers]: Chart.js library is NOT LOADED.");
        showMarketTrendsErrorUI_v_TextOnlyMovers('Charting library missing. Charts cannot load.', document.body, true);
        return;
    }
    console.log("DEBUG [market-trends.js V_TextOnlyMovers]: Chart.js library detected.");

    initializeDOMElementsMT_v_TextOnlyMovers();

    console.info(`[market-trends.js V_TextOnlyMovers] API calls are to CoinGecko...`);

    if (!mtHeroChartCanvas && !mtMarketChartCanvas && !mtMoversContainer && !mtCryptoTableBody) {
        console.warn("[market-trends.js V_TextOnlyMovers]: No essential DOM elements for market trends found.");
    }

    try {
        if (mtMoversContainer || mtCryptoTableBody) {
            await loadTopCryptocurrenciesMT_v_TextOnlyMovers();
        }
        if (mtMarketChartCtx) {
            await loadMarketChartMT_v_TextOnlyMovers(mtCurrentCoinId, mtCurrentTimeRange);
        }
        if (mtHeroChartCtx) {
            await loadHeroChartMT_v_TextOnlyMovers();
        }

        console.log("DEBUG [market-trends.js V_TextOnlyMovers]: Initial data loading sequence attempted.");
        setupEventListenersMT_v_TextOnlyMovers();
        startAutoRefreshMT_v_TextOnlyMovers();

    } catch (error) {
        console.error('ERROR [market-trends.js V_TextOnlyMovers]: Error during initial data load sequence:', error);
        showMarketTrendsErrorUI_v_TextOnlyMovers(`Initialization failed: ${error.message}`, document.body);
    }
});

function initializeDOMElementsMT_v_TextOnlyMovers() {
    console.log("DEBUG [market-trends.js V_TextOnlyMovers]: Initializing DOM elements.");
    mtHeroChartCanvas = document.getElementById('heroChart');
    if (mtHeroChartCanvas) mtHeroChartCtx = mtHeroChartCanvas.getContext('2d');
    else console.warn("[market-trends.js V_TextOnlyMovers]: Hero chart canvas ('heroChart') not found!");

    mtMarketChartCanvas = document.getElementById('marketChart');
    if (mtMarketChartCanvas) mtMarketChartCtx = mtMarketChartCanvas.getContext('2d');
    else console.warn("[market-trends.js V_TextOnlyMovers]: Market chart canvas ('marketChart') not found!");

    mtTimeFilters = document.querySelectorAll('#market .time-filters .time-btn');
    mtSearchInput = document.querySelector('#market .search-box input');
    mtMoversContainer = document.getElementById('topMoversContainer');
    mtCryptoTableBody = document.getElementById('cryptoTableBody');
    mtMarketChartTitleElement = document.getElementById('marketChartTitle');

    if (mtTimeFilters.length === 0) console.warn("[market-trends.js V_TextOnlyMovers]: Time filter buttons not found.");
    if (!mtSearchInput) console.warn("[market-trends.js V_TextOnlyMovers]: Search input not found.");
    if (!mtMoversContainer) console.warn("[market-trends.js V_TextOnlyMovers]: Top Movers container ('topMoversContainer') not found!");
    if (!mtCryptoTableBody) console.warn("[market-trends.js V_TextOnlyMovers]: Crypto table body ('cryptoTableBody') not found!");
    if (!mtMarketChartTitleElement && mtMarketChartCanvas) console.warn("[market-trends.js V_TextOnlyMovers]: Market chart title element ('marketChartTitle') not found!");

    if (mtMarketChartTitleElement && mtMarketChartCanvas) {
        const initialCoinSymbol = mtCurrentCoinId === 'bitcoin' ? 'BTC' : mtCurrentCoinId.toUpperCase();
        mtMarketChartTitleElement.textContent = `${initialCoinSymbol}/USD`;
    }
}

async function fetchCoinGeckoAPIMT_v_TextOnlyMovers(endpoint, loadingElement = null, loadingText = 'Loading...') {
    const apiUrl = `${MT_API_BASE_URL}/${endpoint}`;
    console.log(`DEBUG [market-trends.js V_TextOnlyMovers]: Fetching: ${apiUrl}`);
    if (loadingElement) showMarketTrendsLoadingUI_v_TextOnlyMovers(loadingElement, loadingText);
    let response;
    try {
        response = await fetch(apiUrl);
        const responseTextForError = await response.clone().text();
        if (!response.ok) {
            console.error(`ERROR [market-trends.js V_TextOnlyMovers]: API request FAILED for ${apiUrl}. Status: ${response.status} ${response.statusText}.`);
            console.error(`>>> API Error Response Body (if any) for ${apiUrl}:\n${responseTextForError.slice(0, 500)}`);
            try { const errorJson = JSON.parse(responseTextForError); if (errorJson && errorJson.error) { throw new Error(`CoinGecko API Error: ${errorJson.error} (Status ${response.status})`); }
            } catch (e) { /* ignore */ }
            throw new Error(`Failed to fetch data from market provider (Status ${response.status}). Check network and API status.`);
        }
        const data = await response.json();
        console.log(`SUCCESS [market-trends.js V_TextOnlyMovers]: Data received from ${apiUrl}.`);
        return data;
    } catch (error) {
        console.error(`EXCEPTION CAUGHT [market-trends.js V_TextOnlyMovers]: During fetch for ${apiUrl}.`);
        console.error("Error Message:", error.message);
        if (error.name === 'TypeError' && error.message.toLowerCase().includes('failed to fetch')) {
            console.error("This typically indicates a NETWORK issue, a CSP 'connect-src' block, or a CORS policy violation.");
        }
        if (response) { console.error("Response object at time of error:", { status: response.status, ok: response.ok, statusText: response.statusText }); }
        console.error("Full error object:", error);
        throw error;
    } finally {
        if (loadingElement) hideMarketTrendsLoadingUI_v_TextOnlyMovers(loadingElement);
    }
}

async function loadTopCryptocurrenciesMT_v_TextOnlyMovers() {
    if (mtIsFetchingCoinList) { console.warn("WARN [market-trends.js V_TextOnlyMovers]: Already fetching coin list."); return; }
    if (!mtMoversContainer && !mtCryptoTableBody) { return; }
    mtIsFetchingCoinList = true;
    const loadingTarget = mtMoversContainer?.closest('.card') || mtCryptoTableBody?.closest('.card') || document.body;
    try {
        const coinsData = await fetchCoinGeckoAPIMT_v_TextOnlyMovers('coins/markets?vs_currency=usd&order=market_cap_desc&per_page=15&page=1&sparkline=false&price_change_percentage=24h', loadingTarget, 'Loading Market List...');
        if (!coinsData || coinsData.length === 0) {
            if (mtMoversContainer) mtMoversContainer.innerHTML = '<p class="no-data-message">Movers data unavailable.</p>';
            if (mtCryptoTableBody) mtCryptoTableBody.innerHTML = `<tr><td colspan="5" class="no-data-message text-center">Crypto data unavailable.</td></tr>`;
            return;
        }
        if (mtMoversContainer) updateTopMoversMT_v_TextOnlyMovers(coinsData);
        if (mtCryptoTableBody) updateCryptoTableMT_v_TextOnlyMovers(coinsData); // Crypto table still tries to load images
    } catch (error) {
        console.error('ERROR [market-trends.js V_TextOnlyMovers - loadTopCrypto]:', error.message);
        showMarketTrendsErrorUI_v_TextOnlyMovers('Failed to load crypto list. ' + error.message, loadingTarget);
    } finally { mtIsFetchingCoinList = false; }
}

// MODIFIED FUNCTION FOR TEXT-ONLY TOP MOVERS
function updateTopMoversMT_v_TextOnlyMovers(data) {
    if (!mtMoversContainer) return;
    const sortedByChange = [...data].sort((a, b) => Math.abs(b.price_change_percentage_24h || 0) - Math.abs(a.price_change_percentage_24h || 0));
    const topMovers = sortedByChange.slice(0, 5);
    mtMoversContainer.innerHTML = ''; // Clear previous movers

    if (topMovers.length === 0) {
        mtMoversContainer.innerHTML = '<p class="no-data-message" style="text-align:center; padding:1rem;">No significant movers.</p>';
        return;
    }

    topMovers.forEach(coin => {
        const priceChange24h = coin.price_change_percentage_24h || 0;
        const isPositive = priceChange24h >= 0;

        const moverElement = document.createElement('div');
        moverElement.className = `mover-text-only ${isPositive ? 'positive' : 'negative'}`; // Use new class for styling

        moverElement.innerHTML = `
            <div class="coin-info-text">
                <span class="coin-symbol-prominent">${coin.symbol.toUpperCase()}</span>
                <span class="coin-name-small">${coin.name}</span>
            </div>
            <div class="price">$${formatPriceMT_v_TextOnlyMovers(coin.current_price)}</div>
            <div class="change">${isPositive && priceChange24h !== 0 ? '+' : ''}${priceChange24h.toFixed(2)}%</div>
        `;
        mtMoversContainer.appendChild(moverElement);
    });
    console.log("DEBUG [market-trends.js V_TextOnlyMovers]: Text-only Top Movers UI updated.");
}


// Crypto table still attempts to load images. If you want to make this text-only too,
// you'll need to modify this function similarly to updateTopMoversMT_v_TextOnlyMovers.
function updateCryptoTableMT_v_TextOnlyMovers(data) {
    if (!mtCryptoTableBody) return; mtCryptoTableBody.innerHTML = '';
    const topCoinsForTable = data.slice(0, 10);
    if (topCoinsForTable.length === 0) { const colspan = mtCryptoTableBody.closest('table')?.querySelector('thead tr')?.childElementCount || 5; mtCryptoTableBody.innerHTML = `<tr><td colspan="${colspan}" class="no-data-message text-center" style="padding:1rem;">No crypto data.</td></tr>`; return; }
    topCoinsForTable.forEach((coin, index) => {
        const priceChange24h = coin.price_change_percentage_24h || 0; const isPositive24h = priceChange24h >= 0;
        const row = mtCryptoTableBody.insertRow();
        // THIS LINE STILL HAS THE IMG TAG - CORS errors will persist here.
        row.innerHTML = `<td>${coin.market_cap_rank || index + 1}</td><td><div class="coin-info"><img src="${coin.image}" alt="${coin.name}" class="coin-logo-tiny" onerror="this.style.display='none'; this.insertAdjacentHTML('afterend', '<span class=\'fallback-icon fallback-table\'>${coin.symbol ? coin.symbol[0].toUpperCase() : '?'}</span>');"><span>${coin.name} (${coin.symbol.toUpperCase()})</span></div></td><td>$${formatPriceMT_v_TextOnlyMovers(coin.current_price)}</td><td class="${priceChange24h === 0 ? 'neutral' : isPositive24h ? 'positive' : 'negative'}">${isPositive24h && priceChange24h !== 0 ? '+' : ''}${priceChange24h.toFixed(2)}%</td><td>$${formatMarketCapMT_v_TextOnlyMovers(coin.market_cap)}</td>`;
    });
    console.log("DEBUG [market-trends.js V_TextOnlyMovers]: Crypto Table UI updated (images still attempted).");
}

async function loadMarketChartMT_v_TextOnlyMovers(coinId, timeRange) {
    if (!mtMarketChartCanvas) { console.warn(`WARN [market-trends.js V_TextOnlyMovers]: Market chart canvas unavailable for ${coinId}.`); return; }
    if (mtIsInitializingMarket) {
        console.warn(`WARN [market-trends.js V_TextOnlyMovers]: Market chart for ${coinId} already initializing. Skipping.`);
        return;
    }
    mtIsInitializingMarket = true;
    const chartContainer = mtMarketChartCanvas.parentElement || document.body;
    if (mtMarketChartInstance) mtMarketChartInstance.destroy();
    mtMarketChartInstance = null;
    try {
        const days = getDaysFromTimeRangeForCoinGeckoMT_v_TextOnlyMovers(timeRange);
        const endpoint = `coins/${coinId}/market_chart?vs_currency=usd&days=${days}`;
        const chartData = await fetchCoinGeckoAPIMT_v_TextOnlyMovers(endpoint, chartContainer, `Loading ${coinId.toUpperCase()} Chart...`);
        if (!chartData.prices || chartData.prices.length === 0) throw new Error(`No price data for ${coinId} in range ${timeRange}.`);
        updateMarketChartMT_v_TextOnlyMovers(chartData.prices, coinId, timeRange);
    } catch (error) {
        console.error(`ERROR [market-trends.js V_TextOnlyMovers - loadMarketChart for ${coinId}]:`, error.message);
        showMarketTrendsErrorUI_v_TextOnlyMovers(`Failed to load chart for ${coinId.toUpperCase()}. ${error.message}`, chartContainer, false, 10000);
        const ctx = mtMarketChartCanvas.getContext('2d'); ctx.clearRect(0,0,ctx.canvas.width,ctx.canvas.height); ctx.font = "14px 'Inter', sans-serif"; ctx.textAlign = "center"; ctx.fillStyle = "#999"; ctx.fillText(`Chart for ${coinId.toUpperCase()} unavailable.`, ctx.canvas.width/2, ctx.canvas.height/2);
    } finally {
        mtIsInitializingMarket = false;
    }
}

function updateMarketChartMT_v_TextOnlyMovers(prices, coinId, timeRange) {
    if (!mtMarketChartCanvas || typeof Chart === 'undefined') return; if (mtMarketChartInstance) mtMarketChartInstance.destroy();
    const { labels, dataPoints } = formatChartDataForCoinGeckoMT_v_TextOnlyMovers(prices, timeRange);
    const coinNameFriendly = coinId.charAt(0).toUpperCase() + coinId.slice(1);
    mtMarketChartInstance = new Chart(mtMarketChartCanvas.getContext('2d'), {
        type: 'line', data: { labels: labels, datasets: [{ label: `${coinNameFriendly} Price (USD)`, data: dataPoints, borderColor: 'var(--primary, #6c5ce7)', backgroundColor: 'rgba(108, 92, 231, 0.1)', borderWidth: 2, fill: true, tension: 0.3, pointRadius: dataPoints.length < 70 ? 2.5 : 0 }] },
        options: { responsive: true, maintainAspectRatio: false, interaction: { mode: 'index', intersect: false }, plugins: { legend: {display:true,position:'bottom',labels:{usePointStyle:true,padding:15,color:'var(--dark,#333)',font:{family:"'Inter',sans-serif",size:12}}}, tooltip:{enabled:true,mode:'index',intersect:false,backgroundColor:'rgba(45,52,54,0.9)',titleColor:'var(--light,#fff)',bodyColor:'rgba(255,255,255,0.85)',titleFont:{family:"'Inter',sans-serif",size:13,weight:'600'},bodyFont:{family:"'Inter',sans-serif",size:12},padding:10,boxPadding:5,cornerRadius:8,callbacks:{title:(tis)=>{if(!tis.length||!prices[tis[0].dataIndex])return '';return new Date(prices[tis[0].dataIndex][0]).toLocaleString([],{dateStyle:'medium',timeStyle:'short'});},label:(c)=>`${c.dataset.label}: $${formatPriceMT_v_TextOnlyMovers(c.parsed.y)}`}}}, scales: { y:{grid:{color:'rgba(0,0,0,0.08)'},ticks:{color:'var(--neutral,#777)',font:{family:"'Inter',sans-serif",size:11},callback:v=>'$'+formatPriceMT_v_TextOnlyMovers(v,true)}}, x:{grid:{display:false},ticks:{color:'var(--neutral,#777)',font:{family:"'Inter',sans-serif",size:11},maxRotation:0,autoSkip:true,maxTicksLimit:isMobileViewMT_v_TextOnlyMovers()?4:(dataPoints.length>120?7:5)}}}}
    });
    console.log(`SUCCESS [market-trends.js V_TextOnlyMovers]: Market chart for ${coinId} rendered.`);
    updateMarketChartTitleDisplay_v_TextOnlyMovers();
}

function updateMarketChartTitleDisplay_v_TextOnlyMovers() {
    if (mtMarketChartTitleElement) {
        const coinSymbol = mtCurrentCoinId === 'bitcoin' ? 'BTC' : mtCurrentCoinId.toUpperCase();
        mtMarketChartTitleElement.textContent = `${coinSymbol}/USD`;
    }
}

async function loadHeroChartMT_v_TextOnlyMovers() {
    if (!mtHeroChartCanvas) { console.warn("[market-trends.js V_TextOnlyMovers]: Hero chart canvas not found."); return; }
    if (mtIsInitializingHero) {
        console.warn("[market-trends.js V_TextOnlyMovers]: Hero chart already initializing. Skipping.");
        return;
    }
    mtIsInitializingHero = true;
    const chartContainer = mtHeroChartCanvas.parentElement || document.body;
    if (mtHeroChartInstance) mtHeroChartInstance.destroy();
    mtHeroChartInstance = null;
    try {
        const endpoint = `coins/${MT_DEFAULT_COIN_ID}/market_chart?vs_currency=usd&days=30`;
        const heroChartData = await fetchCoinGeckoAPIMT_v_TextOnlyMovers(endpoint, chartContainer, 'Loading Overview...');
        if (!heroChartData.prices || heroChartData.prices.length === 0) throw new Error(`No price data for hero chart (${MT_DEFAULT_COIN_ID}).`);
        updateHeroChartMT_v_TextOnlyMovers(heroChartData.prices);
    } catch (error) {
        console.error(`ERROR [market-trends.js V_TextOnlyMovers - loadHeroChart]:`, error.message);
        showMarketTrendsErrorUI_v_TextOnlyMovers(`Could not load overview chart. ${error.message}`, chartContainer, false, 10000);
    } finally {
        mtIsInitializingHero = false;
    }
}

function updateHeroChartMT_v_TextOnlyMovers(prices) {
    if (!mtHeroChartCanvas || typeof Chart === 'undefined') return; if (mtHeroChartInstance) mtHeroChartInstance.destroy();
    const dataPoints = prices.map(price => price[1]); const labels = prices.map((_, index) => index + 1);
    mtHeroChartInstance = new Chart(mtHeroChartCanvas.getContext('2d'), {
        type: 'line', data: { labels: labels, datasets: [{ label: `${MT_DEFAULT_COIN_ID.toUpperCase()} Trend`, data: dataPoints, borderColor: 'var(--secondary, #00b894)', backgroundColor: 'rgba(0, 184, 148, 0.05)', borderWidth: 2.5, fill: true, tension: 0.4, pointRadius: 0 }] },
        options: { responsive: true, maintainAspectRatio: false, animation:{duration:0}, plugins:{legend:{display:false},tooltip:{enabled:false}}, scales:{y:{display:false},x:{display:false}}}
    });
    console.log("SUCCESS [market-trends.js V_TextOnlyMovers]: Hero chart rendered.");
}

function setupEventListenersMT_v_TextOnlyMovers() {
    console.log("DEBUG [market-trends.js V_TextOnlyMovers]: Setting up event listeners.");
    if (mtTimeFilters && mtTimeFilters.length > 0) {
        mtTimeFilters.forEach(button => {
            const newButton = button.cloneNode(true);
            button.parentNode.replaceChild(newButton, button);
            newButton.addEventListener('click', async function() {
                if (this.classList.contains('active') || !mtMarketChartCanvas) return;
                document.querySelectorAll('#market .time-filters .time-btn').forEach(btn => btn.classList.remove('active')); // Use live query
                this.classList.add('active');
                mtCurrentTimeRange = this.dataset.time;
                console.log(`DEBUG [market-trends.js V_TextOnlyMovers]: Time filter to ${mtCurrentTimeRange} for: ${mtCurrentCoinId}`);
                await loadMarketChartMT_v_TextOnlyMovers(mtCurrentCoinId, mtCurrentTimeRange);
            });
        });
        const initialActiveButton = document.querySelector('#market .time-filters .time-btn[data-time="' + mtCurrentTimeRange + '"]');
        if (initialActiveButton) initialActiveButton.classList.add('active'); else if(document.querySelector('#market .time-filters .time-btn')) document.querySelector('#market .time-filters .time-btn').classList.add('active');
    }

    if (mtSearchInput) {
        const searchResultsDivId = 'marketCoinSearchResultsDropdown'; let searchResultsDiv = document.getElementById(searchResultsDivId);
        if (!searchResultsDiv && mtSearchInput.parentElement) {
            searchResultsDiv = document.createElement('div'); searchResultsDiv.id = searchResultsDivId; searchResultsDiv.className = 'search-results-dropdown';
            Object.assign(searchResultsDiv.style, { position:'absolute',top:'100%',left:'0',right:'0',backgroundColor:'var(--glass-bg, white)',border:'1px solid var(--glass-border, #ddd)',borderRadius:'0 0 6px 6px',zIndex:'1000',maxHeight:'250px',overflowY:'auto',boxShadow:'var(--card-shadow, 0 2px 5px rgba(0,0,0,0.1))',display:'none'});
            if(getComputedStyle(mtSearchInput.parentElement).position === 'static') mtSearchInput.parentElement.style.position = 'relative';
            mtSearchInput.parentElement.appendChild(searchResultsDiv);
        }
        mtSearchInput.addEventListener('input', debounceMT_v_TextOnlyMovers(async (e) => {
            if (!searchResultsDiv) return; const searchTerm = e.target.value.trim().toLowerCase();
            searchResultsDiv.innerHTML = ''; if (searchTerm.length < 2) { searchResultsDiv.style.display = 'none'; return; }
            try {
                showMarketTrendsLoadingUI_v_TextOnlyMovers(searchResultsDiv, 'Searching...');
                const searchData = await fetchCoinGeckoAPIMT_v_TextOnlyMovers(`search?query=${encodeURIComponent(searchTerm)}`);
                searchResultsDiv.innerHTML = '';
                if (searchData.coins && searchData.coins.length > 0) {
                    searchResultsDiv.style.display = 'block';
                    searchData.coins.slice(0, 7).forEach(coin => {
                        const item = document.createElement('div'); item.className = 'search-result-item';
                        item.style.padding = "10px 15px"; item.style.cursor = "pointer";
                        // Search results still attempt to show thumb image - CORS may occur here
                        item.innerHTML = `<img src="${coin.thumb}" alt="" style="width:20px;height:20px;margin-right:10px;border-radius:50%;vertical-align:middle;" onerror="this.style.display='none';"> ${coin.name} (${coin.symbol.toUpperCase()})`;
                        item.addEventListener('mouseover', () => item.style.backgroundColor = '#f0f0f0');
                        item.addEventListener('mouseout', () => item.style.backgroundColor = 'transparent');
                        item.addEventListener('click', async () => {
                            mtCurrentCoinId = coin.id; mtSearchInput.value = ''; searchResultsDiv.style.display = 'none';
                            console.log(`DEBUG [market-trends.js V_TextOnlyMovers]: Search selected ${mtCurrentCoinId}.`);
                            updateMarketChartTitleDisplay_v_TextOnlyMovers();
                            if (mtMarketChartCanvas) await loadMarketChartMT_v_TextOnlyMovers(mtCurrentCoinId, mtCurrentTimeRange);
                        });
                        searchResultsDiv.appendChild(item);
                    });
                } else { searchResultsDiv.innerHTML = '<div style="padding:10px 15px;text-align:center;color:#777;">No coins found.</div>'; searchResultsDiv.style.display = 'block'; }
            } catch (error) { console.error('ERROR [market-trends.js V_TextOnlyMovers - Search]:', error); searchResultsDiv.innerHTML = `<div style="padding:10px 15px;text-align:center;color:red;">Search error: ${error.message}</div>`; searchResultsDiv.style.display = 'block';
            } finally { hideMarketTrendsLoadingUI_v_TextOnlyMovers(searchResultsDiv); }
        }, 300));
        document.addEventListener('click', (event) => { if (searchResultsDiv && !mtSearchInput.contains(event.target) && !searchResultsDiv.contains(event.target)) searchResultsDiv.style.display = 'none'; });
    }
}

function startAutoRefreshMT_v_TextOnlyMovers() {
    if (mtRefreshIntervalId !== null) {
        console.log("DEBUG [market-trends.js V_TextOnlyMovers]: Clearing previous auto-refresh interval ID:", mtRefreshIntervalId);
        clearInterval(mtRefreshIntervalId);
    }
    console.log(`INFO [market-trends.js V_TextOnlyMovers]: Starting auto-refresh (Interval: ${MT_REFRESH_INTERVAL / 1000}s).`);

    mtRefreshIntervalId = setInterval(async () => {
        if (document.hidden) {
            console.log("DEBUG [market-trends.js V_TextOnlyMovers]: Page hidden, skipping auto-refresh.");
            return;
        }
        console.log("INFO [market-trends.js V_TextOnlyMovers]: Auto-refresh cycle executing.");
        try {
            if (mtMoversContainer || mtCryptoTableBody) {
                await loadTopCryptocurrenciesMT_v_TextOnlyMovers();
            }
            if (mtMarketChartCanvas && mtCurrentCoinId) {
                await loadMarketChartMT_v_TextOnlyMovers(mtCurrentCoinId, mtCurrentTimeRange);
            }
        } catch (error) {
            console.error("ERROR [market-trends.js V_TextOnlyMovers]: Uncaught error in auto-refresh cycle:", error);
        }
    }, MT_REFRESH_INTERVAL);
    console.log("DEBUG [market-trends.js V_TextOnlyMovers]: New auto-refresh interval ID set:", mtRefreshIntervalId);
}

// --- Helper Functions (Suffix with _v_TextOnlyMovers) ---
function formatChartDataForCoinGeckoMT_v_TextOnlyMovers(prices, timeRange) {
    if (!Array.isArray(prices) || prices.length === 0) return { labels: [], dataPoints: [] };
    const days = getDaysFromTimeRangeForCoinGeckoMT_v_TextOnlyMovers(timeRange); const options = {};
    if (days <= 1) { options.hour = 'numeric'; options.minute = '2-digit'; }
    else if (days <= 90) { options.month = 'short'; options.day = 'numeric'; }
    else { options.year = 'numeric'; options.month = 'short'; }
    const labels = prices.map(p => new Date(p[0]).toLocaleDateString('en-US', options));
    const dataPoints = prices.map(p => p[1]); return { labels, dataPoints };
}
function getDaysFromTimeRangeForCoinGeckoMT_v_TextOnlyMovers(timeRange) {
    const ranges = { '24h': 1, '7d': 7, '30d': 30, '90d': 90, '180d': 180, '1y': 365, 'all': 'max' }; return ranges[timeRange] || 1;
}
function formatPriceMT_v_TextOnlyMovers(price, forAxis = false) {
    if (price == null || typeof price !== 'number' || isNaN(price)) return 'N/A';
    if (forAxis && price >= 10000) { if (price >= 1e6) return (price/1e6).toFixed(1)+'M'; return (price/1e3).toFixed(0)+'K';}
    else if (forAxis && price >= 1000) {return (price/1e3).toFixed(1)+'K';}
    const fracDigits = price < 0.0001 ? 8 : price < 0.01 ? 6 : price < 1 ? 4 : 2;
    return price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: fracDigits });
}
function formatMarketCapMT_v_TextOnlyMovers(cap) {
    if (cap == null || typeof cap !== 'number' || isNaN(cap)) return 'N/A';
    if (cap >= 1e12) return `${(cap/1e12).toFixed(2)}T`; if (cap >= 1e9) return `${(cap/1e9).toFixed(2)}B`;
    if (cap >= 1e6) return `${(cap/1e6).toFixed(2)}M`; return cap.toLocaleString('en-US', {maximumFractionDigits: 0});
}
function debounceMT_v_TextOnlyMovers(func, wait) {
    let timeout; return function executedFunction(...args) { const later = () => { clearTimeout(timeout); func.apply(this, args); }; clearTimeout(timeout); timeout = setTimeout(later, wait); };
}
function showMarketTrendsLoadingUI_v_TextOnlyMovers(element, text = 'Loading...') {
    if (!element) return; let host = element.classList.contains('search-results-dropdown') ? element : element.parentElement; if (!host) return;
    if(getComputedStyle(host).position === 'static' && host !== document.body) host.style.position = 'relative';
    let spinner = host.querySelector('.mt-dynamic-spinner-overlay-v_TextOnlyMovers');
    if (!spinner) {
        spinner = document.createElement('div'); spinner.className = 'mt-dynamic-spinner-overlay-v_TextOnlyMovers';
        spinner.innerHTML = `<div class="mt-spinner-content-v_TextOnlyMovers"><div class="mt-spinner-icon-v_TextOnlyMovers"></div><span>${text}</span></div>`;
        Object.assign(spinner.style, { position:'absolute',top:'0',left:'0',width:'100%',height:'100%',backgroundColor:'rgba(255,255,255,0.85)',display:'flex',justifyContent:'center',alignItems:'center',zIndex:'10',transition:'opacity 0.2s',opacity:'0',pointerEvents:'none'});
        spinner.querySelector('.mt-spinner-content-v_TextOnlyMovers').style.cssText = "display:flex;align-items:center;padding:10px 15px;background:white;border-radius:5px;box-shadow:0 1px 5px rgba(0,0,0,0.1);color:#333;";
        spinner.querySelector('.mt-spinner-icon-v_TextOnlyMovers').style.cssText = `width:20px;height:20px;border:2px solid #f0f0f0;border-top-color:var(--primary, #007bff);border-radius:50%;animation:mtSpin_v_TextOnlyMovers 0.6s linear infinite;margin-right:8px;`;
        host.appendChild(spinner);
    } else { spinner.querySelector('span').textContent = text; }
    spinner.style.display = 'flex'; requestAnimationFrame(() => spinner.style.opacity = '1');
}
function hideMarketTrendsLoadingUI_v_TextOnlyMovers(element) {
    if (!element) return; let host = element.classList.contains('search-results-dropdown') ? element : element.parentElement; if (!host) return;
    const spinner = host.querySelector('.mt-dynamic-spinner-overlay-v_TextOnlyMovers');
    if (spinner) { spinner.style.opacity = '0'; setTimeout(() => { if(spinner) spinner.style.display = 'none'; }, 200); }
}
function showMarketTrendsErrorUI_v_TextOnlyMovers(message, parentElement, isCritical = false, duration = 7000) {
    if (!parentElement) parentElement = document.body; let errorBoxContainer = parentElement;
    if (parentElement.tagName === 'CANVAS' && parentElement.parentElement) errorBoxContainer = parentElement.parentElement;
    else if (parentElement.closest('.card')) errorBoxContainer = parentElement.closest('.card');
    const errorBoxId = `mt-error-box-${Date.now()}-${Math.random().toString(36).substring(2,7)}`; let errorBox = document.createElement('div');
    errorBox.id = errorBoxId; errorBox.className = 'market-trends-error-message-ui-v_TextOnlyMovers';
    Object.assign(errorBox.style, { padding:'12px',margin:'10px 0',border:'1px solid #dc3545',borderRadius:'6px',color:'#721c24',backgroundColor:'#f8d7da',textAlign:'left',position:'relative',opacity:'0',transition:'opacity 0.3s ease-in-out, transform 0.3s ease-out',fontSize:'0.9em', transform: 'translateY(-10px)'});
    errorBox.innerHTML = `<span>⚠️ ${message}</span>`;
    if (!isCritical) errorBox.innerHTML += `<button onclick="this.parentElement.style.opacity=0; setTimeout(()=>this.parentElement.remove(),300);" style="position:absolute;top:5px;right:10px;background:none;border:none;font-size:1.4em;cursor:pointer;color:#721c24;padding:0;line-height:1;">×</button>`;
    if (errorBoxContainer === document.body && isCritical) { Object.assign(errorBox.style, {position:'fixed',top:'20px',left:'50%',transform:'translateX(-50%)',zIndex:'9999',minWidth:'320px',maxWidth:'600px'}); document.body.prepend(errorBox);
    } else if (errorBoxContainer.firstChild) errorBoxContainer.insertBefore(errorBox, errorBoxContainer.firstChild);
    else errorBoxContainer.appendChild(errorBox);
    requestAnimationFrame(() => {errorBox.style.opacity = '1'; errorBox.style.transform = 'translateY(0)';});
    console.error(`DISPLAYED UI ERROR (Market Trends V_TextOnlyMovers): ${message}`);
    if (!isCritical && duration > 0) setTimeout(() => {const box = document.getElementById(errorBoxId); if(box){box.style.opacity='0'; setTimeout(()=>box.remove(),300);}}, duration);
}
function isMobileViewMT_v_TextOnlyMovers() { return window.innerWidth <= 768; }
if (!document.getElementById('mtSpinAnimationStyle_v_TextOnlyMovers')) {
    const styleSheet = document.createElement("style"); styleSheet.id = 'mtSpinAnimationStyle_v_TextOnlyMovers';
    styleSheet.innerText = "@keyframes mtSpin_v_TextOnlyMovers { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }";
    document.head.appendChild(styleSheet);
}