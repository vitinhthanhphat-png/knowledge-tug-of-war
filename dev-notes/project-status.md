# Knowledge Tug of War - Project Status & Notes

## Trạng thái hoàn thành (Completed Features)
1. **Giao diện (UI):** 
   - Chủ đề sci-fi/không gian cực kỳ đẹp mắt với `TailwindCSS`. 
   - Bố cục 2 đội trái phải, thanh kéo co ở giữa.
   - Hỗ trợ responsive, tối ưu cho màn hình cảm ứng, iPad và màn hình rộng.
   - Nút bấm (SPACE/ENTER) thiết kế 3D nổi bật.
2. **Logic trò chơi (XState):**
   - Quản lý luồng bằng State Machine: `idle` -> `waiting_buzz` -> `answering` -> `result` -> `timeout_reveal` -> `ended`.
   - Giành quyền bằng phím Space/Enter hoặc bấm trực tiếp trên màn hình.
   - Hỗ trợ 10 giây suy nghĩ đếm ngược khi hiển thị câu hỏi (ai giành quyền sẽ dừng đồng hồ này lại để trả lời).
   - MC thủ công chuyển câu hỏi để có thời gian giải thích (bỏ chế độ tự động nhảy câu).
3. **Quản lý dữ liệu:**
   - Hỗ trợ upload file Excel (có mã hóa câu trả lời).
   - Màn hình Admin (icon bánh răng) để cài đặt thời gian (Buzz Time, Answer Time).
4. **Hiệu ứng Âm thanh & Hình ảnh (VFX & SFX):**
   - Web Audio API: Âm thanh kéo co, tiếng buzz, đồng hồ đếm ngược.
   - Phát ngẫu nhiên các file `mp3` tích hợp (đúng: 3 file, sai: 2 file, thắng: 3 file).
   - Hiệu ứng pháo hoa bắn liên tục (canvas-confetti) và vòng hào quang xoay tròn khi kết thúc trận đấu.
5. **Triển khai (Deployment):**
   - Chạy trên gh-pages trực tiếp (thông qua `npm run deploy`).
   - Có cơ chế chặn bộ nhớ cache thông qua Query String `?v=25`.

## Các ghi chú cần nhớ cho Dev tiếp theo (Dev Notes)
- File Excel cần đúng format chuẩn, cột `Question`, `Option A`, `Option B`, `Option C`, `Option D`, `Answer`. Câu trả lời đúng phải được tô nền hoặc đánh dấu trong code.
- Cơ chế bảo mật âm thanh (Audio Context) yêu cầu người dùng phải tương tác với màn hình ít nhất một lần để khởi chạy. Nút giành quyền trên màn hình đóng vai trò trigger tương tác này.
- Khi cần cập nhật code, hãy `npm run build` sau đó vào `dist-test.html` đổi version cache buster và cập nhật `dist/index.html`.
- Pháo hoa dùng `canvas-confetti` (version mới nhất, import mặc định npm).
- Máy trạng thái nằm trong `src/state-machine.ts`, render logic nằm tại `src/app.tsx`.

## Các tính năng bị loại bỏ hoặc thay đổi (Deprecated)
- **Tự động chuyển câu (Auto-advance):** Đã loại bỏ. Bắt buộc MC phải bấm "Tiếp tục" để kiểm soát nhịp độ trò chơi và có thời gian giải thích.
- **File âm thanh rời rạc ở public:** Đã đổi sang `import` trực tiếp vào mã nguồn trong `src/assets/sounds/` để Vite bundle thẳng vào code, tránh lỗi đường dẫn và bị cache sai.
