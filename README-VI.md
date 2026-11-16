# Family Smart Board

Bộ file thay thế cho GitHub Pages, tối ưu cho iPad Air 11 inch.

## Có gì trong bộ này?

- `index.html`, `styles.css`, `app.js`: giao diện dashboard và Sakura inbox.
- `manifest.webmanifest`, `sw.js`, `assets/icon.svg`: cài như PWA trên iPad.
- `apps-script/Code.gs`: backend Gmail → Google Sheets → Google Drive → website.
- Token và URL Apps Script được nhập trong Settings trên từng thiết bị, không nằm trong GitHub.

## A. Upload lên GitHub

1. Sao lưu repo cũ nếu còn cần.
2. Xóa các file cũ trong repo `Family-smart-board`.
3. Upload toàn bộ nội dung bên trong thư mục `Family-smart-board` (không upload file ZIP).
4. Commit changes.
5. Chờ GitHub Pages cập nhật, sau đó mở:
   `https://hanaizumigaoka.github.io/Family-smart-board/`

## B. Thiết lập Google Apps Script

**Không xóa Google Sheets đang chứa dữ liệu Sakura.** Mã mới dùng lại Spreadsheet ID đã được dùng trong dự án trước.

1. Mở https://script.google.com/
2. Tạo project mới, đặt tên `Family Smart Board API`.
3. Mở `apps-script/Code.gs` trong bộ file này, copy toàn bộ vào `Code.gs`.
4. Kiểm tra `SPREADSHEET_ID` ở đầu code. Mặc định đang điền ID của bảng Sakura đã dùng trong dự án.
5. Chọn hàm `initializeProject` rồi nhấn Run.
6. Cấp quyền cho Google Apps Script truy cập Gmail, Google Sheets và Google Drive.
7. Mở Execution log, copy dòng `API TOKEN`. Đây là bí mật, không gửi cho người khác và không đưa lên GitHub.
8. Chọn Deploy → New deployment → loại Web app.
9. Execute as: **Me**.
10. Who has access: **Anyone**. Token được kiểm tra ở mỗi yêu cầu. Không chia sẻ thư mục Drive attachment công khai.
11. Deploy, copy URL kết thúc bằng `/exec`.

> Nếu tài khoản Google Workspace chặn quyền “Anyone”, cần dùng tài khoản cá nhân hoặc cấu hình được quản trị viên cho phép. Không đổi thư mục Drive sang public.

## C. Kết nối website

1. Mở Family Smart Board.
2. Nhấn nút ⚙.
3. Dán Web App URL vào ô đầu tiên.
4. Dán API Token vào ô thứ hai.
5. Nhấn “Lưu và kiểm tra”.
6. Khi kiểm tra thành công, website sẽ tải các thông báo hiện có.

URL và token được lưu trong localStorage của trình duyệt hiện tại. Muốn dùng trên iPad và máy tính thì nhập một lần trên mỗi thiết bị.

## D. Gmail và file đính kèm

- Backend tìm email từ `sakura@school-i.net`.
- Trigger tự chạy mỗi 15 phút.
- Chạy `testSyncNow` thủ công lần đầu để kiểm tra ngay.
- Email mới được ghi vào tab `SakuraInbox`.
- File đính kèm được sao chép vào thư mục Drive riêng tư `Family Smart Board - Sakura Attachments`.
- Website hiển thị nút file đính kèm. PDF mở trong cửa sổ xem trước; các loại file khác có thể mở trong Google Drive.
- iPad cần đăng nhập đúng tài khoản Google có quyền truy cập thư mục Drive.

**Quan trọng:** Đây là bộ mã thay thế giao diện và backend đồng bộ. Không xóa Spreadsheet chứa dữ liệu cũ nếu muốn giữ lịch sử thông báo.

## E. Nếu gặp lỗi

- `Unauthorized`: token nhập sai hoặc Apps Script chưa chạy `initializeProject`.
- `Hết thời gian chờ API`: kiểm tra URL `/exec`, deployment và quyền truy cập.
- Không thấy email mới: chạy `testSyncNow`, kiểm tra Gmail query và tab `SakuraInbox`.
- PDF yêu cầu quyền: đăng nhập Google đúng tài khoản trên iPad. Không bật chia sẻ công khai chỉ để sửa lỗi này.
- Thay đổi Code.gs sau khi deploy: Deploy → Manage deployments → Edit → New version → Deploy.

## Cấu trúc thư mục

```text
Family-smart-board/
├── index.html
├── styles.css
├── app.js
├── manifest.webmanifest
├── sw.js
├── README-VI.md
├── assets/
│   └── icon.svg
└── apps-script/
    └── Code.gs
```
