document.addEventListener('DOMContentLoaded', () => {
    const whitelistInput = document.getElementById('whitelist');
    const blockingLevelSelect = document.getElementById('blockingLevel');
    const outgoingLevelSelect = document.getElementById('outgoingLevel');
    const enableToggle = document.getElementById('enableToggle');
    const saveBtn = document.getElementById('saveBtn');
    const statusDiv = document.getElementById('status');

    // Load previous configuration
    chrome.storage.sync.get({
        whitelist: ["con người", "con mèo", "con chó", "làm con", "muối bỏ biển"],
        blockingLevel: 'normal',
        outgoingLevel: 'normal',
        isEnabled: true
    }, (items) => {
        whitelistInput.value = items.whitelist.join(", ");
        blockingLevelSelect.value = items.blockingLevel;
        outgoingLevelSelect.value = items.outgoingLevel;
        enableToggle.checked = items.isEnabled;
    });

    // Save configuration
    saveBtn.addEventListener('click', () => {
        // Convert comma-separated string back to array
        let whitelistRaw = whitelistInput.value.split(',');
        let whitelistArray = whitelistRaw.map(s => s.trim().toLowerCase()).filter(s => s.length > 0);

        chrome.storage.sync.set({
            whitelist: whitelistArray,
            blockingLevel: blockingLevelSelect.value,
            outgoingLevel: outgoingLevelSelect.value,
            isEnabled: enableToggle.checked
        }, () => {
            statusDiv.style.opacity = '1';
            setTimeout(() => {
                statusDiv.style.opacity = '0';
            }, 2000);
        });
    });

    // Listen to toggle changes to save immediately
    enableToggle.addEventListener('change', () => {
        chrome.storage.sync.set({ isEnabled: enableToggle.checked });
    });
});
