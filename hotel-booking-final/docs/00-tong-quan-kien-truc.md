# Tổng quan kiến trúc dự án Hotel Booking

## 1. Dự án làm gì

Đây là một **website đặt phòng khách sạn** (Hotel Booking System), gồm 2 phần giao diện dùng chung 1 backend:

- **Customer Portal** (khách hàng): tìm kiếm khách sạn theo địa điểm/ngày/giá/sao/tiện ích, xem chi tiết khách sạn (ảnh, phòng, tiện ích, đánh giá, bản đồ), đặt phòng (có thể đặt không cần đăng nhập — "guest booking"), đăng ký/đăng nhập, xem lịch sử đặt phòng, cập nhật hồ sơ, đổi mật khẩu, nhận email xác nhận đặt phòng.
- **Admin Portal** (quản trị viên): CRUD khách sạn và phòng, quản lý booking (xác nhận/hủy/xóa), quản lý người dùng, quản lý đánh giá, dashboard thống kê doanh thu/tỷ lệ lấp đầy/top khách sạn, cấu hình email gửi xác nhận.

Nghiệp vụ lõi: một khách sạn (`Hotels`) có nhiều loại phòng (`Rooms`), mỗi phòng có số lượng tồn kho (`total_quantity`); khi khách đặt phòng (`Bookings`) trong một khoảng ngày, hệ thống phải tính được phòng đó còn trống bao nhiêu trong khoảng ngày đó để chặn overbooking.

Nguồn: mô tả trong `package.json:4` ("Hotel booking web app with a customer portal and an admin portal") và `README.md:1-18`.

## 2. Kiến trúc tổng thể

```
┌──────────────────────┐        HTTP/JSON (REST, Axios)        ┌───────────────────────┐        TDS protocol (mssql)      ┌────────────────────┐
│   FRONTEND (React)   │  ───────────────────────────────────▶ │   BACKEND (Express)   │ ────────────────────────────────▶ │  SQL Server (RDBMS) │
│ localhost:3000/3005  │ ◀─────────────────────────────────── │   localhost:4000      │ ◀──────────────────────────────── │  DB: HotelBooking   │
└──────────────────────┘        JSON response                 └───────────────────────┘        Recordset / rows          └────────────────────┘
   React Router (SPA)                                             Routes → Middleware →                                    Bảng: Users, Hotels,
   Context API (Auth,                                              Controllers → Raw SQL                                    Rooms, Bookings,
   Theme) + Axios                                                  qua mssql driver                                         Feedbacks, AuditLogs,
                                                                                                                             SystemSettings
```

Đây là kiến trúc **3 lớp (3-tier) client-server tách rời (decoupled)**: Presentation (React SPA) — Application/API (Express REST) — Data (SQL Server). Hai phần Frontend/Backend là hai ứng dụng Node.js độc lập, giao tiếp thuần qua HTTP JSON, không share code runtime.

**Vì sao tách Frontend và Backend thành 2 project riêng (không dùng kiểu server-side rendering gộp chung như truyền thống)?**

- **Độc lập công nghệ & vòng đời phát triển**: FE dùng React (SPA, build ra static file), BE dùng Node/Express (API server) — có thể phát triển, test, deploy, scale riêng từng phần.
- **Tái sử dụng API**: cùng một bộ API `/api/...` có thể phục vụ cả web (React) lẫn sau này mobile app/app khác mà không cần viết lại backend.
- **Phân quyền rõ ràng theo route**: Admin Portal và Customer Portal là 2 nhóm route trong cùng 1 React app (`frontend/my-hotel-app/src/App.js:54-61`) nhưng cùng gọi chung API, được lọc bằng middleware phân quyền (`requireRoles`) ở tầng backend — đảm bảo an toàn tại nguồn dữ liệu, không chỉ ẩn UI.
- **CORS tường minh**: Backend bật `cors()` (`backend/server.js:10`) chính vì FE và BE chạy khác cổng (3000/3005 và 4000), là bằng chứng rõ ràng cho việc 2 phần tách biệt.

## 3. Công nghệ sử dụng và lý do chọn

### Backend (`backend/package.json`)

| Công nghệ | Vai trò | Lý do chọn |
|---|---|---|
| **Express 5** | Web framework, định tuyến HTTP, middleware pipeline | Nhẹ, tối thiểu, phổ biến nhất cho REST API Node.js, dễ tổ chức route/controller/middleware rõ ràng cho đồ án. |
| **mssql** (driver, không phải ORM) | Kết nối và thực thi câu lệnh SQL trực tiếp tới SQL Server, quản lý connection pool | Đồ án yêu cầu SQL Server; dùng driver thuần giúp sinh viên hiểu rõ SQL, kiểm soát chính xác câu truy vấn, tránh "hộp đen" của ORM, dễ tối ưu index/join thủ công. |
| **jsonwebtoken (JWT)** | Sinh và xác thực token đăng nhập (access token), lưu payload gồm id/role | Cơ chế xác thực **stateless**: server không cần lưu session ở bộ nhớ/DB, phù hợp REST API tách rời FE/BE. |
| **bcryptjs** | Băm (hash) mật khẩu trước khi lưu DB | Không bao giờ lưu plain-text password — chuẩn bảo mật tối thiểu bắt buộc phải có. |
| **cors** | Cho phép FE (khác origin/port) gọi API sang BE | Trình duyệt chặn cross-origin request theo mặc định (Same-Origin Policy), phải bật CORS ở BE. |
| **dotenv** | Nạp biến môi trường từ file `.env` (thông tin kết nối DB, JWT secret, SMTP...) | Tách cấu hình nhạy cảm ra khỏi source code, dễ đổi môi trường dev/prod mà không sửa code. |
| **nodemailer** | Gửi email xác nhận đặt phòng (hỗ trợ cả chế độ mock và SMTP thật) | Nghiệp vụ cần thông báo email cho khách khi đặt phòng thành công. |
| **nodemon** (dev) | Tự restart server khi code thay đổi lúc phát triển | Tăng tốc độ dev, không phải thao tác thủ công. |

### Frontend (`frontend/my-hotel-app/package.json`)

| Công nghệ | Vai trò | Lý do chọn |
|---|---|---|
| **React 19** | Thư viện dựng UI theo component, quản lý state | Component hóa giao diện (HotelCard, Navbar...), tái sử dụng cao, hệ sinh thái lớn, dễ học với sinh viên. |
| **react-router-dom** | Định tuyến phía client (SPA), khai báo route trong `App.js` | Cho phép chuyển trang không reload cả trang (trải nghiệm mượt như app), phân tách rõ route khách/route admin. |
| **axios** | Gọi HTTP request tới REST API backend, hỗ trợ interceptor | Có interceptor request/response tiện lợi hơn `fetch` thuần để tự động gắn token và bắt lỗi 401/403 tập trung một chỗ (`frontend/my-hotel-app/src/services/api.js`). |
| **Tailwind CSS** | Utility-first CSS framework | Viết giao diện nhanh, nhất quán, không cần viết file CSS riêng cho từng component, dễ làm dark mode. |
| **Context API** (`AuthContext`, `ThemeContext`) | Quản lý state toàn cục (user đăng nhập, theme sáng/tối) không cần thư viện ngoài (Redux) | Ứng dụng cỡ vừa, state toàn cục không quá phức tạp — Context API của React là đủ, tránh over-engineering. |
| **recharts** | Vẽ biểu đồ (doanh thu, tỷ lệ lấp đầy...) cho Admin Dashboard | Cần trực quan hóa số liệu thống kê cho quản trị viên. |
| **lucide-react / react-icons** | Bộ icon | Giao diện trực quan, đồng bộ style. |
| **react-hot-toast** | Hiển thị thông báo (toast) | UX phản hồi hành động (thêm/sửa/xóa thành công, lỗi...) tức thời. |
| **clsx** | Ghép class CSS có điều kiện | Viết class Tailwind động (ví dụ active/inactive tab) gọn gàng hơn. |

## 4. Cấu trúc thư mục đầy đủ

```
hotel-booking-final/
├── package.json                          # Script gốc: "concurrently" chạy song song backend + frontend (root package.json:7-9)
├── README.md                             # Hướng dẫn cài đặt, seed data, tài khoản demo
├── database/                             # File SQL export sẵn (schema + dữ liệu mẫu) để import nhanh cho đồng đội
│
├── backend/                              # ==== ỨNG DỤNG BACKEND (Node.js + Express) ====
│   ├── server.js                         # Điểm khởi động: tạo app Express, mount route, connect DB rồi mới listen (backend/server.js)
│   ├── .env                              # Biến môi trường: thông tin SQL Server, JWT secret, SMTP...
│   ├── config/
│   │   └── db.js                         # Cấu hình connection pool mssql, tự tạo DB + schema nếu chưa có (ensureDatabaseAndSchema), hàm query()/withTransaction()
│   ├── routes/                           # Khai báo endpoint URL, gắn middleware xác thực/phân quyền, trỏ tới controller
│   │   ├── authRoutes.js                 # /api/auth — đăng ký, đăng nhập, đổi mật khẩu
│   │   ├── userRoutes.js                 # /api/users — hồ sơ người dùng
│   │   ├── hotelRoutes.js                # /api/hotels — tìm kiếm, xem, CRUD khách sạn (backend/routes/hotelRoutes.js)
│   │   ├── roomRoutes.js                 # /api/rooms — quản lý phòng
│   │   ├── bookingRoutes.js              # /api/bookings — luồng đặt phòng
│   │   ├── feedbackRoutes.js             # /api/feedback — đánh giá khách sạn
│   │   └── adminRoutes.js                # /api/admin — API riêng cho khu vực quản trị (dashboard, settings)
│   ├── controllers/                      # Xử lý logic nghiệp vụ chính cho từng route tương ứng
│   │   ├── authController.js             # Đăng ký/đăng nhập: hash password, tạo JWT
│   │   ├── userController.js             # Cập nhật hồ sơ, đổi mật khẩu
│   │   ├── hotelController.js            # Tìm kiếm/lọc khách sạn theo giá/sao/tiện ích/thành phố, CRUD khách sạn
│   │   ├── roomController.js             # CRUD phòng, kiểm tra availability
│   │   ├── bookingController.js          # Tạo booking, kiểm tra tồn kho phòng theo ngày, hủy/xác nhận booking
│   │   ├── feedbackController.js         # Thêm/xem đánh giá
│   │   └── adminController.js            # Số liệu dashboard, quản lý user/settings
│   ├── middleware/
│   │   └── authMiddleware.js             # verifyToken (bắt buộc đăng nhập), requireRoles (phân quyền theo role), optionalToken (backend/middleware/authMiddleware.js)
│   ├── services/                         # Logic dùng chung, tách khỏi controller để tái sử dụng
│   │   ├── emailService.js               # Gửi email xác nhận (mock hoặc SMTP thật qua nodemailer)
│   │   ├── auditService.js               # Ghi log hành động vào bảng AuditLogs
│   │   └── systemSettingsService.js       # Đọc/ghi cấu hình hệ thống (bảng SystemSettings), vd email người gửi
│   ├── utils/
│   │   ├── availability.js               # Tính số phòng còn trống theo khoảng ngày (chống overbooking)
│   │   ├── mappers.js                    # Chuyển đổi record SQL Server (snake_case, JSON string) thành object JS chuẩn cho response
│   │   └── sql.js                        # Hàm tiện ích dựng câu SQL (vd IN clause động)
│   ├── scripts/
│   │   ├── backfill-hotels.js            # Script vá dữ liệu cũ
│   │   └── export-sql-dump.js            # Xuất toàn bộ DB hiện tại ra file database/hotel_booking_full.sql
│   ├── seed.js                           # Script sinh dữ liệu mẫu lớn (89 users, 51 hotels, ~1450 bookings...) để demo
│   └── reset-db.js / test-schema.js      # Script hỗ trợ reset/kiểm tra schema khi phát triển
│
└── frontend/my-hotel-app/                # ==== ỨNG DỤNG FRONTEND (React SPA) ====
    └── src/
        ├── index.js                      # Điểm vào React, render <App /> vào DOM
        ├── App.js                        # "Xương sống" định tuyến: bọc AuthProvider/ThemeProvider/BrowserRouter, khai báo toàn bộ Route (frontend/my-hotel-app/src/App.js)
        ├── context/
        │   ├── AuthContext.js             # State toàn cục: user đang đăng nhập, token, hàm login/logout
        │   └── ThemeContext.js            # State toàn cục: chế độ sáng/tối
        ├── services/
        │   └── api.js                    # Instance Axios dùng chung: tự gắn Bearer token, tự bắt lỗi 401/403 và redirect login (frontend/my-hotel-app/src/services/api.js)
        ├── components/                    # Component dùng lại nhiều nơi (Navbar, Footer, HotelCard, AdminRoute...)
        │   └── AdminRoute.js              # Route Guard: chặn truy cập /admin/* nếu user không phải admin/manager
        ├── pages/                         # Mỗi file là 1 trang, khớp với 1 Route trong App.js
        │   ├── Home.js                    # Trang chủ: tìm kiếm & lọc khách sạn (gọi GET /api/hotels)
        │   ├── HotelDetail.js             # Chi tiết khách sạn, danh sách phòng, đánh giá
        │   ├── BookingPage.js             # Form đặt phòng
        │   ├── Login.js / Register.js     # Đăng nhập / đăng ký
        │   ├── MyBookings.js              # Lịch sử đặt phòng của khách
        │   ├── Profile.js                 # Hồ sơ cá nhân
        │   └── admin/                     # Toàn bộ trang quản trị: Dashboard, Hotels, Rooms, Bookings, Users, Feedbacks
        └── utils/                         # Hàm tiện ích thuần JS (format tiền tệ, tính trạng thái booking, ghép class css)
```

## 5. Luồng khởi động ứng dụng (backend)

Khi chạy `npm start` (hoặc `npm run dev`) trong thư mục `backend`, Node thực thi `backend/server.js`:

1. `backend/server.js:1-4` — nạp `express`, `cors`, `dotenv` (đọc file `.env`) và hàm `connectDB` từ `config/db.js`.
2. `backend/server.js:7` — tạo instance ứng dụng Express: `const app = express();`.
3. `backend/server.js:10` — bật middleware `cors()` để cho phép Frontend (chạy port khác) gọi API.
4. `backend/server.js:13` — bật `express.json()` để parse body JSON của request.
5. `backend/server.js:17-23` — **mount toàn bộ router theo prefix** (`/api/auth`, `/api/users`, `/api/hotels`, `/api/rooms`, `/api/bookings`, `/api/feedback`, `/api/admin`) — mỗi dòng require một file router riêng, đây là điểm thể hiện rõ kiến trúc modular routing.
6. `backend/server.js:26-28` — route gốc `/` trả về JSON kiểm tra server sống.
7. `backend/server.js:37-50` (hàm `startServer`) — đây là phần quan trọng nhất để trả lời "server khởi động ra sao":
   - `backend/server.js:40` — `await connectDB()`: **kết nối DB xong mới cho phép server nhận request**. Đây là chủ đích thiết kế: tránh trường hợp request tới nhưng chưa có DB.
   - `backend/server.js:43-45` — nếu kết nối DB thành công, gọi `app.listen(PORT, ...)` để mở cổng lắng nghe (mặc định 4000, đọc từ `process.env.PORT` tại `backend/server.js:31`).
   - `backend/server.js:46-48` — nếu `connectDB()` ném lỗi (vd sai mật khẩu SQL Server, server chưa bật), log lỗi và `process.exit(1)` để dừng hẳn tiến trình thay vì chạy "nửa vời" không có DB.
8. `backend/server.js:53` — gọi `startServer()` để bắt đầu toàn bộ quy trình trên.

Bên trong `connectDB()` (`backend/config/db.js:279-293`):

- Dùng pattern **Singleton qua `poolPromise`** (`backend/config/db.js:280`) để đảm bảo cả ứng dụng chỉ tạo **một** connection pool duy nhất, không tạo lại pool mỗi lần có request.
- Gọi `ensureDatabaseAndSchema()` (`backend/config/db.js:227-273`) trước: hàm này tự kết nối vào DB `master`, kiểm tra và `CREATE DATABASE` nếu chưa tồn tại (`backend/config/db.js:229-241`), sau đó chạy tuần tự danh sách câu lệnh `CREATE TABLE`/`ALTER TABLE ADD CONSTRAINT`/`CREATE INDEX` lấy từ `getSchemaStatements()` (`backend/config/db.js:50-220`) — mỗi câu lệnh có `IF OBJECT_ID(...) IS NULL` / `IF NOT EXISTS(...)` nên **chạy lại nhiều lần vẫn an toàn (idempotent)**, không lỗi khi bảng đã tồn tại.
- Sau khi schema đã đảm bảo, mở connection pool thật tới DB ứng dụng (`backend/config/db.js:283`) và trả về pool đó cho toàn bộ ứng dụng dùng chung qua `getPool()` (`backend/config/db.js:295-297`).

## 6. Luồng dữ liệu tổng quát: ví dụ "người dùng tìm kiếm khách sạn"

Kịch bản: khách vào trang chủ, gõ điểm đến/ngày/giá rồi bấm tìm kiếm.

1. **Frontend — trigger request**: `frontend/my-hotel-app/src/pages/Home.js:171-197`, `useEffect` theo dõi `searchParams` trên URL; khi thay đổi, hàm `fetchHotels` gọi `api.get('/hotels', { params: {...} })` tại `frontend/my-hotel-app/src/pages/Home.js:177-187`.
2. **Frontend — Axios instance**: request đi qua interceptor tại `frontend/my-hotel-app/src/services/api.js:15-19`, tự động gắn header `Authorization: Bearer <token>` nếu người dùng đã đăng nhập (dù trang tìm kiếm không bắt buộc đăng nhập); `baseURL` là `http://localhost:4000/api` (`frontend/my-hotel-app/src/services/api.js:11`) → request thật gửi tới `GET http://localhost:4000/api/hotels?location=...&check_in=...`.
3. **Backend — routing**: Express nhận request, khớp với `app.use('/api/hotels', ...)` (`backend/server.js:19`), vào `backend/routes/hotelRoutes.js:6` — route `GET /` (không yêu cầu token) trỏ vào `ctrl.getHotels`.
4. **Backend — controller xử lý nghiệp vụ**: `backend/controllers/hotelController.js:155` (`exports.getHotels`):
   - Đọc query string, chuẩn hóa filter (`hotelController.js:157-173`).
   - Gọi `getHotelsByKeyword(keyword)` (`hotelController.js:179`, định nghĩa tại `hotelController.js:74`) — hàm này build câu SQL (có xử lý alias tên thành phố tiếng Việt → tiếng Anh trong DB, `hotelController.js:25-72`) và gọi `query(...)` từ `config/db.js`.
   - Lấy thêm danh sách phòng (`getRoomsByHotelIds`) và đánh giá (`getFeedbacksByHotelIds`) theo `hotelIds`, tính số phòng còn trống theo ngày qua `computeRoomAvailability`/`getBookedRoomCountMap` (import tại `hotelController.js:3`, dùng tại `hotelController.js:181-196`) để đảm bảo không hiển thị phòng đã hết chỗ trong khoảng ngày khách chọn.
   - Gộp dữ liệu hotel + rooms + feedbacks thành 1 mảng kết quả (`hotelController.js:205 trở đi`) rồi `res.json(...)`.
5. **Backend — tầng truy cập DB**: hàm `query()` (`backend/config/db.js:304-314`) lấy pool qua `getPool()`, tạo `sql.Request`, bind tham số bằng `request.input(key, value)` (tránh SQL Injection vì dùng parameterized query chứ không nối chuỗi SQL trực tiếp), gửi câu lệnh xuống SQL Server và trả về `recordset`.
6. **Backend — trả response**: dữ liệu SQL (dạng snake_case, một số cột JSON string như `amenities`) được chuẩn hóa qua `mapHotel`/`mapRoom`/`mapFeedback` (`backend/utils/mappers.js`, import tại `hotelController.js:2`) thành object JS chuẩn (camelCase-friendly) trước khi `res.json()` trả về Frontend.
7. **Frontend — nhận và hiển thị**: `res.data` được set vào state `setHotels(res.data)` (`Home.js:188`), kích hoạt re-render, danh sách khách sạn hiển thị qua component `HotelCardPremium`.

## 7. Câu hỏi phản biện thường gặp và cách trả lời

**Q1. Tại sao không dùng ORM (Sequelize/Prisma/TypeORM) mà dùng driver `mssql` thuần?**
Trả lời: Đồ án chủ đích dùng SQL trực tiếp để kiểm soát chính xác câu truy vấn (join nhiều bảng, tính availability theo ngày, tránh N+1 query), và để thể hiện hiểu biết về SQL/thiết kế schema thay vì phụ thuộc "hộp đen" của ORM. Việc parameterized query qua `request.input()` (`backend/config/db.js:309-311`) đã đảm bảo an toàn chống SQL Injection tương đương ORM. Nhược điểm đánh đổi là phải tự viết mapping (`utils/mappers.js`) và tự quản lý migration bằng script `getSchemaStatements()`.

**Q2. Vì sao tách Frontend và Backend thành 2 ứng dụng riêng thay vì server-side rendering gộp chung (như EJS/Pug)?**
Trả lời: Để tách biệt vòng đời phát triển, cho phép cùng 1 API phục vụ nhiều client (web, mobile sau này), và để Frontend là SPA có trải nghiệm chuyển trang mượt (React Router). Cái giá phải trả là phải xử lý CORS (`backend/server.js:10`) và tự quản lý token ở client (`localStorage`), nhưng đây là mô hình chuẩn công nghiệp cho REST API hiện nay.

**Q3. Hệ thống xác thực (authentication) hoạt động ra sao, có an toàn không?**
Trả lời: Dùng JWT stateless — khi đăng nhập, backend băm-so khớp password bằng `bcryptjs` rồi ký token bằng `jsonwebtoken` chứa `id`/`role`. Mỗi request sau đó Frontend tự gắn token vào header `Authorization` (`frontend/my-hotel-app/src/services/api.js:15-19`), backend xác thực bằng middleware `verifyToken` (`backend/middleware/authMiddleware.js:24-36`) giải mã và gán `req.user`. Phân quyền theo role dùng middleware `requireRoles(['admin','manager'])` (`backend/middleware/authMiddleware.js:61-75`), áp lên các route sửa/xóa dữ liệu nhạy cảm (vd `backend/routes/hotelRoutes.js:10-12`). Vì stateless nên không cần lưu session ở server, dễ scale ngang.

**Q4. Làm sao hệ thống tránh overbooking (đặt trùng phòng khi hết chỗ)?**
Trả lời: Mỗi loại phòng có `total_quantity` cố định (`backend/config/db.js:98`). Khi tìm kiếm hoặc đặt phòng trong khoảng ngày cụ thể, hệ thống đếm số booking đã tồn tại đè lên khoảng ngày đó (qua `getBookedRoomCountMap` dùng index `IX_Bookings_RoomDateStatus` tại `backend/config/db.js:208-209`) rồi trừ vào `total_quantity` để tính phòng còn trống thực tế (`backend/utils/availability.js`, gọi tại `backend/controllers/hotelController.js:183-189`) — logic này chạy lại ở tầng đặt phòng (`bookingController.js`) để chặn tạo booking khi phòng đã hết.

**Q5. Nếu muốn scale hệ thống lên (nhiều người dùng hơn) thì làm thế nào?**
Trả lời: Nhờ kiến trúc tách rời, có thể: (1) scale ngang Backend (chạy nhiều instance Express phía sau load balancer) vì xác thực là stateless (JWT), không có session dính node; (2) tách riêng đọc/ghi DB hoặc thêm cache (Redis) cho các API đọc nhiều như tìm kiếm khách sạn; (3) build Frontend thành static file (`npm run build`) và host qua CDN/static server độc lập với Backend; (4) connection pool (`backend/config/db.js:32-36`, `max: 10`) có thể tăng theo tải. Vì FE/BE không dùng chung tiến trình, việc scale từng phần độc lập không ảnh hưởng phần còn lại.

**Q6. Vì sao dùng Context API (`AuthContext`, `ThemeContext`) mà không dùng Redux?**
Trả lời: Lượng state toàn cục của ứng dụng chỉ gồm thông tin user đăng nhập và theme sáng/tối — không nhiều tầng, không cần middleware phức tạp (thunk/saga) hay time-travel debugging của Redux. Context API là công cụ có sẵn của React, đủ dùng, tránh over-engineering và giảm dependency không cần thiết.

**Q7. Dữ liệu (amenities, images) lưu dạng gì trong SQL Server, sao không tách bảng riêng (chuẩn hóa 3NF)?**
Trả lời: Các cột như `amenities`, `images` trong bảng `Hotels`/`Rooms` (`backend/config/db.js:84-86`, `101`) được lưu dạng chuỗi JSON (`NVARCHAR(MAX)` mặc định `'[]'`) thay vì tách bảng N-N riêng, vì đây là dữ liệu ít thay đổi cấu trúc, không cần join/lọc riêng theo từng tiện ích ở tầng SQL — đánh đổi lấy đơn giản hóa schema và truy vấn nhanh hơn (không cần join thêm bảng phụ mỗi lần lấy danh sách khách sạn). Đây là một quyết định đánh đổi có chủ đích giữa chuẩn hóa (normalization) và hiệu năng/đơn giản.

**Q8. Ai đảm bảo tính toàn vẹn dữ liệu khi có nhiều thao tác ghi liên quan nhau (vd tạo booking phải trừ tồn kho)?**
Trả lời: Dùng SQL Transaction qua `withTransaction()` (`backend/config/db.js:320-337`): nếu bất kỳ bước nào trong chuỗi thao tác lỗi, toàn bộ transaction được `rollback()` (`backend/config/db.js:330-334`), đảm bảo không có trạng thái nửa vời (vd tạo booking thành công nhưng không trừ tồn kho).
