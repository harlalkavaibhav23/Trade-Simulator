import { useEffect, useRef } from "react";
import { createChart, ColorType } from "lightweight-charts";

/**
 * BONUS deliverable: a live-updating line chart per symbol using
 * TradingView's lightweight-charts. We keep an in-memory rolling buffer
 * of {time, value} points and call series.update() on every tick rather
 * than series.setData() - update() is O(1) and is the library's intended
 * way to append live ticks without re-rendering the whole chart.
 */
export default function PriceChart({ symbol, prices }) {
  const containerRef = useRef(null);
  const chartRef = useRef(null);
  const seriesRef = useRef(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const chart = createChart(containerRef.current, {
      layout: { background: { type: ColorType.Solid, color: "#12151c" }, textColor: "#7d8598" },
      grid: { vertLines: { color: "#1a1e2a" }, horzLines: { color: "#1a1e2a" } },
      width: containerRef.current.clientWidth,
      height: 240,
      timeScale: { timeVisible: true, secondsVisible: true },
    });
    const series = chart.addLineSeries({ color: "#3ddc84", lineWidth: 2 });
    chartRef.current = chart;
    seriesRef.current = series;

    const onResize = () => chart.applyOptions({ width: containerRef.current.clientWidth });
    window.addEventListener("resize", onResize);

    return () => {
      window.removeEventListener("resize", onResize);
      chart.remove();
    };
  }, []);

  useEffect(() => {
    const entry = prices[symbol];
    if (!entry || !seriesRef.current) return;
    seriesRef.current.update({
      time: Math.floor(entry.updatedAt / 1000),
      value: entry.price,
    });
  }, [prices, symbol]);

  return (
    <div className="chart-card">
      <h4>{symbol} / USD</h4>
      <div ref={containerRef} />
      <style jsx>{`
        .chart-card {
          background: #12151c;
          border: 1px solid #232838;
          border-radius: 10px;
          padding: 16px;
        }
        h4 { margin: 0 0 8px; color: #f4f6fb; }
      `}</style>
    </div>
  );
}
