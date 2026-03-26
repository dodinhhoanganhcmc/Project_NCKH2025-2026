# PhoBERT Guard: Trợ lý Chặn Độc hại trên Trình duyệt

PhoBERT Guard là một Tiện ích mở rộng (Extension) tập trung vào quyền riêng tư, cho phép phát hiện và chặn các nội dung tiếng Việt độc hại trên mạng xã hội theo thời gian thực (real-time). Dựa trên sức mạnh của phiên bản lượng tử hoá (quantized ONNX) của mô hình PhoBERT, ứng dụng chạy 100% trong trình duyệt (offline). Không có bất kỳ dữ liệu cá nhân nào được gửi đến máy chủ bên ngoài, đảm bảo trải nghiệm riêng tư tuyệt đối và triệt tiêu độ trễ.

## Tính Năng Chính

* **AI Hoạt động Ngoại tuyến**: Sử dụng thư viện `onnxruntime-web` và `@xenova/transformers` để chạy học sâu phân loại văn bản trực tiếp trên trình duyệt.
* **Bảo vệ Đa chiều**:
  * **Chặn Đọc (Incoming Masking)**: Phát hiện và làm mờ các bình luận, bài đăng độc hại ngay khi chúng vừa hiển thị trên màn hình.
  * **Cổng Kiểm duyệt Gửi đi (Outgoing Gatekeeper)**: Bắt các sự kiện nhập liệu và nhấn Gửi, chặn việc xuất bản nội dung độc hại (hiển thị popup cảnh báo `window.confirm` "Bạn có CHẮC CHẮN muốn tiếp tục...?").
* **Hỗ trợ Đa Nền tảng**: Hoạt động trơn tru trên các trang web SPA lớn như Facebook, YouTube, Twitter (X), Instagram, TikTok, Reddit và Threads.
* **Thời gian trễ gần bằng không**: Áp dụng thuật toán theo dõi DOM tối ưu với `WeakMap`, cơ chế chống rung (debounce), và hệ thống danh sách đen dự phòng để hoạt động ngay trong khi AI đang được tải vào RAM.
* **Tương thích Rộng rãi**: Chạy tốt trên Google Chrome, Microsoft Edge, và Mozilla Firefox (Gecko).

## Cấu trúc Dự Án

```text
├── extension/
│   ├── background.js     # Service Worker: Khởi nạp mô hình ONNX, quản lý thông điệp và thông báo.
│   ├── content.js        # DOM Observer: Làm mờ DOM hiện thị, bắt sự kiện Submit, thay đổi UI.
│   ├── popup.html        # Giao diện Bảng điều khiển (Dashboard).
│   ├── popup.js          # Trình quản lý tham số Cấu hình từ người dùng (Danh sách trắng, Độ nhạy).
│   ├── libs/
│   │   ├── segmenter.js        # Cung cấp bộ Tokenizer/Segmenter phân tách từ tiếng Việt.
│   │   ├── dictionary_words.js # Bộ từ vựng điển hình dùng cho Segmenter.
│   │   └── transformers.js     # Thư viện Transformers.js cho môi trường WebAssembly.
│   └── models/phobert_toxic/   # Các file chạy mô hình: INT8 quantized PhoBERT (.onnx), tokenizer.
├── server.py             # Backend Python tuỳ chọn (trong trường hợp muốn chia sẻ API lên Cloud).
└── convert_to_onnx.sh    # Script chuyển đổi mô hình PyTorch thô thành ONNX.
```

## Cấu hình Tối thiểu & Ước tính Hiệu năng (System Requirements)

Bản chất tiện ích này nhúng cứng (embed) một mô hình Deep Learning nặng khoảng 135MB chạy trực tiếp ở chế độ Offline nhờ WebAssembly (WASM). Dưới đây là bức tranh toàn cảnh về mặt tài nguyên:

- **Bộ nhớ Ổ cứng (Disk Space)**: ~140MB (Chủ yếu là kích thước của mô hình đồ thị `.onnx` gốc đã lượng tử hoá xuống INT8).
- **Mức tiêu hao RAM**: 
  - ~200MB - 300MB cho tiến trình chạy nền ở Service Worker (giữ Session ONNX).
  - Khoảng ~5MB - 15MB cực kỳ mỏng nhẹ trên mỗi Tab ứng dụng mạng xã hội (content script) nhờ thiết kế tối ưu với kiểu kiến trúc đối tượng rác (Garbage Collector - GC) bằng `WeakMap`.
- **Nguồn hao phí CPU/GPU (Mạch đồ hoạ)**: Kiến trúc bảo mật của Manifest V3 trên Chrome giới hạn nghiêm ngặt việc sử dụng WebGPU / WebGL trực tiếp từ Service Worker. Do đó, phần lớn (hoặc 100%) xung nhịp dự đoán AI sẽ **chạy trên các nhân CPU** nhờ công hệ nội suy WebAssembly (CPU Execution Provider). Card rời hầm hố hay **Card tích hợp (GPU Onboard)** gần như **không tham gia** / không ảnh hưởng nhiều trong phiên bản Chrome này. 
- **Với Cấu hình Đời Tống 2010**:
  - **Có chạy được không?**: **VẪN CHẠY ĐƯỢC**. Nền tảng WASM hoạt động trên bất kể CPU nào miễn là trình duyệt được cập nhật (RAM từ 2-4GB).
  - **Nhưng chạy ra sao?**: Vì bị chốt bằng sức mạnh CPU thô, một con chip kiến trúc cũ (2010) ví dụ Intel Core 2 Duo, i3/i5 đời đầu (VD: M430) có thể mất **khoảng 1 - 2 giây** để dự đoán các chuỗi ký tự/từ dài. Mặc dù extension đã có Danh sách đen nội bộ chặn trước chờ AI để chống Crash, bạn có thể bị khựng lag cục bộ 1 giây nếu gõ văn bản quá nhanh vượt ngưỡng Debounce.
  - **Khuyến nghị Lạc quan**: Extension không lag (kiểm định $< 50$ mili-giây) ở tất cả các con Chip đời trung và đời mới (từ Intel i5 Gen 8th tương đương, AMD Ryzen mới, cho tới Apple Silicon M1-M3) với 8GB RAM.

## Hướng dẫn Cài đặt & Xây dựng

### Dành cho Lập trình viên (Chạy thư mục Unpacked)

**Trên Chrome / Edge:**
1. Clone / Tải Repository này về máy.
2. Mở trình duyệt và truy cập `chrome://extensions/` (hoặc `edge://extensions/`).
3. Bật **Developer mode (Chế độ dành cho nhà phát triển)** ở góc trên bên phải.
4. Nhấn **Load unpacked (Tải tiện ích đã giải nén)**, và chỉ định thư mục `extension/`.

**Trên Firefox:**
1. Truy cập `about:debugging#/runtime/this-firefox`.
2. Nhấn nút **Load Temporary Add-on...**
3. Trỏ tới file `manifest.json` bên trong thư mục `extension/`.

### Đóng gói Triển khai (Production)

Để tải lên Web Store, bạn hãy nén thư mục `extension` dưới định dạng ZIP:

```bash
zip -r PhoBERT_Guard_Release.zip extension/
```

## Kiến trúc Hệ thống

- **Manifest V3**: Tuân thủ tiêu chuẩn Extension hiện đại nhất của Chrome (sử dụng `background.js` dưới dạng Ephemeral Service Worker).
- **In-Browser ML**: Ghi đè phương thức Tải API mặc định của `transformers.js` để tìm và nạp mô hình lưu sẵn ở dưới local `model_quantized.onnx`.
- **WASM Acceleration**: Trợ lực bằng WebAssembly để xử lý tính toán đồ thị Neural Network với duy nhất 1 luồng được cấp cho Service Worker.

## Chuẩn Mực Viết Code & Đóng góp (Code Style Guidelines)

Chúng tôi hướng tới việc giữ mã nguồn thật tối giản, cực kỳ nhanh, và thân thiện với cộng đồng Open-source Quốc tế. Nếu bạn muốn đóng góp mã nguồn (Pull Request), vui lòng tuân thủ chặt chẽ các luật sau:

1. **Ngôn ngữ**: Tất cả Bình Luận (Comments), Tham số (Variables), Các Log hiển thị trên Console... **BẮT BUỘC** phải bằng tiếng Anh. Chữ tiếng Việt chỉ được xuất hiện ở giao diện hiển thị cho người dùng tại `popup.html`.
2. **Ưu tiên Javascript Thuần (Vanilla JS)**: Tuyệt đối không nhúng các Framework hạng nặng như React/Vue ở Content Scripts. DOM Manipulation phải mỏng nhẹ nhất có thể.
3. **Tối ưu RAM**: 
   - Sử dụng bắt buộc `WeakMap` hoặc `WeakSet` để lưu danh sách các DOM Node đã tương tác, tránh Memory Leak khi người dùng cuộn xem vĩnh viễn trên News Feed (Facebook, TikTok...).
   - Bắt buộc dùng `debounce` (khoảng 150-200ms) để kiềm hãm API Event Keyup hay Mutation, chống treo Tab.
4. **Không Dùng Biểu tượng Cảm xúc (No Emojis)**: Tuyệt đối không dùng Emojis đồ họa trong Comments Code hay System Notifications (Nó làm file trở nên rối mắt ở quy mô lớn và lỗi render trên thiết bị khác nhau). Chỉ sử dụng Icon SVG.
5. **Kỷ luật Bộ Phân tách (Segmenter Discipline)**: Khi bổ sung `libs/segmenter.js`, phải làm sạch dấu gạch dưới `_` trước khi đưa input vào ONNX Tokenizer, nếu không hàm `OrtRun` sẽ gây crash WebAssembly.

## Bản Quyền

Dự án phát hành dưới mô hình mã nguồn mở. Mặc sức tham khảo, chỉnh sửa mô hình độc hại offline này cho nhu cầu bảo vệ sức khỏe tâm lý cộng đồng và gia đình bạn!
