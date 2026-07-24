# 04 — Backend & Trang Quản trị (Admin)

---

## 1. Tổng quan chức năng trang quản trị

Khu vực Admin nằm dưới `/admin/*` ở frontend (React) và được backend lộ ra qua các route Express, nhưng **không phải toàn bộ API admin nằm trong `adminRoutes.js`** — nhiều thao tác quản trị (CRUD khách sạn, phòng, booking, user, feedback) thực chất nằm trong các route "nghiệp vụ" chung (`hotelRoutes.js`, `roomRoutes.js`, `bookingRoutes.js`, `userRoutes.js`, `feedbackRoutes.js`) và chỉ được phân quyền cao hơn bằng middleware `requireRoles`. Còn `adminRoutes.js` chỉ chứa 2 nhóm API thực sự "riêng cho admin": Dashboard thống kê và Cấu hình hệ thống (system settings).

Danh sách chức năng:

| Chức năng | Trang frontend | Vai trò được phép |
|---|---|---|
| Dashboard thống kê doanh thu/booking/công suất phòng | `Dashboard.js` | admin, manager |
| CRUD khách sạn | `Hotels.js` | admin, manager |
| CRUD phòng | `Rooms.js` | admin, manager |
| Xác nhận/hủy/xóa booking | `Bookings.js` | admin, manager |
| Khóa/mở khóa tài khoản, đổi mật khẩu | `Users.js` | **chỉ admin** (xem xác nhận ở mục 6) |
| Xóa phản hồi/đánh giá | `Feedbacks.js` | admin, manager |
| Cấu hình email gửi hệ thống | Nằm ngay trong `Dashboard.js` | **chỉ admin** |

Việc mount route được khai báo tại `backend/server.js:17-23`:

```
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/users', require('./routes/userRoutes'));
app.use('/api/hotels', require('./routes/hotelRoutes'));
app.use('/api/rooms', require('./routes/roomRoutes'));
app.use('/api/bookings', require('./routes/bookingRoutes'));
app.use('/api/feedback', require('./routes/feedbackRoutes'));
app.use('/api/admin', require('./routes/adminRoutes'));
```

Do đó khi trả lời "API quản lý khách sạn nằm ở đâu?", câu trả lời đúng là: **không nằm trong `/api/admin`, mà nằm trong `/api/hotels` với middleware phân quyền admin/manager** — đây là điểm hay bị hỏi bẫy.

---

## 2. Dashboard.js — Thống kê tổng quan

### 2.1 Nguồn dữ liệu

Component `Dashboard` (`frontend/my-hotel-app/src/pages/admin/Dashboard.js:273`) gọi duy nhất một API thống kê:

```js
api.get('/admin/dashboard', { params: nextRange })
```
(`Dashboard.js:299`), tương ứng route `GET /admin/dashboard` được bảo vệ bởi `verifyToken, requireRoles(['admin', 'manager'])` tại `backend/routes/adminRoutes.js:9`, xử lý bởi `exports.getDashboardStats` (`backend/controllers/adminController.js:53-249`).

Để vẽ thẻ "delta % so với kỳ trước" (`DeltaBadge`, `Dashboard.js:74-92`), component gọi **API này 2 lần song song** — một lần cho khoảng ngày hiện tại, một lần cho khoảng ngày liền trước cùng độ dài (`computePreviousRange`, `Dashboard.js:52-61`):

```js
const [currentRes, previousRes] = await Promise.all([
  api.get('/admin/dashboard', { params: nextRange }),
  api.get('/admin/dashboard', { params: prevRange }),
]);
```
(`Dashboard.js:298-301`)

### 2.2 Cách backend tính toán số liệu (`adminController.js`)

`getDashboardStats` (`adminController.js:53`) nhận `from`/`to` từ query, mặc định 14 ngày gần nhất (`defaultFrom.setDate(defaultFrom.getDate() - 13)`, `adminController.js:58-59`), sau đó validate bằng `normalizeDateRange` (`adminController.js:63`).

Nó chạy song song 4 truy vấn (`Promise.all`, `adminController.js:75-100`):
- `SELECT * FROM dbo.Hotels`
- `SELECT * FROM dbo.Rooms`
- Bookings join Hotels/Rooms/Users, lọc theo `created_at BETWEEN @fromDate AND @toDate` (`adminController.js:78-98`) — **lọc theo ngày TẠO booking, không phải theo ngày check-in/check-out**
- `SELECT COUNT(*) FROM dbo.Feedbacks`

Phân loại booking theo trạng thái (`adminController.js:113-115`):
```js
const confirmed = bookings.filter((item) => item.status === 'confirmed');
const pending = bookings.filter((item) => item.status === 'pending');
const cancelled = bookings.filter((item) => item.status === 'cancelled');
```

**Cách tính doanh thu** — đây là phần hay bị hỏi nhất:
- Hàm `isCollected` (`adminController.js:117-120`) coi một booking là "đã thu tiền" nếu `payment_status === 'paid'` HOẶC phương thức thanh toán là `mock_card`/`mock_momo`.
- `revenuePaid` (`adminController.js:122-124`): **chỉ tính trên booking `confirmed` VÀ đã thu tiền** — booking `pending` hoặc `cancelled` **không được tính vào doanh thu đã thu**, dù đã thanh toán online (mock).
- `revenuePending` (`adminController.js:127-129`): tổng tiền của booking confirmed nhưng chưa thu (trả tại khách sạn) và chưa hoàn tiền.
- `refunds` (`adminController.js:131-133`): tổng tiền các booking có `payment_status === 'refunded'` (thường là do bị hủy sau khi đã thanh toán, xem `bookingController.js:383-385`).
- `profit` = `revenuePaid - refunds` (`adminController.js:224`) — đây là "lợi nhuận ước tính" hiển thị ở `Dashboard.js:512-516`.

**Tỷ lệ lấp đầy phòng (occupancy rate)** (`adminController.js:135-145`):
```js
const totalInventory = rooms.reduce((sum, room) => sum + Number(room.total_quantity || 0), 0);
const activeInventory = rooms.filter(r => (r.status||'available')==='available').reduce(...);
const occupiedRoomNights = confirmed.reduce((sum, b) => sum + calculateOverlapNights(b, from, rangeEndExclusive), 0);
const availableRoomNights = activeInventory * Math.max(1, computeStayNights(from, rangeEndExclusive));
const occupancyRate = availableRoomNights > 0 ? (occupiedRoomNights / availableRoomNights) * 100 : 0;
```
Chỉ số này dùng `calculateOverlapNights`/`computeStayNights` từ `backend/utils/availability.js` để tính số "đêm-phòng" (room-nights) đã sử dụng, so với tổng room-nights khả dụng trong dải ngày, tính **trên các booking `confirmed`** (không tính pending/cancelled) và **chỉ trên phòng có status `available`**.

**Biểu đồ xu hướng doanh thu (trend_revenue)** (`adminController.js:147-163`): tự động chọn đơn vị hiển thị theo độ dài khoảng ngày qua `pickTrendUnit` (`adminController.js:20-25`): ≤31 ngày → theo ngày, ≤731 ngày → theo tháng, còn lại → theo năm. Dữ liệu chỉ cộng dồn từ booking `confirmed` + `isCollected` (`adminController.js:156-161`).

**Top 5 khách sạn theo doanh thu** (`adminController.js:165-184`) và **phân bổ theo phương thức thanh toán** (`adminController.js:186-192`) cũng chỉ tính trên booking confirmed + đã thu tiền.

**Booking gần đây** (`adminController.js:194-210`): lấy 8 booking mới nhất theo `created_at`, không lọc theo status (hiển thị mọi trạng thái kèm badge màu ở `Dashboard.js:40-44, 584-603`).

Response trả về gồm `summary`, `payment_breakdown`, `trend_revenue`, `trend_unit`, `top_hotels`, `recent_bookings`, `range` (`adminController.js:212-245`).

### 2.3 Biểu đồ trên UI

Dùng thư viện `recharts`:
- `RevenueTrendChart` (`Dashboard.js:117-166`): `AreaChart` vẽ doanh thu theo thời gian, dùng gradient fill.
- `PaymentDonut` (`Dashboard.js:168-218`): `PieChart` dạng donut thể hiện 3 trạng thái thanh toán: paid/unpaid/refunded, màu tại `PAYMENT_COLORS` (`Dashboard.js:46`).
- `TopHotelsList` (`Dashboard.js:226-267`): thanh progress bar thủ công (không dùng recharts) thể hiện tỷ trọng doanh thu từng khách sạn so với khách sạn cao nhất.
- 4 `StatCard` (doanh thu, tổng booking, tỷ lệ lấp đầy, phản hồi) kèm `DeltaBadge` so sánh % với kỳ trước (`Dashboard.js:477-517`).

### 2.4 Cấu hình email gửi hệ thống (systemEmailSender)

Chỉ hiển thị khi `user?.role === 'admin'` (`Dashboard.js:611`, `menuItems` cũng ẩn mục "Tài khoản" với manager tại `Dashboard.js:360-362`).

- Khi mount, nếu là admin, gọi `GET /admin/system-settings` để nạp email hiện tại (`Dashboard.js:315-334`) → route bảo vệ bởi `requireRoles(['admin'])` (`adminRoutes.js:10`) → xử lý bởi `exports.getSystemSettings` (`adminController.js:251-260`), đọc giá trị qua `getSettingValue(SYSTEM_SETTING_KEYS.EMAIL_SENDER, 'no-reply@hotelbooking.local')` (`adminController.js:253`) — có giá trị mặc định nếu DB chưa có config.
- Khi bấm "Lưu cấu hình", hàm `saveSystemSettings` (`Dashboard.js:336-350`) gọi `PUT /admin/system-settings` với `{ email_sender }` đã chuẩn hóa `trim().toLowerCase()` (`Dashboard.js:340`).
- Backend `updateSystemSettings` (`adminController.js:262-283`) validate: không được rỗng (`adminController.js:265-267`) và phải đúng định dạng email bằng regex `^[^\s@]+@[^\s@]+\.[^\s@]+$` (`adminController.js:269-271`), sau đó lưu qua `upsertSettingValue` (service `services/systemSettingsService.js`, dùng bảng key-value cấu hình hệ thống).
- Giá trị này (`email_sender`) sau đó được dùng làm địa chỉ "From" khi gửi email xác nhận đặt phòng (`sendBookingConfirmationEmail`, `backend/controllers/bookingController.js:243-249` gọi tới service email — service này đọc `SYSTEM_SETTING_KEYS.EMAIL_SENDER` để build header From).

---

## 3. CRUD Khách sạn — `Hotels.js` + `hotelController.js`

### 3.1 Route & phân quyền

`backend/routes/hotelRoutes.js`:
```
GET    /              -> ctrl.getHotels        (public, không cần token)
GET    /:id            -> ctrl.getHotelById     (public)
POST   /               -> verifyToken, requireRoles(['admin','manager']) -> ctrl.createHotel   (hotelRoutes.js:10)
PUT    /:id            -> verifyToken, requireRoles(['admin','manager']) -> ctrl.updateHotel   (hotelRoutes.js:11)
DELETE /:id            -> verifyToken, requireRoles(['admin','manager']) -> ctrl.deleteHotel   (hotelRoutes.js:12)
```

### 3.2 Tạo khách sạn (`createHotel`, `hotelController.js:353-409`)

Nhận payload từ `Hotels.js:27-53` (hàm `handleSubmit`), chuẩn hóa `star_rating`, `hot_deal_discount_percent` thành số, tách `amenities` từ chuỗi phân cách dấu phẩy thành mảng (`Hotels.js:33`). Backend build object `payload` (`hotelController.js:355-367`) với `trim()` cho các field chuỗi, `Number()` cho field số, `Boolean()` cho `is_hot_deal`, và `JSON.stringify` cho `amenities`/`images` (vì cột SQL Server lưu dạng JSON string). Insert bằng câu `INSERT ... OUTPUT INSERTED.*` (`hotelController.js:369-400`) để trả về ngay bản ghi vừa tạo (kèm `id` tự sinh), map qua `mapHotel` để trả `_id` dạng chuẩn frontend dùng (Mongo-style `_id` dù DB thực chất là SQL Server).

**Validate dữ liệu**: hầu như KHÔNG có validate bắt buộc (`name`, `city` có thể rỗng vẫn insert được — chỉ `String(...).trim()`, không check độ dài hay required). Đây là điểm yếu thực tế, nêu ở mục "hạn chế".

### 3.3 Sửa khách sạn (`updateHotel`, `hotelController.js:414-484`)

Lấy bản ghi hiện tại trước (`hotelController.js:416-428`), nếu không tồn tại trả về 404. Sau đó UPDATE toàn bộ field, dùng toán tử `??` để giữ nguyên giá trị cũ nếu field không được gửi lên (`hotelController.js:450-465`) — đây là kiểu "partial update" thông qua fallback về giá trị hiện có, không phải PATCH thực sự nhưng hoạt động tương tự.

### 3.4 Xóa khách sạn (`deleteHotel`, `hotelController.js:490-555`) — **CÓ transaction cascade delete**

```js
const deleted = await withTransaction(async (transaction) => {
  ... kiểm tra tồn tại ...
  DELETE FROM dbo.Feedbacks WHERE hotel_id = @hotelId;   // hotelController.js:508-515
  DELETE FROM dbo.Bookings  WHERE hotel_id = @hotelId;   // hotelController.js:517-524
  DELETE FROM dbo.Rooms     WHERE hotel_id = @hotelId;   // hotelController.js:526-533
  DELETE FROM dbo.Hotels    WHERE id = @hotelId;         // hotelController.js:535-542
  return true;
});
```
Toàn bộ nằm trong `withTransaction` (`config/db.js`) nên nếu 1 bước lỗi, mọi thay đổi sẽ rollback — **đây là điểm mạnh cần nêu khi được hỏi "xóa khách sạn có cascade không?"**: CÓ, và có transaction để đảm bảo toàn vẹn dữ liệu (atomicity). Thứ tự xóa đúng theo ràng buộc khóa ngoại: Feedbacks → Bookings → Rooms → Hotels.

### 3.5 Upload/quản lý ảnh

Thực tế dự án **không có chức năng upload file ảnh thật** (không có multer / thư mục uploads cho hotel). Trường `cover_image` chỉ là input text nhập URL ảnh (`Hotels.js:114`, placeholder `https://...`). Hiển thị ảnh dùng component `SafeImage` (`frontend/.../components/SafeImage.js`) — component này có cơ chế fallback (`sources={hotel.images || []}`, `Hotels.js:210`) để tự chuyển ảnh khác nếu ảnh chính lỗi, và hiển thị tên/thành phố nếu tất cả ảnh lỗi (`title`, `subtitle`, `Hotels.js:215-216`). Trường `images` (mảng nhiều ảnh) tồn tại ở backend (`hotelController.js:366`, `463-464`) nhưng UI admin (`Hotels.js`) **không có form nhập** cho trường này — chỉ backend hỗ trợ, admin không thao tác được qua UI hiện tại.

---

## 4. CRUD Phòng — `Rooms.js` + `roomController.js`

### 4.1 Route & phân quyền

`backend/routes/roomRoutes.js`:
```
GET    /       -> ctrl.getRoomsByHotel   (public, cần query ?hotel_id=)
POST   /       -> verifyToken, requireRoles(['admin','manager']) -> ctrl.createRoom   (roomRoutes.js:10)
PUT    /:id    -> verifyToken, requireRoles(['admin','manager']) -> ctrl.updateRoom   (roomRoutes.js:11)
DELETE /:id    -> verifyToken, requireRoles(['admin','manager']) -> ctrl.deleteRoom   (roomRoutes.js:12)
```

### 4.2 Liên kết với khách sạn

UI (`Rooms.js:38-48`) bắt buộc chọn khách sạn trước (`<select>` tại `Rooms.js:135-146`, load từ `GET /hotels`), sau đó mới load `GET /rooms?hotel_id=...` (`Rooms.js:43-44`). Khi submit, `hotel_id` được gán cứng bằng `selectedHotel` đang chọn (`Rooms.js:67`), **không lấy từ input riêng trong form phòng** — nghĩa là khi sửa phòng, nếu người dùng đổi `selectedHotel` mà quên rằng form đang mở cho phòng khác, phòng có thể bị gán nhầm sang khách sạn khác (rủi ro UX nhỏ).

Backend `createRoom` (`roomController.js:46-91`) insert với `hotelId: Number(req.body.hotel_id)` (`roomController.js:73`) — **không kiểm tra `hotel_id` có thực sự tồn tại trong bảng Hotels hay không** trước khi insert (không có bước `SELECT` kiểm tra khách sạn tồn tại như `bookingController.createBooking` làm ở dòng 118-121). Nếu FK constraint không có ở DB, có thể tạo phòng "mồ côi" với `hotel_id` không tồn tại.

### 4.3 Sửa/Xóa phòng

`updateRoom` (`roomController.js:93-155`) theo pattern giống `updateHotel`: lấy bản ghi hiện tại, dùng `??` để giữ giá trị cũ khi field không gửi lên.

`deleteRoom` (`roomController.js:157-204`) cũng dùng `withTransaction`, xóa `Bookings` liên quan đến phòng trước (`roomController.js:175-182`) rồi mới xóa `Rooms` (`roomController.js:184-191`) — **cascade xóa booking khi xóa phòng**, cùng cơ chế transaction như xóa khách sạn.

### 4.4 Trạng thái phòng

3 trạng thái: `available` (đang mở bán), `maintenance` (bảo trì), `inactive` (ngưng bán) — định nghĩa UI tại `Rooms.js:5-15`. Trạng thái này ảnh hưởng tới tính toán "sức chứa hoạt động" (`activeInventory`) trong Dashboard (`adminController.js:136-138`, chỉ đếm phòng có `status === 'available'`).

---

## 5. Quản lý Booking phía Admin — `Bookings.js`

### 5.1 Route & phân quyền

`backend/routes/bookingRoutes.js:16-18`:
```
GET    /all         -> verifyToken, requireRoles(['admin','manager']) -> ctrl.getAllBookings
PUT    /:id/status  -> verifyToken, requireRoles(['admin','manager']) -> ctrl.updateBookingStatus
DELETE /:id         -> verifyToken, requireRoles(['admin','manager']) -> ctrl.deleteBooking
```

### 5.2 Xác nhận/hủy booking

`Bookings.js:16-28` gọi `GET /bookings/all` để load toàn bộ booking (join Hotel/Room/User, xem `serializeJoinedBooking`, `bookingController.js:7-36`).

Khi admin bấm "Xác nhận" hoặc "Hủy" (`Bookings.js:163-178`, chỉ hiện khi `status === 'pending'`), hàm `handleStatus` (`Bookings.js:30-38`) gọi `PUT /bookings/:id/status` với `{ status }`.

Backend `updateBookingStatus` (`bookingController.js:375-412`):
```js
const nextStatus = String(req.body.status || '').trim();
const nextPaymentStatus = nextStatus === 'cancelled' && current.payment_status === 'paid'
  ? 'refunded'
  : current.payment_status;
```
(`bookingController.js:382-385`) — **logic tự động hoàn tiền**: nếu admin hủy một booking đã thanh toán (`payment_status === 'paid'`), hệ thống tự chuyển `payment_status` sang `refunded`. Đây chỉ là cập nhật trạng thái trong DB (mock), **không gọi cổng thanh toán thật để hoàn tiền** — vì hệ thống dùng thanh toán giả lập (`mock_card`, `mock_momo`, xem `bookingController.js:173-176`).

**Lưu ý bảo mật/logic**: `updateBookingStatus` **không giới hạn giá trị `status`** được truyền vào — admin có thể set bất kỳ chuỗi nào (không validate enum `pending/confirmed/cancelled`), đây là điểm yếu tiềm ẩn.

Booking `confirmed` vẫn có thể bị Hủy tiếp (`Bookings.js:180-195`) hoặc "Xóa record" vĩnh viễn nếu đã `confirmed`/`cancelled` (`Bookings.js:188-193, 197-204`).

### 5.3 Xóa booking

`handleDelete` (`Bookings.js:40-50`) gọi `DELETE /bookings/:id` → `deleteBooking` (`bookingController.js:277-298`) xóa cứng khỏi DB và ghi log audit (`logAudit`, `bookingController.js:292`). Không có ràng buộc "chỉ được xóa nếu đã cancelled" ở backend — validate "chỉ cho phép xóa khi confirmed/cancelled" chỉ nằm ở **frontend** (ẩn nút với booking `pending`), backend không kiểm tra lại điều kiện này (admin có thể gọi trực tiếp API để xóa booking đang `pending`).

---

## 6. Quản lý Người dùng — `Users.js`

### 6.1 Route & phân quyền — hai mức quyền khác nhau

`backend/routes/userRoutes.js:11-15`:
```
GET    /            -> requireRoles(['admin','manager'])  -> listUsers   (xem được)
POST   /            -> requireRoles(['admin'])             -> createUser
PUT    /:id         -> requireRoles(['admin'])             -> updateUser
PATCH  /:id/lock    -> requireRoles(['admin'])             -> lockUser
PATCH  /:id/unlock  -> requireRoles(['admin'])              -> unlockUser
```
Comment ngay trong file xác nhận chủ đích thiết kế: *"Admin / Manager can view users; only Admin can modify"* (`userRoutes.js:10`). Đây là lý do `Users.js:114-123` hiển thị màn hình chặn "Không có quyền truy cập" nếu `user?.role !== 'admin'` — **nhưng đây chỉ là chặn UI phía frontend**; nếu manager tự gọi thẳng `PATCH /users/:id/lock` bằng Postman, request đã bị chặn **ở backend** bởi `requireRoles(['admin'])` (`userRoutes.js:14`), trả về 403 (`authMiddleware.js:70-71`) — tức là lớp bảo vệ thật vẫn đứng vững dù frontend có bị bỏ qua.

### 6.2 Khóa / Mở khóa tài khoản

`lock(id)`/`unlock(id)` (`Users.js:59-79`) gọi `PATCH /users/:id/lock` và `PATCH /users/:id/unlock`.

Backend (`userController.js:216-269`):
- `lockUser`: set `status = 'locked'` (`userController.js:223-232`).
- `unlockUser`: set `status = 'active'` và **reset `failed_attempts = 0`** (`userController.js:250-260`) — hữu ích vì tài khoản có thể bị khóa tự động do đăng nhập sai nhiều lần (cơ chế `failed_attempts` trong `authController.js`), mở khóa thủ công sẽ xóa luôn bộ đếm này.

**Hạn chế thực tế**: `lockUser`/`unlockUser` **không kiểm tra**:
- Admin có đang tự khóa chính mình không (`req.user.id === req.params.id`).
- Đây có phải admin **cuối cùng** còn active trong hệ thống không.

→ Về lý thuyết, một admin hoàn toàn có thể tự khóa tài khoản của chính mình, hoặc khóa hết toàn bộ admin khác, dẫn tới hệ thống không còn ai đăng nhập được để mở khóa lại (phải can thiệp trực tiếp vào DB). Đây là lỗ hổng cần nêu trung thực khi bị hỏi.

### 6.3 Đổi vai trò (role) & đổi mật khẩu

`Users.js` không có UI đổi role trực tiếp (không thấy dropdown đổi role trong file này — chỉ hiển thị badge role, `Users.js:152-154`), nhưng backend `updateUser` (`userController.js:146-214`) **có hỗ trợ đổi `role`** qua `PUT /users/:id` (`userRoutes.js:13`, chỉ admin) nếu FE gửi field `role`. Vậy hiện tại đổi role chỉ khả thi qua gọi API trực tiếp (Postman) hoặc cần bổ sung UI — nêu đúng thực trạng nếu bị hỏi "làm sao đổi role qua giao diện" (câu trả lời trung thực: hiện tại UI Admin chưa có nút đổi role, dù backend đã hỗ trợ).

Đổi mật khẩu qua UI dùng `window.prompt` (`Users.js:81-92`, `changePassword`) hoặc nút "Reset 123" đặt mật khẩu mặc định `'123'` (`Users.js:94-106`, `resetToDefault`) — cả hai đều gọi `PUT /users/:id` với `{ password }`. Backend hash bằng `bcrypt.hash(password.trim(), 10)` (`userController.js:170-172`) và khi đổi mật khẩu sẽ tự động xóa `refresh_token_hash`, `reset_password_token_hash`, reset `failed_attempts` (`userController.js:185-190`) — buộc đăng xuất phiên cũ, hợp lý về bảo mật.

### 6.4 Liên hệ với AuthContext / AdminRoute

`AuthContext` (không đọc trực tiếp trong task này nhưng được `Users.js:4` và `Dashboard.js:17` sử dụng qua `useAuth()`) lưu thông tin `user` (gồm `role`) sau khi đăng nhập — decode từ JWT. `AdminRoute.js` (`frontend/.../components/AdminRoute.js:10-16`) dùng `user.role` này để chặn UI:
```js
if (!user) return <Navigate to="/login" replace />;
if (!['admin', 'manager'].includes(user.role)) return <Navigate to="/" replace />;
return <Outlet />;
```
Đây là **route guard cấp layout** cho toàn bộ nhóm `/admin/*` (đặt trong React Router như phần tử cha bọc các route con). Riêng trang Users tự thêm một lớp chặn nữa dành riêng cho "chỉ admin" (`Users.js:114-123`) vì `AdminRoute` chỉ chặn ở mức admin+manager.

---

## 7. Quản lý Feedback — `Feedbacks.js`

### 7.1 Route & phân quyền

`backend/routes/feedbackRoutes.js`:
```
GET    /            -> requireRoles(['admin','manager']) -> listFeedbacks   (feedbackRoutes.js:8)
POST   /            -> verifyToken                         -> createFeedback (mọi user đã đăng nhập)
DELETE /:id         -> requireRoles(['admin','manager']) -> deleteFeedback  (feedbackRoutes.js:10)
GET    /:hotel_id    -> (public)                             -> getFeedbackByHotel (feedbackRoutes.js:11)
```
Lưu ý thứ tự khai báo route: `GET /` (danh sách toàn bộ, cần quyền) được khai báo **trước** `GET /:hotel_id` (public, xem theo khách sạn) — nếu đảo ngược thứ tự, Express sẽ match nhầm `/:hotel_id` với mọi request `GET /` (không xảy ra ở đây vì `/` không có params nên không match `/:hotel_id`, nhưng thứ tự này vẫn là thực hành đúng cần giữ nguyên).

### 7.2 Xem & xóa đánh giá

`Feedbacks.js` gọi `GET /feedback` để lấy toàn bộ đánh giá kèm thông tin khách sạn + người đánh giá (`feedbackController.js:87-119`, `listFeedbacks`, join `Feedbacks` với `Users` và `Hotels`).

Xóa đánh giá không phù hợp: `handleDelete` (`Feedbacks.js:28-37`) gọi `DELETE /feedback/:id` → `deleteFeedback` (`feedbackController.js:121-135`) — xóa cứng, **không kiểm tra bản ghi có tồn tại trước khi xóa** (không có bước `SELECT` kiểm tra như các controller khác), nên xóa 1 ID không tồn tại vẫn trả về `200 { message: 'Đã xóa phản hồi' }` dù không có gì bị xóa (không lỗi 404) — hành vi hơi khác biệt so với các hàm xóa khác trong hệ thống (`deleteHotel`, `deleteRoom`, `deleteBooking` đều có kiểm tra tồn tại và trả 404 nếu không thấy).

Feedback không có cơ chế "ẩn" (soft-hide) — chỉ có xóa vĩnh viễn.

---

## 8. Cơ chế bảo vệ route Admin

### 8.1 Backend — lớp bảo vệ thật sự

Middleware chính nằm ở `backend/middleware/authMiddleware.js`:

- `verifyToken` (`authMiddleware.js:24-36`): đọc header `Authorization: Bearer <token>` (`extractBearerToken`, `authMiddleware.js:6-18`), verify bằng `jwt.verify(token, process.env.JWT_SECRET)`. Không có token → 401. Token sai/hết hạn → 403. Nếu hợp lệ, gán `req.user = <payload JWT>` rồi `next()`.
- `requireRoles(roles = [])` (`authMiddleware.js:61-75`): là một **higher-order middleware** (factory trả về middleware), kiểm tra `req.user.role` có nằm trong mảng `roles` cho phép không:
  ```js
  const requireRoles = (roles = []) => (req, res, next) => {
    if (!req.user || !req.user.role) return res.status(401).json({ message: 'Không có token' });
    if (!Array.isArray(roles) || roles.length === 0) return next();
    if (!roles.includes(req.user.role)) return res.status(403).json({ message: 'Không có quyền truy cập' });
    return next();
  };
  ```
  Đây chính là middleware được gắn ở tất cả route admin: `requireRoles(['admin','manager'])` cho các thao tác chung, `requireRoles(['admin'])` cho các thao tác nhạy cảm hơn (system settings, quản lý user).
- `isAdmin` (`authMiddleware.js:53-59`) là middleware kiểm tra cứng `role !== 'admin'`, nhưng **không được sử dụng ở bất kỳ route admin nào đã đọc** (các route đều dùng `requireRoles(['admin'])` thay vì `isAdmin`) — có thể là middleware cũ còn sót lại, chưa được dọn dẹp (dead code khả nghi, nên nêu nếu bị hỏi "isAdmin dùng ở đâu?").

**Mọi route ghi/sửa/xóa dữ liệu admin đều bắt buộc đi qua cặp `verifyToken` rồi `requireRoles([...])` theo đúng thứ tự** (verify trước để có `req.user`, sau đó mới kiểm tra role) — ví dụ điển hình `adminRoutes.js:9-11`, `hotelRoutes.js:10-12`, `roomRoutes.js:10-12`, `bookingRoutes.js:16-18`, `userRoutes.js:11-15`, `feedbackRoutes.js:8,10`.

### 8.2 Frontend — chỉ là UX, không phải bảo mật

`AdminRoute.js` (`frontend/.../components/AdminRoute.js:10-16`) chặn việc **render** các trang `/admin/*` nếu chưa đăng nhập hoặc role không phải admin/manager, điều hướng về `/login` hoặc `/`.

**Điểm mấu chốt cần nhấn mạnh khi phản biện**: `AdminRoute` chỉ ẩn giao diện trên trình duyệt. Nó **hoàn toàn không ngăn được** một người dùng có kỹ thuật gọi thẳng API bằng Postman/cURL kèm token hợp lệ nhưng sai role — request đó vẫn được gửi tới server, và **chính `requireRoles` ở backend mới là nơi thực sự chặn** (trả về 401/403). Nếu chỉ dựa vào `AdminRoute` mà backend không có `requireRoles`, hệ thống sẽ có lỗ hổng nghiêm trọng (Broken Access Control). Ở dự án này, may mắn là **mọi route ghi dữ liệu admin đều có `requireRoles` phía backend**, nên FE guard chỉ đóng vai trò trải nghiệm người dùng (ẩn nút, điều hướng sớm) chứ không phải lớp bảo mật.

---

## 9. Bảng toàn bộ API endpoint Admin

| Method | Path đầy đủ | Vai trò | Mô tả | Xử lý tại |
|---|---|---|---|---|
| GET | `/api/admin/dashboard` | admin, manager | Lấy số liệu thống kê Dashboard (doanh thu, booking, công suất, top hotel...) | `adminRoutes.js:9` → `adminController.js:53` |
| GET | `/api/admin/system-settings` | admin | Lấy cấu hình email gửi hệ thống | `adminRoutes.js:10` → `adminController.js:251` |
| PUT | `/api/admin/system-settings` | admin | Cập nhật email gửi hệ thống | `adminRoutes.js:11` → `adminController.js:262` |
| POST | `/api/hotels` | admin, manager | Tạo khách sạn | `hotelRoutes.js:10` → `hotelController.js:353` |
| PUT | `/api/hotels/:id` | admin, manager | Sửa khách sạn | `hotelRoutes.js:11` → `hotelController.js:414` |
| DELETE | `/api/hotels/:id` | admin, manager | Xóa khách sạn (cascade Feedbacks/Bookings/Rooms) | `hotelRoutes.js:12` → `hotelController.js:490` |
| POST | `/api/rooms` | admin, manager | Tạo phòng | `roomRoutes.js:10` → `roomController.js:46` |
| PUT | `/api/rooms/:id` | admin, manager | Sửa phòng | `roomRoutes.js:11` → `roomController.js:93` |
| DELETE | `/api/rooms/:id` | admin, manager | Xóa phòng (cascade Bookings) | `roomRoutes.js:12` → `roomController.js:157` |
| GET | `/api/bookings/all` | admin, manager | Xem toàn bộ booking hệ thống | `bookingRoutes.js:16` → `bookingController.js:340` |
| PUT | `/api/bookings/:id/status` | admin, manager | Đổi trạng thái booking (confirm/cancel), tự set refunded nếu đã paid | `bookingRoutes.js:17` → `bookingController.js:375` |
| DELETE | `/api/bookings/:id` | admin, manager | Xóa cứng booking | `bookingRoutes.js:18` → `bookingController.js:277` |
| GET | `/api/users` | admin, manager | Danh sách user (đã lọc soft-delete) | `userRoutes.js:11` → `userController.js:68` |
| POST | `/api/users` | admin | Tạo user mới | `userRoutes.js:12` → `userController.js:85` |
| PUT | `/api/users/:id` | admin | Sửa thông tin user, đổi mật khẩu/role | `userRoutes.js:13` → `userController.js:146` |
| PATCH | `/api/users/:id/lock` | admin | Khóa tài khoản | `userRoutes.js:14` → `userController.js:216` |
| PATCH | `/api/users/:id/unlock` | admin | Mở khóa + reset failed_attempts | `userRoutes.js:15` → `userController.js:243` |
| GET | `/api/feedback` | admin, manager | Danh sách toàn bộ feedback (join hotel/user) | `feedbackRoutes.js:8` → `feedbackController.js:87` |
| DELETE | `/api/feedback/:id` | admin, manager | Xóa feedback (không kiểm tra tồn tại trước) | `feedbackRoutes.js:10` → `feedbackController.js:121` |

---

## 10. Câu hỏi phản biện thường gặp & cách trả lời

**1. Nếu admin tự khóa tài khoản admin duy nhất (hoặc khóa hết mọi admin) thì sao?**
> Trả lời trung thực: Đây là hạn chế thật của hệ thống. `lockUser` (`userController.js:216-241`) không kiểm tra `req.user.id !== req.params.id` (chặn tự khóa chính mình) cũng không đếm xem còn admin `active` nào khác không. Về lý thuyết có thể dẫn tới tình huống không còn ai đăng nhập được để mở khóa lại, phải sửa trực tiếp trong DB (`UPDATE Users SET status='active' WHERE role='admin'`). Hướng cải thiện: thêm điều kiện chặn tự khóa bản thân, và/hoặc kiểm tra `COUNT(*) FROM Users WHERE role='admin' AND status='active'` > 1 trước khi cho khóa.

**2. Xóa khách sạn có xóa luôn booking/phòng liên quan không (cascade)?**
> Có. `deleteHotel` (`hotelController.js:490-555`) chạy trong `withTransaction`, xóa theo đúng thứ tự: `Feedbacks` → `Bookings` → `Rooms` → `Hotels`. Nếu bất kỳ bước nào lỗi, transaction rollback toàn bộ, đảm bảo không để lại dữ liệu "mồ côi". Tương tự, xóa phòng (`deleteRoom`, `roomController.js:157-204`) cũng cascade xóa `Bookings` liên quan tới phòng đó trước khi xóa phòng.

**3. Làm sao đảm bảo chỉ admin (hoặc admin/manager) mới gọi được các API này?**
> Hai lớp: (1) Frontend `AdminRoute.js` chặn hiển thị trang nếu role không hợp lệ — chỉ là UX. (2) Backend gắn middleware `verifyToken` (xác thực JWT) rồi `requireRoles([...])` (`authMiddleware.js:61-75`) trên từng route — đây mới là lớp chặn thật, trả về 401 nếu thiếu token, 403 nếu sai role. Kẻ tấn công gọi thẳng API bằng Postman với token của user thường vẫn bị chặn ở đây.

**4. Thống kê doanh thu có tính cả booking đã hủy không?**
> Không. `revenuePaid`, `revenuePending`, `trend_revenue`, `top_hotels`, `methods_paid_revenue` đều lọc `confirmed.filter(isCollected)` hoặc dựa trên mảng `confirmed` (`adminController.js:113, 122-129, 156-192`) — chỉ tính trên booking có `status === 'confirmed'`. Booking `cancelled` chỉ xuất hiện trong `summary.cancelled` (đếm số lượng) và trong `refunds` nếu có `payment_status === 'refunded'` (`adminController.js:131-133`) — tức tiền hoàn lại được trừ ra khỏi lợi nhuận (`profit = revenuePaid - refunds`, dòng 224) chứ không cộng vào doanh thu.

**5. Vì sao trang quản lý khách sạn/phòng lại gọi API `/hotels`, `/rooms` chứ không phải `/admin/hotels`?**
> Vì kiến trúc dự án tách API theo **tài nguyên (resource)** chứ không theo **vai trò (role)**: cùng một route `/api/hotels` phục vụ cả khách vãng lai (GET công khai) lẫn admin (POST/PUT/DELETE có `requireRoles`). `adminRoutes.js` chỉ dành cho các chức năng không thuộc về tài nguyên cụ thể nào (dashboard tổng hợp nhiều bảng, cấu hình hệ thống toàn cục).

**6. Đổi vai trò (role) người dùng thực hiện thế nào? UI có hỗ trợ không?**
> Backend có hỗ trợ đầy đủ: `PUT /api/users/:id` (`userController.js:146-214`) nhận field `role` và cập nhật trực tiếp, chỉ admin được phép gọi (`userRoutes.js:13`). Tuy nhiên trang `Users.js` hiện tại **chưa có UI** (dropdown/nút) để đổi role — chỉ hiển thị badge role hiện tại (`Users.js:152-154`) và các nút khóa/mở khóa/đổi mật khẩu. Muốn đổi role hiện phải gọi API trực tiếp. Đây là điểm cần trả lời trung thực nếu bị hỏi, không nên nói "có" nếu chưa kiểm tra UI thực tế.

**7. Middleware `isAdmin` và `requireRoles` khác nhau thế nào, dự án dùng cái nào cho admin routes?**
> `isAdmin` (`authMiddleware.js:53-59`) là hàm cố định, chỉ chấp nhận đúng role `'admin'`. `requireRoles(roles)` (`authMiddleware.js:61-75`) là factory linh hoạt, nhận mảng role tùy route (`['admin']` hoặc `['admin','manager']`). Toàn bộ route admin trong dự án dùng `requireRoles`, `isAdmin` hiện không được import/sử dụng ở route nào đã kiểm tra — nhiều khả năng là middleware cũ chưa dọn dẹp.

**8. Xóa feedback/booking có kiểm tra bản ghi tồn tại trước khi xóa không? Có nhất quán giữa các module không?**
> Không nhất quán. `deleteHotel`, `deleteRoom`, `deleteBooking` đều `SELECT` kiểm tra tồn tại trước, trả 404 nếu không thấy (`hotelController.js:494-506`, `roomController.js:161-172`, `bookingController.js:279-282`). Riêng `deleteFeedback` (`feedbackController.js:121-135`) xóa thẳng không kiểm tra, luôn trả 200 dù ID không tồn tại. Đây là điểm chưa đồng bộ, nên chỉ ra như một hạn chế khi được hỏi về chất lượng code.

**9. `updateBookingStatus` có giới hạn giá trị `status` được set không?**
> Không có validate enum ở backend (`bookingController.js:375-412`) — bất kỳ chuỗi nào cũng được lưu vào cột `status`. Chỉ có ràng buộc ở tầng UI (`Bookings.js` chỉ gọi với `'confirmed'` hoặc `'cancelled'`). Nếu ai đó gọi thẳng API với `status: "abc"`, dữ liệu vẫn được ghi, có thể phá vỡ logic hiển thị dựa trên 3 trạng thái cố định (`pending/confirmed/cancelled`) ở nơi khác trong hệ thống.
