// content.js - Tạm thời chỉ để kiểm tra trong Phase 2
console.log("[PhoBERT Guard] Content Script Initialized!");

chrome.storage.sync.get({isEnabled: true}, (data) => {
    if(!data.isEnabled) {
        console.log("[PhoBERT Guard] Extension is disabled.");
        return;
    }
    console.log("[PhoBERT Guard] Extension is active. Ready to extract texts!");
    
    // Test thử gọi API từ content script (gửi lên background)
    chrome.runtime.sendMessage({
        action: "analyze_texts",
        texts: ["Đây là bản test khởi chạy Content Script."]
    }, (response) => {
        if(response && response.success) {
            console.log("[PhoBERT Guard] Connected to API Server Successfully!", response.data);
        } else {
            console.error("[PhoBERT Guard] API Connection Failed!", response?.error);
        }
    });
});
