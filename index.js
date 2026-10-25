require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");

const app = express();
const port = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// MongoDB client
const client = new MongoClient(process.env.MONGO_URI, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

// ================== API ROUTES ==================
// Ek diner hisab load
app.get('/api/day/:date', async (req, res) => {
  try {
    await client.connect();
    const db = client.db('zayan_db');
    const day = await db.collection('days').findOne({ date: req.params.date });
    res.json(day || { date: req.params.date, bazar: [], staff: [], sales: [] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Din save / update
app.post('/api/day/:date', async (req, res) => {
  try {
    await client.connect();
    const db = client.db('zayan_db');
    const { bazar, staff, sales } = req.body;
    const result = await db.collection('days').findOneAndUpdate(
      { date: req.params.date },
      { $set: { bazar, staff, sales } },
      { upsert: true, returnDocument: 'after' }
    );
    res.json(result.value || result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Sob diner history
app.get('/api/history', async (req, res) => {
  try {
    await client.connect();
    const db = client.db('zayan_db');
    const days = await db.collection('days').find().sort({ date: -1 }).toArray();
    res.json(days);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Monthly summary
app.get('/api/monthly/:year/:month', async (req, res) => {
  try {
    await client.connect();
    const db = client.db('zayan_db');
    const { year, month } = req.params;
    const prefix = `${year}-${month.padStart(2, '0')}`;
    const days = await db.collection('days').find({ date: { $regex: `^${prefix}` } }).toArray();

    let totalSales = 0, totalBazar = 0, totalStaff = 0;
    days.forEach(day => {
      (day.sales || []).forEach(s => totalSales += s.amount);
      (day.bazar || []).forEach(b => totalBazar += b.price);
      (day.staff || []).forEach(s => totalStaff += s.salary);
    });

    const totalCost = totalBazar + totalStaff;
    const profit = totalSales - totalCost;

    res.json({
      year, month, daysCount: days.length,
      totalSales, totalBazar, totalStaff, totalCost, profit, days
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Din delete
app.delete('/api/day/:date', async (req, res) => {
  try {
    await client.connect();
    const db = client.db('zayan_db');
    await db.collection('days').deleteOne({ date: req.params.date });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ================== SERVER START ==================
async function startServer() {
  try {
    await client.connect();
    console.log("✅ MongoDB connected");
    app.listen(port, () => {
      console.log(`🚀 ZAYAN server running: http://localhost:${port}`);
    });
  } catch (err) {
    console.error("❌ MongoDB connection error:", err.message);
  }
}

startServer();