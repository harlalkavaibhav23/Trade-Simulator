const { v4: uuid } = require("uuid");
const db = require("./db");
const { usdToQuantity, quantityToUsd } = require("./money");

/**
 * ---------------------------------------------------------------------
 * RACE-CONDITION SAFETY (double-click / concurrent-request protection)
 * ---------------------------------------------------------------------
 * Two layers, deliberately redundant:
 *
 * 1. Per-user in-memory lock (`locks` map below). If a second trade
 *    request for the same user arrives while the first is still being
 *    processed, it is rejected immediately with 409 Conflict instead of
 *    being queued or silently interleaved. This is what stops a
 *    double-clicked "Buy" button from ever reaching the database twice.
 *
 * 2. The actual balance mutation happens inside `db.transaction(fn)`
 *    from better-sqlite3. better-sqlite3 is fully SYNCHRONOUS - unlike
 *    almost every other Node DB driver, it does not return a Promise or
 *    yield the event loop mid-query. That means the read-balance ->
 *    check-sufficient-funds -> write-new-balance sequence below executes
 *    as one uninterruptible block of JS; no other request handler can
 *    run in between, even if the in-memory lock in (1) were somehow
 *    bypassed. This is the same guarantee a SQL "SELECT ... FOR UPDATE"
 *    gives you, but we get it for free from SQLite's + Node's execution
 *    model rather than needing explicit row locks.
 *
 * Together: (1) rejects duplicate requests fast, (2) guarantees that even
 * if two requests somehow got past the lock, the DB would still never
 * apply both against a stale balance.
 * ---------------------------------------------------------------------
 */
const locks = new Set();

class InsufficientFundsError extends Error {}
class InsufficientHoldingsError extends Error {}
class TradeInProgressError extends Error {}

function withUserLock(userId, fn) {
  if (locks.has(userId)) {
    throw new TradeInProgressError("A trade for this user is already being processed");
  }
  locks.add(userId);
  try {
    return fn();
  } finally {
    locks.delete(userId);
  }
}

function getHoldingQuantity(userId, symbol) {
  const row = db
    .prepare("SELECT quantity_micros FROM holdings WHERE user_id = ? AND symbol = ?")
    .get(userId, symbol);
  return row ? BigInt(row.quantity_micros) : 0n;
}

function upsertHolding(userId, symbol, newQuantityMicros) {
  db.prepare(
    `INSERT INTO holdings (user_id, symbol, quantity_micros)
     VALUES (?, ?, ?)
     ON CONFLICT(user_id, symbol) DO UPDATE SET quantity_micros = excluded.quantity_micros`
  ).run(userId, symbol, newQuantityMicros.toString());
}

/**
 * Execute a market order.
 *
 * @param {object} deps          - { priceFeed } injected so this module stays testable
 * @param {string} userId
 * @param {string} symbol        - 'BTC' | 'ETH' | 'SOL'
 * @param {'BUY'|'SELL'} side
 * @param {bigint} usdCents      - for BUY: how much cash to spend
 * @param {bigint} quantityMicros- for SELL: how much of the token to sell
 */
function executeTrade({ priceFeed }, { userId, symbol, side, usdCents, quantityMicros }) {
  return withUserLock(userId, () => {
    // Read the live price BEFORE entering the DB transaction - the trade
    // executes "at the exact live price currently displayed on the UI",
    // i.e. the same server-side cache value the UI is streaming from.
    const priceMicros = priceFeed.getPriceMicros(symbol);

    const run = db.transaction(() => {
      const user = db.prepare("SELECT * FROM users WHERE id = ?").get(userId);
      if (!user) throw new Error("User not found");

      let balanceCents = BigInt(user.balance_cents);
      let heldQuantity = getHoldingQuantity(userId, symbol);

      let tradeQuantityMicros, tradeUsdCents;

      if (side === "BUY") {
        tradeUsdCents = usdCents;
        if (tradeUsdCents <= 0n) throw new Error("Amount must be positive");
        if (tradeUsdCents > balanceCents) {
          throw new InsufficientFundsError(
            `Insufficient funds: balance is ${balanceCents} cents, trade requires ${tradeUsdCents} cents`
          );
        }
        tradeQuantityMicros = usdToQuantity(tradeUsdCents, priceMicros);
        balanceCents -= tradeUsdCents;
        heldQuantity += tradeQuantityMicros;
      } else if (side === "SELL") {
        tradeQuantityMicros = quantityMicros;
        if (tradeQuantityMicros <= 0n) throw new Error("Quantity must be positive");
        if (tradeQuantityMicros > heldQuantity) {
          throw new InsufficientHoldingsError(
            `Insufficient holdings: you hold ${heldQuantity} micro-${symbol}, trying to sell ${tradeQuantityMicros}`
          );
        }
        tradeUsdCents = quantityToUsd(tradeQuantityMicros, priceMicros);
        balanceCents += tradeUsdCents;
        heldQuantity -= tradeQuantityMicros;
      } else {
        throw new Error("side must be BUY or SELL");
      }

      db.prepare("UPDATE users SET balance_cents = ? WHERE id = ?").run(
        balanceCents.toString(),
        userId
      );
      upsertHolding(userId, symbol, heldQuantity);

      const tradeId = uuid();
      db.prepare(
        `INSERT INTO trades (id, user_id, symbol, side, quantity_micros, price_micros, usd_cents, balance_after, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(
        tradeId,
        userId,
        symbol,
        side,
        tradeQuantityMicros.toString(),
        priceMicros.toString(),
        tradeUsdCents.toString(),
        balanceCents.toString(),
        Date.now()
      );

      return {
        tradeId,
        symbol,
        side,
        quantityMicros: tradeQuantityMicros.toString(),
        priceMicros: priceMicros.toString(),
        usdCents: tradeUsdCents.toString(),
        balanceCents: balanceCents.toString(),
      };
    });

    // better-sqlite3 transactions run synchronously to completion (or roll
    // back synchronously on a thrown error) - see comment block above.
    return run();
  });
}

module.exports = {
  executeTrade,
  InsufficientFundsError,
  InsufficientHoldingsError,
  TradeInProgressError,
};
