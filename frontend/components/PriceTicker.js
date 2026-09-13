export default function PriceTicker({ prices, connected }) {
  const symbols = ["BTC", "ETH", "SOL"];
  return (
    <div className="ticker">
      <div className={`dot ${connected ? "live" : "down"}`} title={connected ? "Live" : "Reconnecting..."} />
      {symbols.map((s) => {
        const entry = prices[s];
        return (
          <div className="ticker-item" key={s}>
            <span className="symbol">{s}</span>
            <span className="price">{entry ? `$${entry.price.toLocaleString(undefined, { maximumFractionDigits: 2 })}` : "—"}</span>
          </div>
        );
      })}
      <style jsx>{`
        .ticker {
          display: flex;
          align-items: center;
          gap: 24px;
          padding: 12px 20px;
          background: #12151c;
          border-radius: 10px;
          border: 1px solid #232838;
        }
        .dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
        }
        .dot.live {
          background: #3ddc84;
          box-shadow: 0 0 8px #3ddc84;
        }
        .dot.down {
          background: #e0574c;
        }
        .ticker-item {
          display: flex;
          flex-direction: column;
        }
        .symbol {
          font-size: 11px;
          letter-spacing: 0.05em;
          color: #7d8598;
        }
        .price {
          font-size: 18px;
          font-weight: 600;
          color: #f4f6fb;
          font-variant-numeric: tabular-nums;
        }
      `}</style>
    </div>
  );
}
