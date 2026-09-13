const express = require("express");
const { v4: uuid } = require("uuid");
const db = require("./db");
const { usdToCents, quantityToUsd } = require("./money");
const {
  executeTrade,
  InsufficientFundsError,
  InsufficientHoldingsError,
  TradeInProgressError,
} = require("./tradeEngine");

const STARTING_BALANCE_CENTS = 1_000_000n; // $10,000.00

function buildRouter(priceFeed) {
  const router = express.Router();

  // Create a new dummy user with a $10,000 starting balance.
  router.post("/users", (req, res) => {
    const { username } = req.body;
    if (!username || typeof username !== "string" || !username.trim()) {
      return res.status(400).json({ error: "username is required" });
    }
    const id = uuid();
    try {
      db.prepare(
        "INSERT INTO users (id, username, balance_cents, created_at) VALUES (?, ?, ?, ?)"
      ).run(id, username.trim(), STARTING_BALANCE_CENTS.toString(), Date.now());
    } catch (err) {
      if (String(err.message).includes("UNIQUE")) {
        return res.status(409).json({ error: "username already taken" });
      }
      throw err;
    }
    res.status(201).json({ id, username: username.trim(), balanceCents: STARTING_BALANCE_CENTS.toString() });
  });

  // Full portfolio: cash + holdings + live mark-to-market value.
  router.get("/users/:id/portfolio", (req, res) => {
    const user = db.prepare("SELECT * FROM users WHERE id = ?").get(req.params.id);
    if (!user) return res.status(404).json({ error: "user not found" });

    const holdings = db
      .prepare("SELECT symbol, quantity_micros FROM holdings WHERE user_id = ?")
      .all(req.params.id);

    const prices = priceFeed.snapshot();
    let holdingsValueCents = 0n;

    const holdingsOut = holdings.map((h) => {
      const qty = BigInt(h.quantity_micros);
      const priceEntry = prices[h.symbol];
      let valueCents = 0n;
      if (priceEntry) {
        valueCents = quantityToUsd(qty, BigInt(priceEntry.priceMicros));
        holdingsValueCents += valueCents;
      }
      return {
        symbol: h.symbol,
        quantityMicros: qty.toString(),
        valueCents: valueCents.toString(),
      };
    });

    const balanceCents = BigInt(user.balance_cents);
    res.json({
      id: user.id,
      username: user.username,
      balanceCents: balanceCents.toString(),
      holdings: holdingsOut,
      totalValueCents: (balanceCents + holdingsValueCents).toString(),
      prices,
    });
  });

  router.get("/users/:id/trades", (req, res) => {
    const trades = db
      .prepare("SELECT * FROM trades WHERE user_id = ? ORDER BY created_at DESC LIMIT 100")
      .all(req.params.id);
    res.json(trades);
  });

  router.get("/prices", (req, res) => {
    res.json(priceFeed.snapshot());
  });

  // Execute a market order.
  // BUY:  body = { userId, symbol, side: 'BUY',  usdAmount: "250.00" }
  // SELL: body = { userId, symbol, side: 'SELL', quantityMicros: "1500000" }
  router.post("/trade", (req, res) => {
    const { userId, symbol, side, usdAmount, quantityMicros } = req.body;

    if (!userId || !symbol || !side) {
      return res.status(400).json({ error: "userId, symbol and side are required" });
    }
    if (!["BTC", "ETH", "SOL"].includes(symbol)) {
      return res.status(400).json({ error: "unsupported symbol" });
    }
    if (!["BUY", "SELL"].includes(side)) {
      return res.status(400).json({ error: "side must be BUY or SELL" });
    }

    try {
      let result;
      if (side === "BUY") {
        if (usdAmount === undefined) return res.status(400).json({ error: "usdAmount is required for BUY" });
        result = executeTrade(
          { priceFeed },
          { userId, symbol, side, usdCents: usdToCents(usdAmount) }
        );
      } else {
        if (quantityMicros === undefined)
          return res.status(400).json({ error: "quantityMicros is required for SELL" });
        result = executeTrade(
          { priceFeed },
          { userId, symbol, side, quantityMicros: BigInt(quantityMicros) }
        );
      }
      res.status(201).json(result);
    } catch (err) {
      if (err instanceof TradeInProgressError) return res.status(409).json({ error: err.message });
      if (err instanceof InsufficientFundsError) return res.status(422).json({ error: err.message });
      if (err instanceof InsufficientHoldingsError) return res.status(422).json({ error: err.message });
      console.error(err);
      res.status(400).json({ error: err.message });
    }
  });

  return router;
}

module.exports = { buildRouter };
