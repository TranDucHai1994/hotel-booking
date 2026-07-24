# 03 — Backend & Frontend: Đặt phòng, Hủy phòng, Đánh giá (Feedback), Email xác nhận


>
> Các file gốc được phân tích:
> - `backend/controllers/bookingController.js`
> - `backend/controllers/feedbackController.js`
> - `backend/routes/bookingRoutes.js`
> - `backend/routes/feedbackRoutes.js`
> - `backend/services/emailService.js`
> - `backend/utils/availability.js` (phụ trợ)
> - `backend/middleware/authMiddleware.js` (phụ trợ)
> - `frontend/my-hotel-app/src/pages/BookingPage.js`
> - `frontend/my-hotel-app/src/pages/MyBookings.js`

---

## 1. Tổng quan chức năng

Hệ thống hỗ trợ trọn vòng đời một lượt đặt phòng:

1. **Đặt phòng** (`createBooking`) — có thể đặt khi đã đăng nhập hoặc ở chế độ **khách vãng lai (Guest mode)**.
2. **Xem lịch sử đặt phòng của tôi** (`getMyBookings`) — chỉ dành cho tài khoản đã đăng nhập.
3. **Hủy đặt phòng** (`cancelBooking`) — người dùng tự hủy booking của chính mình, có điều kiện.
4. **Admin/Manager quản trị**: xem tất cả booking (`getAllBookings`), đổi trạng thái (`updateBookingStatus`), xóa vĩnh viễn (`deleteBooking`).
5. **Gửi email xác nhận đặt phòng** ngay sau khi tạo booking thành công (`emailService.js`), qua SMTP thật hoặc chế độ mock.
6. **Gửi đánh giá (Feedback)** sau khi lưu trú — mỗi user chỉ đánh giá 1 lần / 1 khách sạn; điểm trung bình khách sạn được **tính động (runtime)**, không lưu cột riêng.

Sơ đồ luồng tổng quát khi khách đặt phòng:

```
FE (BookingPage) --POST /api/bookings--> bookingController.createBooking
   -> kiểm tra phòng/khách sạn tồn tại
   -> kiểm tra ngày hợp lệ (normalizeDateRange)
   -> kiểm tra phòng còn trống (getBookedRoomCountMap)
   -> xác định người đặt (tài khoản hoặc khách vãng lai)
   -> tính tiền, tạo bản ghi Bookings (status = 'pending')
   -> gọi emailService gửi email xác nhận (không chặn kết quả API nếu gửi lỗi)
   -> trả về JSON cho FE hiển thị màn hình xác nhận
```

---

## 2. Luồng ĐẶT PHÒNG — `bookingController.createBooking`

File: `backend/controllers/bookingController.js:98-271`

### Bước 1 — Nhận dữ liệu đầu vào
`bookingController.js:99-110`: destructure `hotel_id, room_id, check_in, check_out, guests, payment_method, customer_note, guest_name, guest_email, guest_phone` từ `req.body`.

### Bước 2 — Kiểm tra phòng & khách sạn tồn tại, có khớp nhau không
- `getRoomById(room_id)` → `bookingController.js:38-49` (`SELECT TOP 1 * FROM dbo.Rooms WHERE id = @roomId`). Nếu không có phòng → `404 "Phòng không tồn tại"` (`bookingController.js:114-116`, chuỗi bị lỗi font do file gốc lưu sai encoding, nhưng logic đúng).
- `getHotelById(hotel_id || room.hotel_id)` → `bookingController.js:51-62,118-121`.
- Kiểm tra `room.hotel_id === hotel._id`, nếu không khớp → `400 "Phòng không thuộc khách sạn đã chọn"` (`bookingController.js:123-125`). Đây là bước chống việc FE gửi sai cặp `hotel_id`/`room_id`.

### Bước 3 — Validate ngày check-in / check-out
`bookingController.js:127-130` gọi `normalizeDateRange(check_in, check_out)` (định nghĩa tại `backend/utils/availability.js:21-36`):
- Parse cả hai ngày về `Date` lúc `00:00:00` (`availability.js:11-15`).
- `isValid = checkOut > checkIn` — bắt buộc ngày trả phòng phải **sau** ngày nhận phòng (không cho bằng nhau).
- Nếu `!dateRange.hasRange || !dateRange.isValid` → `400 "Ngày không hợp lệ"`.

Lưu ý: bước này **không kiểm tra check-in phải ở tương lai** ở phía backend (chỉ FE giới hạn `min` bằng ngày hôm nay tại `BookingPage.js:313,328`) — về mặt kỹ thuật, backend vẫn chấp nhận đặt phòng cho một ngày trong quá khứ nếu request được gửi trực tiếp (không qua UI).

### Bước 4 — Kiểm tra trạng thái phòng & sức chứa
- `bookingController.js:132-134`: nếu `room.status !== 'available'` (ví dụ `maintenance`, `inactive`) → từ chối đặt.
- `bookingController.js:136-138`: nếu `guests > room.max_guests` → từ chối "Số khách vượt quá sức chứa phòng".

### Bước 5 — Kiểm tra phòng còn trống (Availability) — có, có gọi tới logic availability dùng chung
`bookingController.js:140-150` gọi `getBookedRoomCountMap` (định nghĩa `backend/utils/availability.js:42-74`) — **đây chính là hàm availability logic dùng chung** với trang tìm kiếm khách sạn (`hotelController.js`):
- Đếm số booking đang ở trạng thái `pending` hoặc `confirmed` của `room_id` này mà khoảng ngày **giao nhau (overlap)** với khoảng `[check_in, check_out)` khách đang chọn — điều kiện SQL: `check_in < @checkOut AND check_out > @checkIn` (`availability.js:59-60`).
- `availableQuantity = room.total_quantity - bookedCount` (`bookingController.js:147`). Nếu `<= 0` → `400 "Phòng đã hết chỗ trong khoảng ngày bạn chọn"`.

→ Đây là cơ chế chống **overbooking theo số lượng phòng cùng loại** (mỗi `room` có `total_quantity` phòng vật lý cùng loại, không phải 1 phòng = 1 giường).

### Bước 6 — Xác định người đặt: tài khoản hay khách vãng lai
`bookingController.js:152-169` — xem chi tiết ở **Mục 3** bên dưới.

### Bước 7 — Tính tổng tiền
`bookingController.js:171-172`:
```js
const nights = Math.ceil((dateRange.checkOut - dateRange.checkIn) / (1000 * 60 * 60 * 24));
const totalAmount = Number(room.price_per_night || 0) * nights;
```
- Số đêm = làm tròn lên (`Math.ceil`) của hiệu hai mốc ngày tính theo mili-giây, chia cho số mili-giây/ngày.
- Tổng tiền = `giá/đêm × số đêm`. Không cộng thêm phụ phí, thuế, giảm giá — công thức đơn giản, không có mã giảm giá/coupon.

### Bước 8 — Xác định phương thức & trạng thái thanh toán
`bookingController.js:173-176`:
- `payment_method` chỉ chấp nhận 1 trong 3 giá trị hợp lệ: `mock_card`, `mock_momo`, `pay_at_hotel`; giá trị khác sẽ tự **fallback về `pay_at_hotel`** (an toàn, không throw lỗi).
- Nếu là `mock_card` hoặc `mock_momo` → `payment_status = 'paid'` **ngay lập tức**, không có cổng thanh toán thật, không xác thực giao dịch nào cả (đây là "mock" — giả lập).
- Nếu là `pay_at_hotel` → `payment_status = 'unpaid'`.

### Bước 9 — Ghi booking vào CSDL
`bookingController.js:178-232`: `INSERT INTO dbo.Bookings (...) OUTPUT INSERTED.* VALUES (...)`.
- **Trạng thái booking khởi tạo luôn là `N'pending'`** (`bookingController.js:210`) — dù thanh toán mock đã "paid" thì trạng thái đơn vẫn là `pending`, cần Admin/Manager duyệt thành `confirmed` qua `updateBookingStatus`.
- `booking_source` = `'account'` nếu có `bookingUser`, ngược lại `'guest'` (`bookingController.js:223`) — đây là cờ đánh dấu đơn được tạo bởi thành viên hay khách vãng lai.
- Không dùng transaction (`BEGIN TRAN ... COMMIT`) bao quanh bước "check availability" (bước 5) và bước "insert" (bước 9) — xem **hạn chế** ở mục 8.

### Bước 10 — Ghi log audit (chỉ khi có tài khoản)
`bookingController.js:236-238`: `logAudit({ userId, action: 'create', entity: 'booking', entityId })` — chỉ gọi khi `bookingUser` tồn tại (khách vãng lai không có `userId` nên không ghi log audit).

### Bước 11 — Gửi email xác nhận
`bookingController.js:240-253`: gọi `sendBookingConfirmationEmail(...)` trong khối `try/catch` riêng — nếu gửi email lỗi, **không làm hỏng response**, chỉ set `emailErrorMessage` và log ra console. Xem chi tiết mục 5.

### Bước 12 — Trả kết quả về FE
`bookingController.js:255-267`: trả `201` kèm `booking`, `email_transport` (mode hiện tại), `mock_email` (nếu gửi được) và `email_error` (nếu gửi lỗi).

### Trạng thái (status) của Booking trong toàn hệ thống
| status | Ý nghĩa | Được set khi nào |
|---|---|---|
| `pending` | Chờ khách sạn/Admin xác nhận | Mặc định khi tạo (`bookingController.js:210`) |
| `confirmed` | Đã được Admin/Manager xác nhận | Qua `updateBookingStatus` (`bookingController.js:375-412`), Admin set thủ công |
| `cancelled` | Đã hủy (tự hủy hoặc Admin hủy) | Qua `cancelBooking` (`bookingController.js:419-465`) hoặc `updateBookingStatus` |

`payment_status` có các giá trị: `unpaid`, `paid`, `refunded` (chuyển sang `refunded` khi hủy một booking đã `paid`, xem mục 4).

---

## 3. Cơ chế "Khách vãng lai" (Guest mode)

**Có** — hệ thống cho phép đặt phòng **không cần đăng nhập**, đúng như trang chủ quảng cáo "Hỗ trợ khách vãng lai (Guest mode)".

### Phía route (không bắt buộc token)
`backend/routes/bookingRoutes.js:11`:
```js
router.post('/', optionalToken, ctrl.createBooking);
```
Middleware `optionalToken` (`backend/middleware/authMiddleware.js:38-51`): nếu có Bearer token hợp lệ thì gán `req.user`; nếu **không có token hoặc token sai** thì vẫn cho đi tiếp (`return next()` / `req.user = null`), **không trả lỗi 401**. Đây là điểm khác với `verifyToken` (dùng cho `/my`, `/:id/cancel`) — bắt buộc phải có token hợp lệ.

### Phía controller (rẽ nhánh theo có/không có user)
`bookingController.js:152-169`:
```js
let bookingUser = null;
if (req.user?.id) {
  bookingUser = await getUserById(req.user.id);
  if (!bookingUser) return 401 ...
  if (bookingUser.deleted_at || bookingUser.status !== 'active') return 403 ...
}

const resolvedGuestName  = bookingUser?.full_name || guest_name;
const resolvedGuestEmail = bookingUser?.email || guest_email;
const resolvedGuestPhone = bookingUser?.phone || guest_phone;

if (!bookingUser && (!resolvedGuestName || !resolvedGuestEmail)) {
  return 400 "Khách vãng lai cần nhập họ tên và email";
}
```
- Nếu `req.user` tồn tại (có token hợp lệ) → lấy thông tin từ bảng `Users`, đồng thời kiểm tra tài khoản chưa bị xóa mềm (`deleted_at`) và đang `active`.
- Nếu **không** có `req.user` → coi là khách vãng lai, bắt buộc phải có `guest_name` và `guest_email` hợp lệ (không bắt buộc `guest_phone`).
- Booking tạo ra sẽ có `user_id = null`, `booking_source = 'guest'` (`bookingController.js:217,223`).

### Hệ quả của Guest mode
- Khách vãng lai đặt được phòng và nhận email xác nhận (`emailService.js`), nhưng **không xuất hiện trong "Đặt phòng của tôi"** vì `getMyBookings` lọc theo `WHERE b.user_id = @userId` (`bookingController.js:325`) — khớp với cảnh báo hiển thị ở FE: `BookingPage.js:437` *"lịch sử booking sẽ không xuất hiện ở mục Đặt phòng của tôi"*.
- Khách vãng lai **không thể tự hủy** booking qua API `/bookings/:id/cancel` vì route này dùng `verifyToken` bắt buộc (`bookingRoutes.js:13`) và điều kiện `WHERE ... AND user_id = @userId` trong `cancelBooking` (`bookingController.js:421-432`) — với `user_id = null` thì không bao giờ khớp `userId` của bất kỳ ai đăng nhập. Muốn hủy, khách vãng lai phải liên hệ Admin để Admin đổi status qua `updateBookingStatus`.
- Phía FE, `BookingPage.js:83` xác định `isGuestMode = !user` (dựa vào `AuthContext`), hiển thị banner vàng cảnh báo và bắt buộc 3 ô nhập `guest_name/guest_email/guest_phone` (`BookingPage.js:260-303`).

---

## 4. Luồng HỦY ĐẶT PHÒNG

Có 2 cách hủy trong hệ thống:

### 4.1. Người dùng tự hủy — `cancelBooking` (`bookingController.js:419-465`)
Route: `PUT /api/bookings/:id/cancel`, bắt buộc `verifyToken` (`bookingRoutes.js:13`).

Điều kiện được phép hủy:
1. Booking phải thuộc về chính người dùng đang đăng nhập: `SELECT ... WHERE id = @bookingId AND user_id = @userId` (`bookingController.js:421-432`) — nếu không tìm thấy (booking của người khác, hoặc là booking guest không gắn `user_id`) → `404`.
2. Booking **chưa** ở trạng thái `cancelled` trước đó (`bookingController.js:439-441`) → tránh hủy 2 lần.
3. **Chỉ được hủy trước ngày nhận phòng**: `if (new Date(currentBooking.check_in) <= new Date()) return 400 "Chỉ có thể hủy trước ngày nhận phòng"` (`bookingController.js:443-445`). Tức là đến đúng ngày check-in hoặc sau đó, không thể tự hủy nữa.
4. Không giới hạn theo `status` hiện tại (booking đang `pending` hay đã `confirmed` đều hủy được, miễn còn trước ngày check-in) — khác với logic hiển thị nút hủy ở FE (xem bên dưới).

Khi hủy thành công (`bookingController.js:447-457`):
```sql
UPDATE dbo.Bookings
SET status = N'cancelled',
    payment_status = CASE WHEN payment_status = N'paid' THEN N'refunded' ELSE payment_status END,
    updated_at = SYSUTCDATETIME()
WHERE id = @bookingId;
```
- `status` → `cancelled`.
- Nếu đã thanh toán (`paid`, tức trả bằng mock_card/mock_momo) → tự động chuyển `payment_status` thành `refunded` (chỉ đổi nhãn trạng thái, **không có bất kỳ giao dịch hoàn tiền thật nào** vì đây là hệ thống thanh toán mock).
- Ghi audit log (`bookingController.js:459`).

**Lệch pha Backend/Frontend cần lưu ý khi bị hỏi**: Backend cho phép hủy cả booking đang `confirmed` (miễn còn trước check-in), nhưng UI ở `MyBookings.js:143-147` **chỉ hiển thị nút "Hủy đặt phòng" khi `b.status === 'pending'`**. Vậy nếu Admin đã `confirmed` một booking, người dùng sẽ không thấy nút hủy trên UI nữa (dù backend vẫn chấp nhận nếu gọi API trực tiếp) — đây là điểm khác biệt giữa ràng buộc UI và ràng buộc thật của API, nên nêu rõ nếu bị hỏi "hủy có bị chặn hoàn toàn theo status không?".

### 4.2. Admin/Manager đổi trạng thái — `updateBookingStatus` (`bookingController.js:375-412`)
Route: `PUT /api/bookings/:id/status`, yêu cầu `requireRoles(['admin','manager'])` (`bookingRoutes.js:17`).
- Nhận `status` bất kỳ từ `req.body.status` (không giới hạn danh sách enum ở tầng code — tin tưởng FE admin gửi đúng giá trị `pending/confirmed/cancelled`).
- Nếu chuyển sang `cancelled` và đang `paid` → cũng tự set `refunded` giống cơ chế tự hủy (`bookingController.js:383-385`).
- Admin cũng dùng route này để chuyển `pending → confirmed`.

### 4.3. Xóa vĩnh viễn — `deleteBooking` (`bookingController.js:277-298`)
Route: `DELETE /api/bookings/:id`, chỉ Admin/Manager. Khác với "hủy" (đổi status), lệnh này **xóa hẳn record khỏi bảng `Bookings`** — dùng cho dọn dữ liệu test/demo, không phải nghiệp vụ hủy phòng thông thường của khách.

---

## 5. `emailService.js` — Gửi email xác nhận

File: `backend/services/emailService.js`

### Thư viện dùng
Dùng **Nodemailer** (`const nodemailer = require('nodemailer')` — `emailService.js:1`).

### Cấu hình transporter — có 2 chế độ, quyết định tự động dựa trên biến môi trường (`.env`)
`createTransporter()` (`emailService.js:9-40`):
- Đọc từ `.env`: `EMAIL_TRANSPORT`, `SMTP_HOST`, `SMTP_PORT` (mặc định `587`), `SMTP_USER` (hoặc `EMAIL_USER`), `SMTP_PASS` (hoặc `EMAIL_PASS`), `SMTP_SECURE` (mặc định `true` nếu port `465`).
- `hasSmtpConfig = Boolean(smtpHost && smtpUser && smtpPass)`.
- `useMock = explicitMode === 'mock' || (!hasSmtpConfig && explicitMode !== 'smtp')` (`emailService.js:18`): nếu người vận hành ép `EMAIL_TRANSPORT=mock`, hoặc thiếu cấu hình SMTP mà không ép buộc `smtp`, hệ thống tự chuyển sang **mock**.
- Mode `mock`: `nodemailer.createTransport({ jsonTransport: true })` (`emailService.js:23`) — không gửi email thật ra ngoài, chỉ build ra object JSON mô phỏng nội dung mail (dùng để demo/test không cần tài khoản email thật).
- Mode `smtp`: `nodemailer.createTransport({ host, port, secure, auth: { user, pass } })` (`emailService.js:30-38`) — gửi email thật qua máy chủ SMTP.

Theo file `backend/.env` hiện tại của dự án: `EMAIL_TRANSPORT=smtp`, `SMTP_HOST=smtp.gmail.com`, `SMTP_PORT=587`, `SMTP_USER=...@gmail.com`, `SMTP_PASS=your_app_password` → tức là cấu hình **Gmail SMTP thật** (dùng App Password của Gmail, không phải mật khẩu tài khoản thường), có `hasSmtpConfig = true` nên sẽ chạy mode `smtp` thật sự (không rơi vào mock).

### Địa chỉ người gửi
`resolveSenderEmail()` (`emailService.js:51-54`) lấy từ **System Settings trong CSDL** (`getSettingValue(SYSTEM_SETTING_KEYS.EMAIL_SENDER, ...)` — bảng cấu hình hệ thống do Admin chỉnh trong trang quản trị), không hard-code, có fallback mặc định `no-reply@hotelbooking.local`.

### Nội dung email xác nhận đặt phòng
`sendBookingConfirmationEmail({ booking, hotel, room, recipientName, recipientEmail })` (`emailService.js:56-98`):
- Nếu không có `recipientEmail` → trả `null` ngay, không gửi (không throw lỗi).
- Email là **plain text** (không có template HTML), nội dung dựng bằng cách join mảng string (`emailService.js:67-77`): tên người nhận, tên khách sạn, loại phòng, ngày check-in/out (format `vi-VN`), tổng tiền (format `toLocaleString('vi-VN')`).
- Gửi bằng `emailClient.transporter.sendMail(mail)` (`emailService.js:80`), rồi log ra console tùy theo mode (`emailService.js:82-90`).
- Trả về object `{ mode, messageId, envelope, preview }` để controller đưa vào response cho FE hiển thị (`bookingController.js:259-265` → `BookingPage.js:204-214`).

### Email đăng ký tài khoản
`sendRegisterSuccessEmail(...)` (`emailService.js:100-138`) — cùng cơ chế, dùng khi user đăng ký tài khoản thành công (thuộc luồng Auth, không phải Booking, nêu ở đây để đối chiếu vì dùng chung transporter).

### Việc gửi email có chặn tạo booking không?
**Không.** Trong `createBooking`, lệnh gửi email được bọc `try/catch` riêng (`bookingController.js:242-253`) — nếu `sendMail` ném lỗi (ví dụ sai App Password, mất mạng), booking **vẫn đã được INSERT thành công trước đó** (bước 9 chạy trước bước gửi email), API vẫn trả `201` kèm `email_error` mô tả lỗi, FE hiển thị dòng "Đặt phòng đã được ghi nhận, nhưng chưa tạo/gửi được email xác nhận" (`BookingPage.js:210`).

---

## 6. `feedbackController.js` — Đánh giá khách sạn

File: `backend/controllers/feedbackController.js`

### Điều kiện được gửi đánh giá
`createFeedback` (`feedbackController.js:9-59`):
1. Bắt buộc đăng nhập: route `POST /api/feedback` dùng `verifyToken` (`feedbackRoutes.js:9`).
2. Kiểm tra **trùng lặp**: `SELECT TOP 1 id FROM Feedbacks WHERE user_id = @userId AND hotel_id = @hotelId` (`feedbackController.js:11-22`) — nếu đã tồn tại → `400 "Bạn đã đánh giá khách sạn này rồi"`. Mỗi user chỉ được đánh giá **1 lần / khách sạn**.
3. **Quan trọng — hạn chế thực tế**: Ở tầng backend, controller **không kiểm tra** người dùng đã từng đặt phòng thành công (hay đã checkout) tại khách sạn đó hay chưa trước khi cho `INSERT` vào `Feedbacks` (`feedbackController.js:28-50`). Điều kiện "phải từng đặt phòng và đã checkout" chỉ được **UI ràng buộc ở phía Frontend** (xem mục 7): nút "Viết đánh giá" chỉ hiện khi `b.status === 'confirmed' && new Date(b.check_out) < new Date()` (`MyBookings.js:150-155`). Nếu người dùng gọi thẳng API `POST /api/feedback` (Postman, script) với `hotel_id` bất kỳ mà chưa từng đặt phòng, hệ thống **vẫn chấp nhận** vì không có ràng buộc khóa ngoại/điều kiện nghiệp vụ kiểm tra lịch sử booking ở phía server.

### Lưu rating/comment
`feedbackController.js:28-50`: `INSERT INTO Feedbacks (user_id, hotel_id, rating, content) OUTPUT INSERTED.*`, với `rating = Number(req.body.rating || 0)` (không giới hạn khoảng 1-5 ở backend — chỉ ép kiểu số, FE mặc định `rating: 5` và thường dùng UI chọn sao 1-5 nhưng backend không chặn giá trị 0, âm, hoặc >5 nếu gọi API trực tiếp), `content` được `trim()`.

### Cách tính rating trung bình khách sạn
**Không lưu cột `average_rating` trong bảng `Hotels`.** Rating trung bình được **tính động (on-the-fly) mỗi lần trả dữ liệu**, tại tầng `hotelController.js`, không phải trong `feedbackController.js`:
- Khi lấy danh sách khách sạn: `hotelController.js:216-218` — với mỗi khách sạn, gom hết feedback của khách sạn đó rồi `reduce` cộng dồn `rating` chia cho số lượng (`averageRating = sum(rating) / count`), trả về field `average_rating` (`hotelController.js:237`) và `review_count` (`hotelController.js:238`). Nếu khách sạn chưa có feedback nào → `average_rating = null`.
- Khi lấy chi tiết 1 khách sạn: logic tương tự tại `hotelController.js:323-326,332-333`.
- Cách này đơn giản, luôn "tươi" (không sợ lệch dữ liệu do quên cập nhật cột cache), nhưng **tốn chi phí tính toán mỗi request** nếu số lượng feedback lớn (đánh đổi giữa tính đúng-tức-thời và hiệu năng).

### Các API còn lại
- `getFeedbackByHotel` (`feedbackController.js:61-85`): lấy tất cả feedback của 1 khách sạn kèm tên người đánh giá (join `Users`), public, không cần token (`feedbackRoutes.js:11`).
- `listFeedbacks` (`feedbackController.js:87-119`): Admin/Manager xem toàn bộ feedback toàn hệ thống, kèm thông tin khách sạn.
- `deleteFeedback` (`feedbackController.js:121-135`): Admin/Manager xóa 1 feedback (kiểm duyệt nội dung không phù hợp/spam).

---

## 7. Phía Frontend

### 7.1. `BookingPage.js` — Trang xác nhận & tạo đặt phòng
- **Tải dữ liệu phòng/khách sạn**: `useEffect` gọi `api.get('/hotels/${hotelId}', { params: { check_in, check_out } })` (`BookingPage.js:54-75`), rồi tìm đúng phòng theo `roomId` trong `res.data.rooms`. Việc truyền kèm `check_in/check_out` giúp BE trả về `is_bookable`/`available_quantity` đã tính theo đúng khoảng ngày (dùng lại `computeRoomAvailability` phía BE).
- **Tính tiền hiển thị tạm thời ở FE** (`BookingPage.js:77-82`): `nights` và `total` được tính lại y hệt công thức BE (`Math.ceil` chênh lệch ngày, nhân giá phòng) để hiển thị trước khi gửi API — đây chỉ là hiển thị tạm, **giá trị chính thức vẫn do BE tính lại và lưu** (không tin dữ liệu từ FE).
- **Xác định Guest mode**: `const isGuestMode = !user;` (`BookingPage.js:83`), lấy `user` từ `useAuth()` (AuthContext).
- **Validate phía client trước khi gọi API** (`BookingPage.js:88-104`): số đêm phải > 0, phòng phải `is_bookable`, nếu guest mode thì bắt buộc có `guest_name`/`guest_email`. Đây chỉ là validate UX, **BE vẫn validate lại toàn bộ độc lập** (mục 2).
- **Gọi API tạo booking**: `api.post('/bookings', { ...form, hotel_id: hotelId, room_id: roomId })` (`BookingPage.js:109-113`).
- **Hiển thị kết quả**: sau khi có `res.data`, set vào `confirmation` để chuyển UI sang màn hình xác nhận thành công, hiển thị mã booking, trạng thái, và thông báo email xác nhận đã gửi/mock (`BookingPage.js:163-240`, đọc `confirmation.mock_email`).

### 7.2. `MyBookings.js` — Lịch sử đặt phòng & hủy & đánh giá
- **Lấy danh sách booking**: `api.get('/bookings/my')` trong `fetchBookings()` (`MyBookings.js:20-25`), gọi lại trong `useEffect` khi mount.
- **Hiển thị trạng thái**: dùng hàm tiện ích `getBookingStatusMeta(b.status, { decorated: true })` (import từ `utils/bookingStatus.js`) để lấy màu + text + icon tương ứng `pending/confirmed/cancelled` (`MyBookings.js:78,94-96`).
- **Cho phép hủy**: `handleCancel(id)` (`MyBookings.js:29-38`) — hiện `window.confirm` xác nhận, rồi gọi `api.put('/bookings/${id}/cancel')`, sau đó gọi lại `fetchBookings()` để refresh danh sách. Nút hủy **chỉ hiển thị khi `b.status === 'pending'`** (`MyBookings.js:143-147`) — chặt hơn điều kiện thật của BE (BE cho hủy cả khi `confirmed`, miễn còn trước check-in — xem mục 4.1).
- **Cho phép đánh giá**: nút "Viết đánh giá" chỉ hiện khi `b.status === 'confirmed' && new Date(b.check_out) < new Date()` (`MyBookings.js:150-155`) — tức là Admin đã xác nhận VÀ đã qua ngày trả phòng. Bấm vào mở modal (`showFeedback`), submit gọi `handleFeedback` → `api.post('/feedback', { hotel_id, rating, content })` (`MyBookings.js:40-54`).
- Component không có phân trang; tải toàn bộ booking của user trong 1 lần gọi.

---

## 8. Bảng API Endpoint liên quan Booking & Feedback

| Method | Path | Mô tả | Cần token? | Vai trò | Xử lý tại |
|---|---|---|---|---|---|
| POST | `/api/bookings` | Tạo đặt phòng mới (hỗ trợ cả tài khoản & khách vãng lai) | Không bắt buộc (`optionalToken`) | Ai cũng gọi được | `bookingRoutes.js:11` → `bookingController.js:98-271` |
| GET | `/api/bookings/my` | Lấy lịch sử đặt phòng của user đang đăng nhập | Bắt buộc | User | `bookingRoutes.js:12` → `bookingController.js:304-335` |
| PUT | `/api/bookings/:id/cancel` | User tự hủy booking của mình | Bắt buộc | User (chủ booking) | `bookingRoutes.js:13` → `bookingController.js:419-465` |
| GET | `/api/bookings/all` | Xem toàn bộ booking hệ thống | Bắt buộc | admin, manager | `bookingRoutes.js:16` → `bookingController.js:340-369` |
| PUT | `/api/bookings/:id/status` | Đổi trạng thái booking (confirm/cancel...) | Bắt buộc | admin, manager | `bookingRoutes.js:17` → `bookingController.js:375-412` |
| DELETE | `/api/bookings/:id` | Xóa vĩnh viễn booking | Bắt buộc | admin, manager | `bookingRoutes.js:18` → `bookingController.js:277-298` |
| GET | `/api/feedback` | Xem toàn bộ feedback hệ thống | Bắt buộc | admin, manager | `feedbackRoutes.js:8` → `feedbackController.js:87-119` |
| POST | `/api/feedback` | Gửi đánh giá cho 1 khách sạn | Bắt buộc | User | `feedbackRoutes.js:9` → `feedbackController.js:9-59` |
| DELETE | `/api/feedback/:id` | Xóa 1 feedback (kiểm duyệt) | Bắt buộc | admin, manager | `feedbackRoutes.js:10` → `feedbackController.js:121-135` |
| GET | `/api/feedback/:hotel_id` | Xem feedback công khai của 1 khách sạn | Không cần | Public | `feedbackRoutes.js:11` → `feedbackController.js:61-85` |

*(Router gốc được mount ở `app.js`/`server.js` với tiền tố `/api/bookings` và `/api/feedback` — kiểm tra file khởi tạo Express để xác nhận tiền tố chính xác nếu thầy hỏi chi tiết mount path.)*

---

## 9. Câu hỏi phản biện thường gặp & cách trả lời

**1. Nếu 2 người đặt cùng 1 phòng cùng thời điểm (race condition) thì xử lý ra sao?**
> Trả lời trung thực: Hệ thống hiện **không dùng transaction/khóa (lock)** bao quanh chuỗi "đếm số phòng đã đặt" (`getBookedRoomCountMap`, `bookingController.js:140-146`) và "insert booking mới" (`bookingController.js:178-232`). Hai request gửi gần như đồng thời đều có thể đọc cùng một `bookedCount` trước khi cái nào insert xong, dẫn đến khả năng **overbooking** nếu phòng chỉ còn đúng 1 slot và có 2 booking cùng lúc vượt `total_quantity`. Đây là hạn chế thật của đồ án — hướng khắc phục: dùng transaction với mức cô lập `SERIALIZABLE`/`UPDLOCK, HOLDLOCK` trên các dòng booking liên quan, hoặc thêm ràng buộc kiểm tra tồn kho tại tầng CSDL (constraint/trigger), hoặc kiểm tra lại `availableQuantity` ngay trong cùng transaction với `INSERT`.

**2. Vì sao cho phép khách vãng lai (Guest mode) đặt phòng? Có rủi ro gì không?**
> Mục đích: giảm rào cản, tăng tỷ lệ chuyển đổi (không phải ai cũng muốn tạo tài khoản chỉ để đặt 1 lần). Cơ chế: route dùng `optionalToken` (`authMiddleware.js:38-51`) thay vì `verifyToken`, cho phép request không có Bearer token đi tiếp với `req.user = null`; controller sau đó bắt buộc `guest_name`/`guest_email` (`bookingController.js:163-169`). Rủi ro: không xác thực danh tính (email/tên có thể là giả), không có cách tự hủy qua tài khoản, khó truy vết nếu có gian lận (chỉ có `guest_email`, `guest_phone` làm định danh), và vì `user_id = null` nên không thể áp dụng các ràng buộc theo lịch sử tài khoản (ví dụ giới hạn số booking/ngày để chống spam).

**3. Email xác nhận gửi thất bại thì có ảnh hưởng đến việc đặt phòng có tính là thành công không?**
> Không. Việc `INSERT` booking (bước 9, `bookingController.js:178-232`) xảy ra **trước** và **độc lập** với việc gửi email (bước 11, `bookingController.js:240-253`, nằm trong `try/catch` riêng). Nếu gửi email lỗi (sai App Password Gmail, mất mạng SMTP...), booking vẫn được lưu vào CSDL với status `pending`, API vẫn trả `201` kèm field `email_error` mô tả lỗi để FE thông báo cho người dùng biết là "đã đặt phòng nhưng chưa gửi được email".

**4. Đánh giá (feedback) có thể bị giả mạo/spam không? Có cơ chế nào chặn?**
> Có 2 lớp chặn nhưng không đầy đủ. (a) Chặn trùng lặp: mỗi `user_id` chỉ được feedback 1 lần / `hotel_id`, kiểm tra bằng `SELECT` trước khi `INSERT` (`feedbackController.js:11-26`). (b) Bắt buộc đăng nhập (`verifyToken`, `feedbackRoutes.js:9`) nên phải có tài khoản thật. Tuy nhiên, **backend không kiểm tra người dùng đã từng đặt phòng và đã checkout tại khách sạn đó chưa** trước khi cho gửi đánh giá (`feedbackController.js:28-50` không có bước `SELECT` từ bảng `Bookings` để xác minh). Điều kiện "phải từng ở" chỉ được UI ràng buộc (`MyBookings.js:150-155` chỉ hiện nút khi có booking `confirmed` đã qua check-out), nên về lý thuyết một tài khoản có thể gọi thẳng `POST /api/feedback` để đánh giá một khách sạn chưa từng đặt. Đây là điểm có thể cải thiện: thêm điều kiện `EXISTS (SELECT 1 FROM Bookings WHERE user_id=... AND hotel_id=... AND status='confirmed' AND check_out < GETDATE())` trong `createFeedback`.

**5. Vì sao trạng thái booking mới tạo luôn là `pending` dù đã thanh toán online (mock_card/mock_momo)?**
> Vì `payment_status` (đã thanh toán hay chưa) và `status` (trạng thái xử lý đơn: chờ duyệt/xác nhận/hủy) là 2 khái niệm tách biệt trong thiết kế dữ liệu (`bookingController.js:210` set cứng `status = 'pending'`, còn `paymentStatus` tính riêng ở dòng 176). Dù thanh toán mock thành công ngay, đơn vẫn cần khách sạn/Admin xác nhận (`updateBookingStatus`) mới chuyển `confirmed` — mô phỏng quy trình thực tế nơi khách sạn cần duyệt phòng trước khi chốt.

**6. Số tiền hiển thị ở Frontend (BookingPage) có phải số tiền cuối cùng được lưu không? Có thể sửa giá bằng cách can thiệp request không?**
> FE có tính `total` để hiển thị trước (`BookingPage.js:77-82`) nhưng **giá trị lưu vào CSDL luôn được BE tính lại độc lập** từ `room.price_per_night` (lấy từ CSDL, không nhận từ `req.body`) nhân với số đêm tính từ `check_in/check_out` do FE gửi (`bookingController.js:171-172`). Vì vậy không thể can thiệp trực tiếp field "total_amount" từ client để giảm giá — nhưng lưu ý: **ngày check-in/check-out vẫn do client gửi lên và chỉ được validate hợp lệ (checkout>checkin), không giới hạn không cho chọn ngày quá khứ ở BE**, nên lý thuyết có thể gửi ngày bất kỳ nếu bypass FE.

**7. Vì sao cho phép hủy booking đến trước ngày check-in mà không có khoảng đệm (ví dụ hủy trước 24h/48h)?**
> Đúng là điều kiện hiện tại chỉ đơn giản là `check_in > now` (`bookingController.js:443-445`), chưa có chính sách hủy linh hoạt theo khung giờ (free-cancellation window) như các hệ thống OTA thực tế (Booking.com, Agoda thường có mốc "miễn phí hủy trước X ngày"). Đây là điểm đơn giản hóa có chủ đích cho phạm vi đồ án, có thể mở rộng bằng cách thêm cột `cancellation_deadline` hoặc policy theo `hotel_id`.

**8. Vì sao rating trung bình không lưu sẵn trong bảng Hotels mà phải tính lại mỗi lần?**
> Thiết kế đơn giản hóa: tránh phải đồng bộ 2 nguồn dữ liệu (bảng `Feedbacks` và cột cache trong `Hotels`) mỗi khi có feedback mới/bị xóa — giảm rủi ro dữ liệu lệch nhau (stale cache). Đánh đổi là tốn thêm truy vấn/tính toán mỗi lần load danh sách khách sạn (`hotelController.js:216-218,323-326`). Với quy mô dữ liệu nhỏ của đồ án, chi phí này chấp nhận được; ở hệ thống lớn hơn nên cân nhắc lưu cột `average_rating`/`review_count` cache và cập nhật (trigger hoặc cập nhật trực tiếp) mỗi khi `INSERT`/`DELETE` feedback.

---

## 10. Tổng kết hạn chế (hạn chế cần cải thiện) — nêu trung thực khi bị hỏi

1. **Race condition khi đặt phòng**: không có transaction/lock giữa bước kiểm tra tồn kho và bước insert (`bookingController.js:140-232`) → có thể overbooking khi nhiều request đồng thời.
2. **Feedback không kiểm tra lịch sử đặt phòng thật ở backend** (`feedbackController.js:9-59`) — chỉ chặn được trùng lặp, chưa chặn được đánh giá "khống".
3. **Rating không giới hạn khoảng giá trị** (0-5) ở backend — chỉ ép kiểu số (`feedbackController.js:47`).
4. **Không validate check-in phải ở tương lai** tại backend (`availability.js:21-36` chỉ so sánh `checkOut > checkIn`), chỉ chặn ở FE bằng `min` date.
5. **Thanh toán "mock"**: `mock_card`/`mock_momo` chuyển `paid` ngay lập tức không qua bất kỳ cổng thanh toán/xác thực giao dịch nào (`bookingController.js:173-176`) — chỉ phù hợp demo, không dùng được cho môi trường thật.
6. **Hoàn tiền (`refunded`) chỉ là đổi nhãn trạng thái**, không có luồng hoàn tiền thực tế qua cổng thanh toán (`bookingController.js:452`, `383-385`).
7. **Không có chính sách hủy theo khung thời gian** (free-cancellation window) — chỉ chặn cứng theo mốc check-in.
