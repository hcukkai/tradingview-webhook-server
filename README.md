# TradingView Webhook Server

Production-ready webhook server that receives TradingView alerts and executes trades with Discord notifications.

## Features

- ✅ **Secure webhooks** - HMAC-SHA256 signature verification
- ✅ **Paper trading mode** - Test without risking capital
- ✅ **Discord alerts** - Instant notifications for all trades
- ✅ **Position tracking** - Open positions, trade history, P&L stats
- ✅ **Auto position sizing** - Risk-based calculation (1% default)
- ✅ **CCXT ready** - Connect to 100+ exchanges

## Deploy to Render (Free)

1. Fork this repo
2. Create new Web Service on Render
3. Add environment variables:
   - `WEBHOOK_SECRET` - generate random string
   - `DISCORD_WEBHOOK` - your Discord webhook URL
   - `PAPER_TRADING` - `true` for testing, `false` for live
4. Deploy

## TradingView Setup

1. Open `pine-script.pine` in TradingView Pine Editor
2. Update `webhookUrl` with your server URL
3. Set `webhookSecret` to match your server
4. Add alert: "Webhook" -> paste your server URL

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/webhook` | POST | Receive TradingView alerts |
| `/positions` | GET | View open positions |
| `/history` | GET | Trade history + stats |
| `/health` | GET | Server status |

## Example Payload

```json
{
  "ticker": "BTCUSDT",
  "action": "buy",
  "price": 45000,
  "stopLoss": 44000,
  "takeProfit": 47000,
  "riskPercent": 1,
  "leverage": 5
}
```
