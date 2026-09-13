import { centsToUsd, microsToQuantity } from "../lib/money";

export default function PortfolioView({ portfolio }) {
  if (!portfolio) return <div className="card">Loading portfolio...</div>;

  return (
    <div className="card">
      <h3>Portfolio - {portfolio.username}</h3>
      <div className="totals">
        <div>
          <div className="label">Cash</div>
          <div className="value">{centsToUsd(portfolio.balanceCents)}</div>
        </div>
        <div>
          <div className="label">Total value</div>
          <div className="value big">{centsToUsd(portfolio.totalValueCents)}</div>
        </div>
      </div>

      <table>
        <thead>
          <tr>
            <th>Asset</th>
            <th>Quantity</th>
            <th>Value</th>
          </tr>
        </thead>
        <tbody>
          {portfolio.holdings.filter((h) => h.quantityMicros !== "0").length === 0 && (
            <tr>
              <td colSpan={3} className="empty">No positions yet</td>
            </tr>
          )}
          {portfolio.holdings
            .filter((h) => h.quantityMicros !== "0")
            .map((h) => (
              <tr key={h.symbol}>
                <td>{h.symbol}</td>
                <td>{microsToQuantity(h.quantityMicros)}</td>
                <td>{centsToUsd(h.valueCents)}</td>
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
        .totals {
          display: flex;
          gap: 32px;
          margin-bottom: 16px;
        }
        .label { font-size: 12px; color: #7d8598; }
        .value { font-size: 18px; font-weight: 600; }
        .value.big { font-size: 24px; color: #3ddc84; }
        table { width: 100%; border-collapse: collapse; }
        th, td { text-align: left; padding: 8px 4px; font-size: 13px; }
        th { color: #7d8598; font-weight: 500; border-bottom: 1px solid #232838; }
        td { border-bottom: 1px solid #1a1e2a; font-variant-numeric: tabular-nums; }
        .empty { color: #7d8598; text-align: center; padding: 16px 0; }
      `}</style>
    </div>
  );
}
