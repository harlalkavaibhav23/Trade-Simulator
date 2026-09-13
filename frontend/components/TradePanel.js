import { useState } from "react";

export default function TradePanel({ prices, trade, pending, error, holdings }) {
  const [symbol, setSymbol] = useState("BTC");
  const [side, setSide] = useState("BUY");
  const [amount, setAmount] = useState("");

  const currentPrice = prices[symbol]?.price;
  const heldQuantityMicros = BigInt(
    holdings?.find((h) => h.symbol === symbol)?.quantityMicros || "0"
  );

  async function onSubmit(e) {
    e.preventDefault();
    if (pending || !amount) return; // client-side guard #1 against double submit

    if (side === "BUY") {
      await trade({ symbol, side, usdAmount: amount });
    } else {
      // amount typed is a token quantity for SELL; convert to micro-units.
      const micros = BigInt(Math.round(parseFloat(amount) * 1_000_000));
      await trade({ symbol, side, quantityMicros: micros.toString() });
    }
    setAmount("");
  }

  return (
    <form className="panel" onSubmit={onSubmit}>
      <h3>Place order</h3>
      <div className="row">
        <select value={symbol} onChange={(e) => setSymbol(e.target.value)}>
          <option value="BTC">BTC</option>
          <option value="ETH">ETH</option>
          <option value="SOL">SOL</option>
        </select>
        <div className="toggle">
          <button type="button" className={side === "BUY" ? "active buy" : ""} onClick={() => setSide("BUY")}>
            Buy
          </button>
          <button type="button" className={side === "SELL" ? "active sell" : ""} onClick={() => setSide("SELL")}>
            Sell
          </button>
        </div>
      </div>

      <label className="label">
        {side === "BUY" ? "Amount to spend (USD)" : `Quantity of ${symbol} to sell`}
      </label>
      <input
        type="number"
        step="any"
        min="0"
        placeholder={side === "BUY" ? "250.00" : "0.05"}
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        required
      />

      {side === "SELL" && (
        <div className="hint">Available: {(Number(heldQuantityMicros) / 1e6).toFixed(6)} {symbol}</div>
      )}
      {currentPrice && (
        <div className="hint">
          Executes at live price: ${currentPrice.toLocaleString(undefined, { maximumFractionDigits: 2 })}
        </div>
      )}

      <button
        type="submit"
        className={`submit ${side === "BUY" ? "buy" : "sell"}`}
        disabled={pending || !currentPrice}
      >
        {pending ? "Executing..." : `${side === "BUY" ? "Buy" : "Sell"} ${symbol}`}
      </button>

      {error && <div className="error">{error}</div>}

      <style jsx>{`
        .panel {
          display: flex;
          flex-direction: column;
          gap: 10px;
          background: #12151c;
          border: 1px solid #232838;
          border-radius: 10px;
          padding: 20px;
        }
        h3 {
          margin: 0 0 4px;
          color: #f4f6fb;
        }
        .row {
          display: flex;
          gap: 10px;
        }
        select {
          flex: 1;
          padding: 10px;
          border-radius: 8px;
          background: #1a1e2a;
          color: #f4f6fb;
          border: 1px solid #2a3040;
        }
        .toggle {
          display: flex;
          border-radius: 8px;
          overflow: hidden;
          border: 1px solid #2a3040;
        }
        .toggle button {
          padding: 10px 16px;
          background: #1a1e2a;
          color: #7d8598;
          border: none;
          cursor: pointer;
        }
        .toggle button.active.buy {
          background: #1e5c43;
          color: #6ee7ac;
        }
        .toggle button.active.sell {
          background: #5c1e1e;
          color: #e78a8a;
        }
        .label {
          font-size: 12px;
          color: #7d8598;
        }
        input {
          padding: 10px;
          border-radius: 8px;
          background: #1a1e2a;
          color: #f4f6fb;
          border: 1px solid #2a3040;
        }
        .hint {
          font-size: 12px;
          color: #7d8598;
        }
        .submit {
          margin-top: 6px;
          padding: 12px;
          border-radius: 8px;
          border: none;
          font-weight: 600;
          cursor: pointer;
        }
        .submit.buy {
          background: #3ddc84;
          color: #06110a;
        }
        .submit.sell {
          background: #e0574c;
          color: #150606;
        }
        .submit:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
        .error {
          color: #e0574c;
          font-size: 13px;
        }
      `}</style>
    </form>
  );
}
