# Knowledge Tug Of War - Project Memory

## Kiến trúc dự án (Architecture)
- **Framework**: Preact + Vite + Tailwind CSS (v3).
- **Core Engine**: XState (State Machine) quản lý toàn bộ luồng game.
- **Component Model**: Đóng gói thành Web Component (Custom Element `<knowledge-tug-of-war>`).
- **Data Protection**: Sử dụng SHA-256 (Web Crypto API) kèm Salt để mã hóa đáp án, chống gian lận F12 (DevTools).

## Quy ước Code (Conventions)
1. **Giao diện (UI)**:
   - Sử dụng thẻ `<div ref={containerRef}>` bọc trong `aspect-video` (16:9) để giữ tỉ lệ chuẩn cho HUD thi đấu.
   - Các Popup (như Start Screen, Admin Panel, Leaderboard) phải nằm ngoài thẻ 16:9 này, nhưng nằm trong thẻ gốc `w-full relative` để phủ kín 100% màn hình khi bật.
   - Thao tác đóng mở popup dựa trên state của XState hoặc `useState` React (Ví dụ: `isAdminOpen`).
   - Màn hình Start Screen: `z-[60]`. Admin Panel: `z-[100]`.

2. **Dữ liệu (Data)**:
   - File JSON đề thi khi Import sẽ được parse, validate (hash SHA-256) ngay lập tức.
   - Bộ đề có sẵn được lưu dưới dạng module nội bộ trong `src/datasets/` để Admin nạp nhanh.
   - Trạng thái trận đấu (`score`, `questions`) lưu trữ vào `localStorage` qua key `knowledge_tug_of_war_state` và `knowledge_tug_of_war_questions`.

## Trạng thái hiện tại
- Đã tách hoàn thiện dự án ra thành Git repository riêng rẽ tại root.
- Cấu hình tự động Build và Push lên Github Pages qua nhánh `gh-pages` (lệnh `npm run deploy`).
- Đã khắc phục triệt để lỗi viền đen của Start Screen và lỗi thứ tự ưu tiên hiển thị (Z-Index) của Admin Panel.
