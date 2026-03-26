# PhoBERT Guard: Offline Browser Toxicity Blocker

PhoBERT Guard is a privacy-first, locally-inferencing browser extension designed to detect and block toxic Vietnamese content on social media platforms in real-time. Powered by a quantized ONNX version of PhoBERT, it runs purely in the browser—no data is sent to external servers, ensuring 100% privacy and low-latency filtering.

## Features

* **Offline AI Inference**: Uses `onnxruntime-web` and `@xenova/transformers` to run deep learning classification entirely within the browser.
* **Bi-directional Protection**:
  * **Incoming Masking**: Blurs toxic posts, comments, and messages automatically as they appear on the screen.
  * **Outgoing Gatekeeper**: Intercepts your keystrokes and forms before submission, throwing a warning confirmation (`window.confirm`) if you attempt to post toxic language.
* **Cross-Platform Support**: Seamlessly works on Facebook, YouTube, Twitter (X), Instagram, TikTok, Reddit, and Threads.
* **Zero Input Lag**: Implements a highly optimized DOM observer with `WeakMap` state tracking, debouncing, and a static fallback blacklist while the AI initializes.
* **Universal Extension**: Supports Google Chrome, Microsoft Edge, and Mozilla Firefox (Gecko).

## Project Structure

```text
├── extension/
│   ├── background.js     # Service Worker: Loads ONNX model, manages messaging and notifications.
│   ├── content.js        # DOM Observer: Blurs DOM nodes, catches submit events, modifies UI.
│   ├── popup.html        # Extension Dashboard UI.
│   ├── popup.js          # Handles User Configuration (Whitelist, Sensitivity level).
│   ├── libs/
│   │   ├── segmenter.js        # Custom Vietnamese word tokenizer/segmenter.
│   │   ├── dictionary_words.js # Dictionary words for segmenter.
│   │   └── transformers.js     # Transformers.js library for WebAssembly ONNX inference.
│   └── models/phobert_toxic/   # Contains the INT8 quantized PhoBERT model (.onnx), tokenizer configs.
├── server.py             # Optional backend (if running a centralized hybrid API).
└── convert_to_onnx.sh    # Scripts used to convert the raw PyTorch model into ONNX.
```

## System Requirements & Performance Estimate

Since this extension runs a 135MB Deep Learning model entirely locally within a browser's Service Worker (via WebAssembly), here are the performance metrics:

- **Storage / Disk Space**: ~140MB (Mainly the quantized INT8 `.onnx` model).
- **RAM Consumption**: 
  - ~200MB - 300MB for the Background Service Worker holding the active ONNX session.
  - ~5MB - 15MB per Active Tab for DOM Observation (highly optimized via `WeakMap`).
- **CPU vs GPU**: Chrome Manifest V3 service workers currently restrict WebGL/WebGPU access. Therefore, the inference runs **strictly on the CPU** using the ONNX WebAssembly (WASM) backend. Integrated GPUs (GPU Onboard) or dedicated GPUs are currently **not heavily utilized** during this background inference process.
- **Minimum Requirements**: 
  - **Can it run on a 2010 PC?**: Yes, functionally. A 2010 CPU (e.g., Core 2 Duo or early Core i3) combined with 4GB RAM can run the WASM block. However, inference may take **1-2 seconds per text chunk**, potentially slowing down the typing experience on older hardware if the `debounce` rate isn't increased.
  - **Recommended**: Any modern CPU (Intel i5 8th gen+, Apple Silicon, modern Ryzen) with 8GB RAM will execute the classification in `< 50ms`, providing a zero-lag experience.

## Build & Installation

### For Developers (Unpacked Testing)

**Chrome / Edge:**
1. Clone this repository.
2. Navigate to `chrome://extensions/` (or `edge://extensions/`).
3. Enable **Developer mode** in the top right.
4. Click **Load unpacked** and select the `extension` folder.

**Firefox:**
1. Navigate to `about:debugging#/runtime/this-firefox`.
2. Click **Load Temporary Add-on...**
3. Select `manifest.json` located inside the `extension` folder.

### For Production (Packaging)

To package the extension for the Web Store, easily create a ZIP of the `extension` folder:

```bash
zip -r PhoBERT_Guard_Release.zip extension/
```

## Tech Stack & Architecture

- **Manifest V3**: Compliant with the latest Chrome extension standards (running `background.js` as an ephemeral Service Worker).
- **In-Browser ML**: Overrides `transformers.js` default fetching to load the local `model_quantized.onnx` securely.
- **WASM Acceleration**: Relies on WebAssembly to execute the Neural Network within the single thread allocated to Chrome V3 Service Workers.

## Code Style & Contribution Guidelines

We aim to keep the codebase raw, lightning-fast, and universally readable. Contributors should strictly adhere to the following rules:

1. **Language**: All comments, console logs, and variable names **MUST** be in professional English. (No Vietnamese strings inside the logic layer; UI exceptions apply to `popup.html`).
2. **Vanilla JS Only**: No heavy frontend frameworks (React/Vue) in the content scripts. Keep DOM injection logic lightweight.
3. **Memory Optimization**: 
   - Always use `WeakMap` or `WeakSet` to track visited DOM nodes. This prevents massive memory memory leaks during endless-scrolling on platforms like Facebook/TikTok.
   - Use `debounce` (e.g., 150-200ms) for keyup and mutation observation to prevent UI hanging.
4. **No Emojis**: Do not use graphical emojis in source code comments or system notifications (they clutter the interface and cause rendering inconsistencies across OS).
5. **Segmenter Discipline**: When updating `libs/segmenter.js`, guarantee that underscore `_` artifacts are scrubbed before passing input to the ONNX tokenizer to prevent `OrtRun` crashes.

## License

This project is open-source. Feel free to fork, adapt, and improve the offline toxicity models!
