const express = require("express");
const path = require("path");
const crypto = require("crypto");
const { Redis } = require("@upstash/redis");

const app = express();
const publicDir = path.join(__dirname, "public");
const trackingLinks = new Map();

const hasRedisConfig = Boolean(
  process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
);

const redis = hasRedisConfig ? Redis.fromEnv() : null;

function getTrackingKey(linkId) {
  return `tracking:${linkId}`;
}

async function saveTrackingRecord(linkId, record) {
  if (redis) {
    await redis.set(getTrackingKey(linkId), record);
    return;
  }

  trackingLinks.set(linkId, record);
}

async function getTrackingRecord(linkId) {
  if (redis) {
    return (await redis.get(getTrackingKey(linkId))) || null;
  }

  return trackingLinks.get(linkId) || null;
}

app.use(express.json());

app.use((req, res, next) => {
  res.setHeader("ngrok-skip-browser-warning", "true");
  next();
});

app.use(express.static(publicDir));

app.get("/api/health", (req, res) => {
  res.json({
    ok: true,
    storage: redis ? "upstash-redis" : "memory",
  });
});

app.post("/api/create-link", async (req, res) => {
  try {
    const linkId = crypto.randomUUID().slice(0, 8);
    await saveTrackingRecord(linkId, {
      createdAt: new Date().toISOString(),
      locations: [],
    });

    res.json({ linkId });
  } catch (error) {
    console.error("Failed to create tracking link:", error);
    res.status(500).json({ error: "Failed to create tracking link" });
  }
});

app.post("/api/location/:linkId", async (req, res) => {
  try {
    const { linkId } = req.params;
    const { latitude, longitude, accuracy } = req.body;
    const trackingRecord = await getTrackingRecord(linkId);

    if (!trackingRecord) {
      return res.status(404).json({ error: "Link not found" });
    }

    const entry = {
      latitude,
      longitude,
      accuracy,
      timestamp: new Date().toISOString(),
      ip: req.headers["x-forwarded-for"] || req.ip,
    };

    trackingRecord.locations.push(entry);
    await saveTrackingRecord(linkId, trackingRecord);

    res.json({ success: true });
  } catch (error) {
    console.error("Failed to save location:", error);
    res.status(500).json({ error: "Failed to save location" });
  }
});

app.get("/api/locations/:linkId", async (req, res) => {
  try {
    const { linkId } = req.params;
    const trackingRecord = await getTrackingRecord(linkId);

    if (!trackingRecord) {
      return res.status(404).json({ error: "Link not found" });
    }

    res.json(trackingRecord);
  } catch (error) {
    console.error("Failed to get locations:", error);
    res.status(500).json({ error: "Failed to load locations" });
  }
});

app.get("/track/:linkId", (req, res) => {
  res.sendFile(path.join(publicDir, "share.html"));
});

app.get("/dashboard/:linkId", (req, res) => {
  res.sendFile(path.join(publicDir, "dashboard.html"));
});

module.exports = app;