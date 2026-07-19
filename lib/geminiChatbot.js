/**
 * Gemini Live Conversational AI Engine - High-Probability F&O Trading Advisor
 * Powered by Google Gemini 3.5 Flash / Gemini Flash Latest
 */

const { getMarketSummary } = require('./marketDataEngine');

// Knowledge base for trading concepts & strategy rules
const KNOWLEDGE_BASE = {
  greetings: ['hi', 'hello', 'hey', 'good morning', 'good afternoon', 'good evening', 'who are you', 'wassup'],
  buyingAdvice: ['buy call', 'buy put', 'should i buy', 'safe to buy', 'call or put', 'trade today', 'entry', 'should i trade', 'suggest trade', 'best trade', 'trade setup'],
  greeks: {
    'theta': '⏳ **Theta (Time Decay):** Measures how much value an option loses every day as expiry approaches. Think of it like an **ice cube melting in the sun**—every day that passes, your option loses value even if the stock price doesn\'t move!',
    'delta': '⚡ **Delta:** Tells you how much an option\'s price will change for every ₹1 movement in the stock. A Delta of 0.50 means if Nifty moves up by ₹10, your Call option goes up by ₹5.',
    'gamma': '🚀 **Gamma:** Measures how fast Delta changes when the stock moves. High Gamma creates explosive price spikes on expiry day!',
    'vega': '🌊 **Vega:** Measures sensitivity to **Implied Volatility (IV)**. High IV inflates option prices.',
    'iv': '📈 **Implied Volatility (IV):** Market expectation of price swings. High IV favors option sellers!'
  }
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
 * Live Gemini 3.5 / Flash Call with Safe Risk-Managed Strategy Advisor Persona
 */
async function callGeminiAPI(apiKey, query, symbol, userContext, market) {
  const systemPrompt = `You are OptionPulse AI, an elite Indian Stock Market F&O Trading Mentor and Quantitative Risk Strategist.
  You are speaking with ${userContext.name || 'Trader'} (${userContext.style || 'Options Trader'}).

  LIVE EXCHANGE MARKET DATA:
  - Symbol: ${symbol}
  - Spot Price: ₹${market.spotPrice} (${market.change})
  - Put-Call Ratio (PCR): ${market.pcr} (${market.sentiment})
  - Key Support Level: ${market.support}
  - Key Resistance Level: ${market.resistance}
  - Max Pain Strike: ₹${market.maxPain}

  USER QUESTION: "${query}"

  YOUR CORE RESPONSIBILITY AS A TOP TRADING ADVISOR:
  1. **PROTECT TRADER CAPITAL FIRST**: Always emphasize strict Risk Management, Stop-Loss (SL), and Risk:Reward ratio (at least 1:2).
  2. **RECOMMEND LOW-RISK / HIGH-PROBABILITY SETUPS**:
     - If market is Trending Bullish (PCR > 1.2): Suggest **Bull Call Spread** or **Buying Call near Support with tight SL**.
     - If market is Trending Bearish (PCR < 0.8): Suggest **Bear Put Spread** or **Buying Put near Resistance with tight SL**.
     - If market is Rangebound (PCR 0.85-1.15): Recommend **Credit Spreads (Iron Condor / Short Straddle)** or waiting for a breakout to avoid Theta decay traps.
  3. **CLEAR ACTIONABLE FORMATTING**:
     - **Market Sentiment & Bias**
     - **Recommended Strategy & Setup** (Entry Zone, Target, Stop Loss)
     - **Risk Warning & Traps to Avoid**
  4. Answer questions about ANY Indian stock (RELIANCE, TATA MOTORS, INFY, HDFC BANK, SBIN, etc.), Futures, Option Greeks, or Chart Patterns.
  5. Keep tone confident, crisp, structured with markdown bolding, bullet points, and emojis! Never output generic lists.`;

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
 * Smart Fallback Engine
 */
function generateSmartResponse(originalQuery, queryLower, symbol, userName, market) {
  if (KNOWLEDGE_BASE.greetings.some(g => queryLower.includes(g))) {
    return {
      text: `Hey **${userName}**! 👋 Welcome back to the trading desk.\n\n` +
        `Right now, **${symbol}** is trading live at **₹${market.spotPrice}** (${market.change}). Market bias is **${market.sentiment}** with a PCR of **${market.pcr}**.\n\n` +
        `How can I help you profit safely today? Ask me for a **High-Probability Trade Setup**, **Support/Resistance levels**, or analyze any stock (RELIANCE, INFY)!`,
      type: 'greeting'
    };
  }

  if (KNOWLEDGE_BASE.buyingAdvice.some(a => queryLower.includes(a))) {
    const suppLevel = parseInt(market.support.split('at ')[1]) || Math.round(market.spotPrice - 100);
    const resLevel = parseInt(market.resistance.split('at ')[1]) || Math.round(market.spotPrice + 100);

    return {
      text: `### 🎯 Low-Risk Trade Setup for **${symbol}**\n\n` +
        `• **Live Spot Price:** ₹${market.spotPrice} (${market.change})\n` +
        `• **PCR Sentiment:** **${market.pcr}** (${market.sentiment})\n\n` +
        `---` +
        `\n### ⚡ Recommended Strategy: **Defined-Risk Spread**\n` +
        `1. **Entry Zone:** Pullback near **₹${suppLevel + 30} - ₹${suppLevel + 50}**\n` +
        `2. **Target 1:** **₹${resLevel - 20}** (R:R Ratio 1:2.2)\n` +
        `3. **Strict Stop-Loss (SL):** **₹${suppLevel - 30}** (Exit immediately if broken)\n\n` +
        `🛡️ **Capital Protection Rule:** Avoid buying naked OTM options near expiry due to fast Theta decay. A **Bull Call Spread** protects your capital if the market consolidates!`,
      type: 'trade_advice'
    };
  }

  for (const [greekKey, greekExplanation] of Object.entries(KNOWLEDGE_BASE.greeks)) {
    if (queryLower.includes(greekKey)) {
      return { text: `### 📘 Understanding Option Greeks\n\n${greekExplanation}`, type: 'concept' };
    }
  }

  return {
    text: `Great question, **${userName}**!\n\n` +
      `Regarding *"_${originalQuery}_"*: In F&O trading, consistency comes from combining Open Interest trends with strict risk management.\n\n` +
      `**Current ${symbol} Market Snapshot:**\n` +
      `• **Spot Price:** ₹${market.spotPrice}\n` +
      `• **PCR Ratio:** **${market.pcr}** (${market.sentiment})\n` +
      `• **Support / Resistance:** **${market.support.split('at ')[1]?.split(' ')[0]}** / **${market.resistance.split('at ')[1]?.split(' ')[0]}**\n\n` +
      `Ask me to analyze any stock setup (RELIANCE, INFY, SBIN) or explain any trading strategy!`,
    type: 'fallback'
  };
}

module.exports = {
  processUserQuery
};
