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
  const token = userManager.getUpstoxToken();
  res.json({
    status: 'online',
    app: 'Options & Futures AI Chatbot Platform',
    upstoxConnected: !!token,
    dataSource: token ? 'Upstox API v2 Live Exchange Feed 🟢' : 'NSE Live Exchange Spot Feed 🟢',
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

function getDynamicRedirectUri(req) {
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  const protocol = req.headers['x-forwarded-proto'] || req.protocol;
  return `${protocol}://${host}/api/auth/upstox/callback`;
}

// Upstox OAuth Login Direct Redirect (Production Dedicated App: Diamond Chatbot)
app.get('/api/auth/upstox/login', (req, res) => {
  const apiKey = '6a578381-2643-480c-bbaf-fabd5f15ca26';
  const redirectUriRaw = getDynamicRedirectUri(req);
  const redirectUri = encodeURIComponent(redirectUriRaw);
  
  const authUrl = `https://api.upstox.com/v2/login/authorization/dialog?response_type=code&client_id=${apiKey}&redirect_uri=${redirectUri}`;
  console.log('[Upstox Login] Redirecting with API Key:', apiKey, 'and Redirect URI:', redirectUriRaw);
  res.redirect(authUrl);
});

// Upstox OAuth Callback Endpoint with Persistent Storage
app.get('/api/auth/upstox/callback', async (req, res) => {
  const { code } = req.query;
  if (!code) {
    return res.status(400).send('Authorization code missing from Upstox redirect.');
  }

  try {
    const apiKey = '6a578381-2643-480c-bbaf-fabd5f15ca26';
    const apiSecret = '98lifiqs5t';
    const redirectUri = getDynamicRedirectUri(req);

    console.log('[Upstox Callback] Exchanging code with API Key:', apiKey, 'and Redirect URI:', redirectUri);

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
      userManager.saveUpstoxToken(tokenData.access_token);
      console.log('[Upstox Callback] Successfully received and saved persistent access token!');

      return res.send(`
        <!DOCTYPE html>
        <html>
        <head><title>Upstox Connected</title></head>
        <body style="font-family:sans-serif; text-align:center; padding:40px; background:#090d16; color:#fff;">
          <h2 style="color:#22c55e;">⚡ Upstox Live Feed Connected Successfully!</h2>
          <p style="color:#8b9bb4;">Your dedicated broker data feed is now active on Diamond Chatbot.</p>
          <a href="/" style="display:inline-block; margin-top:20px; padding:12px 24px; background:#38bdf8; color:#000; text-decoration:none; border-radius:20px; font-weight:bold;">Return to Dashboard ➔</a>
        </body>
        </html>
      `);
    } else {
      return res.status(400).send(`<h2>Upstox Login Error</h2><pre>${JSON.stringify(tokenData, null, 2)}</pre>`);
    }
  } catch (err) {
    return res.status(500).send(`<h2>OAuth Exchange Error</h2><p>${err.message}</p>`);
  }
});

// Start Server
app.listen(PORT, () => {
  console.log(`====================================================`);
  console.log(`🚀 Options & Futures AI Chatbot Platform Running on Port ${PORT}`);
  console.log(`====================================================`);
});
