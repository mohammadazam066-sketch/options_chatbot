require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const userManager = require('./lib/userManager');
const geminiChatbot = require('./lib/geminiChatbot');
const marketEngine = require('./lib/marketDataEngine');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Health Check API
app.get('/api/health', (req, res) => {
  res.json({
    status: 'online',
    app: 'Options & Futures AI Chatbot Platform',
    upstoxConnected: !!process.env.UPSTOX_ACCESS_TOKEN,
    dataSource: process.env.UPSTOX_ACCESS_TOKEN ? 'Upstox API v2 Live Feed' : 'Yahoo Finance / NSE Live Exchange Spot Feed',
    timestamp: new Date().toISOString()
  });
});

// Gmail Sign-In / User Profile creation
app.post('/api/auth/gmail', (req, res) => {
  const { gmailId, displayName } = req.body;
  if (!gmailId) {
    return res.status(400).json({ error: 'Gmail ID is required.' });
  }

  const user = userManager.loginWithGmail(gmailId, displayName);
  return res.json({ success: true, user });
});

// Chat History Endpoint for a specific user
app.get('/api/chat/history', (req, res) => {
  const { gmailId } = req.query;
  if (!gmailId) {
    return res.status(400).json({ error: 'Gmail ID is required.' });
  }

  const history = userManager.getUserChatHistory(gmailId);
  return res.json({ gmailId, history });
});

// Send Message Endpoint (Processes message through Gemini AI + Live Market Data)
app.post('/api/chat/send', async (req, res) => {
  const { gmailId, message, symbol } = req.body;
  if (!gmailId || !message) {
    return res.status(400).json({ error: 'Gmail ID and message are required.' });
  }

  try {
    const user = userManager.loginWithGmail(gmailId);
    const responseMessage = await geminiChatbot.processUserQuery(message, symbol || 'NIFTY', user);
    const botText = typeof responseMessage === 'string' ? responseMessage : (responseMessage.text || 'Analysis complete.');
    
    // Save user question
    userManager.addChatMessage(gmailId, {
      id: `msg-user-${Date.now()}`,
      sender: 'user',
      text: message,
      timestamp: new Date().toISOString()
    });

    // Save bot response
    userManager.addChatMessage(gmailId, {
      id: `msg-bot-${Date.now()}`,
      sender: 'bot',
      text: botText,
      timestamp: new Date().toISOString()
    });

    const updatedHistory = userManager.getUserChatHistory(gmailId);

    return res.json({
      success: true,
      message: { sender: 'bot', text: botText, timestamp: new Date().toISOString() },
      updatedHistory
    });
  } catch (err) {
    console.error('[Chat Error]:', err);
    return res.status(500).json({ error: 'Failed to process AI chat query.', details: err.message });
  }
});

// Clear Chat History for a specific user
app.post('/api/chat/clear', (req, res) => {
  const { gmailId } = req.body;
  if (!gmailId) {
    return res.status(400).json({ error: 'Gmail ID is required.' });
  }

  const history = userManager.clearUserHistory(gmailId);
  return res.json({ success: true, history });
});

// Market Data Endpoints
app.get('/api/market/summary', async (req, res) => {
  const symbol = req.query.symbol || 'NIFTY';
  const summary = await marketEngine.getMarketSummaryAsync(symbol);
  return res.json({ summary });
});

app.get('/api/market/option-chain', async (req, res) => {
  const symbol = req.query.symbol || 'NIFTY';
  const chain = await marketEngine.generateOptionChainAsync(symbol);
  return res.json({ chain });
});

// Upstox OAuth Login Direct Redirect
app.get('/api/auth/upstox/login', (req, res) => {
  const apiKey = process.env.UPSTOX_API_KEY || '8c31c6b1-15ac-4812-87ab-9bfb4f62402b';
  const redirectUri = encodeURIComponent(process.env.UPSTOX_REDIRECT_URI || 'http://127.0.0.1:5000/');
  const authUrl = `https://api.upstox.com/v2/login/authorization/dialog?response_type=code&client_id=${apiKey}&redirect_uri=${redirectUri}`;
  res.redirect(authUrl);
});

// Upstox OAuth Callback Endpoint for Production
app.get('/api/auth/upstox/callback', async (req, res) => {
  const { code } = req.query;
  if (!code) {
    return res.status(400).send('Authorization code missing from Upstox redirect.');
  }

  try {
    const apiKey = process.env.UPSTOX_API_KEY || '8c31c6b1-15ac-4812-87ab-9bfb4f62402b';
    const apiSecret = process.env.UPSTOX_API_SECRET || 'egotcpt07r';
    const redirectUri = process.env.UPSTOX_REDIRECT_URI || 'http://127.0.0.1:5000/';

    const response = await fetch('https://api.upstox.com/v2/login/authorization/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json'
      },
      body: new URLSearchParams({
        code: code,
        client_id: apiKey,
        client_secret: apiSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code'
      })
    });

    const tokenData = await response.json();

    if (tokenData.access_token) {
      process.env.UPSTOX_ACCESS_TOKEN = tokenData.access_token;
      
      const envPath = path.join(__dirname, '.env');
      let envContent = '';
      if (fs.existsSync(envPath)) {
        envContent = fs.readFileSync(envPath, 'utf8');
      }

      if (envContent.includes('UPSTOX_ACCESS_TOKEN=')) {
        envContent = envContent.replace(/UPSTOX_ACCESS_TOKEN=.*/, `UPSTOX_ACCESS_TOKEN=${tokenData.access_token}`);
      } else {
        envContent += `\nUPSTOX_ACCESS_TOKEN=${tokenData.access_token}\n`;
      }

      fs.writeFileSync(envPath, envContent);
      return res.send('<h2>Upstox Connected Successfully!</h2><p>You can close this window.</p>');
    } else {
      return res.status(400).json({ error: 'Failed to retrieve access token.', details: tokenData });
    }
  } catch (err) {
    return res.status(500).json({ error: 'OAuth exchange failed.', message: err.message });
  }
});

// Start Server
app.listen(PORT, () => {
  console.log(`====================================================`);
  console.log(`🚀 Options & Futures AI Chatbot Platform Running on Port ${PORT}`);
  console.log(`====================================================`);
});
