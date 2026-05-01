// server.js
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const session = require("express-session");
const dotenv = require("dotenv");
const fetch = require("node-fetch");
const path = require("path");
const fs = require("fs");

const http = require("http");
const { Server } = require("socket.io");

dotenv.config();

// --------------------
// Routes
// --------------------
const userRoutes = require("./routes/userRoutes");
const incidentRoutes = require("./routes/incidentRoutes");
const historyRoutes = require("./routes/historyRoutes");
const evacRoutes = require("./routes/EvacRoutes");
const authRoutes = require("./routes/authRoutes");
const barangayRoutes = require("./routes/barangayRoutes");
const drrmoRoutes = require("./routes/drrmoRoutes");
const reliefTrackingRoutes = require("./routes/reliefTrackingRoutes");
const auditRoutes = require("./routes/auditRoutes");
const guidelineRoutes = require("./routes/GuidelineRoutes");
const announcementRoutes = require("./routes/AnnouncementRoutes");
const connectionRoutes = require("./routes/connectionRoutes");
const timeInOutRoutes = require("./routes/timeInOutRoutes");
const editRoutes = require("./routes/editRoutes");
const barangayStockRoutes = require("./routes/barangayStockRoutes");
const donationRoutes = require("./routes/donationRoutes");
const safetyMarkingRoutes = require("./routes/safetyMarkingRoutes");

// Donation & inventory routes
const inventoryRoutes = require("./routes/inventoryRoutes");
const reliefRequestRoutes = require("./routes/reliefRequestRoutes");
const reliefReleaseRoutes = require("./routes/reliefReleaseRoutes");
const barangayCollectionRoutes = require("./routes/barangayCollectionRoutes");

const app = express();
const server = http.createServer(app);

app.set("trust proxy", 1);

// --------------------
// Upload folders
// --------------------
const uploadDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const guidelinesDir = path.join(uploadDir, "guidelines");
if (!fs.existsSync(guidelinesDir)) fs.mkdirSync(guidelinesDir, { recursive: true });

const announcementsDir = path.join(uploadDir, "announcements");
if (!fs.existsSync(announcementsDir)) fs.mkdirSync(announcementsDir, { recursive: true });

const inventoryDir = path.join(uploadDir, "inventory");
if (!fs.existsSync(inventoryDir)) fs.mkdirSync(inventoryDir, { recursive: true });

const goodsDir = path.join(uploadDir, "goods");
if (!fs.existsSync(goodsDir)) fs.mkdirSync(goodsDir, { recursive: true });

const monetaryDir = path.join(uploadDir, "monetary");
if (!fs.existsSync(monetaryDir)) fs.mkdirSync(monetaryDir, { recursive: true });

const proofsDir = path.join(uploadDir, "proofs");
if (!fs.existsSync(proofsDir)) fs.mkdirSync(proofsDir, { recursive: true });

const reliefRequestsDir = path.join(uploadDir, "relief-requests");
if (!fs.existsSync(reliefRequestsDir)) {
  fs.mkdirSync(reliefRequestsDir, { recursive: true });
}

const avatarsDir = path.join(uploadDir, "avatars");
if (!fs.existsSync(avatarsDir)) {
  fs.mkdirSync(avatarsDir, { recursive: true });
}

// --------------------
// Body parsers
// --------------------
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

// --------------------
// CORS
// --------------------
const FRONTEND_URLS = [
  "http://localhost:3000",
  "http://localhost:8081",
  "http://10.0.2.2:8081",
  "http://192.168.1.87:8081",
  "https://sagipbayan.com",
];

app.use(
  cors({
    origin: function (origin, callback) {
      // React Native requests often have no browser Origin.
      if (!origin || FRONTEND_URLS.includes(origin)) {
        callback(null, true);
      } else {
        console.log("[cors] blocked origin:", origin);
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
  })
);

// --------------------
// Session
// --------------------
const isProd = process.env.NODE_ENV === "production";

app.use(
  session({
    secret: process.env.SESSION_SECRET || "supersecretkey",
    resave: false,
    saveUninitialized: false,
    proxy: isProd,
    cookie: {
      secure: isProd,
      httpOnly: true,
      sameSite: isProd ? "none" : "lax",
      maxAge: 1000 * 60 * 60 * 24,
    },
  })
);

// --------------------
// Debug middleware
// --------------------
app.use((req, res, next) => {
  console.log("REQUEST:", req.method, req.url);
  console.log("SESSION:", req.session);
  next();
});

// --------------------
// Health / Debug routes
// --------------------
app.get("/health", (req, res) => {
  res.status(200).json({
    ok: true,
    message: "Backend is reachable",
  });
});

app.post("/health-post", (req, res) => {
  console.log("POST /health-post reached");
  console.log("BODY:", req.body);

  res.status(200).json({
    ok: true,
    message: "POST is working",
    body: req.body,
  });
});

app.get("/api/debug-express", (req, res) => {
  res.json({
    message: "EXPRESS WORKING",
    session: req.session,
  });
});

app.get("/api/mobile-debug", async (req, res) => {
  const startedAt = Date.now();
  const checks = {
    backend: true,
    apiStatus: "ok",
    mongoState: mongoose.connection.readyState,
    incidentFetch: false,
    evacFetch: false,
    guidelineFetch: false,
  };

  try {
    const [incidentCount, evacCount, guidelineCount] = await Promise.all([
      mongoose.connection.db.collection("incidents").countDocuments({ status: "accepted" }),
      mongoose.connection.db.collection("evacplaces").countDocuments({ isArchived: { $ne: true } }),
      mongoose.connection.db.collection("guidelines").countDocuments({ status: "published" }),
    ]);

    checks.incidentFetch = true;
    checks.evacFetch = true;
    checks.guidelineFetch = true;

    res.json({
      ok: true,
      message: "Connected to server",
      responseTimeMs: Date.now() - startedAt,
      checks,
      counts: {
        acceptedIncidents: incidentCount,
        evacuationCenters: evacCount,
        publishedGuidelines: guidelineCount,
      },
    });
  } catch (err) {
    res.status(500).json({
      ok: false,
      message: "Failed to fetch server diagnostics",
      responseTimeMs: Date.now() - startedAt,
      checks,
      error: err.message,
    });
  }
});

app.get("/api/tryserver", (req, res) => {
  res.json({ message: "Server is working!" });
});

app.get("/api/debug-session", (req, res) => {
  res.json({
    session: req.session,
    username: req.session?.username || null,
    userId: req.session?.userId || null,
    role: req.session?.role || null,
  });
});

app.get("/", (req, res) => {
  res.send("ROOT WORKING");
});

// --------------------
// Serve uploads
// --------------------
app.use("/uploads", express.static(uploadDir));
app.use("/uploads/guidelines", express.static(guidelinesDir));
app.use("/uploads/announcements", express.static(announcementsDir));
app.use("/uploads/inventory", express.static(inventoryDir));
app.use("/uploads/goods", express.static(goodsDir));
app.use("/uploads/monetary", express.static(monetaryDir));
app.use("/uploads/proofs", express.static(proofsDir));
app.use("/uploads/relief-requests", express.static(reliefRequestsDir));
app.use("/uploads/avatars", express.static(avatarsDir));

// --------------------
// API Routes
// --------------------
app.use("/api/guidelines", guidelineRoutes);
app.use("/api/announcements", announcementRoutes);
app.use("/user", userRoutes);
app.use("/incident", incidentRoutes);
app.use("/history", historyRoutes);
app.use("/evacs", evacRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/barangays/collection", barangayCollectionRoutes);
app.use("/api/barangays", barangayRoutes);
app.use("/api/drrmo", drrmoRoutes);
app.use("/api/relief-tracking", reliefTrackingRoutes);
app.use("/api/audit", auditRoutes);
app.use("/connection", connectionRoutes);
app.use("/api/timeinout", timeInOutRoutes);
app.use("/api/edit", editRoutes);
app.use("/api/inventory", inventoryRoutes);
app.use("/api/relief-requests", reliefRequestRoutes);
app.use("/api/relief-releases", reliefReleaseRoutes);
app.use("/api/barangay-stock", barangayStockRoutes);
app.use("/api/donations", donationRoutes);
app.use("/api/safety-marking", safetyMarkingRoutes);

// --------------------
// Hazard proxy
// --------------------
app.get("/hazards", async (req, res) => {
  try {
    const citiesRes = await fetch("https://api.mapakalamidad.ph/cities");
    const citiesJson = await citiesRes.json();

    const pasig = citiesJson.result?.find(
      (city) =>
        city.name.toLowerCase().includes("pasig") ||
        city.code.toLowerCase().includes("pasig")
    );

    if (!pasig) {
      return res.status(404).json({ error: "Pasig City not found" });
    }

    const reportsRes = await fetch(
      `https://api.mapakalamidad.ph/reports?geoformat=geojson&admin=${pasig.code}`,
      { headers: { "User-Agent": "MyHazardMapApp/1.0" } }
    );

    const reportsData = await reportsRes.json();
    res.json(reportsData.result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --------------------
// React build production
// --------------------
if (process.env.NODE_ENV === "production") {
  const buildPath = path.join(__dirname, "..", "tests", "build");
  app.use(express.static(buildPath));

  app.get(/^\/(?!api).*/, (req, res) => {
    res.sendFile(path.join(buildPath, "index.html"));
  });
}

// --------------------
// Global error handler
// --------------------
app.use((err, req, res, next) => {
  console.error("GLOBAL EXPRESS ERROR:", {
    method: req.method,
    url: req.originalUrl,
    message: err.message,
    name: err.name,
    code: err.code,
    stack: err.stack,
  });

  res.status(err.status || 500).json({
    message: err.message || "Server error",
    name: err.name || "Error",
    code: err.code || null,
  });
});

// --------------------
// Socket.IO
// --------------------
const io = new Server(server, {
  cors: {
    origin: [
      "https://sagipbayan.com",
      "http://localhost:3000",
      "http://localhost:8081",
      "http://10.0.2.2:8081",
      "http://192.168.1.87:8081",
    ],
    credentials: true,
  },
});

io.on("connection", (socket) => {
  console.log("[socket] User connected:", socket.id);

  socket.on("send-location", (data) => {
    console.log("[socket] Received location:", data);
    socket.broadcast.emit("receive-location", data);
  });

  socket.on("disconnect", () => {
    console.log("[socket] User disconnected:", socket.id);
  });
});

// --------------------
// MongoDB
// --------------------
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("MongoDB Atlas connected"))
  .catch((err) => console.error("MongoDB connection error:", err));

mongoose.connection.once("open", async () => {
  console.log("Connected DB:", mongoose.connection.name);

  const collections = await mongoose.connection.db.listCollections().toArray();
  console.log(
    "Collections in DB:",
    collections.map((c) => c.name)
  );
});

// --------------------
// Start server
// --------------------
const PORT = process.env.PORT || 8000;

server.on("error", (err) => {
  if (err.code === "EADDRINUSE") {
    console.error(
      `Port ${PORT} is already in use. Stop the other server using that port, or start this one with a different PORT value.`
    );
    console.error("Example: $env:PORT=8001; node server.js");
    process.exit(1);
  }

  console.error("Server failed to start:", err);
  process.exit(1);
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on port ${PORT}`);
});
