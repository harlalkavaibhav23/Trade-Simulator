import { useCallback, useEffect, useRef, useState } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api";

export function usePortfolio(userId) {
  const [portfolio, setPortfolio] = useState(null);
  const [trades, setTrades] = useState([]);
  const [error, setError] = useState(null);
  // Guards against a double-submit reaching the network at all - the
  // backend also rejects concurrent trades per-user (belt & suspenders).
  const pendingRef = useRef(false);
  const [pending, setPending] = useState(false);

  const refresh = useCallback(async () => {
    if (!userId) return;
    const [pRes, tRes] = await Promise.all([
      fetch(`${API_URL}/users/${userId}/portfolio`),
      fetch(`${API_URL}/users/${userId}/trades`),
    ]);
    if (pRes.ok) setPortfolio(await pRes.json());
    if (tRes.ok) setTrades(await tRes.json());
  }, [userId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const trade = useCallback(
    async ({ symbol, side, usdAmount, quantityMicros }) => {
      if (pendingRef.current) return { ok: false, error: "A trade is already in progress" };
      pendingRef.current = true;
      setPending(true);
      setError(null);
      try {
        const res = await fetch(`${API_URL}/trade`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId, symbol, side, usdAmount, quantityMicros }),
        });
        const body = await res.json();
        if (!res.ok) {
          setError(body.error);
          return { ok: false, error: body.error };
        }
        await refresh();
        return { ok: true, result: body };
      } catch (err) {
        setError(err.message);
        return { ok: false, error: err.message };
      } finally {
        pendingRef.current = false;
        setPending(false);
      }
    },
    [userId, refresh]
  );

  return { portfolio, trades, trade, pending, error, refresh };
}
