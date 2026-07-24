# Tài liệu học bảo vệ đồ án — Hotel Booking System

Bộ tài liệu này được viết để bạn **học thuộc và trả lời phản biện** với thầy. Mỗi file tương ứng với một nhóm chức năng, mọi đoạn giải thích code đều trích dẫn chính xác `đường/dẫn/file.js:số_dòng` để bạn mở đúng chỗ khi bị hỏi.

## Mục lục

| # | File | Nội dung |
|---|------|----------|
| 00 | [tong-quan-kien-truc.md](00-tong-quan-kien-truc.md) | Kiến trúc tổng thể, công nghệ sử dụng & lý do chọn, cấu trúc thư mục, luồng khởi động server, luồng dữ liệu mẫu |
| 01 | [backend-xac-thuc-nguoi-dung.md](01-backend-xac-thuc-nguoi-dung.md) | Đăng ký, đăng nhập, JWT, bcrypt, phân quyền, AuthContext, AdminRoute |
| 02 | [backend-khach-san-phong.md](02-backend-khach-san-phong.md) | Tìm kiếm/lọc khách sạn, chi tiết khách sạn, quản lý phòng, kiểm tra phòng trống, nhúng Google Maps |
| 03 | [backend-dat-phong-danh-gia.md](03-backend-dat-phong-danh-gia.md) | Luồng đặt phòng, Guest mode, hủy phòng, gửi email xác nhận, đánh giá/feedback |
| 04 | [backend-quan-tri-admin.md](04-backend-quan-tri-admin.md) | Dashboard thống kê, CRUD khách sạn/phòng, quản lý booking/user/feedback, bảo vệ route admin |
| 05 | [co-so-du-lieu-va-dich-vu.md](05-co-so-du-lieu-va-dich-vu.md) | Schema SQL Server (ERD), seed/reset DB, audit log, cấu hình hệ thống động, biến môi trường |
| 06 | [frontend-thanh-phan-dung-chung.md](06-frontend-thanh-phan-dung-chung.md) | Routing (App.js), axios instance, Theme (dark mode), Navbar/Footer, TailwindCSS |

**Gợi ý học:** đọc theo đúng thứ tự 00 → 06, vì file 00 cho bức tranh tổng thể, các file sau đi sâu từng mảng. Mỗi file đều có mục **"Câu hỏi phản biện thường gặp & cách trả lời"** ở cuối — nên học phần đó kỹ nhất.

## Tổng hợp các hạn chế/điểm yếu thật đã phát hiện trong code

Khi rà code, các phần đã phát hiện một số điểm yếu **có thật** (không phải suy đoán) và đã ghi chi tiết vào từng file tương ứng. Đây là danh sách tổng hợp nhanh — nếu thầy hỏi "dự án còn thiếu gì / có thể cải thiện gì", đây chính là câu trả lời trung thực và thuyết phục nhất (thể hiện bạn hiểu sâu code, không chỉ code chạy được):

1. **Race condition khi đặt phòng đồng thời** — không có transaction/khóa khi kiểm tra phòng trống trước khi tạo booking, 2 người có thể đặt trùng phòng cùng lúc. *(file 02, 03)*
2. **Lộ thông tin tồn tại tài khoản (user enumeration)** — thông báo lỗi đăng nhập phân biệt rõ "Email không tồn tại" và "Sai mật khẩu". *(file 01)*
3. **Không có rate-limit/CAPTCHA chống brute-force đăng nhập** theo IP, chỉ khóa theo tài khoản sau 5 lần sai. *(file 01)*
4. **Admin có thể tự khóa chính mình hoặc khóa hết toàn bộ admin còn lại** — không có điều kiện chặn. *(file 04)*
5. **Lọc khách sạn theo tiện ích/giá/rating thực hiện ở tầng JavaScript**, không phải SQL WHERE — không tối ưu khi dữ liệu lớn. *(file 02)*
6. **`baseURL` của axios hard-code `localhost:4000`**, chưa dùng biến môi trường `REACT_APP_API_URL` — sẽ lỗi khi deploy lên domain khác. *(file 06)*
7. **JWT token lưu ở `localStorage`** thay vì httpOnly cookie — rủi ro bị đánh cắp qua XSS. *(file 01, 06)*
8. **`deleteFeedback` không kiểm tra tồn tại trước khi xóa**, không nhất quán với các hàm xóa khác. *(file 04)*
9. **Feedback không kiểm tra người dùng đã từng đặt phòng thành công** ở tầng backend trước khi cho đánh giá. *(file 03)*
10. **Không dùng migration tool chuẩn (Flyway/Knex)** — tự tạo schema bằng `IF OBJECT_ID(...) IS NULL CREATE TABLE` mỗi lần khởi động. *(file 05)*

> Lưu ý: đây là các điểm yếu **thật sự tồn tại trong code hiện tại**, không phải điểm trừ — nêu ra và giải thích được hướng khắc phục sẽ giúp bạn ghi điểm khi phản biện thay vì bị động khi bị hỏi.
