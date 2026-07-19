/**
 * Gemini Live Conversational AI Engine
 * Powered by Google Gemini 3.5 Flash / Gemini Flash Latest
 */

const { getMarketSummary } = require('./marketDataEngine');

// Comprehensive Knowledge Base fallback
const KNOWLEDGE_BASE = {
  greetings: ['hi', 'hello', 'hey', 'good morning', 'good afternoon', 'good evening', 'who are you', 'wassup'],
  buyingAdvice: ['buy call', 'buy put', 'should i buy', 'safe to buy', 'call or put', 'trade today', 'entry', 'should i trade'],
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
 * Live Gemini 3.5 / Flash Call
 */
async function callGeminiAPI(apiKey, query, symbol, userContext, market) {
  const systemPrompt = `You are OptionPulse AI, a top-tier Indian Stock Market & F&O Trading Assistant.
  You are speaking with ${userContext.name || 'Trader'} (${userContext.style || 'Trader'}).

  LIVE EXCHANGE MARKET CONTEXT:
  - Symbol: ${symbol}
  - Spot Price: ₹${market.spotPrice} (${market.change})
  - Put-Call Ratio (PCR): ${market.pcr} (${market.sentiment})
  - Key Support Level: ${market.support}
  - Key Resistance Level: ${market.resistance}
  - Max Pain Strike: ₹${market.maxPain}

  USER PROMPT: "${query}"

  INSTRUCTIONS:
  1. Talk naturally, like a human trading mentor in a live chat app.
  2. You can answer questions about ANY Indian stock (RELIANCE, TATA MOTORS, INFY, HDFC BANK, SBIN, etc.), Futures, Options, Technical Analysis (RSI, Moving Averages), Option Greeks, or Strategies.
  3. Keep tone encouraging, crisp, professional, and clear with markdown headers, bullet points, and emojis.
  4. NEVER repeat static template lists ("You can ask questions like:"). Answer their prompt directly and uniquely!`;

  // Try gemini-3.5-flash first, then gemini-flash-latest
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
      text: `Hey **${userName}**! 👋 Good to see you.\n\n` +
        `Right now, **${symbol}** is trading at **₹${market.spotPrice}** (${market.change}). The market sentiment is **${market.sentiment}** with a PCR of **${market.pcr}**.\n\n` +
        `What\'s on your mind today? Are you looking for trade levels, OI analysis, or want to analyze a stock?`,
      type: 'greeting'
    };
  }

  if (KNOWLEDGE_BASE.buyingAdvice.some(a => queryLower.includes(a))) {
    return {
      text: `### 🎯 Trading Outlook for **${symbol}**\n\n` +
        `• **Current Price:** ₹${market.spotPrice} (${market.change})\n` +
        `• **PCR:** **${market.pcr}** (${market.sentiment})\n\n` +
        `💡 **Advisor Perspective for ${userName}:**\n` +
        `The market is currently bounded between support at **${market.support.split('at ')[1]?.split(' ')[0]}** and resistance at **${market.resistance.split('at ')[1]?.split(' ')[0]}**. Rangebound markets cause rapid time decay (Theta) for option buyers, so spread strategies or waiting for a breakout is safer!`,
      type: 'trade_advice'
    };
  }

  for (const [greekKey, greekExplanation] of Object.entries(KNOWLEDGE_BASE.greeks)) {
    if (queryLower.includes(greekKey)) {
      return { text: `### 📘 Understanding Option Greeks\n\n${greekExplanation}`, type: 'concept' };
    }
  }

  return {
    text: `That\'s a great question, **${userName}**!\n\n` +
      `Regarding *"_${originalQuery}_"*: In options and futures trading, market dynamics shift rapidly depending on Open Interest building up at key strikes.\n\n` +
      `Currently for **${symbol}** (trading at ₹${market.spotPrice}):\n` +
      `• **Put-Call Ratio:** **${market.pcr}** (${market.sentiment})\n` +
      `• **Key Range:** Bounded between **${market.support.split('at ')[1]?.split(' ')[0]}** and **${market.resistance.split('at ')[1]?.split(' ')[0]}**.\n\n` +
      `Feel free to ask me about any stock (RELIANCE, TATA MOTORS, INFY), option greeks, or strategies!`,
    type: 'fallback'
  };
}

module.exports = {
  processUserQuery
};
