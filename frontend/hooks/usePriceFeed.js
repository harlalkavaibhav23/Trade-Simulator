import { useEffect, useReducer, useRef } from "react";

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:4000/ws/prices";

function reducer(state, action) {
  switch (action.type) {
    case "snapshot":
      return { ...state, prices: action.prices, connected: true };
    case "price":
      // Only touch the one symbol that changed - never rebuild the whole
      // object from scratch on every tick, so React only re-renders the
      // components subscribed to that symbol's price (see PriceTicker).
      return {
        ...state,
        connected: true,
        prices: {
          ...state.prices,
          [action.symbol]: {
            symbol: action.symbol,
            price: action.price,
            priceMicros: action.priceMicros,
            updatedAt: action.updatedAt,
          },
        },
      };
    case "disconnected":
      return { ...state, connected: false };
    default:
      return state;
  }
}

/**
 * Owns the ONE WebSocket connection to the backend's live price relay for
 * the whole app. Consumers just call this hook and read `prices` /
 * `connected` - they never touch the socket directly.
 *
 * Design notes (see README for the full write-up):
 *  - The socket instance lives in a ref, not state, so re-renders never
 *    tear down and reopen the connection.
 *  - useEffect's cleanup closes the socket on unmount and clears any
 *    pending reconnect timer, so we never leak sockets across route
 *    changes or Fast Refresh in dev.
 *  - Reconnection uses a simple exponential backoff capped at 10s.
 */
export function usePriceFeed() {
  const [state, dispatch] = useReducer(reducer, { prices: {}, connected: false });
  const socketRef = useRef(null);
  const retryDelayRef = useRef(500);
  const timeoutRef = useRef(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;

    function connect() {
      const socket = new WebSocket(WS_URL);
      socketRef.current = socket;

      socket.onopen = () => {
        retryDelayRef.current = 500; // reset backoff on a healthy connection
      };

      socket.onmessage = (event) => {
        let msg;
        try {
          msg = JSON.parse(event.data);
        } catch {
          return;
        }
        if (msg.type === "snapshot") {
          dispatch({ type: "snapshot", prices: msg.prices });
        } else if (msg.type === "price") {
          dispatch({ type: "price", ...msg });
        }
      };

      socket.onclose = () => {
        if (!mountedRef.current) return;
        dispatch({ type: "disconnected" });
        timeoutRef.current = setTimeout(connect, retryDelayRef.current);
        retryDelayRef.current = Math.min(retryDelayRef.current * 2, 10_000);
      };

      socket.onerror = () => socket.close();
    }

    connect();

    return () => {
      mountedRef.current = false;
      clearTimeout(timeoutRef.current);
      socketRef.current?.close();
    };
  }, []);

  return state; // { prices: { BTC: {...}, ETH: {...}, SOL: {...} }, connected }
}
