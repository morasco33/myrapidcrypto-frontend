document.addEventListener('DOMContentLoaded', function() {
  const registerForm = document.getElementById('registerForm');
  const messageEl = document.getElementById('message'); // Message display element
  const submitBtn = document.getElementById('registerBtn'); // Get button by ID for consistency

  // --- Use API_BASE_URL from global configuration in register.html ---
  if (!window.GLOBAL_KEYS || !window.GLOBAL_KEYS.API_BASE_URL) {
    console.error("CRITICAL: GLOBAL_KEYS.API_BASE_URL is not defined. Registration will fail.");
    if (messageEl) {
        messageEl.textContent = "Configuration error. Please contact support.";
        messageEl.className = 'form-message error';
    }
    if (submitBtn) submitBtn.disabled = true;
    return; // Stop execution if config is missing
  }
  const API_BASE_URL = window.GLOBAL_KEYS.API_BASE_URL;
  const originalButtonHtml = submitBtn ? submitBtn.innerHTML : 'Create Account'; // Store original button content


  if (registerForm && submitBtn) {
    registerForm.addEventListener('submit', async function(e) {
      e.preventDefault();

      // --- Clear previous messages ---
      if (messageEl) {
        messageEl.textContent = '';
        messageEl.className = 'form-message'; // Reset class
      }

      // --- Collect all form data from register.html ---
      const firstname = document.getElementById('firstname')?.value.trim();
      const lastname = document.getElementById('lastname')?.value.trim();
      const username = document.getElementById('username')?.value.trim();
      const email = document.getElementById('email')?.value.trim();
      const password = document.getElementById('password')?.value;
      const confirmPassword = document.getElementById('confirmPassword')?.value;
      const termsCheckbox = document.getElementById('terms'); // For terms and conditions

      // --- Client-Side Validation ---
      if (!firstname || !lastname || !username || !email || !password || !confirmPassword) {
        displayMessage('All fields are required.', 'error');
        return;
      }
      if (password !== confirmPassword) {
        displayMessage('Passwords do not match.', 'error');
        return;
      }
      if (password.length < 6) { // Match minlength in HTML
        displayMessage('Password must be at least 6 characters long.', 'error');
        return;
      }
      // Validate username length if needed (HTML has minlength="3")
      if (username.length < 3) {
        displayMessage('Username must be at least 3 characters long.', 'error');
        return;
      }
      // Validate email format (basic)
      const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailPattern.test(email)) {
        displayMessage('Please enter a valid email address.', 'error');
        return;
      }
      // Check terms and conditions if the checkbox exists
      if (termsCheckbox && !termsCheckbox.checked) {
        displayMessage('You must agree to the Terms and Conditions.', 'error');
        return;
      }

      // --- Prepare data for the backend ---
      // This must match what your backend /api/register expects
      const formData = {
        firstname,
        lastname,
        username,
        email,
        password
        // Do NOT send confirmPassword to the backend
      };

      try {
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Creating Account...';

        // --- Construct the correct API endpoint ---
        // API_BASE_URL should be like "https://your-backend.onrender.com" (NO /api)
        // Backend endpoint is "/api/register"
        const response = await fetch(`${API_BASE_URL}/api/register`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json' // Good practice
          },
          body: JSON.stringify(formData)
        });

        const data = await response.json(); // Attempt to parse JSON regardless of status for error messages

        if (!response.ok) {
          // Backend should send a 'message' field in its JSON error response
          throw new Error(data.message || `Registration failed with status: ${response.status}`);
        }

        // --- Handle Success ---
        // Backend sends { success: true, message: "Registered! Verification email sent." }
        displayMessage(data.message || 'Registration successful! Please check your email to verify.', 'success');

        // Optional: Clear form fields on success
        registerForm.reset(); 
        
        // Redirect to login page after a delay, passing a message
        setTimeout(() => {
          // The message from backend (data.message) is usually for the current page.
          // For login page, a more generic message is often better.
          window.location.href = `login.html?message=${encodeURIComponent('Registration successful! Please verify your email and log in.')}`;
        }, 3000); // 3-second delay

      } catch (error) {
        console.error('Registration error:', error);
        const errorMessage = error.message && error.message.includes('Failed to fetch')
          ? 'Network error. Please check your connection or try again later.'
          : (error.message || 'An unknown registration error occurred.');
        displayMessage(errorMessage, 'error');
      } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalButtonHtml; // Restore original button content
      }
    });
  } else {
    console.error("Register form or submit button not found.");
    if (messageEl) displayMessage("Registration form elements are missing. Please contact support.", 'error');
  }

  // --- Helper function to display messages ---
  function displayMessage(text, type = 'info') { // type can be 'info', 'success', or 'error'
    if (messageEl) {
      messageEl.textContent = text;
      messageEl.className = `form-message ${type}`; // Assumes you have CSS for .form-message.success, .form-message.error
    } else {
      // Fallback if messageEl is not found (though it should be)
      if (type === 'error') alert(`Error: ${text}`);
      else alert(text);
    }
  }
});