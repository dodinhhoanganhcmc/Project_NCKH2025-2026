import { pipeline, env } from './libs/transformers.js';
import { segmentText } from './libs/segmenter.js';

// Configure WebAssembly (WASM) environment for Offline Local Inference
env.allowLocalModels = true;
env.allowRemoteModels = false;

// Set local paths to extension folders
env.localModelPath = chrome.runtime.getURL('models/');
env.backends.onnx.wasm.wasmPaths = chrome.runtime.getURL('libs/');

// Chrome V3 Service Workers restrict multi-threading. NumThreads must be 1.
env.backends.onnx.wasm.numThreads = 1;

// Disable caching for direct disk access (Chrome v3 scheme fix)
env.useBrowserCache = false; 

// Initial heuristic filter to block toxic words while ONNX is loading into RAM
const FALLBACK_BLACKLIST = [
    "địt", "đụ", "cặc", "lồn", "phò", "đĩ", "chó đẻ", 
    "vãi l", "vcl", "ngu dốt", "óc chó", "đmm", "đcm", 
    "mẹ mày", "con đĩ", "thằng l", "súc vật", "chết mẹ"
];

let currentWhitelist = ["con người", "con mèo", "con chó", "làm con", "muối bỏ biển"];
let currentScoreThreshold = 0.9;
let currentOutgoingThreshold = 0.9;

function updateSettings(whitelistArray, levelString, outgoingString) {
    if(whitelistArray) currentWhitelist = whitelistArray;
    
    if(levelString) {
        if(levelString === 'strictly') currentScoreThreshold = 0.7;
        else if(levelString === 'normal') currentScoreThreshold = 0.9;
        else if(levelString === 'non_blocking') currentScoreThreshold = 2.0; 
    }
    
    if(outgoingString) {
        if(outgoingString === 'strictly') currentOutgoingThreshold = 0.7;
        else if(outgoingString === 'normal') currentOutgoingThreshold = 0.9;
        else if(outgoingString === 'non_blocking') currentOutgoingThreshold = 2.0;
    }
    
    console.log(`[PhoBERT Guard] Config Loaded. Read Threshold: > ${currentScoreThreshold}. Outgoing Threshold: > ${currentOutgoingThreshold}`);
}

chrome.storage.sync.get({ whitelist: currentWhitelist, blockingLevel: 'normal', outgoingLevel: 'normal' }, (items) => {
    updateSettings(items.whitelist, items.blockingLevel, items.outgoingLevel);
});

chrome.storage.onChanged.addListener((changes, namespace) => {
    if (namespace === 'sync') {
        updateSettings(
            changes.whitelist?.newValue ?? currentWhitelist,
            changes.blockingLevel?.newValue ?? null,
            changes.outgoingLevel?.newValue ?? null
        );
    }
});

let classifierPipeline = null;

async function loadModel() {
    if (!classifierPipeline) {
        if (!env.localModelPath) {
            console.error("[PhoBERT Guard] Missing config file path");
        }
        classifierPipeline = await pipeline('text-classification', 'phobert_toxic', {
            quantized: true,
        });
        console.log("Initialized");
    }
    return classifierPipeline;
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "analyze_texts") {
        (async () => {
            try {
                let results = [];
                let isToxicList = [];
                let pipeIsReady = classifierPipeline !== null;
                
                for(let text of request.texts) {
                    let sanitized = text.toLowerCase().trim();
                    let skip = (currentScoreThreshold > 1.0);
                    
                    if (!skip) {
                        for (let word of currentWhitelist) {
                             if (sanitized === word || (sanitized.length < 20 && sanitized.includes(word))) {
                                 skip = true;
                                 break;
                             }
                        }
                    }

                    if (skip) {
                        results.push(0.0);
                        isToxicList.push(false);
                        continue;
                    }

                    // Handle model initialization delay using fallback regex
                    if (!pipeIsReady) {
                        let isFallBackToxic = FALLBACK_BLACKLIST.some(badWord => sanitized.includes(badWord));
                        results.push(isFallBackToxic ? 1.0 : 0.0);
                        isToxicList.push(isFallBackToxic);
                        continue;
                    }
                    
                    let segmentedText = segmentText(text);
                    let output = await classifierPipeline(segmentedText, { truncation: true, max_length: 256 });
                    
                    let score = 0;
                    if (output[0].label === "LABEL_1") score = output[0].score;
                    else if(output[0].label === "LABEL_0") score = 1.0 - output[0].score;
                    
                    results.push(score);
                    isToxicList.push(score > currentScoreThreshold);
                }
                
                sendResponse({ success: true, data: { scores: results, is_toxic: isToxicList } });
            } catch(error) {
                console.error("[PhoBERT Guard] Inference Error:", error);
                sendResponse({ success: false, error: error.toString() });
            }
        })();
        
        return true; // Async response
        
    } else if (request.action === "analyze_single") {
        if (currentOutgoingThreshold >= 2.0) {
            sendResponse({ success: true, is_toxic: false });
            return true;
        }
        
        (async () => {
            try {
                let text = request.text;
                let sanitized = text.toLowerCase().trim();
                let skip = currentWhitelist.some(phrase => sanitized.includes(phrase));
                
                if (skip) {
                    sendResponse({ success: true, is_toxic: false });
                    return;
                }
                
                if (!classifierPipeline) {
                    let isFallBackToxic = FALLBACK_BLACKLIST.some(badWord => sanitized.includes(badWord));
                    sendResponse({ success: true, is_toxic: isFallBackToxic });
                    return;
                }
                
                let segmentedText = segmentText(text);
                let output = await classifierPipeline(segmentedText, { truncation: true, max_length: 256 });
                let score = 0;
                
                if (output[0].label === "LABEL_1") score = output[0].score;
                else if(output[0].label === "LABEL_0") score = 1.0 - output[0].score;
                
                sendResponse({ success: true, is_toxic: (score > currentOutgoingThreshold) });
            } catch (err) {
                sendResponse({ success: false });
            }
        })();
        
        return true;
        
    } else if (request.action === "notify") {
        if(chrome.notifications) {
            const fallbackIcon = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADAAAAAwCAYAAABXAvmHAAAABGdBTUEAALGPC/xhBQAAACBjSFJNAAB6JgAAgIQAAPoAAACA6AAAdTAAAOpgAAA6mAAAF3CculE8AAAAy0lEQVRo3u3WwQnDMBBE0V/O6XyXzrmCQAihG98I2I+B4J9QWP7QzWb/0/vM1tE8mscb4DEwj+aRBuAxsI7m0QTwGFhH88jGwDqaRx2Ax8A4mke1A4yjcTQPmEdzaB4wj+ZoHjCPZmkewDzaoHkE82iD5rEP8wiD5vEN8wgPmqf7/j+zN/B4A/BonuYR/AA8mqd5JD8Aj+ZpHtUPwKN5mkcegEfjNA/tA+zRHM1D84B5NEfzADZonsDDPNrH+wGj92AezQN4vAF4NE/z2B7NtzV/Yl5bAAAAAElFTkSuQmCC';
            chrome.notifications.create({
                type: "basic",
                iconUrl: fallbackIcon, 
                title: request.title,
                message: request.message,
                priority: 2
            });
        }
        return false;
        
    } else if (request.action === "add_to_whitelist") {
        let newPhrase = request.text.replace(/,/g, ' ').trim().toLowerCase();
        
        if (!currentWhitelist.includes(newPhrase)) {
            let updatedList = [...currentWhitelist, newPhrase];
            chrome.storage.sync.set({ whitelist: updatedList }, () => {
                sendResponse({ success: true });
            });
        } else {
            sendResponse({ success: true });
        }
        return true;
    }
});

// Load the model in the background immediately
loadModel().catch(err => console.error("[PhoBERT Guard] Model Init Error:", err));
