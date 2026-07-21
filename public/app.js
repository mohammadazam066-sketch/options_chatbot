/**
 * OptionPulse AI Client Application
 * Features Strict Private Onboarding, Gmail Auth, 12-Hour Retention Dual-Sync Chat History, Theme Switcher & Upstox Live Stream
 */

// Application State
let activeGmailId = localStorage.getItem('activeGmailId') || null;
let activeUser = null;
let currentSymbol = 'NIFTY';
let currentTheme = localStorage.getItem('theme') || 'dark';

const TWELVE_HOURS_MS = 12 * 60 * 60 * 1000;

// STRICT ADMIN EMAIL ONLY
const ADMIN_EMAIL = 'mohammadazam066@gmail.com';

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
const myAvatar = document.getElementById('myAvatar');
const myProfileName = document.getElementById('myProfileName');
const myProfileEmail = document.getElementById('myProfileEmail');
const adminSlot = document.getElementById('adminSlot');
const signOutBtn = document.getElementById('signOutBtn');

const refreshStatsBtn = document.getElementById('refreshStatsBtn');
const refreshIcon = document.getElementById('refreshIcon');
const themeToggleBtn = document.getElementById('themeToggleBtn');
const themeIcon = document.getElementById('themeIcon');
const themeLabel = document.getElementById('themeLabel');
const dataSourceBadge = document.getElementById('dataSourceBadge');
const expiryBadge = document.getElementById('expiryBadge');
const toastNotification = document.getElementById('toastNotification');
const toastMsg = document.getElementById('toastMsg');

// Initialize Application
document.addEventListener('DOMContentLoaded', async () => {
  applyTheme(currentTheme);
  setupEventListeners();

  if (activeGmailId && activeGmailId.trim().length > 0) {
    await startUserSession(activeGmailId);
  } else {
    showWelcomeScreen();
  }
});

function showWelcomeScreen() {
  localStorage.removeItem('activeGmailId');
  activeGmailId = null;
  activeUser = null;

  if (welcomeEmailInput) welcomeEmailInput.value = '';
  if (welcomeNameInput) welcomeNameInput.value = '';

  if (userModal) userModal.classList.add('hidden');
  if (appContainer) appContainer.classList.add('hidden');
  if (welcomeScreen) welcomeScreen.classList.remove('hidden');
}

async function startUserSession(email, name = '') {
  try {
    // Render Local Backup (filtered for 12-hour validity)
    const localBackup = getLocalChatBackup(email);
    if (localBackup && localBackup.length > 0) {
      renderChatHistory(localBackup);
    }

    await loginUser(email, name);
    await fetchChatHistory(email);

    if (welcomeScreen) welcomeScreen.classList.add('hidden');
    if (appContainer) appContainer.classList.remove('hidden');

    checkBrokerStatus();
    fetchMarketData();
  } catch (err) {
    console.error('[Session Error]:', err);
    if (welcomeScreen) welcomeScreen.classList.add('hidden');
    if (appContainer) appContainer.classList.remove('hidden');
  }
}

// LocalStorage Backup Helpers with 12-Hour Auto Expiry
function getLocalChatBackup(gmailId) {
  try {
    const key = `optionpulse_chat_${gmailId.toLowerCase().trim()}`;
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const history = JSON.parse(raw);
    const now = Date.now();
    const valid = history.filter(msg => {
      if (!msg.timestamp) return true;
      return (now - new Date(msg.timestamp).getTime()) <= TWELVE_HOURS_MS;
    });

    if (valid.length !== history.length) {
      saveLocalChatBackup(gmailId, valid);
    }
    return valid;
  } catch (e) {
    return null;
  }
}

function saveLocalChatBackup(gmailId, history) {
  try {
    const key = `optionpulse_chat_${gmailId.toLowerCase().trim()}`;
    localStorage.setItem(key, JSON.stringify(history));
  } catch (e) {
    console.warn('Failed to save chat to localStorage backup:', e);
  }
}

// Merges server and local chat histories within 12-hour window
function mergeHistories(serverHist = [], localHist = []) {
  const now = Date.now();
  const filterOld = list => list.filter(item => {
    if (!item || !item.text) return false;
    if (!item.timestamp) return true;
    return (now - new Date(item.timestamp).getTime()) <= TWELVE_HOURS_MS;
  });

  const validServer = filterOld(serverHist);
  const validLocal = filterOld(localHist);

  const map = new Map();
  validLocal.forEach(item => map.set(item.id || item.text, item));
  validServer.forEach(item => map.set(item.id || item.text, item));

  return Array.from(map.values()).sort((a, b) => new Date(a.timestamp || 0) - new Date(b.timestamp || 0));
}

// Check Broker Status
async function checkBrokerStatus() {
  try {
    const res = await fetch('/api/health');
    const data = await res.json();
    if (data.upstoxConnected) {
      if (dataSourceBadge) dataSourceBadge.innerText = 'Upstox API Live 🟢';
    } else {
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
    if (themeIcon) themeIcon.innerText = '☀️';
    if (themeLabel) themeLabel.innerText = 'Light';
  } else {
    document.body.classList.remove('light-theme');
    document.body.classList.add('dark-theme');
    if (themeIcon) themeIcon.innerText = '🌙';
    if (themeLabel) themeLabel.innerText = 'Dark';
  }
}

function toggleTheme() {
  applyTheme(currentTheme === 'dark' ? 'light' : 'dark');
}

function showToast(message) {
  if (!toastNotification || !toastMsg) return;
  toastMsg.innerText = message;
  toastNotification.classList.remove('hidden');
  setTimeout(() => {
    toastNotification.classList.add('hidden');
  }, 2500);
}

// Setup Event Listeners
function setupEventListeners() {
  if (welcomeLoginForm) {
    welcomeLoginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = welcomeEmailInput ? welcomeEmailInput.value.trim() : '';
      const name = welcomeNameInput ? welcomeNameInput.value.trim() : '';
      if (email) {
        await startUserSession(email, name);
      }
    });
  }

  if (signOutBtn) {
    signOutBtn.addEventListener('click', (e) => {
      e.preventDefault();
      showWelcomeScreen();
    });
  }

  if (themeToggleBtn) themeToggleBtn.addEventListener('click', toggleTheme);

  // My Account Modal
  if (userProfileBtn) {
    userProfileBtn.addEventListener('click', () => {
      if (activeUser) {
        if (myAvatar) myAvatar.src = activeUser.avatar;
        if (myProfileName) myProfileName.innerText = activeUser.name;
        if (myProfileEmail) myProfileEmail.innerText = activeUser.gmailId;

        const currentEmail = (activeUser.gmailId || '').trim().toLowerCase();
        if (adminSlot) {
          if (currentEmail === ADMIN_EMAIL) {
            adminSlot.innerHTML = `
              <div style="margin-top:14px; padding:12px; background:rgba(34, 197, 94, 0.08); border:1px solid rgba(34, 197, 94, 0.3); border-radius:10px; text-align:center;">
                <span style="font-size:11px; color:var(--text-muted); display:block; margin-bottom:6px;">⚡ Owner Broker Data Controller:</span>
                <a href="/api/auth/upstox/login" style="display:inline-flex; align-items:center; gap:6px; background:var(--accent-green); color:#000; font-weight:700; font-size:12px; padding:8px 14px; border-radius:20px; text-decoration:none;">
                  ⚡ Connect Upstox Live Feed
                </a>
              </div>
            `;
          } else {
            adminSlot.innerHTML = '';
          }
        }
      }
      if (userModal) userModal.classList.remove('hidden');
    });
  }

  if (closeModalBtn) {
    closeModalBtn.addEventListener('click', () => {
      if (userModal) userModal.classList.add('hidden');
    });
  }

  if (userModal) {
    userModal.addEventListener('click', (e) => {
      if (e.target === userModal) userModal.classList.add('hidden');
    });
  }

  if (indexSelector) {
    indexSelector.addEventListener('change', (e) => {
      currentSymbol = e.target.value;
      const statsSymbol = document.getElementById('statsSymbol');
      if (statsSymbol) statsSymbol.innerText = currentSymbol;
      fetchMarketData();
    });
  }

  if (sendBtn) sendBtn.addEventListener('click', sendMessage);
  if (userInput) {
    userInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') sendMessage();
    });
  }

  if (clearChatBtn) clearChatBtn.addEventListener('click', clearChat);

  document.querySelectorAll('.chip-btn').forEach(chip => {
    chip.addEventListener('click', () => {
      if (userInput) {
        userInput.value = chip.getAttribute('data-query');
        sendMessage();
      }
    });
  });

  document.querySelectorAll('.nav-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.view-section').forEach(v => v.classList.remove('active-view'));

      tab.classList.add('active');
      const targetView = document.getElementById(tab.getAttribute('data-target'));
      if (targetView) targetView.classList.add('active-view');
    });
  });

  if (refreshStatsBtn) {
    refreshStatsBtn.addEventListener('click', async () => {
      if (refreshIcon) refreshIcon.classList.add('spin');
      await fetchMarketData();
      setTimeout(() => {
        if (refreshIcon) refreshIcon.classList.remove('spin');
        showToast('⚡ Live market stats refreshed!');
      }, 600);
    });
  }
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

      if (currentAvatar) currentAvatar.src = activeUser.avatar;
      if (currentUserName) currentUserName.innerText = activeUser.name;

      const localBackup = getLocalChatBackup(activeGmailId) || [];
      const merged = mergeHistories(data.user.chatHistory || [], localBackup);
      renderChatHistory(merged);
      saveLocalChatBackup(activeGmailId, merged);
    }
  } catch (err) {
    console.error('Failed to log in user:', err);
    activeUser = {
      gmailId: gmailId,
      name: displayName || gmailId.split('@')[0],
      avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(gmailId)}`,
      chatHistory: getLocalChatBackup(gmailId) || []
    };
    activeGmailId = gmailId;
    localStorage.setItem('activeGmailId', activeGmailId);
    if (currentAvatar) currentAvatar.src = activeUser.avatar;
    if (currentUserName) currentUserName.innerText = activeUser.name;
  }
}

// Fetch Saved Chat History
async function fetchChatHistory(gmailId) {
  try {
    const res = await fetch(`/api/chat/history?gmailId=${encodeURIComponent(gmailId)}`);
    const data = await res.json();
    const localBackup = getLocalChatBackup(gmailId) || [];
    const merged = mergeHistories(data.history || [], localBackup);
    renderChatHistory(merged);
    saveLocalChatBackup(gmailId, merged);
  } catch (err) {
    console.error('Failed to fetch chat history:', err);
    const backup = getLocalChatBackup(gmailId);
    if (backup && backup.length > 0) {
      renderChatHistory(backup);
    }
  }
}

// Send Message
async function sendMessage() {
  if (!userInput) return;
  const text = userInput.value.trim();
  if (!text) return;

  userInput.value = '';

  const userMsgObj = {
    id: `msg-user-${Date.now()}`,
    sender: 'user',
    text: text,
    timestamp: new Date().toISOString()
  };

  appendChatBubble(userMsgObj);

  const currentBackup = getLocalChatBackup(activeGmailId) || [];
  currentBackup.push(userMsgObj);
  saveLocalChatBackup(activeGmailId, currentBackup);

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
      const merged = mergeHistories(data.updatedHistory, getLocalChatBackup(activeGmailId) || []);
      renderChatHistory(merged);
      saveLocalChatBackup(activeGmailId, merged);
    } else if (data.message) {
      appendChatBubble(data.message);
      currentBackup.push(data.message);
      saveLocalChatBackup(activeGmailId, currentBackup);
    }
  } catch (err) {
    removeElement(typingId);
    appendChatBubble({
      sender: 'bot',
      text: '⚠️ Connection error. Please check your internet connection.',
      timestamp: new Date().toISOString()
    });
  }
}

// Clear Chat
async function clearChat() {
  if (!confirm('Are you sure you want to clear your saved chat history?')) return;
  try {
    localStorage.removeItem(`optionpulse_chat_${activeGmailId.toLowerCase().trim()}`);
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
  if (!chatWindow) return;
  chatWindow.innerHTML = '';
  if (Array.isArray(history)) {
    history.forEach(msg => appendChatBubble(msg));
  }
  scrollToBottom();
}

function appendChatBubble(msg) {
  if (!chatWindow) return;
  const bubble = document.createElement('div');
  bubble.className = `chat-bubble ${msg.sender}`;

  const textContent = msg.text || (typeof msg === 'string' ? msg : '');

  if (msg.sender === 'user') {
    bubble.innerText = textContent;
  } else {
    bubble.innerHTML = window.marked ? marked.parse(textContent) : textContent;
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
  if (!chatWindow) return;
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
  if (chatWindow) chatWindow.scrollTop = chatWindow.scrollHeight;
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
    }

    if (chainData.chain && chainData.chain.strikes) {
      renderOptionChainPreview(chainData.chain.strikes);
    }
  } catch (err) {
    console.warn('Market fetch warning:', err);
  }
}

function updateMarketTicker(s) {
  const spot = document.getElementById('tickerSpot');
  const expiry = document.getElementById('tickerExpiry');
  const pcr = document.getElementById('tickerPcr');
  const supp = document.getElementById('tickerSupp');
  const res = document.getElementById('tickerRes');

  if (spot) spot.innerText = `₹${s.spotPrice}`;
  if (expiry) expiry.innerText = s.expiryDate || '--';
  if (pcr) pcr.innerText = s.pcr;
  if (supp) supp.innerText = s.support.split('at ')[1]?.split(' ')[0] || '--';
  if (res) res.innerText = s.resistance.split('at ')[1]?.split(' ')[0] || '--';
}

function updateStatsWidget(s) {
  const mSpot = document.getElementById('mSpot');
  const mExpiry = document.getElementById('mExpiry');
  const mPcr = document.getElementById('mPcr');
  const mSupport = document.getElementById('mSupport');
  const mResistance = document.getElementById('mResistance');
  const mMaxPain = document.getElementById('mMaxPain');

  if (mSpot) mSpot.innerText = `₹${s.spotPrice} (${s.change})`;
  if (mExpiry) mExpiry.innerText = s.expiryDate || '--';
  if (mPcr) mPcr.innerText = `${s.pcr} (${s.sentiment})`;
  if (mSupport) mSupport.innerText = s.support;
  if (mResistance) mResistance.innerText = s.resistance;
  if (mMaxPain) mMaxPain.innerText = `₹${s.maxPain}`;
  if (expiryBadge) expiryBadge.innerText = `Expiry: ${s.expiryDate || 'Weekly'}`;
}

function renderOptionChainPreview(strikes) {
  const tbody = document.getElementById('optionChainBody');
  if (!tbody) return;
  tbody.innerHTML = '';

  const atmIdx = strikes.findIndex(s => s.isATM);
  const start = Math.max(0, atmIdx - 3);
  const end = Math.min(strikes.length, atmIdx + 4);
  const sliced = strikes.slice(start, end);

  sliced.forEach(row => {
    const tr = document.createElement('tr');
    if (row.isATM) tr.className = 'atm-row';

    const callDisplay = row.call.oiFormatted || '0';
    const putDisplay = row.put.oiFormatted || '0';

    tr.innerHTML = `
      <td class="val-red">${callDisplay}</td>
      <td><strong>${row.strike}</strong> ${row.isATM ? '📌 ATM' : ''}</td>
      <td class="val-green">${putDisplay}</td>
    `;
    tbody.appendChild(tr);
  });
}
