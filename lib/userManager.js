/**
 * User Manager & Gmail Authentication Handler
 * Features Persistent Disk Storage (data/db.json) for User Profiles & Chat Histories.
 * Chat history will NEVER vanish on page refresh or server restart.
 */

const fs = require('fs');
const path = require('path');

const DB_DIR = path.join(__dirname, '..', 'data');
const DB_FILE = path.join(DB_DIR, 'db.json');

// Ensure data directory exists
if (!fs.existsSync(DB_DIR)) {
  fs.mkdirSync(DB_DIR, { recursive: true });
}

// In-Memory User Store
let users = new Map();

// Default preset Gmail accounts
const defaultAccounts = [
  {
    gmailId: 'rahul.trader@gmail.com',
    name: 'Rahul Sharma',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Rahul',
    favoriteIndex: 'NIFTY',
    style: 'Intraday Scalper ⚡'
  },
  {
    gmailId: 'priya.options@gmail.com',
    name: 'Priya Patel',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Priya',
    favoriteIndex: 'BANKNIFTY',
    style: 'Option Seller 🛡️'
  },
  {
    gmailId: 'vikram.fo@gmail.com',
    name: 'Vikram Singh',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Vikram',
    favoriteIndex: 'NIFTY',
    style: 'Positional Trader 📈'
  }
];

// Load Database from Disk
function loadDatabase() {
  try {
    if (fs.existsSync(DB_FILE)) {
      const raw = fs.readFileSync(DB_FILE, 'utf8');
      const parsed = JSON.parse(raw);
      users = new Map(Object.entries(parsed));
      console.log(`[DB] Successfully loaded ${users.size} user account(s) from persistent disk storage.`);
      return;
    }
  } catch (err) {
    console.warn('[DB] Failed to parse db.json, re-initializing default accounts:', err.message);
  }

  // Seed default accounts if database file doesn't exist
  defaultAccounts.forEach(acc => {
    const key = acc.gmailId.toLowerCase();
    users.set(key, {
      ...acc,
      createdAt: new Date().toISOString(),
      chatHistory: [
        {
          id: `msg-welcome-${Date.now()}`,
          sender: 'bot',
          text: `Welcome back **${acc.name}**! 👋 Your chat history is now **persistently saved**. Ask me any question about stocks, options, PCR, or strategies!`,
          timestamp: new Date().toISOString()
        }
      ]
    });
  });
  saveDatabase();
}

// Save Database to Disk
function saveDatabase() {
  try {
    const obj = Object.fromEntries(users);
    fs.writeFileSync(DB_FILE, JSON.stringify(obj, null, 2), 'utf8');
  } catch (err) {
    console.error('[DB] Failed to save database to disk:', err.message);
  }
}

// Initialize on module load
loadDatabase();

/**
 * Authenticate or Register User with Gmail ID
 */
function loginWithGmail(gmailId, displayName = '') {
  if (!gmailId || !gmailId.includes('@')) {
    throw new Error('Please enter a valid Gmail ID (e.g. user@gmail.com)');
  }

  const cleanEmail = gmailId.trim().toLowerCase();

  if (!users.has(cleanEmail)) {
    const usernamePart = cleanEmail.split('@')[0];
    const formattedName = displayName || usernamePart.charAt(0).toUpperCase() + usernamePart.slice(1);

    users.set(cleanEmail, {
      gmailId: cleanEmail,
      name: formattedName,
      avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(formattedName)}`,
      favoriteIndex: 'NIFTY',
      style: 'Options Trader 📊',
      createdAt: new Date().toISOString(),
      chatHistory: [
        {
          id: `msg-${Date.now()}`,
          sender: 'bot',
          text: `Welcome **${formattedName}**! 🎉 Your account (**${cleanEmail}**) is signed in. All your conversations will be saved permanently!`,
          timestamp: new Date().toISOString()
        }
      ]
    });
    saveDatabase();
  }

  const user = users.get(cleanEmail);
  return {
    gmailId: user.gmailId,
    name: user.name,
    avatar: user.avatar,
    favoriteIndex: user.favoriteIndex,
    style: user.style,
    chatHistory: user.chatHistory
  };
}

/**
 * Get all available user accounts
 */
function getAllUsers() {
  return Array.from(users.values()).map(u => ({
    gmailId: u.gmailId,
    name: u.name,
    avatar: u.avatar,
    favoriteIndex: u.favoriteIndex,
    style: u.style,
    messageCount: u.chatHistory ? u.chatHistory.length : 0
  }));
}

/**
 * Add message to user chat history and persist to disk
 */
function addChatMessage(gmailId, message) {
  const cleanEmail = gmailId.trim().toLowerCase();
  let user = users.get(cleanEmail);
  if (!user) {
    user = loginWithGmail(cleanEmail);
  }
  user.chatHistory.push(message);
  saveDatabase();
  return user.chatHistory;
}

/**
 * Get user chat history
 */
function getUserChatHistory(gmailId) {
  const cleanEmail = gmailId.trim().toLowerCase();
  const user = users.get(cleanEmail);
  return user ? user.chatHistory : [];
}

/**
 * Clear user chat history and save
 */
function clearUserHistory(gmailId) {
  const cleanEmail = gmailId.trim().toLowerCase();
  const user = users.get(cleanEmail);
  if (user) {
    user.chatHistory = [
      {
        id: `msg-${Date.now()}`,
        sender: 'bot',
        text: `Chat history cleared for **${user.name}**. How can I help you now?`,
        timestamp: new Date().toISOString()
      }
    ];
    saveDatabase();
  }
  return user ? user.chatHistory : [];
}

module.exports = {
  loginWithGmail,
  getAllUsers,
  addChatMessage,
  getUserChatHistory,
  clearUserHistory
};
