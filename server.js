require("dotenv").config();
const { Client } = require("pg");
const WebSocket = require("ws");

const pgClient = new Client({
  connectionString: process.env.DATABASE_URL_UNPOOLED,
  ssl: { rejectUnauthorized: false },
});

pgClient.connect()
  .then(() => {
    console.log("🟢 Connected to PostgreSQL");
    return pgClient.query("LISTEN student_inserted");
  })
  .catch((err) => console.error("❌ PostgreSQL connection error:", err));

// Create WebSocket server
const wss = new WebSocket.Server({ port: process.env.PORT || 4000 });

wss.on("connection", (ws) => {
  console.log("📡 Client connected");

  ws.on("close", () => {
    console.log("🔌 Client disconnected");
  });
});

// ✅ Global DB notification handler — only once
pgClient.on("notification", (msg) => {
  try {
    const payload = JSON.parse(msg.payload);
    const message = JSON.stringify({ type: "student_inserted", data: payload });

    // Broadcast to all connected clients
    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    });
  } catch (e) {
    console.error("⚠️ Failed to parse payload:", e);
  }
});

// 🕒 Keep connections alive
setInterval(() => {
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify({ type: "ping" }));
    }
  });
}, 30000);
