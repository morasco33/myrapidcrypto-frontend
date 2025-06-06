// deposit.js (Hardened Production Version v2.0)

(function initDeposit() {
    // ======================
    // CONFIGURATION
    // ======================
    const CONFIG = {
        VERSION: '2.0',
        ADDRESS_MAP: {
            btc: { btc: '3FGdY6iVT3iRqBYwJTcJn4AzTTEsJL6r1J' },
            eth: { 
                erc20: '0x889916Be18bFA95fD05e8b0B0d643265527453B9',
                bep20: '' // Example: '0xYourBEP20AddressForETHIfWrapped'
            },
            usdt: {
                erc20: '0x619e666AFD7ee061bC2A275F494a4540a5E278f9',
                trc20: '', // Example: 'TYOURTRC20ADDRESSFORUSDT'
                bep20: ''  // Example: '0xYourBEP20AddressForUSDT'
            },
            usdc: {
                erc20: '0xB5594fbada5eC1E1E8920946c8E2796348823338', // Fixed typo (removed trailing 's')
                bep20: ''  // Example: '0xYourBEP20AddressForUSDC'
            }
        },
        QR_CODE_SIZE: 180,
        QR_ERROR_CORRECTION: 'H'
    };

    // ======================
    // DOM ELEMENTS
    // ======================
    const elements = {
        cryptoAsset: document.getElementById('cryptoAsset'),
        networkType: document.getElementById('networkType'),
        walletDisplay: document.getElementById('walletDisplay'),
        selectedNetwork: document.getElementById('selectedNetwork'),
        qrCanvas: document.getElementById('qrCanvas'),
        copyBtn: document.getElementById('copyAddressBtn')
    };

    // ======================
    // INITIALIZATION
    // ======================
    document.addEventListener('DOMContentLoaded', () => {
        console.log(`[Deposit v${CONFIG.VERSION}] Initializing...`);
        
        // Verify critical DOM elements
        if (!validateElements()) {
            showCriticalError('Required elements missing');
            return;
        }

        // Set up event listeners
        setupEventListeners();

        // Initial UI update
        updateDepositDetails();
    });

    // ======================
    // CORE FUNCTIONS
    // ======================
    function validateElements() {
        let valid = true;
        Object.entries(elements).forEach(([key, element]) => {
            if (!element && key !== 'copyBtn') { // copyBtn is optional
                console.error(`[Deposit] Missing required element: ${key}`);
                valid = false;
            }
        });
        return valid;
    }

    function setupEventListeners() {
        // Asset/network selection
        elements.cryptoAsset.addEventListener('change', updateDepositDetails);
        elements.networkType.addEventListener('change', updateDepositDetails);

        // Copy button (if present)
        if (elements.copyBtn) {
            elements.copyBtn.addEventListener('click', handleCopyAddress);
        }
    }

    function updateDepositDetails() {
        const asset = elements.cryptoAsset.value;
        const network = elements.networkType.value;
        const address = getAddress(asset, network);

        updateAddressDisplay(address, asset, network);
        updateQRCode(address);
        updateCopyButton(address);
    }

    function getAddress(asset, network) {
        const address = CONFIG.ADDRESS_MAP[asset]?.[network] || '';
        return address.trim();
    }

    // ======================
    // UI UPDATES
    // ======================
    function updateAddressDisplay(address, asset, network) {
        if (address) {
            elements.walletDisplay.textContent = address;
            elements.selectedNetwork.textContent = 
                `${getSelectedText(elements.cryptoAsset)} (${getSelectedText(elements.networkType)})`;
        } else {
            elements.walletDisplay.textContent = 'Address not available for this selection.';
            elements.selectedNetwork.textContent = 
                `${getSelectedText(elements.cryptoAsset)} (${getSelectedText(elements.networkType)})`;
        }
    }

    function updateQRCode(address) {
        if (!address) {
            clearQRCode();
            return;
        }

        if (typeof QRCode === 'undefined') {
            showQRCodeError('QR Code library not loaded');
            return;
        }

        generateQRCode(address);
    }

    function updateCopyButton(address) {
        if (!elements.copyBtn) return;
        elements.copyBtn.disabled = !address;
    }

    // ======================
    // QR CODE FUNCTIONS
    // ======================
    function generateQRCode(address) {
        QRCode.toCanvas(
            elements.qrCanvas,
            address,
            {
                width: CONFIG.QR_CODE_SIZE,
                errorCorrectionLevel: CONFIG.QR_ERROR_CORRECTION
            },
            (error) => {
                if (error) {
                    console.error('[Deposit] QR Code generation failed:', error);
                    showQRCodeError('Error generating QR');
                } else {
                    console.log('[Deposit] QR Code generated successfully');
                }
            }
        );
    }

    function clearQRCode() {
        const ctx = elements.qrCanvas.getContext('2d');
        ctx.clearRect(0, 0, elements.qrCanvas.width, elements.qrCanvas.height);
        
        // Show placeholder if no address available
        if (elements.walletDisplay.textContent.includes('Address not available')) {
            showQRCodePlaceholder('Select asset and network');
        }
    }

    function showQRCodeError(message) {
        const ctx = elements.qrCanvas.getContext('2d');
        elements.qrCanvas.width = elements.qrCanvas.width; // Clear canvas
        ctx.fillStyle = 'red';
        ctx.font = '12px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(message, elements.qrCanvas.width / 2, elements.qrCanvas.height / 2);
    }

    function showQRCodePlaceholder(message) {
        const ctx = elements.qrCanvas.getContext('2d');
        ctx.fillStyle = '#888';
        ctx.font = '12px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(message, elements.qrCanvas.width / 2, elements.qrCanvas.height / 2);
    }

    // ======================
    // COPY FUNCTIONALITY
    // ======================
    async function handleCopyAddress() {
        const address = elements.walletDisplay.textContent;
        
        if (!address || address.includes('Address not available')) {
            showToast('No valid address to copy', 'error');
            return;
        }

        try {
            await navigator.clipboard.writeText(address);
            console.log('[Deposit] Address copied to clipboard');
            showCopySuccess();
        } catch (err) {
            console.error('[Deposit] Failed to copy address:', err);
            showToast('Failed to copy address', 'error');
        }
    }

    function showCopySuccess() {
        if (!elements.copyBtn) return;
        
        const originalHtml = elements.copyBtn.innerHTML;
        elements.copyBtn.innerHTML = '<i class="fas fa-check"></i> Copied!';
        
        setTimeout(() => {
            elements.copyBtn.innerHTML = originalHtml;
        }, 2000);
    }

    // ======================
    // HELPER FUNCTIONS
    // ======================
    function getSelectedText(selectElement) {
        return selectElement.options[selectElement.selectedIndex].text;
    }

    function showCriticalError(message) {
        console.error(`[Deposit] CRITICAL: ${message}`);
        // Implement your error display logic here
    }

    function showToast(message, type) {
        // Implement your toast notification system here
        console.log(`[Deposit] ${type.toUpperCase()}: ${message}`);
    }

    // ======================
    // INITIALIZATION
    // ======================
    initDeposit();
})();
