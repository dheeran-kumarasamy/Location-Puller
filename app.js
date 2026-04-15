const express = require("express");
const path = require("path");
const crypto = require("crypto");
const { Redis } = require("@upstash/redis");

const app = express();
const publicDir = path.join(__dirname, "public");
const trackingLinks = new Map();
const FIXED_LINK_ID = process.env.FIXED_LINK_ID || "live-location";
const LEGACY_SENDER_ID = "legacy-sender";

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
    const record = (await redis.get(getTrackingKey(linkId))) || null;
    return normalizeTrackingRecord(record);
  }

  return normalizeTrackingRecord(trackingLinks.get(linkId) || null);
}

function normalizeTrackingRecord(record) {
  if (!record) {
    return null;
  }

  if (record.senders && typeof record.senders === "object") {
    return record;
  }

  const legacyLocations = Array.isArray(record.locations) ? record.locations : [];
  return {
    createdAt: record.createdAt || new Date().toISOString(),
    senders: {
      [LEGACY_SENDER_ID]: {
        name: "Unknown",
        locations: legacyLocations,
      },
    },
  };
}

async function ensureTrackingRecord(linkId) {
  const existingRecord = await getTrackingRecord(linkId);
  if (existingRecord) {
    return existingRecord;
  }

  const newRecord = {
    createdAt: new Date().toISOString(),
    senders: {},
  };

  await saveTrackingRecord(linkId, newRecord);
  return newRecord;
}

app.use(express.json());

app.use((req, res, next) => {
  res.setHeader("ngrok-skip-browser-warning", "true");
  next();
});

app.use(express.static(publicDir));

app.get("/", (req, res) => {
  res.sendFile(path.join(publicDir, "index.html"));
});

app.get("/api/health", (req, res) => {
  res.json({
    ok: true,
    storage: redis ? "upstash-redis" : "memory",
  });
});

app.post("/api/create-link", async (req, res) => {
  try {
    const linkId = FIXED_LINK_ID;
    await ensureTrackingRecord(linkId);

    res.json({ linkId });
  } catch (error) {
    console.error("Failed to create tracking link:", error);
    res.status(500).json({ error: "Failed to create tracking link" });
  }
});

app.post("/api/location/:linkId", async (req, res) => {
  try {
    const { linkId } = req.params;
    const { latitude, longitude, accuracy, senderName, senderId } = req.body;
    const trackingRecord = linkId === FIXED_LINK_ID
      ? await ensureTrackingRecord(linkId)
      : await getTrackingRecord(linkId);

    if (!trackingRecord) {
      return res.status(404).json({ error: "Link not found" });
    }

    const cleanSenderName = typeof senderName === "string" ? senderName.trim().slice(0, 40) : "";
    if (!cleanSenderName) {
      return res.status(400).json({ error: "Sender name is required" });
    }

    const cleanSenderId = typeof senderId === "string"
      ? senderId.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 64)
      : "";

    if (!cleanSenderId) {
      return res.status(400).json({ error: "Sender ID is required" });
    }

    if (!trackingRecord.senders || typeof trackingRecord.senders !== "object") {
      trackingRecord.senders = {};
    }

    if (!trackingRecord.senders[cleanSenderId]) {
      trackingRecord.senders[cleanSenderId] = {
        name: cleanSenderName,
        locations: [],
      };
    }

    const entry = {
      latitude,
      longitude,
      accuracy,
      timestamp: new Date().toISOString(),
      ip: req.headers["x-forwarded-for"] || req.ip,
    };

    trackingRecord.senders[cleanSenderId].name = cleanSenderName;
    trackingRecord.senders[cleanSenderId].locations.push(entry);
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
    const trackingRecord = linkId === FIXED_LINK_ID
      ? await ensureTrackingRecord(linkId)
      : await getTrackingRecord(linkId);

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