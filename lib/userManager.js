/**
 * User Manager & Gmail Authentication Handler
 * Features Persistent Disk Storage (data/db.json) for User Profiles, Chat Histories, and Broker Tokens.
 */

const fs = require('fs');
const path = require('path');

const DB_DIR = path.join(__dirname, '..', 'data');
const DB_FILE = path.join(DB_DIR, 'db.json');

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
          console.log(`[DB] Restored active Upstox Access Token from persistent storage!`);
        }
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
          text: `Welcome **${formattedName}**! 🎉 Your account (**${cleanEmail}**) is active. Live market prices and F&O data are streaming!`,
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
  user.chatHistory.push(message);
  saveDatabase();
  return user.chatHistory;
}

function getUserChatHistory(gmailId) {
  const cleanEmail = gmailId.trim().toLowerCase();
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
