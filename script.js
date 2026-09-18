function switchTab(tabName) {
    // إخفاء جميع التبويبات وإلغاء تفعيل الأزرار
    document.querySelectorAll('.tab-pane').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.menu-btn').forEach(el => el.classList.remove('active'));

    // تفعيل التبويب والزر المطلوب
    const targetTab = document.getElementById(tabName + 'Tab');
    if (targetTab) {
        targetTab.classList.add('active');
    }
    
    // العثور على الزر الذي تم ضغطه وتفعيله
    event.currentTarget.classList.add('active');
}

// دالة فتح المجلد أو الانتقال عبر المسارات في مدير الملفات
function openPath(path) {
    document.getElementById('currentPath').textContent = path;
    
    fetch('/api/filemanager/list', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deviceId: 'default_device', path: path })
    })
    .then(res => res.json())
    .then(data => {
        console.log("Path loaded successfully:", data);
    })
    .catch(err => console.error("Error loading path:", err));
}

// دالة معاينة الصور الفردية عند النقر عليها
function viewImage(imagePath) {
    fetch('/api/filemanager/getfile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deviceId: 'default_device', path: imagePath })
    })
    .then(res => res.json())
    .then(data => {
        alert("تم طلب ملف الصورة بنجاح: " + imagePath);
    })
    .catch(err => console.error("Error fetching file:", err));
}
