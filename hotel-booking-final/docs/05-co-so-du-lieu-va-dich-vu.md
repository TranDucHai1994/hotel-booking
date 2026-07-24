# 05. Cơ sở dữ liệu và các Service liên quan


---

## 1. Tổng quan công nghệ dùng cho tầng dữ liệu

Dự án dùng **SQL Server** thông qua driver thuần **`mssql`** (npm package), **KHÔNG dùng ORM** như Sequelize, Prisma hay TypeORM.

Bằng chứng trong code: `backend/config/db.js:1` chỉ `require('mssql')`, không có bất kỳ import ORM nào. Toàn bộ câu lệnh SQL trong dự án (ở `db.js`, `seed.js`, các service, các route) đều là **raw SQL string** kèm parameterized query (`request.input(key, value)` tại `backend/config/db.js:309-311`).

### Vì sao chọn cách này (không dùng ORM)?

- **Kiểm soát chính xác câu SQL chạy ra**: với đồ án học tập, việc thấy rõ từng câu `SELECT/INSERT/UPDATE` giúp dễ debug và dễ giải thích khi phản biện, không bị "hộp đen" như ORM sinh SQL tự động.
- **Không cần định nghĩa model 2 lớp** (model JS + migration file) như ORM, giảm số lượng file phải đồng bộ.
- **Tận dụng trực tiếp tính năng đặc thù của SQL Server** như `MERGE`, `OUTPUT INSERTED.id`, `IF OBJECT_ID(...) IS NULL`, filtered unique index (`WHERE username IS NOT NULL`) — những thứ ORM thường phải viết raw query mới làm được.
- **Nhược điểm phải thừa nhận khi phản biện**: mất tính năng migration có version, không có validation tự động ở tầng model, dễ sai chính tả tên cột vì không có type-checking, phải tự viết lại các đoạn kiểm tra "IF NOT EXISTS" thủ công.

### Quản lý kết nối: Connection Pool + Singleton

`backend/config/db.js:279-297` triển khai pattern **singleton pool**:

```js
let poolPromise = null; // db.js:10

async function connectDB() {
  if (!poolPromise) {                       // db.js:280
    poolPromise = (async () => {
      await ensureDatabaseAndSchema();
      const pool = await new sql.ConnectionPool(getSqlConfig(DEFAULT_DATABASE)).connect();
      return pool;
    })().catch((error) => {
      poolPromise = null;                   // db.js:287 - reset nếu lỗi để lần sau thử lại
      throw error;
    });
  }
  return poolPromise;
}

async function getPool() {
  return connectDB();                        // db.js:296
}
```

- **Singleton**: biến module-level `poolPromise` đảm bảo dù `connectDB()`/`getPool()` được gọi bao nhiêu lần từ nhiều file khác nhau (route, service...), pool kết nối chỉ được tạo **một lần duy nhất**. Các lần gọi sau chỉ `await` lại cùng một Promise đã lưu.
- **Connection Pool**: cấu hình tại `getSqlConfig()` (`db.js:16-40`), phần `pool: { max: 10, min: 0, idleTimeoutMillis: 30000 }` (`db.js:32-36`) — driver `mssql` tự quản lý một tập hợp tối đa 10 kết nối TCP tới SQL Server, tái sử dụng giữa các query thay vì mở/đóng connection cho mỗi request. Đây là lý do bắt buộc phải có pool: mở kết nối TCP + login SQL Server rất tốn thời gian (handshake, auth), nếu mở mới cho mỗi HTTP request thì server sẽ rất chậm và dễ hết tài nguyên (SQL Server giới hạn số connection tối đa).
- Nếu `poolPromise` bị lỗi (ví dụ SQL Server chưa bật), nó được set về `null` (`db.js:287`) để lần gọi tiếp theo có thể thử kết nối lại thay vì bị "kẹt" ở trạng thái lỗi vĩnh viễn.

### Hàm tiện ích `query()` và `withTransaction()`

- `query(text, params, options)` (`backend/config/db.js:304-314`): tạo `sql.Request` (từ pool singleton, hoặc từ transaction nếu có), gán từng tham số qua `request.input(key, value)` để **chống SQL Injection** (parameterized query), rồi thực thi.
- `withTransaction(handler)` (`backend/config/db.js:320-337`): bọc một chuỗi thao tác trong `sql.Transaction`, tự động `commit()` nếu thành công, tự động `rollback()` nếu có lỗi (dùng cho các nghiệp vụ cần tính toàn vẹn, ví dụ đặt phòng phải trừ số lượng phòng trống cùng lúc với tạo booking).

---

## 2. Sơ đồ ERD (dạng text) và chi tiết từng bảng

Toàn bộ schema được định nghĩa dưới dạng chuỗi SQL trong hàm `getSchemaStatements()` tại `backend/config/db.js:50-220`.

### Sơ đồ quan hệ tổng quát

```
Users (1) ────< Bookings >──── (1) Hotels
  │                  │                │
  │                  └──── (1) Rooms ─┘   (Rooms thuộc 1 Hotel)
  │
  ├────< Feedbacks >──── (1) Hotels
  │
  └────< AuditLogs   (ghi log hành động của user)

SystemSettings  (bảng độc lập, không có khóa ngoại - dạng key-value)
```

### 2.1. Bảng `Users` — `backend/config/db.js:53-71`

| Cột | Kiểu | Ghi chú |
|---|---|---|
| id | INT IDENTITY PK | |
| username | NVARCHAR(100) NULL | có unique index filtered (cho phép nhiều NULL) |
| role | NVARCHAR(20) DEFAULT 'customer' | admin / manager / customer |
| status | NVARCHAR(20) DEFAULT 'active' | active / locked... |
| deleted_at | DATETIME2 NULL | soft delete |
| failed_attempts | INT DEFAULT 0 | đếm số lần đăng nhập sai để khoá tài khoản |
| full_name, email, phone | NVARCHAR | email là bắt buộc + unique |
| password_hash | NVARCHAR(255) | lưu hash bcrypt, không lưu plaintext |
| refresh_token_hash / refresh_token_expiry | | phục vụ cơ chế refresh token JWT |
| reset_password_token_hash / reset_password_expiry | | phục vụ quên mật khẩu |
| created_at, updated_at | DATETIME2 DEFAULT SYSUTCDATETIME() | |

Index: `UQ_Users_Email` (`db.js:196-197`), `UQ_Users_Username` — **unique index có điều kiện** `WHERE username IS NOT NULL` (`db.js:199-200`), cho phép nhiều user có `username = NULL` mà không vi phạm unique.

### 2.2. Bảng `Hotels` — `backend/config/db.js:74-89`

Cột chính: `name`, `city`, `address`, `description`, `property_type` (hotel/resort/villa...), `star_rating`, `is_hot_deal` (BIT), `hot_deal_discount_percent`, `amenities` (NVARCHAR(MAX) lưu **JSON dạng chuỗi**, mặc định `'[]'`), `cover_image`, `images` (cũng JSON string).

→ Đây là điểm đáng chú ý khi phản biện: **SQL Server không có kiểu JSON/array gốc** như PostgreSQL, nên `amenities`/`images` được lưu dưới dạng chuỗi JSON trong cột NVARCHAR(MAX), và tầng ứng dụng (`JSON.stringify`/`JSON.parse`, xem `utils/sql.js` với hàm `parseJsonArray` được dùng ở `backend/scripts/backfill-hotels.js:3,75-76`) chịu trách nhiệm encode/decode.

### 2.3. Bảng `Rooms` — `backend/config/db.js:92-104`, FK tại `db.js:107-110`

Cột chính: `hotel_id` (FK), `room_type`, `max_guests`, `price_per_night` (DECIMAL(18,2)), `total_quantity`, `status` (available/maintenance/inactive), `description`, `amenities` (JSON string).

```sql
-- db.js:107-110
ALTER TABLE dbo.Rooms ADD CONSTRAINT FK_Rooms_Hotels
  FOREIGN KEY (hotel_id) REFERENCES dbo.Hotels(id) ON DELETE CASCADE
```

→ Xoá 1 Hotel sẽ **tự động xoá luôn toàn bộ Rooms** của khách sạn đó (CASCADE).

Index đáng chú ý: `UQ_Rooms_HotelRoomType` (`db.js:202-203`) — mỗi khách sạn không được có 2 loại phòng trùng tên (`hotel_id + room_type` là unique).

### 2.4. Bảng `Bookings` — `backend/config/db.js:113-132`, FK tại `db.js:135-148`

Cột chính: `user_id` (FK, NULL được — cho phép đặt phòng không cần tài khoản/guest), `hotel_id`, `room_id`, `guest_name/email/phone` (lưu lại thông tin khách ngay tại thời điểm đặt, không phụ thuộc bảng Users), `booking_source` (account/guest), `check_in`, `check_out` (kiểu DATE), `guests`, `total_amount`, `status` (pending/confirmed/cancelled), `payment_method`, `payment_status`, `customer_note`.

3 khóa ngoại:
```sql
-- db.js:135-138: nếu xoá User thì user_id trong Booking chỉ set về NULL (giữ lại lịch sử booking)
FK_Bookings_Users  FOREIGN KEY (user_id)  REFERENCES Users(id)  ON DELETE SET NULL
-- db.js:140-143: xoá Hotel thì xoá luôn các Booking liên quan
FK_Bookings_Hotels FOREIGN KEY (hotel_id) REFERENCES Hotels(id) ON DELETE CASCADE
-- db.js:145-148: xoá Room KHÔNG được phép nếu còn Booking tham chiếu (tránh mất dữ liệu lịch sử)
FK_Bookings_Rooms  FOREIGN KEY (room_id)  REFERENCES Rooms(id)  ON DELETE NO ACTION
```

→ Đây là điểm thiết kế hay để nêu khi phản biện: 3 FK cùng trỏ tới dữ liệu "cha" nhưng có 3 hành vi ON DELETE khác nhau (SET NULL / CASCADE / NO ACTION), thể hiện tư duy: dữ liệu booking phải được bảo toàn (không mất lịch sử) ngay cả khi user/room bị xoá.

Index: `IX_Bookings_RoomDateStatus` (room_id, check_in, check_out, status) — phục vụ truy vấn kiểm tra phòng trống theo ngày; `IX_Bookings_UserCreatedAt` — phục vụ lấy lịch sử đặt phòng của 1 user, sắp theo thời gian mới nhất (`db.js:208-212`).

### 2.5. Bảng `Feedbacks` — `backend/config/db.js:151-159`, FK tại `db.js:162-170`

Cột: `user_id`, `hotel_id`, `rating` (INT), `content`. Cả 2 FK đều `ON DELETE CASCADE` — xoá User hoặc Hotel thì feedback liên quan cũng biến mất.

Index `UQ_Feedbacks_UserHotel` (`db.js:214-215`): **mỗi user chỉ được đánh giá 1 khách sạn đúng 1 lần** (unique trên cặp user_id + hotel_id).

### 2.6. Bảng `AuditLogs` — `backend/config/db.js:173-180`, FK tại `db.js:190-193`

Cột: `user_id` (NULL được), `action` (chuỗi mô tả hành động, VD "LOGIN", "CREATE_BOOKING"), `entity` (tên đối tượng bị tác động, VD "Booking"), `entity_id`, `timestamp` (mặc định giờ hiện tại UTC).

```sql
-- db.js:190-193
FK_AuditLogs_Users FOREIGN KEY (user_id) REFERENCES Users(id) ON DELETE SET NULL
```

### 2.7. Bảng `SystemSettings` — `backend/config/db.js:183-187`

Bảng dạng **key-value**, PK chính là cột `[key]` (NVARCHAR(100)), `[value]` là NVARCHAR(MAX), `updated_at`. Không có khóa ngoại — đây là bảng cấu hình động, độc lập với các bảng nghiệp vụ khác.

---

## 3. Cơ chế `ensureDatabaseAndSchema` / `connectDB` — tự tạo DB và bảng khi khởi động

Toàn bộ logic nằm trong `backend/config/db.js:227-273`, được gọi bên trong `connectDB()` (`db.js:282`) — nghĩa là **mỗi khi server khởi động và có request đầu tiên cần DB**, hàm này chạy tự động, không cần chạy lệnh migrate thủ công.

Các bước:

1. **Bước 1 — Tạo Database nếu chưa có** (`db.js:229-241`): mở một `ConnectionPool` trỏ vào database hệ thống `master` (database luôn tồn tại sẵn trên mọi instance SQL Server), rồi chạy:
   ```sql
   IF DB_ID(N'HotelBooking') IS NULL
   BEGIN
     CREATE DATABASE [HotelBooking];
   END;
   ```
   (`db.js:233-236`). Đóng pool `master` ngay sau đó (`db.js:240`).

2. **Bước 2 — Tạo bảng/index** (`db.js:243-272`): mở pool mới trỏ thẳng vào database `HotelBooking`, sau đó lặp qua từng câu lệnh trong `getSchemaStatements()` (`db.js:246-264`) và chạy **tuần tự từng statement một** bằng `appPool.request().batch(statement)` (`db.js:253`). Mỗi câu lệnh CREATE TABLE đều có `IF OBJECT_ID(...) IS NULL` bao ngoài, mỗi ALTER TABLE thêm FK đều có `IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys ...)`, và mỗi CREATE INDEX đều có `IF NOT EXISTS (SELECT 1 FROM sys.indexes ...)` — nên **chạy lại nhiều lần không gây lỗi trùng lặp** (idempotent).

3. Nếu 1 statement lỗi vì đã tồn tại ("already exists"), lỗi đó được bỏ qua (`db.js:255-261`); các lỗi khác thì ném ra ngoài và dừng luôn quá trình khởi tạo (`db.js:257-259`).

### Ưu điểm so với dùng migration tool (Flyway/Knex migrations)

- Đơn giản, không cần cài thêm công cụ, không cần học cú pháp migration riêng, phù hợp môi trường đồ án/demo.
- Clone code về, chạy `npm start` là tự có DB + bảng ngay, không cần bước "chạy migrate" riêng — tiện cho việc chấm điểm/deploy nhanh.

### Nhược điểm (phải thừa nhận khi phản biện)

- **Không có version lịch sử của schema**: migration tool như Flyway/Knex lưu lại từng bước thay đổi schema theo thời gian (V1, V2, V3...), biết chính xác DB đang ở "phiên bản" nào, và có thể rollback về version cũ. Cách làm hiện tại chỉ có 1 khối script "trạng thái cuối cùng", không biết được lịch sử đã thay đổi ra sao.
- **Sửa cột đã tồn tại rất khó**: nếu cần đổi kiểu dữ liệu 1 cột đã có dữ liệu (VD đổi NVARCHAR(100) thành NVARCHAR(200)), đoạn `IF OBJECT_ID(...) IS NULL` sẽ không chạy lại (vì bảng đã tồn tại), nên phải tự viết thêm `ALTER COLUMN` thủ công — không có cơ chế tự động phát hiện & áp dụng thay đổi cột như migration tool.
- **Rủi ro race-condition** nếu nhiều instance server cùng khởi động song song (xem mục 10, câu hỏi phản biện).
- Không phù hợp cho production nhiều người dùng đồng thời sửa schema — migration tool có cơ chế khóa (migration lock) để tránh 2 người chạy migrate cùng lúc.

---

## 4. `seed.js` — sinh dữ liệu mẫu

File: `backend/seed.js`

### Cách hoạt động tổng quan

- Không dùng thư viện sinh dữ liệu giả chuyên dụng (như `faker.js`) — dữ liệu mẫu "cứng" (hotelsSeed, roomsSeed... khai báo tay từ dòng 5–247), sau đó hàm `buildLargeDemoData()` (`seed.js:253-430`) **tự sinh thêm dữ liệu lớn bằng vòng lặp + mảng template** (tên thành phố, tên khách sạn, loại phòng...) để có dữ liệu phong phú cho demo biểu đồ thống kê.
- Số lượng dữ liệu sinh ra:
  - **Users**: 4 user mẫu cố định (admin, manager, 2 customer) + **80 customer** được sinh vòng lặp (`seed.js:256-273`, biến `demo.customer1..80`).
  - **Hotels**: 3 hotel mẫu cố định + sinh thêm theo **8 thành phố × 6 tên gọi (descriptor)** = 48 hotel nữa (`seed.js:277-304`), tổng ~51 khách sạn.
  - **Rooms**: mỗi hotel sinh thêm có 4 loại phòng theo `roomTemplates` (`seed.js:306-329`).
  - **Bookings**: sinh theo từng tháng trong **42 tháng gần nhất (~3.5 năm)** (`seed.js:338-417`) với số lượng dao động theo mùa (Tết, hè, cuối năm) để biểu đồ doanh thu theo tháng/năm có xu hướng thực tế, không phẳng.
  - **Feedbacks**: 2 mẫu cố định + 160 feedback sinh thêm (`seed.js:419-429`).
- **Cơ chế upsert**: mỗi hàm `upsertUser/upsertHotel/upsertRoom/upsertBooking/upsertFeedback` (`seed.js:438-872`) đều SELECT kiểm tra tồn tại trước, nếu có thì UPDATE, chưa có thì INSERT — nên **chạy `node seed.js` nhiều lần không tạo dữ liệu trùng lặp**.

### Hash mật khẩu

Dùng thư viện **`bcryptjs`** (`seed.js:2`, `require('bcryptjs')`). Mật khẩu được hash trước khi lưu:
```js
// seed.js:439
const passwordHash = await bcrypt.hash(item.password, 10); // độ khó (salt rounds) = 10
```
Tài khoản admin mẫu: `admin@hotelbooking.local`, mật khẩu gốc là chuỗi `"123"` (chỉ dùng cho môi trường demo/đồ án — xem `seed.js:11`), sau khi hash mới lưu vào cột `password_hash`, **không bao giờ lưu plaintext**.

---

## 5. `reset-db.js` — xoá và tạo lại database

File: `backend/reset-db.js`

Logic (`resetDatabase()`, dòng 32-62):
1. Kết nối vào DB `master`.
2. Chạy:
   ```sql
   ALTER DATABASE [HotelBooking] SET SINGLE_USER WITH ROLLBACK IMMEDIATE;
   DROP DATABASE [HotelBooking];
   ```
   (`reset-db.js:40-41`) — `SET SINGLE_USER WITH ROLLBACK IMMEDIATE` ép **ngắt kết nối mọi session khác** đang dùng DB đó và huỷ ngay các transaction dở dang, để `DROP DATABASE` chắc chắn thực hiện được (nếu không, DROP có thể bị chặn vì còn connection khác đang mở).
3. Tạo lại `CREATE DATABASE [HotelBooking]` rỗng (`reset-db.js:56`) — **chưa có bảng nào**, phải chạy lại server (để trigger `ensureDatabaseAndSchema`) hoặc `seed.js` để có schema + dữ liệu trở lại.

### CẢNH BÁO khi dùng

- Đây là **lệnh phá huỷ dữ liệu không thể hoàn tác** — toàn bộ Users, Hotels, Rooms, Bookings, Feedbacks, AuditLogs, SystemSettings đều mất sạch.
- Chỉ nên chạy khi: schema bị lỗi cần làm lại từ đầu, hoặc muốn dọn sạch dữ liệu demo/rác để seed lại cho sạch.
- **Tuyệt đối không chạy trên database production/thật có dữ liệu khách hàng thật**.
- Nên có thói quen export dữ liệu ra trước bằng `export-sql-dump.js` (mục 6) nếu cần backup trước khi reset.

---

## 6. Hai script trong `backend/scripts/`

### 6.1. `backfill-hotels.js`

File: `backend/scripts/backfill-hotels.js`

Dùng để **vá dữ liệu cũ** — với các bản ghi Hotel đã tồn tại từ trước (có thể được tạo khi cột `property_type`, `star_rating`, `is_hot_deal` chưa tồn tại hoặc đang NULL), script sẽ:
- Lấy toàn bộ Hotels (`backfill-hotels.js:14`).
- Với mỗi hotel, kiểm tra từng cột: nếu `property_type` rỗng thì gán ngẫu nhiên 1 giá trị từ `TYPES` (`backfill-hotels.js:29-32`); nếu `star_rating` NULL thì gán ngẫu nhiên từ `STAR_VALUES` (`backfill-hotels.js:34-37`); nếu `is_hot_deal` NULL thì random 25% là hot deal (`backfill-hotels.js:39-42`); đồng bộ lại `hot_deal_discount_percent` cho khớp với `is_hot_deal` (`backfill-hotels.js:44-52`).
- Chỉ UPDATE nếu có thay đổi (`changed = true`, dòng 54).

→ Đây là ví dụ thực tế của việc **thay đổi schema sau khi đã có dữ liệu** — vì dự án không dùng migration tool chuẩn, khi thêm cột mới vào bảng đã có dữ liệu, phải tự viết script "backfill" riêng để lấp dữ liệu cũ, thay vì migration tool có cơ chế default value/transform tự động.

### 6.2. `export-sql-dump.js`

File: `backend/scripts/export-sql-dump.js`

Dùng để **xuất toàn bộ schema + dữ liệu hiện tại thành 1 file .sql** (`database/hotel_booking_full.sql`, xác nhận `export-sql-dump.js:7`), dùng để nộp bài/bàn giao/backup, có thể chạy lại bằng SSMS hoặc `sqlcmd` trên máy khác để dựng lại y hệt database (`export-sql-dump.js:94-97`).

Cách hoạt động:
- Lấy sẵn các câu CREATE TABLE từ `getSchemaStatements()` trong `db.js` (dùng lại đúng 1 nguồn schema, không viết trùng lặp) — `export-sql-dump.js:86-87`.
- Với từng bảng trong danh sách `TABLES` (Users, Hotels, Rooms, Bookings, Feedbacks, SystemSettings — **KHÔNG export AuditLogs** vì chỉ là log phát triển, không phải dữ liệu demo — comment tại `export-sql-dump.js:11-12`), SELECT toàn bộ dữ liệu và build câu `INSERT INTO ... VALUES (...)` theo lô 200 dòng/lần (`ROWS_PER_INSERT = 200`, dòng 9, hàm `buildInsertStatements` dòng 43-61).
- Có `SET IDENTITY_INSERT dbo.<table> ON/OFF` bao quanh (`export-sql-dump.js:70-77`) để cho phép chèn thẳng giá trị `id` (cột IDENTITY tự tăng) đúng như dữ liệu gốc, giữ nguyên các khóa ngoại tham chiếu.
- Ghi file ra `database/hotel_booking_full.sql` (kích thước thực tế hiện tại khoảng ~527KB theo `database/` folder).

---

## 7. `auditService.js` — ghi log hành động

File: `backend/services/auditService.js`

```js
// auditService.js:3-20
async function logAudit({ userId = null, action, entity, entityId = null }) {
  try {
    await query(
      `INSERT INTO dbo.AuditLogs (user_id, action, entity, entity_id)
       VALUES (@userId, @action, @entity, @entityId);`,
      { userId: userId || null, action, entity, entityId: entityId ? String(entityId) : null }
    );
  } catch {
    // Do not block the main flow if audit logging fails.
  }
}
```

- Bảng `AuditLogs` lưu: **ai** (`user_id`), **làm gì** (`action` — chuỗi mô tả nghiệp vụ, ví dụ "LOGIN", "CREATE_BOOKING", "DELETE_HOTEL"...), **trên đối tượng nào** (`entity` + `entity_id`), và **khi nào** (`timestamp`, tự động gán `SYSUTCDATETIME()` theo default của cột, `db.js:179`).
- Điểm quan trọng cần nêu khi phản biện: khối `try/catch` bọc quanh insert (`auditService.js:4-19`) và **catch rỗng, không throw lại** (`auditService.js:17-19`) — có nghĩa là **nếu ghi audit log thất bại (VD mất kết nối DB tạm thời), luồng nghiệp vụ chính (đăng nhập, đặt phòng...) vẫn tiếp tục chạy bình thường, không bị chặn lại**. Đây là đánh đổi có chủ đích: ưu tiên trải nghiệm người dùng hơn là đảm bảo 100% log được ghi.
- `entityId` được ép về `String(entityId)` (`auditService.js:14`) vì cột `entity_id` trong bảng là `NVARCHAR(50)` (`db.js:178`) — audit log dùng chung 1 cột string để lưu ID của nhiều loại entity khác nhau (Booking, Hotel, User...) nên không thể dùng kiểu INT cụ thể.

---

## 8. `systemSettingsService.js` — cấu hình hệ thống động (key-value)

File: `backend/services/systemSettingsService.js`

Thay vì hardcode các giá trị cấu hình có thể thay đổi (ví dụ: email dùng để gửi thông báo hệ thống) ngay trong code, dự án lưu chúng trong bảng `SystemSettings` (mục 2.7) dưới dạng **key-value**, cho phép **admin thay đổi cấu hình qua giao diện quản trị mà không cần sửa code / deploy lại**.

```js
// systemSettingsService.js:3-5
const SYSTEM_SETTING_KEYS = {
  EMAIL_SENDER: 'email_sender',
};
```

- `getSettingValue(key, fallback)` (`systemSettingsService.js:7-23`): SELECT giá trị theo `key`, nếu không có/rỗng thì trả về `fallback` mặc định (dòng 18-20) — đảm bảo hệ thống vẫn chạy được ngay cả khi admin chưa cấu hình gì.
- `upsertSettingValue(key, value)` (`systemSettingsService.js:25-41`): dùng câu lệnh **`MERGE`** của SQL Server — kết hợp UPDATE nếu key đã tồn tại, INSERT nếu chưa có, trong **1 câu lệnh SQL nguyên tử duy nhất**, tránh phải viết 2 bước SELECT rồi IF/ELSE ở tầng ứng dụng (giảm race-condition khi 2 request cùng ghi 1 key đồng thời).
- Ứng dụng thực tế trong dự án: `email_sender` — địa chỉ email hệ thống dùng làm "From" khi gửi mail (xác nhận đặt phòng, quên mật khẩu...), có thể đổi qua bảng `SystemSettings` mà không cần sửa `.env` hay deploy lại code.

---

## 9. Danh sách biến môi trường (`.env`)

**Lưu ý bảo mật**: bảng dưới đây chỉ liệt kê **tên biến và mục đích sử dụng**, giá trị thật (mật khẩu SQL, secret JWT, mật khẩu SMTP) **không được ghi ra tài liệu này**. Ví dụ minh hoạ dùng placeholder giả (`your_value_here`).

| Biến | Mục đích | Ví dụ (giả, không phải giá trị thật) |
|---|---|---|
| `PORT` | Cổng HTTP server backend Express lắng nghe | `4000` |
| `JWT_SECRET` | Khóa bí mật dùng để ký/xác thực JSON Web Token (access token đăng nhập) | `your_value_here` |
| `SQL_SERVER` | Địa chỉ host của SQL Server | `127.0.0.1` |
| `SQL_INSTANCE` | Tên instance SQL Server (khi dùng named instance thay vì port cố định), dùng SQL Browser để resolve port động (`db.js:6,21-24,30`) | `SQL1` |
| `SQL_PORT` | Cổng TCP cố định của SQL Server (nếu không dùng instance name) | `1433` |
| `SQL_DATABASE` | Tên database ứng dụng sẽ tự tạo/kết nối vào | `HotelBooking` |
| `SQL_USER` | Username đăng nhập SQL Server | `sa` |
| `SQL_PASSWORD` | Mật khẩu đăng nhập SQL Server — **nhạy cảm, không log/commit giá trị thật** | `your_value_here` |
| `SQL_ENCRYPT` | Bật/tắt mã hoá kết nối TCP tới SQL Server (true/false) | `false` |
| `SQL_TRUST_SERVER_CERTIFICATE` | Có tin tưởng certificate tự ký của SQL Server hay không (thường bật `true` khi dev local) | `true` |
| `SQL_POOL_MAX` | Số connection tối đa trong pool (`db.js:33`) | `10` |
| `SQL_CONNECTION_TIMEOUT` | Thời gian chờ tối đa khi mở kết nối (ms) | `15000` |
| `SQL_REQUEST_TIMEOUT` | Thời gian chờ tối đa cho 1 câu query (ms) | `30000` |
| `EMAIL_TRANSPORT` | Loại cơ chế gửi mail (vd `smtp`) | `smtp` |
| `SMTP_HOST` | Địa chỉ máy chủ SMTP dùng để gửi email | `smtp.gmail.com` |
| `SMTP_PORT` | Cổng kết nối SMTP | `587` |
| `SMTP_SECURE` | Có dùng kết nối bảo mật (SSL) khi gửi mail hay không | `false` |
| `SMTP_USER` | Tài khoản email dùng để đăng nhập SMTP gửi mail hệ thống — **nhạy cảm** | `your_value_here` |
| `SMTP_PASS` | Mật khẩu / app-password của tài khoản SMTP — **nhạy cảm, tuyệt đối không public** | `your_value_here` |

> Ghi chú thêm: file `.env` thực tế của dự án hiện có `SMTP_USER`/`SMTP_PASS` chứa thông tin tài khoản Gmail thật (dùng app password) — đây là **rủi ro bảo mật thực tế** cần lưu ý: file `.env` không nên bị commit lên Git công khai hoặc chia sẻ ra ngoài. Nên kiểm tra `.gitignore` đã loại trừ `.env` chưa và đổi lại app-password nếu từng bị lộ.

---

## 10. Câu hỏi phản biện thường gặp & cách trả lời

**1. Tại sao không dùng ORM (Sequelize/Prisma/TypeORM)?**
> Vì đồ án ưu tiên việc hiểu và kiểm soát trực tiếp câu SQL chạy trên SQL Server, tận dụng các tính năng đặc thù (MERGE, OUTPUT INSERTED, filtered index) mà không phải học thêm lớp trừu tượng của ORM. Đánh đổi là mất type-safety tự động và phải tự viết logic kiểm tra tồn tại bảng/cột thủ công (xem `getSchemaStatements()` tại `backend/config/db.js:50-220`).

**2. Tại sao không dùng migration tool chuẩn (Flyway, Knex migrations)?**
> Vì quy mô đồ án nhỏ, ưu tiên chạy nhanh (`npm start` là có DB ngay, xem `ensureDatabaseAndSchema` tại `db.js:227-273`), không cần theo dõi lịch sử version schema. Hạn chế thật sự: không rollback được theo version, sửa cột đã có dữ liệu phải viết script backfill riêng (ví dụ `backend/scripts/backfill-hotels.js`) thay vì migration tool tự động áp dụng.

**3. Connection Pool là gì, vì sao cần?**
> Là một tập hợp kết nối TCP tới SQL Server được mở sẵn và tái sử dụng, thay vì mở/đóng kết nối mới cho mỗi truy vấn (`db.js:32-36`, cấu hình `max: 10`). Cần vì mở kết nối SQL Server tốn chi phí (TCP handshake + login) và SQL Server giới hạn số kết nối đồng thời; dùng pool giúp phục vụ nhiều request cùng lúc mà không tạo/hủy connection liên tục.

**4. AuditLog có bị mất khi hệ thống lỗi/rollback không?**
> `logAudit()` (`auditService.js:3-20`) không nằm trong transaction chính của nghiệp vụ, và có `try/catch` nuốt lỗi (`auditService.js:17-19`). Vì vậy: (a) nếu chính bản thân insert AuditLog lỗi, nó không làm sập luồng chính; (b) nhưng ngược lại, nếu luồng nghiệp vụ chính bị rollback (transaction thất bại) SAU KHI đã gọi `logAudit`, log đó **vẫn được ghi** dù nghiệp vụ chính thất bại — vì AuditLog insert độc lập, không nằm trong cùng transaction. Đây là hạn chế cần cải thiện nếu muốn log chính xác 100% theo kết quả nghiệp vụ.

**5. Nếu 2 instance server cùng chạy `ensureDatabaseAndSchema()` song song thì sao?**
> Có rủi ro race-condition thật sự: cả 2 tiến trình có thể cùng thấy `DB_ID(...) IS NULL` là true tại cùng thời điểm và cùng chạy `CREATE DATABASE` (SQL Server sẽ báo lỗi "database already exists" cho tiến trình chạy sau, hoặc với CREATE TABLE tương tự dù có kiểm tra `IF OBJECT_ID(...) IS NULL` vẫn có khe hở giữa lúc kiểm tra và lúc tạo — "check-then-act" không phải là atomic). Trong thực tế với 1 server đơn instance (đúng như cách chạy hiện tại của dự án) việc này không xảy ra; nhưng nếu scale ra nhiều instance (load balancing) thì cần cơ chế khóa riêng (migration lock, hoặc chỉ 1 instance được phép init schema) để tránh xung đột.

**6. Vì sao 3 khóa ngoại trong bảng `Bookings` lại có 3 hành vi ON DELETE khác nhau?**
> Vì mục tiêu là **bảo toàn lịch sử booking** dù dữ liệu tham chiếu bị xoá: xoá User thì booking cũ vẫn giữ (chỉ mất liên kết user_id, set NULL — `db.js:135-138`) vì đã có sẵn `guest_name/guest_email/guest_phone` lưu kèm; xoá Hotel thì hợp lý để xoá luôn booking liên quan vì hotel không còn tồn tại (`db.js:140-143`); còn Room thì **không cho xoá** nếu còn booking tham chiếu (`ON DELETE NO ACTION`, `db.js:145-148`) để tránh mất dữ liệu lịch sử giá phòng/loại phòng đã đặt.

**7. Mật khẩu được bảo vệ như thế nào?**
> Không lưu plaintext. Dùng `bcryptjs` để hash trước khi insert vào cột `password_hash` (`seed.js:2,439`, độ khó salt rounds = 10). Khi đăng nhập, so sánh bằng `bcrypt.compare`, không bao giờ so sánh chuỗi thô.

**8. Vì sao `amenities`/`images` của Hotel/Room lại lưu dạng NVARCHAR(MAX) chứa JSON thay vì tách bảng riêng (chuẩn hoá 3NF)?**
> Vì đây là dữ liệu danh sách đơn giản, ít khi cần JOIN/lọc riêng theo từng amenity, nên chọn cách lưu JSON string để đơn giản hoá schema và truy vấn (denormalization có chủ đích). Đánh đổi: không thể `WHERE amenities LIKE '%WiFi%'` hiệu quả bằng cách có bảng `Amenities` + bảng nối riêng, và mất khả năng đánh index trên từng amenity.
