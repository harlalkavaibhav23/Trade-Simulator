import { useEffect, useState } from "react";
import { usePriceFeed } from "../hooks/usePriceFeed";
import { usePortfolio } from "../hooks/usePortfolio";
import PriceTicker from "../components/PriceTicker";
import TradePanel from "../components/TradePanel";
import PortfolioView from "../components/PortfolioView";
import TradeHistory from "../components/TradeHistory";
import PriceChart from "../components/PriceChart";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api";

export default function Home() {
  const { prices, connected } = usePriceFeed();
  const [userId, setUserId] = useState(null);
  const [username, setUsername] = useState("");
  const { portfolio, trades, trade, pending, error } = usePortfolio(userId);

  useEffect(() => {
    const saved = typeof window !== "undefined" && sessionStorage.getItem("tradeSimUserId");
    if (saved) setUserId(saved);
  }, []);

  async function createUser(e) {
    e.preventDefault();
    if (!username.trim()) return;
    const res = await fetch(`${API_URL}/users`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username }),
    });
    const body = await res.json();
    if (res.ok) {
      sessionStorage.setItem("tradeSimUserId", body.id);
      setUserId(body.id);
    }
  }

  if (!userId) {
    return (
      <div className="onboarding">
        <form onSubmit={createUser}>
          <h1>Trade Simulator</h1>
          <p>Paper trade BTC, ETH and SOL against live market prices. Start with $10,000 in dummy cash.</p>
          <input placeholder="Choose a username" value={username} onChange={(e) => setUsername(e.target.value)} />
          <button type="submit">Start trading</button>
        </form>
        <style jsx>{`
          .onboarding { display: flex; align-items: center; justify-content: center; min-height: 100vh; background: #0b0d13; }
          form { display: flex; flex-direction: column; gap: 12px; width: 360px; }
          h1 { color: #f4f6fb; margin-bottom: 0; }
          p { color: #7d8598; margin-top: 0; }
          input { padding: 12px; border-radius: 8px; background: #1a1e2a; border: 1px solid #2a3040; color: #f4f6fb; }
          button { padding: 12px; border-radius: 8px; border: none; background: #3ddc84; font-weight: 600; cursor: pointer; }
        `}</style>
      </div>
    );
  }

  return (
    <div className="page">
      <header>
        <h1>Trade Simulator</h1>
        <PriceTicker prices={prices} connected={connected} />
      </header>

      <div className="grid">
        <div className="col">
          <PriceChart symbol="BTC" prices={prices} />
          <TradeHistory trades={trades} />
        </div>
        <div className="col">
          <PortfolioView portfolio={portfolio} />
          <TradePanel
            prices={prices}
            trade={trade}
            pending={pending}
            error={error}
            holdings={portfolio?.holdings}
          />
        </div>
      </div>

      <style jsx>{`
        .page { min-height: 100vh; background: #0b0d13; padding: 24px 32px; }
        header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; }
        h1 { color: #f4f6fb; font-size: 20px; }
        .grid { display: grid; grid-template-columns: 1.4fr 1fr; gap: 20px; }
        .col { display: flex; flex-direction: column; gap: 20px; }
        @media (max-width: 900px) {
          .grid { grid-template-columns: 1fr; }
        }
      `}</style>
    </div>
  );
}
