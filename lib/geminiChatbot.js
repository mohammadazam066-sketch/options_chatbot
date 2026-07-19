/**
 * Gemini Live Conversational AI Engine - Short & Crisp F&O Trading Advisor
 * Powered by Google Gemini 3.5 Flash
 */

const { getMarketSummary } = require('./marketDataEngine');

const KNOWLEDGE_BASE = {
  greetings: ['hi', 'hello', 'hey', 'good morning', 'good afternoon', 'good evening', 'wassup'],
  buyingAdvice: ['buy call', 'buy put', 'should i buy', 'safe to buy', 'call or put', 'trade today', 'entry', 'should i trade', 'suggest trade', 'best trade', 'trade setup']
};

/**
 * Main Conversational Entrypoint
 */
async function processUserQuery(userQuery, symbol = 'NIFTY', userContext = {}) {
  const queryLower = userQuery.toLowerCase().trim();
  const indexSymbol = queryLower.includes('bank') ? 'BANKNIFTY' : symbol;
  const userName = userContext.name || 'Trader';
  const market = getMarketSummary(indexSymbol);
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
 * Live Gemini Call - Ultra Crisp & Short Response System
 */
async function callGeminiAPI(apiKey, query, symbol, userContext, market) {
  const systemPrompt = `You are OptionPulse AI, a sharp, ultra-concise Indian F&O Trading Assistant.

  LIVE MARKET DATA:
  - Symbol: ${symbol} | Spot: ₹${market.spotPrice} (${market.change})
  - PCR: ${market.pcr} (${market.sentiment})
  - Support: ${market.support} | Resistance: ${market.resistance} | Max Pain: ₹${market.maxPain}

  USER QUERY: "${query}"

  CRITICAL INSTRUCTION:
  - KEEP ANSWER SHORT, CRISP & DIRECT (MAX 3-4 BULLET POINTS TOTAL).
  - DO NOT OVER-EXPLAIN OR WRITE LONG PARAGRAPHS.
  - IF USER ASKS FOR A TRADE OR ENTRY: Give EXACT Trade Setup:
    • **Bias:** Bullish / Bearish / Sideways
    • **Recommended Trade:** (e.g. Buy ${symbol} Call/Put or Bull Call Spread)
    • **Levels:** Entry Zone, Target (TGT), and Stop-Loss (SL)
    • **Key Reason:** PCR & Support/Resistance level in 1 line.
  - Talk like a professional intraday desk trader. No fluff!`;

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
 * Ultra Crisp Fallback Engine
 */
function generateSmartResponse(originalQuery, queryLower, symbol, userName, market) {
  const suppNum = parseInt(market.support.split('at ')[1]) || Math.round(market.spotPrice - 100);
  const resNum = parseInt(market.resistance.split('at ')[1]) || Math.round(market.spotPrice + 100);

  if (KNOWLEDGE_BASE.greetings.some(g => queryLower.includes(g))) {
    return {
      text: `👋 **Hey ${userName}!**\n\n` +
        `• **${symbol} Spot:** ₹${market.spotPrice} (${market.change})\n` +
        `• **PCR:** **${market.pcr}** (${market.sentiment})\n` +
        `• **Range:** ${suppNum} – ${resNum}\n\n` +
        `Ask for a **Trade Setup**, **Support/Resistance**, or analyze any stock (RELIANCE, INFY)!`,
      type: 'greeting'
    };
  }

  if (KNOWLEDGE_BASE.buyingAdvice.some(a => queryLower.includes(a))) {
    const isBull = market.pcr >= 1.1;
    const isBear = market.pcr <= 0.85;
    const tradeType = isBull ? `Buy ${symbol} ${Math.round(market.spotPrice / 50) * 50} CE` : isBear ? `Buy ${symbol} ${Math.round(market.spotPrice / 50) * 50} PE` : `Bull Call Spread / Wait for breakout`;

    return {
      text: `📊 **Trade Setup: ${symbol}**\n\n` +
        `• **Bias:** ${isBull ? 'Bullish 🟢' : isBear ? 'Bearish 🔴' : 'Rangebound ⚖️'}\n` +
        `• **Recommended Trade:** ${tradeType}\n` +
        `• **Entry Zone:** Near ₹${suppNum + 30}\n` +
        `• **Target (TGT):** ₹${resNum - 20}\n` +
        `• **Stop-Loss (SL):** ₹${suppNum - 30}\n` +
        `• **Reason:** PCR is ${market.pcr} with strong Put writing at ${suppNum}.`,
      type: 'trade_advice'
    };
  }

  return {
    text: `⚡ **${symbol} Pulse Check**\n\n` +
      `• **Spot Price:** ₹${market.spotPrice} (${market.change})\n` +
      `• **PCR:** ${market.pcr} (${market.sentiment})\n` +
      `• **Support:** ${suppNum} | **Resistance:** ${resNum}\n` +
      `• **Advice:** Maintain strict Stop-Loss (SL) near ${suppNum - 20}. Avoid buying naked OTM options near expiry!`,
    type: 'fallback'
  };
}

module.exports = {
  processUserQuery
};
