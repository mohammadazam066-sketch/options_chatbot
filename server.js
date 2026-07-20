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

// Upstox OAuth Login Direct Redirect (Supports both localhost and Production domain)
app.get('/api/auth/upstox/login', (req, res) => {
  const apiKey = process.env.UPSTOX_API_KEY || '8c31c6b1-15ac-4812-87ab-9bfb4f62402b';
  
  // Build dynamic redirect URI for production (https://www.diamondchatbot.online/api/auth/upstox/callback)
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  const protocol = req.headers['x-forwarded-proto'] || req.protocol;
  const defaultCallback = `${protocol}://${host}/api/auth/upstox/callback`;
  
  const redirectUriRaw = process.env.UPSTOX_REDIRECT_URI || defaultCallback;
  const redirectUri = encodeURIComponent(redirectUriRaw);
  
  const authUrl = `https://api.upstox.com/v2/login/authorization/dialog?response_type=code&client_id=${apiKey}&redirect_uri=${redirectUri}`;
  console.log('[Upstox Login] Initiating OAuth redirect to:', redirectUriRaw);
  res.redirect(authUrl);
});

// Upstox OAuth Callback Endpoint for Production & Localhost
app.get('/api/auth/upstox/callback', async (req, res) => {
  const { code } = req.query;
  if (!code) {
    return res.status(400).send('Authorization code missing from Upstox redirect.');
  }

  try {
    const apiKey = process.env.UPSTOX_API_KEY || '8c31c6b1-15ac-4812-87ab-9bfb4f62402b';
    const apiSecret = process.env.UPSTOX_API_SECRET || 'egotcpt07r';
    
    const host = req.headers['x-forwarded-host'] || req.headers.host;
    const protocol = req.headers['x-forwarded-proto'] || req.protocol;
    const defaultCallback = `${protocol}://${host}/api/auth/upstox/callback`;
    const redirectUri = process.env.UPSTOX_REDIRECT_URI || defaultCallback;

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
      console.log('[Upstox Callback] Successfully received access token!');

      return res.send(`
        <!DOCTYPE html>
        <html>
        <head><title>Upstox Connected</title></head>
        <body style="font-family:sans-serif; text-align:center; padding:40px; background:#090d16; color:#fff;">
          <h2 style="color:#22c55e;">⚡ Upstox Connected Successfully!</h2>
          <p>Your live 24-hour exchange data feed is now active on OptionPulse AI.</p>
          <a href="/" style="display:inline-block; margin-top:20px; padding:10px 20px; background:#38bdf8; color:#000; text-decoration:none; border-radius:20px; font-weight:bold;">Return to Dashboard ➔</a>
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
