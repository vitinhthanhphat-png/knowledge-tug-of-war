# 🏆 Đấu Trường Kéo Co Kiến Thức (Knowledge Tug of War)

Trò chơi tương tác học tập kịch tính, kết hợp trả lời trắc nghiệm và cơ chế kéo co đầy hấp dẫn. Được xây dựng với React và TypeScript (Vite).

## 🚀 Giới Thiệu (Introduction)

**Đấu Trường Kéo Co Kiến Thức** là một web game giáo dục, nơi 2 đội sẽ thi đấu với nhau bằng cách trả lời các câu hỏi trắc nghiệm. Trả lời đúng, đội của bạn sẽ kéo được cờ về phía mình. Trò chơi kết thúc khi một đội kéo cờ chạm vạch đích hoặc hết câu hỏi. 

Trò chơi rất phù hợp cho:
- Hoạt động ngoại khóa, ôn tập bài cũ tại các trường học.
- Mini-game trong các sự kiện, hội thảo (Sử dụng kèm màn hình LED hoặc máy chiếu).
- Gắn kết đội nhóm (Teambuilding).

## 🎮 Hướng Dẫn Chơi Game (Game Instructions)

### 👥 Dành Cho Người Chơi (2 Đội)
1. **Mục tiêu**: Trả lời đúng các câu hỏi do MC đưa ra để kéo cờ về phía đội mình.
2. **Cơ chế đập chuông (Buzzer)**:
   - Ngay khi MC mở câu hỏi, hãy nhanh tay nhấn **Phím Space (Hoặc Enter)** để giành quyền trả lời.
   - **Chú ý**: Nếu đập chuông **TRƯỚC** khi MC đọc xong và mở khóa chuông, đội của bạn sẽ bị phạt mất lượt.
3. **Thời gian**: Mỗi đội có tối đa **10 giây** để trả lời sau khi giành được quyền.
4. **Câu Hỏi Vàng**: Nếu MC bật chế độ "Câu Hỏi Vàng", điểm số sẽ được nhân đôi (kéo được 2 nhịp nếu đúng, bị đối phương kéo lại 2 nhịp nếu sai).

### 🎤 Dành Cho Quản Trò (MC)
- **Chuẩn bị đề thi**: MC có thể sử dụng các bộ đề có sẵn hoặc tải lên file Excel chứa bộ câu hỏi riêng.
- **Phím tắt điều khiển (Bí mật)**:
  - `M`: Bật/Tắt nhạc nền (Rất hữu ích khi MC cần giải thích luật hoặc đọc câu hỏi).
  - `G`: Kích hoạt chế độ "Câu Hỏi Vàng" (x2 điểm số). Mặc định sẽ tự động bật từ câu số 10.
  - `P`: Ẩn/Hiện bảng câu hỏi để tăng tính hồi hộp.
  - `R`: Reset lại lượt đập chuông hiện tại (Dùng khi có sự cố).
  - `C`: Cài đặt/Mở bảng cấu hình.

## 💻 Hướng Dẫn Tích Hợp (Integration Guide)

### 1. Tích Hợp Vào WordPress / Website Bất Kỳ (Iframe)
Bạn có thể dễ dàng nhúng game này vào bài viết WordPress hoặc website cá nhân thông qua thẻ `iframe`.

**Bước 1:** Cập nhật game lên một hosting hoặc sử dụng link GitHub Pages sẵn có: `https://vitinhthanhphat-png.github.io/knowledge-tug-of-war`
**Bước 2:** Chèn mã HTML sau vào website của bạn:
```html
<iframe 
  src="https://vitinhthanhphat-png.github.io/knowledge-tug-of-war" 
  width="100%" 
  height="700px" 
  frameborder="0" 
  allowfullscreen="true"
  allow="autoplay; fullscreen">
</iframe>
```

### 2. Triển Khai Lên GitHub Pages (Hosting Miễn Phí)
1. Cài đặt package `gh-pages`: `npm install gh-pages --save-dev`
2. Cập nhật file `package.json` thêm trường `homepage` và scripts `predeploy`, `deploy`.
3. Build và đẩy source lên github:
```bash
npm run deploy
```

## 🛠 Hướng Dẫn Cài Đặt Mã Nguồn (Quick Start)

Nếu bạn muốn tùy chỉnh hoặc phát triển thêm tính năng:

**Yêu cầu:** Đã cài đặt [Node.js](https://nodejs.org/) (Phiên bản 18+).

```bash
# 1. Clone mã nguồn về máy
git clone https://github.com/vitinhthanhphat-png/knowledge-tug-of-war.git

# 2. Cài đặt các thư viện cần thiết
cd knowledge-tug-of-war
npm install

# 3. Chạy môi trường phát triển (Development)
npm run dev
# Mở trình duyệt tại http://localhost:5173

# 4. Build phiên bản phát hành (Production)
npm run build
```

## 📝 Giấy Phép (License)

Trò chơi được phát hành dưới giấy phép mã nguồn mở **MIT License**.
Bạn hoàn toàn có quyền:
- 🟢 Sử dụng cho mục đích cá nhân và thương mại.
- 🟢 Sao chép, chỉnh sửa mã nguồn tùy ý.
- 🟢 Phân phối lại.

*Điều kiện duy nhất: Vui lòng giữ lại ghi chú bản quyền (Author Credits) gốc của tác giả trong mã nguồn.*

---
**Tác giả (Author):** Trần Vĩ Thành (Techshare VN)
**Liên hệ:** [Techsharevn.com](https://techsharevn.com) | 0949.897.293
