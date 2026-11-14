# Review Hub – Hướng dẫn cài đặt

Khoảng 20–30 phút, làm 1 lần. Hoàn toàn miễn phí.

```
GitHub Pages (giao diện)  ──►  Apps Script (đọc Drive + lưu nhận xét vào Google Sheet)
        │
        └──► video phát trực tiếp từ Google Drive (qua API key)
```

## Bước 1. Thư mục Drive

1. Tạo thư mục mẹ, ví dụ `Review Hub`.
2. Bấm chuột phải → **Chia sẻ** → *Quyền truy cập chung*: **Bất kỳ ai có đường liên kết – Người xem**.
   (Apps Script cũng tự bật chế độ này cho từng file video, đây là bước dự phòng.)
3. Trong thư mục mẹ, tạo cấu trúc:
   ```
   Review Hub/
   ├── NOEL Parquet/            ← 1 thư mục = 1 dự án (1 link khách)
   │   ├── Gioi thieu san go/   ← 1 thư mục = 1 video
   │   │   ├── gioi-thieu-v1.mp4    ← các file = các phiên bản (cũ → mới theo ngày tải lên)
   │   │   └── gioi-thieu-v2.mp4
   │   └── Teaser/
   │       └── teaser.mp4
   └── Tin Hay Nha Dat/
       └── ...
   ```
   Thả file mới vào thư mục video là web tự có phiên bản mới. File video để thẳng trong thư mục dự án cũng được tính là 1 video.
4. Mở thư mục mẹ, copy **ID** trên thanh địa chỉ:
   `https://drive.google.com/drive/folders/`**`1AbCdEf...`** ← phần này.

> Nên xuất bản review nhẹ: MP4 H.264, 1080p, 5–8 Mbps. Khách xem bằng 4G sẽ load nhanh hơn nhiều.

## Bước 2. Google Sheet + Apps Script (lưu nhận xét)

1. Tạo 1 Google Sheet mới, đặt tên `Review Hub – data`.
2. Menu **Tiện ích mở rộng → Apps Script**.
3. Xoá code mẫu, dán toàn bộ nội dung file `apps-script/Code.gs`, bấm 💾 Lưu.
4. Bánh răng **Cài đặt dự án** (bên trái) → kéo xuống **Thuộc tính tập lệnh** → *Thêm thuộc tính*:
   | Thuộc tính | Giá trị |
   |---|---|
   | `ROOT_FOLDER_ID` | ID thư mục mẹ ở Bước 1 |
   | `ADMIN_PASSWORD` | mật khẩu trang quản lý của anh |
5. Quay lại **Trình chỉnh sửa**, chọn hàm `setup` ở thanh trên → **Chạy**. Google hỏi quyền → chọn tài khoản → *Nâng cao* → *Đi tới… (không an toàn)* → **Cho phép**. (Cảnh báo này là bình thường với script tự viết.)
   Nhật ký sẽ in: `Đã tìm thấy N dự án…`. Sheet có thêm 3 trang `Projects`, `Comments`, `Notes`.
6. **Triển khai → Tùy chọn triển khai mới** → biểu tượng bánh răng → **Ứng dụng web**:
   - *Thực thi dưới dạng*: **Tôi**
   - *Người có quyền truy cập*: **Bất kỳ ai**
   → **Triển khai** → copy **URL ứng dụng web** (dạng `https://script.google.com/macros/s/…/exec`).

> Sửa `Code.gs` sau này: **Triển khai → Quản lý các lần triển khai → ✏️ → Phiên bản: Mới → Triển khai**. URL giữ nguyên.

## Bước 3. API key để phát video từ Drive

1. Vào <https://console.cloud.google.com/> → tạo project mới (tên tuỳ ý).
2. **APIs & Services → Library** → tìm **Google Drive API** → **Enable**.
3. **APIs & Services → Credentials → Create credentials → API key** → copy key.
4. Bấm vào key vừa tạo → **Restrictions**:
   - *Application restrictions*: **Websites** → thêm `https://TEN-GITHUB.github.io/*`
   - *API restrictions*: **Restrict key** → chọn **Google Drive API** → Save.

## Bước 4. Đưa web lên GitHub Pages

1. Tạo repo mới trên GitHub, ví dụ `review-hub` (Public, vì GitHub Pages miễn phí cần repo public).
2. Mở file `config.js`, điền:
   ```js
   API_URL: 'https://script.google.com/macros/s/…/exec',
   DRIVE_API_KEY: 'AIza…',
   ```
3. Tải toàn bộ thư mục lên repo (*Add file → Upload files*, kéo cả thư mục vào). Có thể bỏ thư mục `demo/` và `apps-script/`.
4. Repo → **Settings → Pages** → *Source*: **Deploy from a branch** → Branch **main** / **(root)** → Save.
5. Khoảng 1 phút sau web chạy tại `https://TEN-GITHUB.github.io/review-hub/`.

## Dùng hằng ngày

- **Trang quản lý**: `https://TEN-GITHUB.github.io/review-hub/admin.html` → nhập tên hiển thị + mật khẩu → thấy mọi dự án, video, phiên bản, số nhận xét chưa xử lý. Bấm **Mở** để vào video dưới dạng quản trị (thanh trên màu tối, nhãn QUẢN LÝ).
- **Chỉ quản trị mới có**: ghi chú phiên bản (khách đọc được), tick *Đã sửa*, tab *Chưa xử lý / Đã sửa / Tất cả*, xoá mọi nhận xét, nút Copy link khách. Trả lời của anh có nhãn **Bên dựng**.
- **Gửi khách**: bấm **Copy link khách** ở dự án → gửi qua Zalo/Messenger. Link dạng `…/review-hub/?p=WByYkpGu`; khách chỉ thấy dự án đó.
- **Bản sửa mới**: thả file vào thư mục video trên Drive → khách mở lại link là thấy `v3 · MỚI`. Nhận xét bản cũ vẫn xem lại được.
- **Dự án mới**: tạo thư mục con trong thư mục mẹ → trang quản lý bấm **Đồng bộ lại** → có link mới.
- Dữ liệu nhận xét nằm trong Sheet `Review Hub – data`, có thể lọc/xuất CSV khi cần.

## Khách làm được gì

- Lần đầu nhập tên (máy nhớ, có nút *Đổi tên*).
- Bấm vào video → ghim số → gõ nhận xét → Enter.
- Vẽ bút, mũi tên, khung, vòng tròn (5 màu) kèm nhận xét.
- **Sửa / xoá nhận xét của chính mình**: chữ, hình vẽ, vị trí ghim.
- Trả lời, chuyển phiên bản, đọc ghi chú phiên bản của bên dựng, tua từng khung (← →), Space phát/dừng.
- Khách không thấy nút/tab *Đã sửa*.
- Khung nhận xét hiện ngay dưới chấm ghim (sát đáy video thì lật lên trên). Trên điện thoại trang tự cuộn để ghim lên nửa trên màn hình, bàn phím không che.

## Lỗi thường gặp

| Hiện tượng | Cách xử lý |
|---|---|
| "Không phát được video" | Kiểm tra `DRIVE_API_KEY`, đã bật Drive API, đã thêm đúng domain `github.io` vào giới hạn key, file đang để "Bất kỳ ai có liên kết". |
| "Sai mật khẩu quản lý" | So lại `ADMIN_PASSWORD` trong Thuộc tính tập lệnh. |
| Thêm video mà web chưa thấy | Danh sách được nhớ tạm 30 giây, đợi rồi tải lại trang. |
| Sửa Code.gs mà không có tác dụng | Phải triển khai **Phiên bản mới** (xem cuối Bước 2). |
| Đã cài bản cũ, nâng cấp lên bản có ghi chú phiên bản | Dán lại toàn bộ `Code.gs`, chạy `setup` 1 lần, triển khai **Phiên bản mới**. |
| Lỗi CORS / "Failed to fetch" | URL ở `API_URL` phải kết thúc bằng `/exec`, quyền truy cập ứng dụng web là **Bất kỳ ai**. |

## Bảo mật (cần biết)

- Ai có link khách thì xem và nhận xét được dự án đó, tương tự link chia sẻ Drive. Không dùng cho video tuyệt mật.
- Mã dự án là chuỗi ngẫu nhiên 8 ký tự, không đoán được. Muốn thu hồi link: xoá dòng dự án trong trang `Projects` của Sheet, bấm Đồng bộ lại để tạo mã mới.
- Mật khẩu quản lý không nằm trong code web, chỉ nằm trong Apps Script.
- Tên khách và mã người dùng lưu trên trình duyệt của khách; người khác dùng chung máy có thể sửa nhận xét của người trước. Đổi máy thì vẫn xem được nhưng không sửa được nhận xét cũ của mình.
