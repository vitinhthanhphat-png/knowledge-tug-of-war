# Original User Request

## Initial Request — 2026-06-25T03:42:54Z

# Teamwork Project Prompt

Xây dựng một Web Component độc lập (Game Kéo Co Kiến Thức) sử dụng Preact, Vite, Tailwind CSS và XState.

Working directory: `D:\AI APP\DauTruongKienThuc\Requirement\knowledge-tug-of-war`
Integrity mode: development

## Requirements

### R1. Kiến trúc và Giao diện
- Khởi tạo một dự án Vite sử dụng Preact và Tailwind CSS.
- Đóng gói toàn bộ ứng dụng thành một Custom HTML Element (Web Component) duy nhất.
- Giao diện phải ép tỷ lệ 16:9 (Letterbox) và tự động scale theo màn hình.
- Sử dụng các thiết kế từ `code.html` và `DESIGN.md` (Theme: Kinetic Academy). Sử dụng ảnh nền `game_background_1782358874419.png` đã được tạo.

### R2. Quản lý trạng thái bằng XState
- Triển khai Finite State Machine bằng XState để quản lý các trạng thái: `idle`, `waiting_buzz`, `answering`, `result`, `ended`.
- Ngăn chặn triệt để Race Conditions khi hai người chơi cùng bấm phím Space (Đội 1) và Enter (Đội 2).
- Bắt buộc dùng `e.preventDefault()` để chặn cuộn trang khi bấm Space.

### R3. Dữ liệu và Web Crypto API
- Lưu trữ danh sách câu hỏi đề thi trong Local Storage.
- Có giao diện Admin (ẩn/hiện qua một nút nhỏ) để tải lên/xuất file JSON câu hỏi.
- Xử lý kiểm tra đáp án thông qua Web Crypto API (Hash đáp án người dùng chọn và so sánh với `answer_hash` trong JSON).

## Acceptance Criteria

### Chức năng Core
- [ ] Chạy lệnh `npm run build` thành công và tạo ra file JS bundle có thể nhúng vào một trang HTML trắng qua thẻ `<knowledge-tug-of-war>`.
- [ ] Khi bấm Space hoặc Enter ở trạng thái `waiting_buzz`, state chuyển đổi chính xác và khóa phím của đội còn lại.
- [ ] Không có lỗi state xảy ra khi thử nghiệm spam 2 phím cùng lúc.

### Dữ liệu và Giao diện
- [ ] Câu hỏi được nạp qua file JSON sẽ tự động lưu vào Local Storage và không bị mất khi F5.
- [ ] Các hiệu ứng CSS Animations (Glow, Fire Progress Bar) hoạt động mượt mà.
- [ ] Gọi đúng các hàm Audio giả lập (ví dụ `playBuzzSound()`, v.v.) tại các State chuyển giao tương ứng.

## Follow-up — 2026-06-25T03:56:58Z

The user has responded to the Socratic Gate questions:
1. CSS bundling: Option B (Inlined CSS).
2. Cryptographic Salt structure: Option A (Per-question salt in JSON).
3. Edge cases: Agree to reset game on JSON import, and agree to display 'Draw' for tie-breakers.

Please proceed with the implementation.

