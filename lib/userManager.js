/**
 * User Manager & Gmail Authentication Handler
 * Features Persistent Disk Storage (data/db.json) with 12-Hour Chat Retention Auto-Cleanup.
 */

const fs = require('fs');
const path = require('path');

const DB_DIR = path.join(__dirname, '..', 'data');
const DB_FILE = path.join(DB_DIR, 'db.json');
const TWELVE_HOURS_MS = 12 * 60 * 60 * 1000;

if (!fs.existsSync(DB_DIR)) {
  fs.mkdirSync(DB_DIR, { recursive: true });
}

let dbState = {
  users: {},
  brokerConfig: {
    upstoxAccessToken: null,
    lastConnectedAt: null
  }
};

function loadDatabase() {
  try {
    if (fs.existsSync(DB_FILE)) {
      const raw = fs.readFileSync(DB_FILE, 'utf8');
      const parsed = JSON.parse(raw);
      if (parsed.users) {
        dbState = parsed;
        console.log(`[DB] Successfully loaded ${Object.keys(dbState.users).length} user account(s) from persistent disk storage.`);
        if (dbState.brokerConfig?.upstoxAccessToken) {
          process.env.UPSTOX_ACCESS_TOKEN = dbState.brokerConfig.upstoxAccessToken;
        }
        cleanExpiredChats();
        return;
      }
    }
  } catch (err) {
    console.warn('[DB] Failed to parse db.json, initializing fresh database:', err.message);
  }

  dbState = {
    users: {},
    brokerConfig: {
      upstoxAccessToken: process.env.UPSTOX_ACCESS_TOKEN || null,
      lastConnectedAt: null
    }
  };
  saveDatabase();
}

function saveDatabase() {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(dbState, null, 2), 'utf8');
  } catch (err) {
    console.error('[DB] Failed to save database to disk:', err.message);
  }
}

/**
 * 12-Hour Chat Auto-Cleanup Routine
 */
function cleanExpiredChats() {
  const now = Date.now();
  let modified = false;

  Object.keys(dbState.users).forEach(email => {
    const user = dbState.users[email];
    if (user && Array.isArray(user.chatHistory)) {
      const filtered = user.chatHistory.filter(msg => {
        if (!msg.timestamp) return true;
        const msgAge = now - new Date(msg.timestamp).getTime();
        return msgAge <= TWELVE_HOURS_MS;
      });

      if (filtered.length !== user.chatHistory.length) {
        user.chatHistory = filtered;
        modified = true;
      }
    }
  });

  if (modified) {
    saveDatabase();
    console.log('[DB] Expired chat messages older than 12 hours cleaned up automatically.');
  }
}

loadDatabase();

function saveUpstoxToken(token) {
  process.env.UPSTOX_ACCESS_TOKEN = token;
  dbState.brokerConfig = {
    upstoxAccessToken: token,
    lastConnectedAt: new Date().toISOString()
  };
  saveDatabase();
}

function getUpstoxToken() {
  return process.env.UPSTOX_ACCESS_TOKEN || dbState.brokerConfig?.upstoxAccessToken || null;
}

function loginWithGmail(gmailId, displayName = '') {
  if (!gmailId || !gmailId.includes('@')) {
    throw new Error('Please enter a valid Gmail ID (e.g. user@gmail.com)');
  }

  const cleanEmail = gmailId.trim().toLowerCase();
  cleanExpiredChats();

  if (!dbState.users[cleanEmail]) {
    const usernamePart = cleanEmail.split('@')[0];
    const formattedName = displayName || usernamePart.charAt(0).toUpperCase() + usernamePart.slice(1);

    dbState.users[cleanEmail] = {
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
          text: `Welcome **${formattedName}**! 🎉 Your private AI session is active. Live market prices and F&O data are streaming!`,
          timestamp: new Date().toISOString()
        }
      ]
    };
    saveDatabase();
  }

  return dbState.users[cleanEmail];
}

function addChatMessage(gmailId, message) {
  const cleanEmail = gmailId.trim().toLowerCase();
  let user = dbState.users[cleanEmail];
  if (!user) {
    user = loginWithGmail(cleanEmail);
  }

  cleanExpiredChats();
  user.chatHistory.push(message);
  saveDatabase();
  return user.chatHistory;
}

function getUserChatHistory(gmailId) {
  const cleanEmail = gmailId.trim().toLowerCase();
  cleanExpiredChats();
  const user = dbState.users[cleanEmail];
  return user ? user.chatHistory : [];
}

function clearUserHistory(gmailId) {
  const cleanEmail = gmailId.trim().toLowerCase();
  const user = dbState.users[cleanEmail];
  if (user) {
    user.chatHistory = [
      {
        id: `msg-${Date.now()}`,
        sender: 'bot',
        text: `Chat history cleared for **${user.name}**. Ask me any market query!`,
        timestamp: new Date().toISOString()
      }
    ];
    saveDatabase();
  }
  return user ? user.chatHistory : [];
}

module.exports = {
  loginWithGmail,
  addChatMessage,
  getUserChatHistory,
  clearUserHistory,
  saveUpstoxToken,
  getUpstoxToken
};
