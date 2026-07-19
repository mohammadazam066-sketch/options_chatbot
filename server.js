/**
 * Express Backend Server
 * Options & Futures AI Chatbot Platform
 * Dual-Port Architecture: Port 3000 (Main Web Dashboard) & Port 5000 (Upstox OAuth Callback Handler)
 */

const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const { generateOptionChainAsync, getMarketSummaryAsync } = require('./lib/marketDataEngine');
const { loginWithGmail, getAllUsers, addChatMessage, getUserChatHistory, clearUserHistory } = require('./lib/userManager');
const { processUserQuery } = require('./lib/geminiChatbot');

const app = express();
const PORT = process.env.PORT || 3000;

// Upstox Credentials matching registered developer console settings (Redirect URI: http://127.0.0.1:5000/)
const UPSTOX_CLIENT_ID = process.env.UPSTOX_API_KEY || '8c31c6b1-15ac-4812-87ab-9bfb4f62402b';
const UPSTOX_CLIENT_SECRET = process.env.UPSTOX_API_SECRET || 'egotcpt07r';
const UPSTOX_REDIRECT_URI = 'http://127.0.0.1:5000/';

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Health Check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'online',
    app: 'Options & Futures AI Chatbot Platform',
    upstoxConnected: Boolean(process.env.UPSTOX_ACCESS_TOKEN),
    dataSource: process.env.UPSTOX_ACCESS_TOKEN ? 'Upstox API v2 Live Exchange Feed' : 'Yahoo Finance / NSE Live Exchange Spot Feed',
    timestamp: new Date().toISOString()
  });
});

// 1-Click Upstox Login Redirect (Redirects to registered Upstox URI http://127.0.0.1:5000/)
app.get('/api/auth/upstox/login', (req, res) => {
  const upstoxAuthUrl = `https://api.upstox.com/v2/login/authorization/dialog?response_type=code&client_id=${UPSTOX_CLIENT_ID}&redirect_uri=${encodeURIComponent(UPSTOX_REDIRECT_URI)}`;
  res.redirect(upstoxAuthUrl);
});

// Upstox OAuth Token Exchange Logic
async function handleUpstoxOAuthTokenExchange(code) {
  try {
    const tokenRes = await fetch('https://api.upstox.com/v2/login/authorization/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json'
      },
      body: new URLSearchParams({
        code: code,
        client_id: UPSTOX_CLIENT_ID,
        client_secret: UPSTOX_CLIENT_SECRET,
        redirect_uri: UPSTOX_REDIRECT_URI,
        grant_type: 'authorization_code'
      })
    });

    const tokenData = await tokenRes.json();
    if (tokenData.access_token) {
      process.env.UPSTOX_ACCESS_TOKEN = tokenData.access_token;

      // Persist token to .env file
      const envPath = path.join(__dirname, '.env');
      let envContent = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf8') : '';
      if (envContent.includes('UPSTOX_ACCESS_TOKEN=')) {
        envContent = envContent.replace(/UPSTOX_ACCESS_TOKEN=.*/g, `UPSTOX_ACCESS_TOKEN=${tokenData.access_token}`);
      } else {
        envContent += `\nUPSTOX_ACCESS_TOKEN=${tokenData.access_token}`;
      }
      fs.writeFileSync(envPath, envContent, 'utf8');
      console.log('[Upstox OAuth] Successfully connected! Access token saved to .env.');
      return true;
    } else {
      console.error('[Upstox Token Error]:', tokenData);
    }
  } catch (err) {
    console.error('[Upstox Token Exception]:', err.message);
  }
  return false;
}

// Gmail Auth
app.post('/api/auth/gmail', (req, res) => {
  try {
    const { gmailId, displayName } = req.body;
    if (!gmailId) return res.status(400).json({ error: 'Gmail ID is required.' });
    const userProfile = loginWithGmail(gmailId, displayName);
    res.json({ success: true, user: userProfile });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// List Users
app.get('/api/users', (req, res) => {
  res.json({ users: getAllUsers() });
});

// Chat History
app.get('/api/chat/history', (req, res) => {
  const gmailId = req.query.gmailId;
  if (!gmailId) return res.status(400).json({ error: 'gmailId required' });
  res.json({ history: getUserChatHistory(gmailId) });
});

// Send Chat Message
app.post('/api/chat/send', async (req, res) => {
  try {
    const { gmailId, message, symbol = 'NIFTY' } = req.body;
    if (!gmailId || !message) return res.status(400).json({ error: 'gmailId and message required' });

    const userProfile = loginWithGmail(gmailId);

    addChatMessage(gmailId, {
      id: `user-${Date.now()}`,
      sender: 'user',
      text: message,
      timestamp: new Date().toISOString()
    });

    const aiResult = await processUserQuery(message, symbol, userProfile);

    const botMsgObj = {
      id: `bot-${Date.now()}`,
      sender: 'bot',
      text: aiResult.text,
      type: aiResult.type || 'text',
      data: aiResult.data || null,
      timestamp: new Date().toISOString()
    };
    addChatMessage(gmailId, botMsgObj);

    res.json({
      success: true,
      message: botMsgObj,
      updatedHistory: getUserChatHistory(gmailId)
    });
  } catch (err) {
    console.error('Chat error:', err);
    res.status(500).json({ error: 'Failed to process chat message.' });
  }
});

// Clear Chat
app.post('/api/chat/clear', (req, res) => {
  const { gmailId } = req.body;
  if (!gmailId) return res.status(400).json({ error: 'gmailId required' });
  res.json({ success: true, history: clearUserHistory(gmailId) });
});

// Market Endpoints
app.get('/api/market/summary', async (req, res) => {
  try {
    const symbol = req.query.symbol || 'NIFTY';
    const summary = await getMarketSummaryAsync(symbol);
    res.json({ summary });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch market summary' });
  }
});

app.get('/api/market/option-chain', async (req, res) => {
  try {
    const symbol = req.query.symbol || 'NIFTY';
    const chain = await generateOptionChainAsync(symbol);
    res.json({ chain });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch option chain' });
  }
});

// Primary Web Server on Port 3000
app.listen(PORT, () => {
  console.log(`====================================================`);
  console.log(`🚀 Options & Futures AI Chatbot Platform Running!`);
  console.log(`📱 Access URL: http://localhost:${PORT}`);
  console.log(`====================================================`);
});

// Auxiliary Server on Port 5000 (Receives Upstox redirect http://127.0.0.1:5000/?code=...)
const oauthApp = express();
oauthApp.get('/', async (req, res) => {
  const code = req.query.code;
  if (code) {
    const success = await handleUpstoxOAuthTokenExchange(code);
    if (success) {
      return res.redirect(`http://localhost:${PORT}/?upstox=connected`);
    }
  }
  res.send('<h2>Upstox Authorization Completed! You can close this window and return to <a href="http://localhost:3000">OptionPulse AI Dashboard</a>.</h2>');
});

oauthApp.listen(5000, () => {
  console.log(`🔐 Upstox OAuth Redirect Listener active on http://127.0.0.1:5000/`);
});
