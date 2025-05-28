require("dotenv").config();
const { Client } = require("pg");
const WebSocket = require("ws");

// Connect using non-pooled URL for LISTEN/NOTIFY
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

const wss = new WebSocket.Server({ port: process.env.PORT || 4000 });

wss.on("connection", (ws) => {
    console.log("📡 Dashboard connected");

    const listener = (msg) => {
        try {
            const payload = JSON.parse(msg.payload);
            ws.send(JSON.stringify({ type: "student_inserted", data: payload }));
        } catch (e) {
            console.error("⚠️ Failed to parse payload:", e);
        }
    };

    pgClient.on("notification", listener);

    ws.on("close", () => {
        pgClient.removeListener("notification", listener);
        console.log("🔌 Dashboard disconnected");
    });
});
// 🕒 Keep WebSocket connections alive with periodic ping
setInterval(() => {
    wss.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify({ type: "ping" }));
        }
    });
}, 30000); // every 30 seconds