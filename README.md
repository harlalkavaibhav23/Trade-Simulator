# Crypto Trade Simulator (Task-3)

A full-stack real-time paper-trading platform. Users get a dummy $10,000
balance and trade BTC/ETH/SOL market orders against a live Binance price
feed. Nothing here touches real money or a real exchange account -
Binance's public market-data stream is used read-only.

## Architecture

```
backend/   Node.js + Express + ws + better-sqlite3
  src/priceFeed.js   one upstream WebSocket to Binance -> fans out to all clients
  src/money.js       integer-only (BigInt) money math - no floats in the ledger
  src/tradeEngine.js order execution: per-user lock + synchronous DB transaction
  src/routes.js       REST API (users, portfolio, trades, trade)
  src/server.js       HTTP + WebSocket server

frontend/  Next.js (React)
  hooks/usePriceFeed.js   the ONE websocket connection, shared app-wide
  hooks/usePortfolio.js   REST calls + client-side double-submit guard
  components/             ticker, trade form, portfolio, history, chart
```

## Running it locally

**Backend**
```bash
cd backend
npm install
npm start          # http://localhost:4000
```

**Frontend** (separate terminal)
```bash
cd frontend
cp .env.local.example .env.local
npm install
npm run dev         # http://localhost:3000
```

Open http://localhost:3000, pick a username, and you're trading against
live prices immediately - no API keys needed for Binance's public feed.

## How each requirement is met

| Requirement | Where |
|---|---|
| Backend, dummy $10,000 balance | `POST /api/users` in `routes.js` |
| Live data integration (BTC/ETH/SOL) | `priceFeed.js` - Binance combined trade stream |
| Trading interface, executes at live price | `TradePanel.js` reads the same price the server caches; `tradeEngine.js` executes against the server-side cached price, never a client-supplied price |
| State enforcement (balance + holdings update immediately) | `tradeEngine.js` updates both in one DB transaction; frontend calls `refresh()` right after a trade resolves |
| Race conditions (no double-spend from double-click) | Per-user in-memory lock + synchronous `better-sqlite3` transaction, see comment block at the top of `tradeEngine.js`; frontend also disables the submit button and guards via a ref while a request is in flight |
| Floating point / rounding | `money.js` on both sides - USD in integer cents, crypto quantities in integer micro-units, BigInt math throughout; floats only ever touch the outer edge (the incoming exchange price, and final display formatting) |
| Bonus: chart | `PriceChart.js`, TradingView `lightweight-charts` |
| Bonus: reputation counter | see "Extending it further" below - not included by default since it was optional and needs a definition of "profitable" (realized vs. unrealized) that's worth agreeing on before building |

## Write-up: managing real-time WebSocket state in the frontend

The frontend keeps exactly **one** WebSocket connection to the backend's
price relay for the entire app (`usePriceFeed.js`), rather than letting
each component open its own socket. The connection itself lives in a
`useRef`, not React state - state changes trigger re-renders, and a
re-render must never tear down and reopen a live socket. The *data* the
socket produces lives in a `useReducer`, so every incoming tick dispatches
a small, targeted action (`{ type: 'price', symbol, price, ... }`) that
only replaces the one symbol's entry in the price map, instead of
rebuilding the whole object - this keeps re-renders scoped to the
components that actually subscribed to that symbol (e.g. only the BTC row
in the ticker re-renders on a BTC tick, not the whole ticker or the trade
panel). `useEffect`'s cleanup function closes the socket and clears any
pending reconnect timer on unmount, which matters a lot in dev with React
Fast Refresh remounting components - without it you silently accumulate
duplicate sockets. Reconnection uses simple exponential backoff (500ms,
capped at 10s) so a dropped connection recovers without hammering the
server. Components that need prices (the ticker, the trade panel, the
chart) simply call `usePriceFeed()` themselves; because the socket setup
lives inside the hook rather than being passed down as props from a
single "owner" component, we avoided needing a Context provider for what
is otherwise a single global piece of live state, at the cost of one
socket connection per *hook consumer* if the hook were called in multiple
places - in this app it's only called once, at the page level, and passed
down as props, keeping the "one socket" invariant explicit rather than
implicit. The trade panel never uses this live price to *decide* what
price a trade executes at - it only displays it for the user's benefit.
The actual execution price is looked up server-side, from the same cache
the WebSocket is broadcasting from, at the moment the trade transaction
runs, so the UI price and the fill price can never drift out of sync in
a way that matters to correctness.

## Screenshots to capture for your deliverable

1. The trading UI with the live ticker showing non-zero prices.
2. A `sqlite3 backend/trade_sim.db "SELECT * FROM users;"` (or a GUI
   tool like DB Browser for SQLite) before and after a trade, showing
   `balance_cents` and the `holdings` row changing.
3. The trade history table in the UI matching the `trades` table in the
   DB.

## Extending it further (optional bonus items not built in)

- **Reputation counter**: add a `realized_pnl_cents` column, computed on
  each SELL using average cost basis of the holding being sold (you'll
  need to track cost basis per lot or as a running average per symbol),
  and increment a public per-user "profitable trades" counter whenever a
  SELL's realized P&L is positive.
- **Auth**: usernames currently have no password - fine for a demo, but
  swap in a real auth provider before deploying anywhere public.
- **Testing**: add a Jest test that fires two concurrent `POST /trade`
  requests for the same user and asserts only one succeeds - this
  exercises the lock in `tradeEngine.js` directly.
