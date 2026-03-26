/* 
 * content.js - DOM Observer & Execution Core
 * Handles content filtering and input monitoring across social networks.
 */

const processedNodes = new WeakSet();
const pendingTextsMap = new Map();
const textResultCache = new Map();
const processingTexts = new Set();
const outgoingScores = new WeakMap();

let debounceTimer = null;
let typeDebounceTimer = null;
let isExtensionEnabled = true;
let outgoingLevel = 'normal';
let lastActiveToxicInput = null;

// Fallback blacklist for synchronous blocking
const FALLBACK_BLACKLIST = [
    "địt", "đụ", "cặc", "lồn", "phò", "đĩ", "chó đẻ", 
    "vãi l", "vcl", "ngu dốt", "óc chó", "đmm", "đcm", 
    "mẹ mày", "con đĩ", "thằng l", "súc vật", "chết mẹ"
];

const SELECTORS = {
    youtube: ['#content-text', 'yt-formatted-string.title'],
    facebook: ['div[dir="auto"]', 'span[dir="auto"]'],
    twitter: ['[data-testid="tweetText"]'],
    instagram: ['span[dir="auto"]', '._a9zs'],
    tiktok: ['[data-e2e="comment-level-1"]', '[data-e2e="comment-level-2"]', '.tiktok-comment-text'],
    reddit: ['shreddit-comment p', '[data-testid="comment"] p'],
    threads: ['span[dir="auto"]']
};

function getInputValue(el) {
    if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') return el.value;
    if (el.isContentEditable) return el.innerText || el.textContent;
    return "";
}

function maskToxicNode(originalNode, toxicText) {
    if (!originalNode || !originalNode.style) return;
    
    let domain = window.location.hostname;
    let nodeToMask = originalNode;

    // Resolve parent container
    if (domain.includes("facebook.com") || domain.includes("instagram.com") || domain.includes("threads.net")) {
        let container = originalNode.closest('[role="article"]');
        if (container) nodeToMask = container;
        else {
            let p = originalNode;
            for(let i=0; i<3; i++) { if(p.parentElement) p = p.parentElement; }
            nodeToMask = p;
        }
    } else if (domain.includes("youtube.com")) {
        let container = originalNode.closest('ytd-comment-thread-renderer, ytd-comment-view-model');
        if (container) nodeToMask = container;
    } else if (domain.includes("twitter.com") || domain.includes("x.com")) {
        let container = originalNode.closest('[data-testid="tweet"]');
        if (container) nodeToMask = container;
    } else if (domain.includes("tiktok.com")) {
        let container = originalNode.closest('[class*="DivCommentItemContainer"]');
        if (container) nodeToMask = container;
    } else if (domain.includes("reddit.com")) {
        let container = originalNode.closest('shreddit-comment, [data-testid="comment"]');
        if (container) nodeToMask = container;
    }

    if (nodeToMask.dataset.phobertMasked === 'true') return;
    if (nodeToMask.closest('[data-phobert-masked="true"]') || nodeToMask.querySelector('[data-phobert-masked="true"]')) return;
    
    nodeToMask.dataset.phobertMasked = 'true';
    nodeToMask.dataset.originalFilter = nodeToMask.style.filter || '';
    nodeToMask.dataset.originalOpacity = nodeToMask.style.opacity || '';
    
    nodeToMask.style.filter = "blur(8px)";
    nodeToMask.style.opacity = "0.7";
    nodeToMask.style.transition = "all 0.3s ease";
    nodeToMask.style.cursor = "pointer";
    nodeToMask.style.backgroundColor = "rgba(255, 0, 0, 0.05)";
    nodeToMask.style.borderRadius = "8px";
    nodeToMask.title = "Toxic content blocked. Click to reveal.";
    
    let safeBtn = document.createElement('button');
    safeBtn.innerText = "Blocked Content (Unlock)";
    safeBtn.style.cssText = "display: none; position: absolute; z-index: 99999; top: 50%; left: 50%; transform: translate(-50%, -50%); background: rgba(0, 0, 0, 0.75); color: white; border: 1px solid rgba(255,255,255,0.2); border-radius: 8px; padding: 6px 12px; font-size: 11px; cursor: pointer; font-family: Inter, sans-serif; font-weight: 600; box-shadow: 0 4px 12px rgba(0,0,0,0.15); backdrop-filter: blur(4px); white-space: nowrap;";
    
    if (getComputedStyle(nodeToMask).position === 'static') {
        nodeToMask.style.position = 'relative';
    }
    nodeToMask.appendChild(safeBtn);

    nodeToMask.onclick = (e) => {
        if(nodeToMask.style.filter === 'none') return;
        
        e.preventDefault();
        e.stopPropagation();
        nodeToMask.style.filter = "none";
        nodeToMask.style.opacity = "1";
        nodeToMask.style.backgroundColor = "transparent";
        nodeToMask.title = "";
        
        safeBtn.style.display = "block";
    };
    
    safeBtn.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        
        safeBtn.innerText = "Adding...";
        safeBtn.style.background = "#64748b";
        
        if (!chrome.runtime || !chrome.runtime.sendMessage) {
            console.warn("[PhoBERT Guard] Extension was updated. Reload page required.");
            safeBtn.remove();
            return;
        }

        chrome.runtime.sendMessage({ action: "add_to_whitelist", text: toxicText }, (res) => {
            if (chrome.runtime.lastError) console.warn(chrome.runtime.lastError);
            safeBtn.innerText = "Marked as safe!";
            safeBtn.style.background = "#3b82f6";
            setTimeout(() => safeBtn.remove(), 2500);
        });
    };
}

function sendBatchToBackground(textsToProcess) {
    if(textsToProcess.length === 0) return;

    if (!chrome.runtime || !chrome.runtime.sendMessage) {
        isExtensionEnabled = false;
        return;
    }

    try {
        chrome.runtime.sendMessage({ action: "analyze_texts", texts: textsToProcess }, (response) => {
            if (chrome.runtime.lastError) {
                textsToProcess.forEach(t => { processingTexts.delete(t); pendingTextsMap.delete(t); });
                return;
            }

            textsToProcess.forEach(t => processingTexts.delete(t));
            
            if (!response || !response.success) {
                textsToProcess.forEach(t => pendingTextsMap.delete(t));
                return;
            }
        
            const { scores, is_toxic } = response.data;
            
            textsToProcess.forEach((text, index) => {
                const toxic = is_toxic[index];
                textResultCache.set(text, toxic);
                
                const nodes = pendingTextsMap.get(text);
                if(nodes) {
                    nodes.forEach(node => {
                        if(toxic) maskToxicNode(node, text);
                    });
                }
            });
        });
    } catch(err) {
        console.warn("[PhoBERT Guard] Connection error:", err);
        isExtensionEnabled = false;
    }
}

function processBatch() {
    if(pendingTextsMap.size === 0) return;
    
    const maxBatchSize = 10;
    let textsToSend = [];
    
    for (let [text, nodes] of pendingTextsMap.entries()) {
        if (textResultCache.has(text)) {
            let isToxic = textResultCache.get(text);
            nodes.forEach(node => {
                if(isToxic) maskToxicNode(node, text);
            });
            pendingTextsMap.delete(text);
        } else if (!processingTexts.has(text)) {
            textsToSend.push(text);
            processingTexts.add(text);
            if(textsToSend.length >= maxBatchSize) break;
        }
    }
    
    if(textsToSend.length > 0) {
        sendBatchToBackground(textsToSend);
    }
    
    if(pendingTextsMap.size > 0) {
        setTimeout(processBatch, 1000);
    }
}

function scanDOM() {
    if(!isExtensionEnabled) return;
    
    let domain = window.location.hostname;
    let selectors = [];
    if (domain.includes("facebook.com")) selectors = SELECTORS.facebook;
    else if (domain.includes("youtube.com")) selectors = SELECTORS.youtube;
    else if (domain.includes("twitter.com") || domain.includes("x.com")) selectors = SELECTORS.twitter;
    else if (domain.includes("instagram.com")) selectors = SELECTORS.instagram;
    else if (domain.includes("tiktok.com")) selectors = SELECTORS.tiktok;
    else if (domain.includes("reddit.com")) selectors = SELECTORS.reddit;
    else if (domain.includes("threads.net")) selectors = SELECTORS.threads;
    else return;
    
    const elements = document.querySelectorAll(selectors.join(','));
    let addedNewText = false;
    
    elements.forEach(node => {
        if(processedNodes.has(node)) return;
        processedNodes.add(node);
        
        let text = node.innerText || node.textContent;
        if(!text) return;
        text = text.trim();
        
        if(text.length < 2 || text === "Like" || text === "Share" || text === "Reply") return;
        
        if(!pendingTextsMap.has(text)) pendingTextsMap.set(text, []);
        pendingTextsMap.get(text).push(node);
        addedNewText = true;
    });
    
    if(addedNewText) {
        if(debounceTimer) clearTimeout(debounceTimer);
        debounceTimer = setTimeout(processBatch, 500);
    }
}

const observer = new MutationObserver((mutations) => {
    if(debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(scanDOM, 300);
});

// Outgoing Content Monitor
document.addEventListener('input', (e) => {
    if(!isExtensionEnabled || outgoingLevel === 'non_blocking') return;
    
    let target = e.target;
    if (target.tagName !== 'INPUT' && target.tagName !== 'TEXTAREA' && !target.isContentEditable) return;
    
    if(typeDebounceTimer) clearTimeout(typeDebounceTimer);
    typeDebounceTimer = setTimeout(() => {
        let text = getInputValue(target).trim();
        if(text.length < 5) {
            outgoingScores.set(target, false);
            if(lastActiveToxicInput && lastActiveToxicInput.el === target) lastActiveToxicInput = null;
            return;
        }
        
        chrome.runtime.sendMessage({ action: "analyze_single", text: text }, (response) => {
            if(chrome.runtime.lastError) return;
            if(response && response.success) {
                if(response.is_toxic) {
                    outgoingScores.set(target, true);
                    lastActiveToxicInput = { el: target, time: Date.now(), text: text };
                } else {
                    outgoingScores.set(target, false);
                    if(lastActiveToxicInput && lastActiveToxicInput.el === target) lastActiveToxicInput = null;
                }
            }
        });
    }, 150);
}, true);

function handleWarn(e) {
    let warnMsg = "PhoBERT Guard AI:\n\nThe content you are about to submit may contain toxic language or violate community guidelines.\n\nAre you SURE you want to proceed?";
    
    if(!confirm(warnMsg)) {
        e.preventDefault();
        e.stopImmediatePropagation();
        return false;
    }
    
    if(e.target) outgoingScores.set(e.target, false);
    lastActiveToxicInput = null;
    return true;
}

document.addEventListener('keydown', (e) => {
    if(!isExtensionEnabled || outgoingLevel === 'non_blocking') return;
    
    if(e.key === 'Enter' && !e.shiftKey) {
        let text = getInputValue(e.target).trim().toLowerCase();
        let isSyncFallback = FALLBACK_BLACKLIST.some(w => text.includes(w));
        
        if(outgoingScores.get(e.target) || isSyncFallback) {
            handleWarn(e);
        }
    }
}, true);

document.addEventListener('click', (e) => {
    if(!isExtensionEnabled || outgoingLevel === 'non_blocking') return;
    
    let el = e.target.closest('button, [role="button"], input[type="submit"], [aria-label], [type="submit"]');
    if(!el) return;
    
    if(lastActiveToxicInput && (Date.now() - lastActiveToxicInput.time) < 30000) {
        let currentText = getInputValue(lastActiveToxicInput.el).trim().toLowerCase();
        if (!currentText || currentText.length < 5) return;
        
        let isSyncFallback = FALLBACK_BLACKLIST.some(w => currentText.includes(w));
        
        if(outgoingScores.get(lastActiveToxicInput.el) || isSyncFallback) {
            let btnText = (el.innerText || "").toLowerCase();
            let ariaLabel = (el.getAttribute('aria-label') || "").toLowerCase();
            let nameAttr = (el.getAttribute('name') || "").toLowerCase();
            
            let sendKeywords = ['gửi', 'send', 'post', 'đăng', 'bình luận', 'reply', 'trả lời', 'comment', 'tweet', 'cast', 'tạo'];
            let isSubmitHit = sendKeywords.some(w => btnText.includes(w) || ariaLabel.includes(w) || nameAttr.includes(w));
            
            if (!isSubmitHit && lastActiveToxicInput.el.closest('form') && lastActiveToxicInput.el.closest('form').contains(el)) {
                isSubmitHit = true; 
            }
            
            if (isSubmitHit) {
                handleWarn(e);
            }
        }
    }
}, true);

// Init Extension
chrome.storage.sync.get({isEnabled: true, outgoingLevel: 'normal'}, (data) => {
    isExtensionEnabled = data.isEnabled;
    outgoingLevel = data.outgoingLevel;
    if(isExtensionEnabled) {
        setTimeout(scanDOM, 1000); 
        observer.observe(document.body, { childList: true, subtree: true });
    }
});

chrome.storage.onChanged.addListener((changes, namespace) => {
    if (namespace === 'sync') {
        if (changes.isEnabled !== undefined) isExtensionEnabled = changes.isEnabled.newValue;
        if (changes.outgoingLevel !== undefined) outgoingLevel = changes.outgoingLevel.newValue;
    }
});
