const express = require('express');
const crypto = require('crypto');
const axios = require('axios');
const winston = require('winston');
require('dotenv').config();

const { JupiterSwap, JupiterTrigger, JupiterClient } = require('./src/jupiter');

const app = express();
app.use(express.json());

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' }),
    new winston.transports.Console()
  ]
});

const PORT = process.env.PORT || 3000;
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || 'default-secret-change-me';
const DISCORD_WEBHOOK = process.env.DISCORD_WEBHOOK;
const PAPER_TRADING = process.env.PAPER_TRADING !== 'false';
const JUPITER_API_KEY = process.env.JUPITER_API_KEY;
const SOLANA_RPC_URL = process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com';
const SOLANA_PRIVATE_KEY = process.env.SOLANA_PRIVATE_KEY;

let positions = {};
let tradeHistory = [];
let dailyStats = { wins: 0, losses: 0, pnl: 0 };

// Jupiter instances
const jupiterSwap = new JupiterSwap({
  rpcUrl: SOLANA_RPC_URL,
  privateKey: SOLANA_PRIVATE_KEY,
  apiKey: JUPITER_API_KEY,
  paperTrading: PAPER_TRADING
});

const jupiterTrigger = new JupiterTrigger({
  apiKey: JUPITER_API_KEY,
  publicKey: jupiterSwap.publicKey,
  paperTrading: PAPER_TRADING
});

const jupiterClient = new JupiterClient(JUPITER_API_KEY);

function verifySignature(req) {
  const signature = req.headers['x-tradingview-signature'] || req.headers['x-signature'];
  if (!signature) return false;
  const expected = crypto.createHmac('sha256', WEBHOOK_SECRET)
    .update(JSON.stringify(req.body))
    .digest('hex');
  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
}

async function sendDiscord(message) {
  if (!DISCORD_WEBHOOK) return;
  try {
    await axios.post(DISCORD_WEBHOOK, {
      content: message,
      username: 'TradingView Jupiter Bot'
    });
  } catch (e) {
    logger.error('Discord send failed:', e.message);
  }
}

function calculatePositionSize(balance, riskPercent, entry, stopLoss, leverage = 1) {
  const riskAmount = balance * (riskPercent / 100);
  const priceDiff = Math.abs(entry - stopLoss);
  const positionSize = (riskAmount / priceDiff) * entry;
  return {
    size: positionSize.toFixed(8),
    riskAmount: riskAmount.toFixed(2),
    leverage: leverage,
    notional: (positionSize * leverage).toFixed(2)
  };
}

async function executeTrade(signal) {
  const { ticker, action, price, stopLoss, takeProfit, riskPercent = 1, leverage = 1 } = signal;
  const timestamp = new Date().toISOString();

  const trade = {
    id: crypto.randomUUID(),
    ticker,
    action,
    entryPrice: price,
    stopLoss,
    takeProfit,
    size: 0,
    timestamp,
    status: 'open'
  };

  if (PAPER_TRADING) {
    trade.size = calculatePositionSize(10000, riskPercent, price, stopLoss, leverage).size;
    trade.paper = true;
    logger.info(`[PAPER] ${action.toUpperCase()} ${ticker} @ $${price}`);
    await sendDiscord(`📋 **PAPER TRADE**\n${action.toUpperCase()} ${ticker}\nEntry: $${price}\nSL: $${stopLoss}\nTP: $${takeProfit}`);
  } else {
    trade.size = calculatePositionSize(10000, riskPercent, price, stopLoss, leverage).size;
    logger.info(`[LIVE] ${action.toUpperCase()} ${ticker} @ $${price}`);
    await sendDiscord(`🔴 **LIVE TRADE**\n${action.toUpperCase()} ${ticker}\nEntry: $${price}\nSL: $${stopLoss}\nTP: $${takeProfit}`);
  }

  positions[ticker] = trade;
  tradeHistory.push(trade);

  return trade;
}

async function closePosition(ticker, exitPrice, reason = 'signal') {
  const pos = positions[ticker];
  if (!pos) return null;

  const pnl = pos.action === 'buy'
    ? (exitPrice - pos.entryPrice) * pos.size
    : (pos.entryPrice - exitPrice) * pos.size;

  pos.exitPrice = exitPrice;
  pos.pnl = pnl;
  pos.status = 'closed';
  pos.closeReason = reason;
  pos.closeTime = new Date().toISOString();

  delete positions[ticker];

  if (pnl > 0) {
    dailyStats.wins++;
    dailyStats.pnl += pnl;
    await sendDiscord(`✅ **WIN** ${ticker} +$${pnl.toFixed(2)} (${reason})`);
  } else {
    dailyStats.losses++;
    dailyStats.pnl += pnl;
    await sendDiscord(`❌ **LOSS** ${ticker} -$${Math.abs(pnl).toFixed(2)} (${reason})`);
  }

  return pos;
}

// ========== JUPITER ROUTES ==========

app.post('/jupiter/swap', async (req, res) => {
  try {
    if (!verifySignature(req)) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { token_in, token_out, amount, slippage = 50, ticker = 'SOL-USDC' } = req.body;

    logger.info('Jupiter swap request:', req.body);

    const result = await jupiterSwap.executeMarketSwap({
      inputMint: token_in,
      outputMint: token_out,
      amount,
      slippageBps: slippage
    });

    const emoji = result.status === 'success' ? '✅' : '📋';
    await sendDiscord(`${emoji} **Jupiter Swap**\n${ticker}\nType: Market\nAmount: ${amount}\nTX: ${result.txSignature || result.status}`);

    tradeHistory.push({
      id: crypto.randomUUID(),
      type: 'jupiter_swap',
      ticker,
      token_in,
      token_out,
      amount,
      result,
      timestamp: new Date().toISOString()
    });

    res.json({ status: 'ok', result });
  } catch (e) {
    logger.error('Jupiter swap error:', e);
    await sendDiscord(`❌ **Jupiter Swap Failed**\n${e.message}`);
    res.status(500).json({ error: e.message });
  }
});

app.post('/jupiter/limit', async (req, res) => {
  try {
    if (!verifySignature(req)) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { token_in, token_out, in_amount, out_amount, expired_at, ticker = 'SOL-USDC' } = req.body;

    logger.info('Jupiter limit order request:', req.body);

    const result = await jupiterTrigger.createLimitOrder({
      inputMint: token_in,
      outputMint: token_out,
      inAmount: in_amount,
      outAmount: out_amount,
      expiredAt: expired_at
    });

    const emoji = result.status === 'success' ? '✅' : '📋';
    await sendDiscord(`${emoji} **Jupiter Limit Order**\n${ticker}\nIn: ${in_amount}\nOut: ${out_amount}\nOrder: ${result.orderId || result.status}`);

    tradeHistory.push({
      id: crypto.randomUUID(),
      type: 'jupiter_limit',
      ticker,
      token_in,
      token_out,
      in_amount,
      out_amount,
      result,
      timestamp: new Date().toISOString()
    });

    res.json({ status: 'ok', result });
  } catch (e) {
    logger.error('Jupiter limit error:', e);
    await sendDiscord(`❌ **Jupiter Limit Failed**\n${e.message}`);
    res.status(500).json({ error: e.message });
  }
});

app.post('/jupiter/dca', async (req, res) => {
  try {
    if (!verifySignature(req)) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { token_in, token_out, in_amount, out_amount, cycle_frequency, number_of_cycles, ticker = 'SOL-USDC' } = req.body;

    logger.info('Jupiter DCA request:', req.body);

    const result = await jupiterTrigger.createDCA({
      inputMint: token_in,
      outputMint: token_out,
      inAmount: in_amount,
      outAmount: out_amount,
      cycleFrequency: cycle_frequency,
      numberOfCycles: number_of_cycles
    });

    const emoji = result.status === 'success' ? '✅' : '📋';
    await sendDiscord(`${emoji} **Jupiter DCA**\n${ticker}\nCycles: ${number_of_cycles}\nFreq: ${cycle_frequency}s\nOrder: ${result.orderId || result.status}`);

    tradeHistory.push({
      id: crypto.randomUUID(),
      type: 'jupiter_dca',
      ticker,
      token_in,
      token_out,
      in_amount,
      number_of_cycles,
      result,
      timestamp: new Date().toISOString()
    });

    res.json({ status: 'ok', result });
  } catch (e) {
    logger.error('Jupiter DCA error:', e);
    await sendDiscord(`❌ **Jupiter DCA Failed**\n${e.message}`);
    res.status(500).json({ error: e.message });
  }
});

app.get('/jupiter/price/:mint', async (req, res) => {
  try {
    const price = await jupiterClient.getPrice(req.params.mint);
    res.json({ mint: req.params.mint, price });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/jupiter/token/:mint', async (req, res) => {
  try {
    const info = await jupiterClient.getTokenInfo(req.params.mint);
    res.json(info);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ========== ORIGINAL ROUTES ==========

app.post('/webhook', async (req, res) => {
  try {
    if (!verifySignature(req)) {
      logger.warn('Invalid webhook signature');
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const signal = req.body;
    logger.info('Webhook received:', signal);

    if (signal.action === 'buy' || signal.action === 'sell') {
      const trade = await executeTrade(signal);
      res.json({ status: 'executed', trade });
    } else if (signal.action === 'close') {
      const closed = await closePosition(signal.ticker, signal.price, signal.reason);
      res.json({ status: closed ? 'closed' : 'no_position', trade: closed });
    } else if (signal.action === 'alert') {
      await sendDiscord(`🔔 **ALERT** ${signal.ticker}: ${signal.message}`);
      res.json({ status: 'alert_sent' });
    } else {
      res.json({ status: 'unknown_action' });
    }
  } catch (e) {
    logger.error('Webhook error:', e);
    res.status(500).json({ error: e.message });
  }
});

app.get('/positions', (req, res) => {
  res.json({ positions, count: Object.keys(positions).length });
});

app.get('/history', (req, res) => {
  res.json({
    trades: tradeHistory.slice(-100),
    stats: dailyStats,
    totalTrades: tradeHistory.length
  });
});

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    uptime: process.uptime(),
    paperTrading: PAPER_TRADING,
    jupiterMode: PAPER_TRADING ? 'paper' : 'live',
    openPositions: Object.keys(positions).length
  });
});

app.listen(PORT, () => {
  logger.info(`TradingView Jupiter Bridge running on port ${PORT}`);
  logger.info(`Mode: ${PAPER_TRADING ? 'PAPER' : 'LIVE'} trading`);
  logger.info(`Solana wallet: ${jupiterSwap.publicKey}`);
});
