const express = require("express");
const cors = require("cors");
const http = require("http");
const WebSocket = require("ws");

const { PriceFeed } = require("./priceFeed");
const { buildRouter } = require("./routes");

const PORT = process.env.PORT || 4000;

const app = express();
app.use(cors());
app.use(express.json());

const priceFeed = new PriceFeed();
app.use("/api", buildRouter(priceFeed));

const server = http.createServer(app);

// Frontend clients connect here for a live price stream, e.g.
//   new WebSocket('ws://localhost:4000/ws/prices')
const wss = new WebSocket.Server({ server, path: "/ws/prices" });

wss.on("connection", (socket) => {
  // Send whatever we already have cached, immediately on connect,
  // so the UI isn't blank while waiting for the next tick.
  socket.send(JSON.stringify({ type: "snapshot", prices: priceFeed.snapshot() }));

  const onPrice = (entry) => {
    if (socket.readyState !== WebSocket.OPEN) return;
    socket.send(
      JSON.stringify({
        type: "price",
        symbol: entry.symbol,
        price: entry.priceFloat,
        priceMicros: entry.priceMicros.toString(),
        updatedAt: entry.updatedAt,
      })
    );
  };
  priceFeed.on("price", onPrice);

  socket.on("close", () => priceFeed.off("price", onPrice));
});

server.listen(PORT, () => {
  console.log(`Trade simulator backend listening on http://localhost:${PORT}`);
  console.log(`Live price WebSocket at ws://localhost:${PORT}/ws/prices`);
});
