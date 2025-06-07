// login.js (REPLACE YOUR CURRENT login.js WITH THIS)
// This simplified version lets auth.js handle the login form.

document.addEventListener('DOMContentLoaded', () => {
  console.log('DEBUG [login.js - Simplified]: DOMContentLoaded. login.js is loaded.');

  // This script is now simplified.
  // The main login form submission (for #loginForm) is handled by auth.js.

  // You can add any UI logic specific ONLY to the login.html page here,
  // as long as it doesn't try to re-handle the #loginForm submission.
  // For example, a show/hide password toggle button, or other minor UI tweaks.

  // Verify that the message div auth.js will use exists on this page.
  const loginMessageDiv = document.getElementById('loginMessage');
  if (!loginMessageDiv) {
      console.warn('WARN [login.js - Simplified]: The #loginMessage div (which auth.js uses for messages) was not found in login.html. Make sure your login.html has <div id="loginMessage" ...></div>.');
  } else {
      console.log('DEBUG [login.js - Simplified]: #loginMessage div found.');
  }
});

console.log('DEBUG [login.js - Simplified]: Script loaded.');