const express = require("express");
const { v4: uuidv4 } = require("uuid");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// Bypass ngrok browser warning
app.use((req, res, next) => {
  res.setHeader("ngrok-skip-browser-warning", "true");
  next();
});

app.use(express.static(path.join(__dirname, "public")));

// In-memory storage for tracking links and locations
const trackingLinks = new Map(); // linkId -> { createdAt, locations: [] }

// Create a new tracking link
app.post("/api/create-link", (req, res) => {
  const linkId = uuidv4().slice(0, 8);
  trackingLinks.set(linkId, {
    createdAt: new Date().toISOString(),
    locations: [],
  });
  res.json({ linkId });
});

// Receive location from the recipient
app.post("/api/location/:linkId", (req, res) => {
  const { linkId } = req.params;
  const { latitude, longitude, accuracy } = req.body;

  if (!trackingLinks.has(linkId)) {
    return res.status(404).json({ error: "Link not found" });
  }

  const entry = {
    latitude,
    longitude,
    accuracy,
    timestamp: new Date().toISOString(),
    ip: req.ip,
  };

  trackingLinks.get(linkId).locations.push(entry);
  res.json({ success: true });
});

// Get locations for a tracking link (sender's dashboard)
app.get("/api/locations/:linkId", (req, res) => {
  const { linkId } = req.params;

  if (!trackingLinks.has(linkId)) {
    return res.status(404).json({ error: "Link not found" });
  }

  res.json(trackingLinks.get(linkId));
});

// Serve the recipient's page
app.get("/track/:linkId", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "share.html"));
});

// Serve the dashboard page
app.get("/dashboard/:linkId", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "dashboard.html"));
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
