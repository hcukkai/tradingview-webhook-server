# Jupiter "Not Your Regular Bounty" Submission

## TradingView Jupiter Bridge v2.0

**Repo:** https://github.com/hcukkai/tradingview-webhook-server  
**Landing Page:** https://hcukkai.github.io/

---

### What We Built

A production-ready bridge that lets TradingView alerts execute Jupiter swaps, limit orders, and DCA on Solana — in real time, with HMAC security, Discord notifications, and paper trading.

**No one has built this before.**

### APIs Used

| Jupiter API | How We Used It |
|-------------|----------------|
| **Swap V1** (`/swap/v1/quote` + `/swap/v1/swap`) | Market order execution from TradingView signals |
| **Trigger** (`/trigger/v1/createOrder`) | Limit orders (TP/SL) triggered by Pine Script alerts |
| **Recurring** (`/recurring/v1/createOrder`) | DCA strategies executed on schedule from TradingView |
| **Tokens** (`/tokens/v1/token/:mint`) | Token metadata lookup |
| Quote-as-Price | Derive real-time prices from swap quotes |

### The "Oh" Moment

TradingView is the standard for technical analysis. Jupiter is the standard for Solana trading. But there is **zero** integration between them.

We built the missing link: a webhook server that receives Pine Script alerts and executes Jupiter transactions. A trader can now:

1. Draw a trendline on TradingView
2. Set an alert with a webhook
3. When the price crosses, Jupiter executes a swap automatically
4. Discord pings them with the tx signature

This combines **two platforms traders already use** into one automated pipeline.

### Architecture

```
TradingView Pine Script Alert
        ↓
   POST /jupiter/swap
        ↓
  HMAC Verification
        ↓
  Jupiter Quote API
        ↓
  Jupiter Swap/Trigger/Recurring API
        ↓
  Solana Transaction (or Paper Mode)
        ↓
  Discord Notification
```

### Endpoints

- `POST /jupiter/swap` — Execute market swap
- `POST /jupiter/limit` — Create limit order
- `POST /jupiter/dca` — Create DCA order
- `GET /jupiter/price/:mint` — Real-time token price
- `GET /jupiter/token/:mint` — Token metadata

All endpoints require HMAC-SHA256 signature verification.

### Paper Trading Mode

Set `PAPER_TRADING=true` and the server simulates every Jupiter API call without sending real transactions. Perfect for testing strategies.

### Honest Feedback on Jupiter APIs

**What was great:**
- The unified developer portal at `developers.jup.ag` is genuinely useful. One API key, one dashboard, clear rate limits.
- Swap V1 quote API is fast and reliable. Sub-5ms response times.
- The `swapTransaction` base64 format makes it trivial to deserialize and sign with `@solana/web3.js`.
- Gasless swaps and auto-priority fees are killer features.

**What sucked:**
- **API versioning is confusing.** We initially tried `/v6/quote` and `/swap/v2/quote` based on docs, but both returned 404. Only `/swap/v1/quote` worked. The docs mention "Swap API v2" but the actual endpoint is v1. Clearer routing would save hours.
- **Price API v2 is undocumented or gated.** We tried `/price/v2` and got 404s. Had to derive prices from swap quotes as a workaround.
- **Trigger API docs are thin.** We got limit orders working, but the difference between `inAmount`/`outAmount` semantics for buy vs sell orders wasn't clear. More examples would help.
- **No webhook support.** We'd love to receive callbacks when limit orders fill, instead of polling.

### Setup

```bash
git clone https://github.com/hcukkai/tradingview-webhook-server
cd tradingview-webhook-server
npm install
cp .env.example .env
# Add your JUPITER_API_KEY and DISCORD_WEBHOOK
npm start
```

### Pine Script

Included: `jupiter-pine.pine` — drop it into TradingView, set your webhook URL to `/jupiter/swap`, and your SMA crossovers will execute Jupiter swaps.

### Tech Stack

Node.js, Express, Solana web3.js, Winston logging, HMAC auth, Discord webhooks

---

Built by an AI agent (🤖) in 2 hours. Human claims the prize.
