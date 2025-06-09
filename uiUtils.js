// File: public/uiUtils.js (Revised for Robust Initialization)

// --- Modal Elements (global scope within this file/module) ---
let appModalElement, modalTitleElement, modalBodyElement, modalFooterElement, modalCloseBtnElement;
let currentModalResolve = null; // To handle prompt-like behavior

function initializeModalElements() {
    appModalElement = document.getElementById('appModal');

    // ---- MODIFICATION START ----
    // Only proceed if the main modal container exists on the page.
    // If not, this page doesn't use these modals, so no warning is needed.
    if (!appModalElement) {
        // console.log("DEBUG (uiUtils.js): 'appModal' element not found. Modals will not be initialized for this page."); // Optional: for less alarming debugging
        return; // Exit silently
    }
    // ---- MODIFICATION END ----

    // If appModalElement exists, then we expect the other parts to exist too.
    // Now, if these are missing, it's a genuine setup problem for a page that *should* have modals.
    modalTitleElement = document.getElementById('modalTitle');
    modalBodyElement = document.getElementById('modalBody');
    modalFooterElement = document.getElementById('modalFooter');
    modalCloseBtnElement = document.getElementById('modalCloseBtn');

    if (modalTitleElement && modalBodyElement && modalFooterElement && modalCloseBtnElement) {
        console.log("DEBUG (uiUtils.js): All modal components found. Initializing modal event listeners.");
        modalCloseBtnElement.addEventListener('click', closeModal);
        appModalElement.addEventListener('click', (event) => {
            if (event.target === appModalElement) { // Click on overlay
                closeModal();
                if (currentModalResolve) { // If it was a prompt
                    currentModalResolve(null); // Resolve with null (cancel)
                    currentModalResolve = null;
                }
            }
        });
    } else {
        // This warning now only shows if 'appModal' was found but its children weren't,
        // indicating an incomplete modal HTML structure on a page that tries to use modals.
        console.warn("DEBUG WARNING (uiUtils.js): Main 'appModal' found, but some child modal elements (title, body, footer, closeBtn) are missing. Modals may not function correctly.");
    }
}

function showModal(title, bodyHtml, footerButtons = []) {
    // Check if core elements are initialized. If not, initializeModalElements might not have run or found them.
    if (!appModalElement) {
        // Attempt to initialize again, in case showModal is called before DOMContentLoaded fully finished
        // or if uiUtils was loaded dynamically after initial DOMContentLoaded.
        initializeModalElements(); 
        // If still not found after trying to initialize, then error out.
        if (!appModalElement) {
            console.error("DEBUG ERROR (uiUtils.js): Cannot show modal - 'appModal' element still missing after re-check. Falling back to alert.");
            alert(`Modal Title: ${title}\n${bodyHtml.replace(/<p>|<\/p>|<br\s*\/?>/gi, "\n")}`);
            return;
        }
    }
    // Also check for child elements, which should have been found if appModalElement was.
    if (!modalTitleElement || !modalBodyElement || !modalFooterElement) {
         console.error("DEBUG ERROR (uiUtils.js): Cannot show modal - child modal elements missing. Modal HTML structure might be incomplete.");
         alert(`Modal Title: ${title}\n${bodyHtml.replace(/<p>|<\/p>|<br\s*\/?>/gi, "\n")}`);
         return;
    }

    console.log(`DEBUG (uiUtils.js): Showing modal with title: ${title}`);

    modalTitleElement.textContent = title;
    modalBodyElement.innerHTML = bodyHtml;
    modalFooterElement.innerHTML = ''; // Clear previous buttons

    footerButtons.forEach(btnConfig => {
        const button = document.createElement('button');
        button.textContent = btnConfig.text;
        button.className = btnConfig.className || 'btn'; // Default to a generic 'btn' class
        button.type = 'button'; // Good practice for buttons not submitting forms

        button.addEventListener('click', () => {
            let preventCloseOnClick = btnConfig.preventClose || false;
            
            if (typeof btnConfig.onClick === 'function') {
                const onClickResult = btnConfig.onClick();
                // Allow onClick to explicitly prevent close
                if (onClickResult === false) { // e.g., if validation in onClick fails
                    preventCloseOnClick = true;
                }
            }
            if (!preventCloseOnClick) {
                 closeModal();
            }
        });
        modalFooterElement.appendChild(button);
    });

    appModalElement.style.display = 'flex';
    // Force a reflow before adding 'active' class for transition to work reliably
    void appModalElement.offsetWidth; 
    appModalElement.classList.add('active');
}

function closeModal() {
    if (appModalElement && appModalElement.classList.contains('active')) {
        console.log("DEBUG (uiUtils.js): Closing modal.");
        appModalElement.classList.remove('active');
        
        // Listen for transition end to set display: none, or use a timeout
        // This makes it more robust if CSS transition duration changes.
        const transitionEnded = (e) => {
            if (e.propertyName !== 'opacity' || appModalElement.classList.contains('active')) return; // Ensure it's the right transition and modal is indeed meant to be hidden
            appModalElement.style.display = 'none';
            appModalElement.removeEventListener('transitionend', transitionEnded);
        };
        appModalElement.addEventListener('transitionend', transitionEnded);

        // Fallback timeout in case transitionend doesn't fire (e.g., no transition defined in CSS)
        setTimeout(() => {
           if (!appModalElement.classList.contains('active')) { // Check again
               appModalElement.style.display = 'none';
               appModalElement.removeEventListener('transitionend', transitionEnded); // Clean up listener if timeout fires first
           }
        }, 500); // Should be slightly longer than your CSS transition duration

    } else if (appModalElement) {
        // If modal was not 'active' but somehow visible, just hide it.
        appModalElement.style.display = 'none';
    }

    if (currentModalResolve) {
        console.log("DEBUG (uiUtils.js): Resolving current prompt modal with null (cancel from generic close).");
        currentModalResolve(null); 
        currentModalResolve = null;
    }
}

function showPromptModal(title, message, inputType = 'text', placeholder = '') {
     // Similar check as in showModal
    if (!appModalElement) {
        initializeModalElements();
        if (!appModalElement) {
            console.error("DEBUG ERROR (uiUtils.js): Cannot show prompt modal - 'appModal' element missing. Falling back to browser prompt.");
            return Promise.resolve(prompt(message, placeholder));
        }
    }
    if (!modalTitleElement || !modalBodyElement || !modalFooterElement) {
         console.error("DEBUG ERROR (uiUtils.js): Cannot show prompt modal - child modal elements missing.");
         return Promise.resolve(prompt(message, placeholder));
    }
    console.log(`DEBUG (uiUtils.js): Showing prompt modal with title: ${title}`);

    return new Promise((resolve) => {
        currentModalResolve = resolve; // Store the resolve function

        modalTitleElement.textContent = title;
        modalBodyElement.innerHTML = `
            <p>${message.replace(/\n/g, "<br>")}</p>
            <input type="${inputType}" id="modalInputPrompt" class="modal-prompt-input" placeholder="${placeholder}" style="width: 100%; padding: 8px; box-sizing: border-box; margin-top: 10px; border: 1px solid #ccc; border-radius: 4px;">
        `; // Added some basic styling
        modalFooterElement.innerHTML = ''; // Clear previous buttons

        const confirmButton = document.createElement('button');
        confirmButton.textContent = 'OK';
        confirmButton.className = 'btn btn-primary modal-confirm-btn'; // Example classes
        confirmButton.type = 'button';
        confirmButton.addEventListener('click', () => {
            const inputElement = document.getElementById('modalInputPrompt');
            const value = inputElement ? inputElement.value : null;
            
            if (currentModalResolve) { // Check if it hasn't been resolved already
                currentModalResolve(value);
                currentModalResolve = null; // Clear it after resolving
            }
            closeModal(); // Close the modal
        });

        const cancelButton = document.createElement('button');
        cancelButton.textContent = 'Cancel';
        cancelButton.className = 'btn btn-secondary modal-cancel-btn'; // Example classes
        cancelButton.type = 'button';
        cancelButton.addEventListener('click', () => {
            if (currentModalResolve) { // Check if it hasn't been resolved already
                currentModalResolve(null); // Resolve with null for cancel
                currentModalResolve = null; // Clear it
            }
            closeModal(); // Close the modal
        });

        modalFooterElement.appendChild(cancelButton); // Standard order: Cancel, OK
        modalFooterElement.appendChild(confirmButton);
        
        appModalElement.style.display = 'flex';
        void appModalElement.offsetWidth; // Reflow
        appModalElement.classList.add('active');
        
        const modalInputElement = document.getElementById('modalInputPrompt');
        if (modalInputElement) {
            // Delay focus slightly to ensure modal is visible and input is interactive
            setTimeout(() => modalInputElement.focus(), 100); 
        }
    });
}

// --- Global UI Helper Functions (Example) ---
function showGlobalSuccessMessage(message, duration = 3000) {
    const id = 'ui-global-success-msg';
    let msgDiv = document.getElementById(id);
    if (!msgDiv) {
        msgDiv = document.createElement('div');
        msgDiv.id = id;
        // Basic styling, should be enhanced with CSS
        Object.assign(msgDiv.style, {
            position: 'fixed', top: '20px', left: '50%', transform: 'translateX(-50%)',
            backgroundColor: '#d4edda', color: '#155724', padding: '10px 20px',
            borderRadius: '5px', zIndex: '10000', boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
            opacity: '0', transition: 'opacity 0.3s ease-in-out'
        });
        document.body.appendChild(msgDiv);
    }
    msgDiv.textContent = message;
    requestAnimationFrame(() => { // Ensure element is in DOM before animating
        msgDiv.style.opacity = '1';
    });

    setTimeout(() => {
        msgDiv.style.opacity = '0';
        setTimeout(() => msgDiv.remove(), 300); // Remove after fade out
    }, duration);
}

function showGlobalErrorMessage(message, duration = 5000) {
    const id = 'ui-global-error-msg';
    let msgDiv = document.getElementById(id);
    if (!msgDiv) {
        msgDiv = document.createElement('div');
        msgDiv.id = id;
        Object.assign(msgDiv.style, {
            position: 'fixed', top: '20px', left: '50%', transform: 'translateX(-50%)',
            backgroundColor: '#f8d7da', color: '#721c24', padding: '10px 20px',
            borderRadius: '5px', zIndex: '10000', boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
            opacity: '0', transition: 'opacity 0.3s ease-in-out'
        });
        document.body.appendChild(msgDiv);
    }
    msgDiv.textContent = message;
     requestAnimationFrame(() => {
        msgDiv.style.opacity = '1';
    });
    setTimeout(() => {
        msgDiv.style.opacity = '0';
        setTimeout(() => msgDiv.remove(), 300);
    }, duration);
}


// Initialize modal elements when this script loads if DOM is ready, or on DOMContentLoaded
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeModalElements);
} else {
    // DOM is already ready (e.g. script loaded async or defer at end of body)
    initializeModalElements();
}

// Expose functions to global scope if needed by other scripts (optional, depends on your setup)
// window.uiUtils = {
//     showModal,
//     closeModal,
//     showPromptModal,
//     showGlobalSuccessMessage,
//     showGlobalErrorMessage
// };