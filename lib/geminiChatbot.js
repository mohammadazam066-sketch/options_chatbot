/**
 * Gemini Live Conversational AI Engine - Balanced F&O Trading Advisor
 * Delivers clear, professional, well-explained trade setups with optimal depth.
 */

const { getMarketSummaryAsync } = require('./marketDataEngine');

const KNOWLEDGE_BASE = {
  greetings: ['hi', 'hello', 'hey', 'good morning', 'good afternoon', 'good evening', 'wassup'],
  buyingAdvice: ['buy call', 'buy put', 'should i buy', 'safe to buy', 'call or put', 'trade today', 'entry', 'should i trade', 'suggest trade', 'best trade', 'trade setup']
};

/**
 * Main Conversational Entrypoint (Supports NIFTY, BANKNIFTY, and BSE SENSEX)
 */
async function processUserQuery(userQuery, symbol = 'NIFTY', userContext = {}) {
  const queryLower = userQuery.toLowerCase().trim();
  
  let indexSymbol = symbol;
  if (queryLower.includes('sensex') || queryLower.includes('bse') || queryLower.includes('bsesn')) {
    indexSymbol = 'SENSEX';
  } else if (queryLower.includes('bank')) {
    indexSymbol = 'BANKNIFTY';
  } else if (queryLower.includes('nifty')) {
    indexSymbol = 'NIFTY';
  }

  const userName = userContext.name || 'Trader';
  
  // FETCH REAL LIVE SPOT PRICE & EXCHANGE METRICS
  const market = await getMarketSummaryAsync(indexSymbol);
  const apiKey = process.env.GEMINI_API_KEY;

  if (apiKey) {
    try {
      const geminiResult = await callGeminiAPI(apiKey, userQuery, indexSymbol, userContext, market);
      if (geminiResult) return geminiResult;
    } catch (err) {
      console.warn('[Gemini AI] Call failed, using smart fallback:', err.message);
    }
  }

  return generateSmartResponse(userQuery, queryLower, indexSymbol, userName, market);
}

/**
 * Live Gemini Call - Balanced Depth & Professional Explanation System
 */
async function callGeminiAPI(apiKey, query, symbol, userContext, market) {
  const systemPrompt = `You are OptionPulse AI, an expert, balanced Indian F&O Trading Advisor.

  LIVE REAL EXCHANGE MARKET DATA:
  - Symbol: ${symbol} | Live Spot: ₹${market.spotPrice} (${market.change})
  - Upcoming Weekly Expiry: ${market.expiryDate}
  - Put-Call Ratio (PCR): ${market.pcr} (${market.sentiment})
  - Key Support: ${market.support} | Key Resistance: ${market.resistance} | Max Pain: ₹${market.maxPain}

  USER QUERY: "${query}"

  TONE & RESPONSE STYLE (MEET IN THE MIDDLE):
  - Do NOT give 1-liner short answers.
  - Do NOT write overwhelming 5-page essays.
  - Provide a BALANCED, HIGHLIGHTED 3-PART RESPONSE:

  1. 📊 **Market Pulse & Sentiment (2-3 sentences):**
     Explain the market direction using the live PCR and spot price in plain, clear English. Mention if buyers or sellers are in control.

  2. 🎯 **Actionable Trade Setup (Structured Levels):**
     - **Bias:** Bullish 🟢 / Bearish 🔴 / Sideways ⚖️
     - **Recommended Strategy:** (e.g. Bull Call Spread or ATM Call/Put)
     - **Entry Zone:** Exact price range
     - **Target 1 & Target 2:** (With 1:2+ Risk:Reward)
     - **Strict Stop-Loss (SL):** Line in the sand to exit immediately

  3. 🛡️ **Capital Protection & Level Logic (2-3 sentences):**
     Explain WHY this level matters (Open Interest buildup at Support/Resistance) and give a practical tip (e.g. managing Theta time decay near expiry).`;

  const models = ['gemini-3.5-flash', 'gemini-flash-latest'];

  for (const model of models) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: systemPrompt }] }] })
      });

      const data = await res.json();
      const textOutput = data?.candidates?.[0]?.content?.parts?.[0]?.text;

      if (textOutput) {
        return {
          text: textOutput,
          type: 'gemini_live_ai'
        };
      }
    } catch (e) {
      console.warn(`[Gemini Model ${model}] Error:`, e.message);
    }
  }

  return null;
}

/**
 * Balanced Fallback Engine
 */
function generateSmartResponse(originalQuery, queryLower, symbol, userName, market) {
  const suppNum = parseInt(market.support.split('at ')[1]) || Math.round(market.spotPrice - 100);
  const resNum = parseInt(market.resistance.split('at ')[1]) || Math.round(market.spotPrice + 100);
  const step = symbol === 'SENSEX' ? 100 : symbol === 'BANKNIFTY' ? 100 : 50;
  const atmStrike = Math.round(market.spotPrice / step) * step;

  if (KNOWLEDGE_BASE.greetings.some(g => queryLower.includes(g))) {
    return {
      text: `👋 **Welcome ${userName}!**\n\n` +
        `Here is your live F&O market snapshot:\n` +
        `• **${symbol} Live Spot:** ₹${market.spotPrice} (${market.change})\n` +
        `• **Upcoming Weekly Expiry:** ${market.expiryDate}\n` +
        `• **Put-Call Ratio (PCR):** **${market.pcr}** (${market.sentiment})\n` +
        `• **Expected Trading Range:** ₹${suppNum} – ₹${resNum}\n\n` +
        `How can I assist your trading today? You can ask for a **Trade Setup**, **Support/Resistance Levels**, or analyze any stock (RELIANCE, INFY)!`,
      type: 'greeting'
    };
  }

  const isBull = market.pcr >= 1.1;
  const isBear = market.pcr <= 0.85;

  return {
    text: `📊 **Market Pulse & Sentiment:**\n` +
      `${symbol} is trading live at **₹${market.spotPrice}** (${market.change}) heading towards the **${market.expiryDate}** expiry. ` +
      `The Put-Call Ratio stands at **${market.pcr}**, indicating a **${market.sentiment}** market sentiment where ${isBull ? 'Put writers are actively supporting lower levels' : isBear ? 'Call writers are creating overhead pressure' : 'the market is consolidating near ATM strikes'}.\n\n` +
      `🎯 **Actionable Trade Setup:**\n` +
      `• **Bias:** ${isBull ? 'Bullish 🟢' : isBear ? 'Bearish 🔴' : 'Rangebound / Neutral ⚖️'}\n` +
      `• **Recommended Strategy:** ${isBull ? `Buy ${symbol} ${atmStrike} CE or Bull Call Spread` : isBear ? `Buy ${symbol} ${atmStrike} PE or Bear Put Spread` : `Iron Condor / Wait for range breakout`}\n` +
      `• **Entry Zone:** ₹${suppNum + 20} – ₹${suppNum + 40}\n` +
      `• **Target 1:** ₹${resNum - 30} | **Target 2:** ₹${resNum + 20}\n` +
      `• **Strict Stop-Loss (SL):** ₹${suppNum - 30} *(Exit immediately if broken)*\n\n` +
      `🛡️ **Capital Protection Insight:**\n` +
      `Key Put Open Interest concentration is anchored at **₹${suppNum}**, making it your primary defense line. Keep risk capped by avoiding holding naked options overnight when Theta decay accelerates near expiry.`,
    type: 'trade_advice'
  };
}

module.exports = {
  processUserQuery
};
