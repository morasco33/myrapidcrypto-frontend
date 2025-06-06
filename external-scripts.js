// Logout & Navigation Control
document.addEventListener('DOMContentLoaded', () => {
  const token = localStorage.getItem('cryptohub_auth_token');
  const mainNavUl = document.querySelector('header nav ul');
  const loginNavItem = mainNavUl?.querySelector('li a[href="login.html"]')?.parentElement;
  const registerNavItem = mainNavUl?.querySelector('li a[href="register.html"]')?.parentElement;
  const logoutNavItemLi = document.getElementById('logoutNavItem');
  const logoutBtn = document.getElementById('logoutBtn');
  const footerLogout = document.getElementById('footerLogoutBtn');

  const handleLogout = () => {
    localStorage.removeItem('cryptohub_auth_token');
    localStorage.removeItem('cryptohub_user_info');
    window.location.href = 'login.html';
  };

  if (token) {
    loginNavItem?.style.setProperty('display', 'none');
    registerNavItem?.style.setProperty('display', 'none');
    logoutNavItemLi?.style.removeProperty('display');
    logoutBtn?.addEventListener('click', handleLogout);
    footerLogout?.addEventListener('click', handleLogout);
  } else {
    logoutNavItemLi?.style.setProperty('display', 'none');
    loginNavItem?.style.removeProperty('display');
    registerNavItem?.style.removeProperty('display');
  }
});

// Sentence Rotation
const sentencesForRotation = [
  "Unlock Financial Freedom...",
  "Effortless Wealth Generation...",
  "Join a Trusted Community...",
  "Risk-Free Investments...",
  "Rapid Results...",
  "Expert Guidance...",
  "Secure Your Future...",
  "Empower Your Financial Journey...",
  "Transformative Opportunities...",
  "Start Today, Benefit Tomorrow..."
];
let currentSentenceIndex = 0;
const sentenceDisplayElement = document.getElementById('sentenceElement');

function rotateDisplaySentence() {
  if (sentenceDisplayElement) {
    sentenceDisplayElement.innerHTML = `<p>${sentencesForRotation[currentSentenceIndex]}</p>`;
    currentSentenceIndex = (currentSentenceIndex + 1) % sentencesForRotation.length;
  }
}
if (sentenceDisplayElement) {
  setInterval(rotateDisplaySentence, 6000);
  rotateDisplaySentence();
}
