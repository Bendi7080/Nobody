const express = require("express");
const cors = require("cors");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));

app.use(express.static(__dirname));

app.get("/api/status", (req, res) => {
    res.json({
        ok: true,
        app: "NOBODY",
        version: "0.1.0",
        status: "online"
    });
});

app.get("/api/health", (req, res) => {
    res.json({
        success: true,
        message: "NOBODY server is alive"
    });
});

app.get("*", (req, res) => {
    res.sendFile(path.join(__dirname, "index.html"));
});

app.listen(PORT, () => {
    console.log("╔══════════════════════════════╗");
    console.log("║          N O B O D Y         ║");
    console.log("╠══════════════════════════════╣");
    console.log(`║ Server: http://localhost:${PORT}`);
    console.log("║ Status: ONLINE");
    console.log("║ Version: 0.1.0");
    console.log("╚══════════════════════════════╝");
});
