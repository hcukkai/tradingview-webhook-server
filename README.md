# TradingView Jupiter Bridge

TradingView webhook server that executes Jupiter swaps, limit orders, and DCA on Solana — directly from Pine Script alerts.

## What's New in v2.0

- **Jupiter Swap V2** — Market orders via `/jupiter/swap`
- **Jupiter Trigger** — Limit orders via `/jupiter/limit`
- **Jupiter Recurring** — DCA orders via `/jupiter/dca`
- **Price API** — Real-time Solana token prices
- **Paper trading** — Test everything without real transactions
- **Same HMAC security** — Signature verification on all routes

## Quick Start

```bash
npm install
cp .env.example .env
# Edit .env with your keys
npm start
```

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `WEBHOOK_SECRET` | Yes | HMAC secret for TradingView |
| `DISCORD_WEBHOOK` | No | Discord alert URL |
| `PAPER_TRADING` | No | `true` to simulate (default) |
| `JUPITER_API_KEY` | Yes | From [developers.jup.ag](https://developers.jup.ag) |
| `SOLANA_PRIVATE_KEY` | For live | Base58 private key |
| `SOLANA_RPC_URL` | No | Default: public mainnet |

## TradingView Setup

1. Open `jupiter-pine.pine` in TradingView Pine Editor
2. Update `webhookUrl` to your server + `/jupiter/swap`
3. Set token addresses (SOL, USDC, etc.)
4. Create alert → Webhook → paste URL

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/webhook` | POST | Original TradingView alerts |
| `/jupiter/swap` | POST | Execute market swap |
| `/jupiter/limit` | POST | Create limit order |
| `/jupiter/dca` | POST | Create DCA order |
| `/jupiter/price/:mint` | GET | Token price |
| `/jupiter/token/:mint` | GET | Token metadata |
| `/positions` | GET | Open positions |
| `/history` | GET | Trade history |
| `/health` | GET | Server status |

## Example: Market Swap Payload

```json
{
  "ticker": "SOL-USDC",
  "token_in": "So11111111111111111111111111111111111111112",
  "token_out": "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
  "amount": "1000000000",
  "slippage": 50
}
```

## Example: Limit Order Payload

```json
{
  "ticker": "SOL-USDC",
  "token_in": "So11111111111111111111111111111111111111112",
  "token_out": "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
  "in_amount": "1000000000",
  "out_amount": "150000000000"
}
```

## Jupiter APIs Used

- [Swap V2](https://developers.jup.ag/docs/swap-api) — Quote, build, execute
- [Trigger](https://developers.jup.ag/docs/trigger-api) — Limit orders, TP/SL
- [Recurring](https://developers.jup.ag/docs/recurring-api) — DCA
- [Price](https://developers.jup.ag/docs/price-api) — Real-time pricing
- [Tokens](https://developers.jup.ag/docs/token-api) — Metadata

## Deploy to Render

1. Fork this repo
2. Create Web Service on Render
3. Add env vars from `.env.example`
4. Deploy

## License

MIT
