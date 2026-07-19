/**
 * OptionPulse AI Client Application
 * Features Welcome/Sign-In Screen Onboarding, Gmail Auth, Persistent Chat History, Theme Switcher & Upstox Live Stream
 */

// Application State
let activeGmailId = localStorage.getItem('activeGmailId') || null;
let activeUser = null;
let currentSymbol = 'NIFTY';
let currentTheme = localStorage.getItem('theme') || 'dark';
let allUsers = [];

// DOM Elements
const welcomeScreen = document.getElementById('welcomeScreen');
const welcomeLoginForm = document.getElementById('welcomeLoginForm');
const welcomeEmailInput = document.getElementById('welcomeEmailInput');
const welcomeNameInput = document.getElementById('welcomeNameInput');
const appContainer = document.getElementById('appContainer');

const userProfileBtn = document.getElementById('userProfileBtn');
const currentAvatar = document.getElementById('currentAvatar');
const currentUserName = document.getElementById('currentUserName');
const indexSelector = document.getElementById('indexSelector');
const chatWindow = document.getElementById('chatWindow');
const userInput = document.getElementById('userInput');
const sendBtn = document.getElementById('sendBtn');
const clearChatBtn = document.getElementById('clearChatBtn');
const userModal = document.getElementById('userModal');
const closeModalBtn = document.getElementById('closeModalBtn');
const presetUserList = document.getElementById('presetUserList');
const gmailLoginForm = document.getElementById('gmailLoginForm');
const gmailInput = document.getElementById('gmailInput');
const nameInput = document.getElementById('nameInput');
const signOutBtn = document.getElementById('signOutBtn');
const refreshStatsBtn = document.getElementById('refreshStatsBtn');
const refreshIcon = document.getElementById('refreshIcon');
const themeToggleBtn = document.getElementById('themeToggleBtn');
const themeIcon = document.getElementById('themeIcon');
const themeLabel = document.getElementById('themeLabel');
const connectBrokerBtn = document.getElementById('connectBrokerBtn');
const brokerStatusLabel = document.getElementById('brokerStatusLabel');
const dataSourceBadge = document.getElementById('dataSourceBadge');
const expiryBadge = document.getElementById('expiryBadge');
const toastNotification = document.getElementById('toastNotification');
const toastMsg = document.getElementById('toastMsg');

// Initialize Application
document.addEventListener('DOMContentLoaded', async () => {
  applyTheme(currentTheme);
  setupEventListeners();

  if (activeGmailId) {
    // User is already signed in
    welcomeScreen.classList.add('hidden');
    appContainer.classList.remove('hidden');

    checkBrokerStatus();
    loadUserAccounts();

    await loginUser(activeGmailId);
    await fetchChatHistory(activeGmailId);
    fetchMarketData();

    setInterval(fetchMarketData, 8000);
  } else {
    // Show Welcome Sign-In Screen First
    welcomeScreen.classList.remove('hidden');
    appContainer.classList.add('hidden');
  }
});

// Check Broker Status
async function checkBrokerStatus() {
  try {
    const res = await fetch('/api/health');
    const data = await res.json();
    if (data.upstoxConnected) {
      connectBrokerBtn.classList.add('connected');
      brokerStatusLabel.innerText = 'Upstox Connected 🟢';
      if (dataSourceBadge) dataSourceBadge.innerText = 'Upstox API Live 🔴';
    } else {
      connectBrokerBtn.classList.remove('connected');
      brokerStatusLabel.innerText = 'Connect Upstox';
      if (dataSourceBadge) dataSourceBadge.innerText = 'F&O Live Feed 🟢';
    }
  } catch (err) {
    console.warn('Health check warning:', err);
  }
}

// Theme Switcher
function applyTheme(theme) {
  currentTheme = theme;
  localStorage.setItem('theme', theme);
  if (theme === 'light') {
    document.body.classList.remove('dark-theme');
    document.body.classList.add('light-theme');
    themeIcon.innerText = '☀️';
    themeLabel.innerText = 'Light';
  } else {
    document.body.classList.remove('light-theme');
    document.body.classList.add('dark-theme');
    themeIcon.innerText = '🌙';
    themeLabel.innerText = 'Dark';
  }
}

function toggleTheme() {
  applyTheme(currentTheme === 'dark' ? 'light' : 'dark');
}

function showToast(message) {
  toastMsg.innerText = message;
  toastNotification.classList.remove('hidden');
  setTimeout(() => {
    toastNotification.classList.add('hidden');
  }, 2500);
}

// Setup Event Listeners
function setupEventListeners() {
  // Onboarding Welcome Form
  welcomeLoginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = welcomeEmailInput.value.trim();
    const name = welcomeNameInput.value.trim();
    if (email) {
      await performSignIn(email, name);
    }
  });

  // Demo chips on Welcome Screen
  document.querySelectorAll('.demo-chip-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const email = btn.getAttribute('data-email');
      await performSignIn(email);
    });
  });

  // Sign Out Button
  if (signOutBtn) {
    signOutBtn.addEventListener('click', () => {
      localStorage.removeItem('activeGmailId');
      activeGmailId = null;
      activeUser = null;
      userModal.classList.add('hidden');
      appContainer.classList.add('hidden');
      welcomeScreen.classList.remove('hidden');
    });
  }

  themeToggleBtn.addEventListener('click', toggleTheme);

  userProfileBtn.addEventListener('click', () => {
    loadUserAccounts();
    userModal.classList.remove('hidden');
  });

  closeModalBtn.addEventListener('click', () => {
    userModal.classList.add('hidden');
  });

  userModal.addEventListener('click', (e) => {
    if (e.target === userModal) userModal.classList.add('hidden');
  });

  gmailLoginForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const email = gmailInput.value.trim();
    const name = nameInput.value.trim();
    if (email) {
      loginUser(email, name);
      userModal.classList.add('hidden');
      gmailLoginForm.reset();
    }
  });

  indexSelector.addEventListener('change', (e) => {
    currentSymbol = e.target.value;
    document.getElementById('statsSymbol').innerText = currentSymbol;
    fetchMarketData();
  });

  sendBtn.addEventListener('click', sendMessage);
  userInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') sendMessage();
  });

  clearChatBtn.addEventListener('click', clearChat);

  document.querySelectorAll('.chip-btn').forEach(chip => {
    chip.addEventListener('click', () => {
      userInput.value = chip.getAttribute('data-query');
      sendMessage();
    });
  });

  document.querySelectorAll('.nav-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.view-section').forEach(v => v.classList.remove('active-view'));

      tab.classList.add('active');
      document.getElementById(tab.getAttribute('data-target')).classList.add('active-view');
    });
  });

  refreshStatsBtn.addEventListener('click', async () => {
    refreshIcon.classList.add('spin');
    await fetchMarketData();
    setTimeout(() => {
      refreshIcon.classList.remove('spin');
      showToast('⚡ Live market stats refreshed!');
    }, 600);
  });
}

// Perform Initial Sign In from Welcome Screen
async function performSignIn(email, name = '') {
  await loginUser(email, name);
  await fetchChatHistory(email);

  welcomeScreen.classList.add('hidden');
  appContainer.classList.remove('hidden');

  checkBrokerStatus();
  loadUserAccounts();
  fetchMarketData();

  setInterval(fetchMarketData, 8000);
}

// Login User
async function loginUser(gmailId, displayName = '') {
  try {
    const res = await fetch('/api/auth/gmail', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ gmailId, displayName })
    });
    const data = await res.json();
    if (data.success && data.user) {
      activeUser = data.user;
      activeGmailId = activeUser.gmailId;
      localStorage.setItem('activeGmailId', activeGmailId);

      currentAvatar.src = activeUser.avatar;
      currentUserName.innerText = activeUser.name;

      renderChatHistory(activeUser.chatHistory || []);
    }
  } catch (err) {
    console.error('Failed to log in user:', err);
  }
}

// Fetch Saved Chat History
async function fetchChatHistory(gmailId) {
  try {
    const res = await fetch(`/api/chat/history?gmailId=${encodeURIComponent(gmailId)}`);
    const data = await res.json();
    if (data.history) {
      renderChatHistory(data.history);
    }
  } catch (err) {
    console.error('Failed to fetch chat history:', err);
  }
}

// Load Accounts List for Modal
async function loadUserAccounts() {
  try {
    const res = await fetch('/api/users');
    const data = await res.json();
    allUsers = data.users || [];

    presetUserList.innerHTML = '';
    allUsers.forEach(user => {
      const isCurrent = activeGmailId && user.gmailId.toLowerCase() === activeGmailId.toLowerCase();
      const card = document.createElement('div');
      card.className = `user-card-item ${isCurrent ? 'active' : ''}`;
      card.innerHTML = `
        <img src="${user.avatar}" class="avatar-img">
        <div style="flex:1;">
          <div style="font-weight:600; font-size:13px;">${user.name} ${isCurrent ? '(Active)' : ''}</div>
          <div style="font-size:11px; color:var(--text-muted);">${user.gmailId} • ${user.style}</div>
        </div>
        <span style="font-size:11px; color:var(--accent-blue);">Select ➔</span>
      `;
      card.addEventListener('click', () => {
        loginUser(user.gmailId);
        userModal.classList.add('hidden');
      });
      presetUserList.appendChild(card);
    });
  } catch (err) {
    console.error('Failed to load user accounts:', err);
  }
}

// Send Message
async function sendMessage() {
  const text = userInput.value.trim();
  if (!text) return;

  userInput.value = '';

  appendChatBubble({
    sender: 'user',
    text: text,
    timestamp: new Date().toISOString()
  });

  const typingId = `typing-${Date.now()}`;
  appendTypingIndicator(typingId);

  try {
    const res = await fetch('/api/chat/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        gmailId: activeGmailId,
        message: text,
        symbol: currentSymbol
      })
    });
    const data = await res.json();

    removeElement(typingId);

    if (data.success && data.updatedHistory) {
      renderChatHistory(data.updatedHistory);
    } else if (data.message) {
      appendChatBubble(data.message);
    }
  } catch (err) {
    removeElement(typingId);
    appendChatBubble({
      sender: 'bot',
      text: '⚠️ Connection error. Please check if the server is running.',
      timestamp: new Date().toISOString()
    });
  }
}

// Clear Chat
async function clearChat() {
  if (!confirm('Are you sure you want to clear your saved chat history?')) return;
  try {
    const res = await fetch('/api/chat/clear', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ gmailId: activeGmailId })
    });
    const data = await res.json();
    if (data.history) {
      renderChatHistory(data.history);
    }
  } catch (err) {
    console.error('Failed to clear chat:', err);
  }
}

// Render Chat History
function renderChatHistory(history) {
  chatWindow.innerHTML = '';
  history.forEach(msg => appendChatBubble(msg));
  scrollToBottom();
}

function appendChatBubble(msg) {
  const bubble = document.createElement('div');
  bubble.className = `chat-bubble ${msg.sender}`;

  if (msg.sender === 'user') {
    bubble.innerText = msg.text;
  } else {
    bubble.innerHTML = window.marked ? marked.parse(msg.text) : msg.text;
  }

  const timeStr = msg.timestamp ? new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
  const timeSpan = document.createElement('div');
  timeSpan.className = 'timestamp';
  timeSpan.innerText = timeStr;
  bubble.appendChild(timeSpan);

  chatWindow.appendChild(bubble);
  scrollToBottom();
}

function appendTypingIndicator(id) {
  const bubble = document.createElement('div');
  bubble.id = id;
  bubble.className = 'chat-bubble bot';
  bubble.innerHTML = '⏳ <i>Analyzing market data with Gemini AI...</i>';
  chatWindow.appendChild(bubble);
  scrollToBottom();
}

function removeElement(id) {
  const el = document.getElementById(id);
  if (el) el.remove();
}

function scrollToBottom() {
  chatWindow.scrollTop = chatWindow.scrollHeight;
}

// Fetch Market Summary & Option Chain
async function fetchMarketData() {
  try {
    const [summaryRes, chainRes] = await Promise.all([
      fetch(`/api/market/summary?symbol=${currentSymbol}`),
      fetch(`/api/market/option-chain?symbol=${currentSymbol}`)
    ]);

    const summaryData = await summaryRes.json();
    const chainData = await chainRes.json();

    if (summaryData.summary) {
      updateMarketTicker(summaryData.summary);
      updateStatsWidget(summaryData.summary);
      if (summaryData.summary.expiryDate && expiryBadge) {
        expiryBadge.innerText = `Expiry: ${summaryData.summary.expiryDate}`;
      }
    }

    if (chainData.chain && chainData.chain.strikes) {
      renderOptionChainPreview(chainData.chain.strikes);
    }
  } catch (err) {
    console.warn('Market fetch warning:', err);
  }
}

function updateMarketTicker(s) {
  document.getElementById('tickerSpot').innerText = `₹${s.spotPrice}`;
  document.getElementById('tickerPcr').innerText = s.pcr;
  document.getElementById('tickerSupp').innerText = s.support.split('at ')[1]?.split(' ')[0] || '--';
  document.getElementById('tickerRes').innerText = s.resistance.split('at ')[1]?.split(' ')[0] || '--';
}

function updateStatsWidget(s) {
  document.getElementById('mSpot').innerText = `₹${s.spotPrice} (${s.change})`;
  document.getElementById('mPcr').innerText = `${s.pcr} (${s.sentiment})`;
  document.getElementById('mSupport').innerText = s.support;
  document.getElementById('mResistance').innerText = s.resistance;
  document.getElementById('mMaxPain').innerText = `₹${s.maxPain}`;
}

function renderOptionChainPreview(strikes) {
  const tbody = document.getElementById('optionChainBody');
  tbody.innerHTML = '';

  const atmIdx = strikes.findIndex(s => s.isATM);
  const start = Math.max(0, atmIdx - 3);
  const end = Math.min(strikes.length, atmIdx + 4);
  const sliced = strikes.slice(start, end);

  sliced.forEach(row => {
    const tr = document.createElement('tr');
    if (row.isATM) tr.className = 'atm-row';
    tr.innerHTML = `
      <td class="val-red">${row.call.oiChangeFormatted}</td>
      <td><strong>${row.strike}</strong> ${row.isATM ? '📌 ATM' : ''}</td>
      <td class="val-green">${row.put.oiChangeFormatted}</td>
    `;
    tbody.appendChild(tr);
  });
}
