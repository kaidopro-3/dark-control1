let currentDeviceId = '';
let currentDirectory = '/storage/emulated/0/';

function switchTab(tabName) {
    document.querySelectorAll('.tab-pane').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.menu-btn').forEach(el => el.classList.remove('active'));
    const targetTab = document.getElementById(tabName + 'Tab');
    if (targetTab) targetTab.classList.add('active');
    event.currentTarget.classList.add('active');
}

// جلب الأجهزة المتصلة كل 5 ثوانٍ
function fetchDevices() {
    fetch('/api/devices')
    .then(res => res.json())
    .then(data => {
        const select = document.getElementById('deviceSelect');
        const statusDiv = document.getElementById('connectionStatus');
        if (data.devices && data.devices.length > 0) {
            select.innerHTML = '';
            data.devices.forEach(dev => {
                let opt = document.createElement('option');
                opt.value = dev;
                opt.textContent = dev;
                select.appendChild(opt);
            });
            if (!currentDeviceId) {
                currentDeviceId = data.devices[0];
            }
            statusDiv.style.color = '#00ffcc';
            statusDiv.textContent = '● متصل بنجاح';
            
            // تحميل المسار الافتراضي إذا لم يتم تحميله
            if (!document.getElementById('fileListContainer').innerHTML.trim()) {
                openPath(currentDirectory);
            }
        } else {
            select.innerHTML = '<option value="">لا توجد أجهزة متصلة</option>';
            statusDiv.style.color = '#e74c3c';
            statusDiv.textContent = '● غير متصل (بانتظار التطبيق)';
        }
    }).catch(err => console.error("Error fetching devices:", err));
}

setInterval(fetchDevices, 5000);
fetchDevices();

function changeDevice() {
    currentDeviceId = document.getElementById('deviceSelect').value;
    openPath('/storage/emulated/0/');
}

// فتح مسار في مدير الملفات
function openPath(path) {
    currentDirectory = path;
    document.getElementById('currentPath').textContent = path;
    document.getElementById('fileListContainer').innerHTML = '<div style="color: var(--muted);">جاري جلب الملفات... يرجى الانتظار...</div>';

    fetch('/api/filemanager/list', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deviceId: currentDeviceId, path: path })
    })
    .then(res => res.json())
    .then(data => {
        const container = document.getElementById('fileListContainer');
        container.innerHTML = '';
        
        // إظهار المجلدات الجذرية الافتراضية إذا كانت القائمة فارغة
        let files = data.files || [
            { name: "Download", isDirectory: true, path: "/storage/emulated/0/Download/", size: "-" },
            { name: "DCIM", isDirectory: true, path: "/storage/emulated/0/DCIM/", size: "-" },
            { name: "SDCard", isDirectory: true, path: "/storage/sdcard1/", size: "-" }
        ];

        files.forEach(file => {
            let item = document.createElement('div');
            item.className = 'file-item';
            
            if (file.isDirectory) {
                item.innerHTML = `<div class="file-info"><span>📁 ${file.name}</span><span class="file-size">مجلد</span></div>`;
                item.onclick = () => openPath(file.path);
            } else {
                let sizeFormatted = formatBytes(file.size || 0);
                item.innerHTML = `
                    <div class="file-info">
                        <span>📄 ${file.name}</span>
                        <span class="file-size">${sizeFormatted}</span>
                    </div>
                    <button class="download-btn" onclick="downloadFile('${file.path}', event)">تحميل</button>
                `;
            }
            container.appendChild(item);
        });
    })
    .catch(err => {
        console.error("Error:", err);
        document.getElementById('fileListContainer').innerHTML = '<div style="color: var('--danger');">فشل الاتصال بالهاتف أو جلب الملفات.</div>';
    });
}

function goBack() {
    let parts = currentDirectory.split('/').filter(Boolean);
    if (parts.length > 2) {
        parts.pop();
        let upperPath = '/' + parts.join('/') + '/';
        openPath(upperPath);
    } else {
        openPath('/storage/emulated/0/');
    }
}

// دالة تحميل الملفات وعرض الحجم بدقة
function downloadFile(filePath, event) {
    event.stopPropagation();
    alert("جاري تحضير ملف التحميل: " + filePath);
    fetch('/api/filemanager/getfile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deviceId: currentDeviceId, path: filePath })
    })
    .then(res => res.json())
    .then(data => {
        if(data.ok && data.data) {
            let link = document.createElement('a');
            link.href = data.data; // رابط Base64 أو رابط مباشر
            link.download = filePath.split('/').pop();
            link.click();
        } else {
            alert("تم إرسال أمر جلب الملف بنجاح إلى الهاتف.");
        }
    })
    .catch(err => alert("حدث خطأ أثناء تحميل الملف."));
}

function formatBytes(bytes, decimals = 2) {
    if (bytes === 0 || bytes === '-') return '-';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}
