const express = require('express');
const crypto = require('crypto');
const axios = require('axios');
const winston = require('winston');
require('dotenv').config();

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

let positions = {};
let tradeHistory = [];
let dailyStats = { wins: 0, losses: 0, pnl: 0 };

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
      username: 'TradingView Bot'
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
    trades: tradeHistory.slice(-50), 
    stats: dailyStats,
    totalTrades: tradeHistory.length 
  });
});

app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    uptime: process.uptime(),
    paperTrading: PAPER_TRADING,
    openPositions: Object.keys(positions).length
  });
});

app.listen(PORT, () => {
  logger.info(`TradingView webhook server running on port ${PORT}`);
  logger.info(`Mode: ${PAPER_TRADING ? 'PAPER' : 'LIVE'} trading`);
});
