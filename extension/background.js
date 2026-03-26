// background.js - Xử lý gọi API để tránh lỗi CORS (Content Security Policy) trên các trang mạng xã hội
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "analyze_texts") {
        // Lấy API URL từ Storage, nếu không có mặc định dùng server bạn cung cấp
        chrome.storage.sync.get({ apiUrl: 'http://171.241.42.222:8000/analyze' }, function (data) {
            fetch(data.apiUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ texts: request.texts })
            })
            .then(response => response.json())
            .then(result => {
                sendResponse({ success: true, data: result });
            })
            .catch(error => {
                console.error("Lỗi khi kết nối PhoBERT server:", error);
                sendResponse({ success: false, error: error.toString() });
            });
        });

        // Trả về true để cho phép sendResponse trả lời bất đồng bộ
        return true; 
    }
});
