const WebSocket = require("ws");
const EventEmitter = require("events");
const { priceToMicros } = require("./money");

const SYMBOLS = ["BTC", "ETH", "SOL"];
const BINANCE_STREAMS = SYMBOLS.map((s) => `${s.toLowerCase()}usdt@trade`).join("/");
const BINANCE_URL = `wss://stream.binance.com:9443/stream?streams=${BINANCE_STREAMS}`;

/**
 * PriceFeed keeps a single upstream connection to the exchange and fans
 * live prices out to every connected frontend client. This is the classic
 * "one upstream, many downstream" pattern: we never open one exchange
 * connection per browser tab, and every client sees the exact same
 * server-side price cache that trades are executed against.
 */
class PriceFeed extends EventEmitter {
  constructor() {
    super();
    // symbol -> { priceMicros: BigInt, priceFloat: number, updatedAt: number }
    this.latest = new Map();
    SYMBOLS.forEach((s) => this.latest.set(s, null));
    this._connect();
  }

  _connect() {
    this.ws = new WebSocket(BINANCE_URL);

    this.ws.on("open", () => console.log("[priceFeed] connected to Binance"));

    this.ws.on("message", (raw) => {
      try {
        const msg = JSON.parse(raw.toString());
        const data = msg.data;
        if (!data || !data.s || !data.p) return;
        const symbol = data.s.replace("USDT", ""); // BTCUSDT -> BTC
        if (!SYMBOLS.includes(symbol)) return;

        const priceFloat = parseFloat(data.p);
        const entry = {
          symbol,
          priceFloat,
          priceMicros: priceToMicros(priceFloat),
          updatedAt: Date.now(),
        };
        this.latest.set(symbol, entry);
        this.emit("price", entry);
      } catch (err) {
        console.error("[priceFeed] parse error", err);
      }
    });

    this.ws.on("close", () => {
      console.warn("[priceFeed] disconnected, retrying in 2s");
      setTimeout(() => this._connect(), 2000);
    });

    this.ws.on("error", (err) => {
      console.error("[priceFeed] error", err.message);
      this.ws.close();
    });
  }

  /** Snapshot of all latest prices, safe to JSON-serialize (BigInt -> string). */
  snapshot() {
    const out = {};
    for (const [symbol, entry] of this.latest.entries()) {
      if (!entry) continue;
      out[symbol] = {
        symbol,
        price: entry.priceFloat,
        priceMicros: entry.priceMicros.toString(),
        updatedAt: entry.updatedAt,
      };
    }
    return out;
  }

  /** The exact integer price (micro-USD) a trade must execute against. Throws if not yet available. */
  getPriceMicros(symbol) {
    const entry = this.latest.get(symbol);
    if (!entry) throw new Error(`No live price yet for ${symbol}`);
    return entry.priceMicros;
  }
}

module.exports = { PriceFeed, SYMBOLS };
