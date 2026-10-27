// ================== ZAYAN RESTAURANT SERVER (Vercel Ready) ==================
const dns = require('dns');
dns.setServers(['8.8.8.8', '8.8.4.4']);

require("dotenv").config();
const express = require("express");
const cors = require("cors");
const path = require("path");
const { MongoClient, ServerApiVersion } = require("mongodb");

const app = express();
const port = process.env.PORT || 5000;

// ================== MIDDLEWARE ==================
app.use(cors());
app.use(express.json());
// ✅ index.js রুট ডিরেক্টরিতে, তাই public ফোল্ডার একই স্তরে
app.use(express.static(path.join(__dirname, "public")));

// ================== MONGODB CLIENT (Cached for Vercel Serverless) ==================
let cachedClient = null;

async function getClient() {
  if (cachedClient) return cachedClient;

  const client = new MongoClient(process.env.MONGO_URI, {
    serverApi: {
      version: ServerApiVersion.v1,
      strict: true,
      deprecationErrors: true,
    },
    maxPoolSize: 5,
    minPoolSize: 0,
    serverSelectionTimeoutMS: 10000,
    socketTimeoutMS: 45000,
  });

  await client.connect();
  cachedClient = client;
  return client;
}

const dbName = "zayan_db";

async function getDb() {
  const client = await getClient();
  return client.db(dbName);
}

// ================== API ROUTES ==================

// 1️⃣ GET ONE DAY
app.get("/api/day/:date", async (req, res) => {
  try {
    const db = await getDb();
    const day = await db.collection("days").findOne({ date: req.params.date });
    res.json(day || { date: req.params.date, bazar: [], staff: [], sales: [] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 2️⃣ SAVE / UPDATE A DAY
app.post("/api/day/:date", async (req, res) => {
  try {
    const db = await getDb();
    const { bazar, staff, sales } = req.body;
    const result = await db.collection("days").findOneAndUpdate(
      { date: req.params.date },
      { $set: { bazar, staff, sales } },
      { upsert: true, returnDocument: "after" }
    );
    res.json(result.value || result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 3️⃣ GET ALL DAYS (HISTORY)
app.get("/api/history", async (req, res) => {
  try {
    const db = await getDb();
    const days = await db.collection("days").find().sort({ date: -1 }).toArray();
    res.json(days);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 4️⃣ MONTHLY SUMMARY
app.get("/api/monthly/:year/:month", async (req, res) => {
  try {
    const db = await getDb();
    const { year, month } = req.params;
    const prefix = `${year}-${month.padStart(2, "0")}`;
    const days = await db
      .collection("days")
      .find({ date: { $regex: `^${prefix}` } })
      .toArray();

    let totalSales = 0, totalBazar = 0, totalStaff = 0;
    days.forEach((day) => {
      (day.sales || []).forEach((s) => (totalSales += s.amount));
      (day.bazar || []).forEach((b) => (totalBazar += b.price));
      (day.staff || []).forEach((s) => (totalStaff += s.salary));
    });

    const totalCost = totalBazar + totalStaff;
    const profit = totalSales - totalCost;

    res.json({
      year,
      month,
      daysCount: days.length,
      totalSales,
      totalBazar,
      totalStaff,
      totalCost,
      profit,
      days,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 5️⃣ DELETE A DAY
app.delete("/api/day/:date", async (req, res) => {
  try {
    const db = await getDb();
    await db.collection("days").deleteOne({ date: req.params.date });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ================== FRONTEND ==================
// ✅ public ফোল্ডারের পাথ ঠিক করা হয়েছে
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// ================== SERVER START (লোকাল ডেভেলপমেন্টের জন্য) ==================
if (process.env.NODE_ENV !== "production") {
  (async () => {
    try {
      await getClient();
      console.log("✅ MongoDB connected");
      app.listen(port, () => {
        console.log(`🚀 ZAYAN server running: http://localhost:${port}`);
      });
    } catch (err) {
      console.error("❌ MongoDB connection error:", err.message);
    }
  })();
}

// Vercel-এর জন্য app এক্সপোর্ট
module.exports = app;