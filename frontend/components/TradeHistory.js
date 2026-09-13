import { centsToUsd, microsToQuantity } from "../lib/money";

export default function TradeHistory({ trades }) {
  return (
    <div className="card">
      <h3>Trade history</h3>
      <table>
        <thead>
          <tr>
            <th>Time</th>
            <th>Side</th>
            <th>Asset</th>
            <th>Qty</th>
            <th>Price</th>
            <th>Total</th>
          </tr>
        </thead>
        <tbody>
          {trades.length === 0 && (
            <tr><td colSpan={6} className="empty">No trades yet</td></tr>
          )}
          {trades.map((t) => (
            <tr key={t.id}>
              <td>{new Date(t.created_at).toLocaleTimeString()}</td>
              <td className={t.side === "BUY" ? "buy" : "sell"}>{t.side}</td>
              <td>{t.symbol}</td>
              <td>{microsToQuantity(t.quantity_micros)}</td>
              <td>{centsToUsd(BigInt(Math.round(Number(BigInt(t.price_micros)) / 10000)))}</td>
              <td>{centsToUsd(t.usd_cents)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <style jsx>{`
        .card {
          background: #12151c;
          border: 1px solid #232838;
          border-radius: 10px;
          padding: 20px;
          color: #f4f6fb;
        }
        h3 { margin-top: 0; }
        table { width: 100%; border-collapse: collapse; }
        th, td { text-align: left; padding: 8px 4px; font-size: 13px; }
        th { color: #7d8598; font-weight: 500; border-bottom: 1px solid #232838; }
        td { border-bottom: 1px solid #1a1e2a; font-variant-numeric: tabular-nums; }
        .buy { color: #3ddc84; }
        .sell { color: #e0574c; }
        .empty { color: #7d8598; text-align: center; padding: 16px 0; }
      `}</style>
    </div>
  );
}
