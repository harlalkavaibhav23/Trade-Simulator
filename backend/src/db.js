const Database = require("better-sqlite3");
const path = require("path");

const db = new Database(path.join(__dirname, "..", "trade_sim.db"));

db.pragma("journal_mode = WAL"); // safe concurrent readers while we write

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id            TEXT PRIMARY KEY,
    username      TEXT UNIQUE NOT NULL,
    balance_cents INTEGER NOT NULL,     -- USD cash balance, integer cents
    created_at    INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS holdings (
    user_id         TEXT NOT NULL,
    symbol          TEXT NOT NULL,      -- e.g. 'BTC'
    quantity_micros TEXT NOT NULL,      -- BigInt stored as TEXT (SQLite has no native 64-bit-safe BigInt)
    PRIMARY KEY (user_id, symbol),
    FOREIGN KEY (user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS trades (
    id               TEXT PRIMARY KEY,
    user_id          TEXT NOT NULL,
    symbol           TEXT NOT NULL,
    side             TEXT NOT NULL,      -- 'BUY' | 'SELL'
    quantity_micros  TEXT NOT NULL,
    price_micros     TEXT NOT NULL,
    usd_cents        TEXT NOT NULL,
    balance_after     INTEGER NOT NULL,
    created_at       INTEGER NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id)
  );

  CREATE INDEX IF NOT EXISTS idx_trades_user ON trades(user_id, created_at DESC);
`);

module.exports = db;
