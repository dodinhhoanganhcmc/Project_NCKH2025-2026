document.addEventListener('DOMContentLoaded', () => {
    const apiUrlInput = document.getElementById('apiUrl');
    const enableToggle = document.getElementById('enableToggle');
    const saveBtn = document.getElementById('saveBtn');
    const statusDiv = document.getElementById('status');

    // Tải cấu hình cũ
    chrome.storage.sync.get({
        apiUrl: 'http://171.241.42.222:8000/analyze',
        isEnabled: true
    }, (items) => {
        apiUrlInput.value = items.apiUrl;
        enableToggle.checked = items.isEnabled;
    });

    // Lưu cấu hình
    saveBtn.addEventListener('click', () => {
        chrome.storage.sync.set({
            apiUrl: apiUrlInput.value,
            isEnabled: enableToggle.checked
        }, () => {
            statusDiv.style.display = 'block';
            setTimeout(() => {
                statusDiv.style.display = 'none';
            }, 2000);
        });
    });

    // Lắng nghe thay đổi bật/tắt để lưu ngay lập tức
    enableToggle.addEventListener('change', () => {
        chrome.storage.sync.set({ isEnabled: enableToggle.checked });
    });
});
