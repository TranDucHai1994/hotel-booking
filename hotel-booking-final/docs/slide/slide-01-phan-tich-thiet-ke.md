# Slide 01 — Phân tích & Thiết kế hệ thống

> **Phục vụ mục:** Phân tích thiết kế hệ thống (Nguyễn Ngọc Kiều — K25DTCN195)
> **Nội dung:** Use Case Diagram, Activity Diagram, Sequence Diagram cho các luồng chính của Hotel Booking System.
> **Cách dùng:** Copy từng khối Mermaid vào PowerPoint (add-in "Mermaid Chart"), Notion, Draw.io hoặc dán trực tiếp vào GitHub/README để render sẵn. Nếu công cụ không hỗ trợ Mermaid, có thể export sang PNG tại <https://mermaid.live>.

---

## 1. Danh sách Actors (tác nhân)

| # | Actor | Mô tả | Cách phân biệt trong code |
|---|-------|-------|--------------------------|
| 1 | **Khách vãng lai (Guest)** | Người dùng chưa đăng nhập, có thể tìm/xem khách sạn và đặt phòng không cần tài khoản | `req.user = null` (thông qua middleware `optionalToken`) |
| 2 | **Khách hàng (Customer)** | Người dùng đã đăng ký & đăng nhập, có lịch sử đặt phòng | `role = 'customer'` trong bảng `Users` |
| 3 | **Quản lý (Manager)** | Quản lý dữ liệu khách sạn/phòng/booking nhưng KHÔNG được thao tác trên tài khoản người dùng | `role = 'manager'` |
| 4 | **Quản trị viên (Admin)** | Toàn quyền trên hệ thống, kể cả CRUD tài khoản, cấu hình email | `role = 'admin'` |
| 5 | **Hệ thống Email (SMTP/Mock)** | Gửi email xác nhận đăng ký & xác nhận đặt phòng | `services/emailService.js` (Nodemailer) |

---

## 2. Use Case Diagram

Sơ đồ dưới đây thể hiện các use case chính, thứ tự tính kế thừa: Admin ⊃ Manager ⊃ Customer ⊃ Guest.

```mermaid
%%{init: {'theme':'default'}}%%
flowchart LR
    subgraph SYS["Hệ thống Đặt phòng Khách sạn"]
        UC1((Tìm kiếm khách sạn))
        UC2((Xem chi tiết khách sạn))
        UC3((Đặt phòng))
        UC4((Đăng ký tài khoản))
        UC5((Đăng nhập))
        UC6((Xem lịch sử đặt phòng))
        UC7((Hủy đặt phòng))
        UC8((Đánh giá khách sạn))
        UC9((Cập nhật thông tin cá nhân))
        UC10((Đổi mật khẩu))
        UC11((Quên mật khẩu))
        UC12((Quản lý khách sạn - CRUD))
        UC13((Quản lý phòng - CRUD))
        UC14((Duyệt/Hủy/Xóa booking))
        UC15((Xem Dashboard thống kê))
        UC16((Quản lý người dùng))
        UC17((Kiểm duyệt & xóa Feedback))
        UC18((Cấu hình email hệ thống))
    end

    Guest([Khách vãng lai])
    Customer([Khách hàng])
    Manager([Quản lý])
    Admin([Quản trị viên])
    EmailSys([Hệ thống Email])

    Guest --> UC1
    Guest --> UC2
    Guest --> UC3
    Guest --> UC4
    Guest --> UC5
    Guest --> UC11

    Customer --> UC1
    Customer --> UC2
    Customer --> UC3
    Customer --> UC6
    Customer --> UC7
    Customer --> UC8
    Customer --> UC9
    Customer --> UC10

    Manager --> UC12
    Manager --> UC13
    Manager --> UC14
    Manager --> UC15
    Manager --> UC17

    Admin --> UC12
    Admin --> UC13
    Admin --> UC14
    Admin --> UC15
    Admin --> UC16
    Admin --> UC17
    Admin --> UC18

    UC3 -.->|include| EmailSys
    UC4 -.->|include| EmailSys
```

### 2.1. Mô tả chi tiết các use case chính (ưu tiên UC quan trọng)

#### UC-03. Đặt phòng

| Mục | Nội dung |
|------|----------|
| **ID** | UC-03 |
| **Actor** | Guest, Customer |
| **Tiền điều kiện** | Đã chọn khách sạn, phòng, ngày check-in/check-out |
| **Luồng chính** | 1) Nhập/xác nhận thông tin liên hệ · 2) Chọn hình thức thanh toán (Pay at hotel / Mock card / Mock momo) · 3) Backend kiểm tra phòng còn trống · 4) Tính tổng tiền = `price_per_night × số đêm` · 5) Ghi bản ghi Booking (status = `pending`, payment_status = `unpaid` hoặc `paid`) · 6) Gửi email xác nhận |
| **Luồng phụ (Exception)** | E1: Phòng đã hết → báo lỗi 400 · E2: Ngày check-in ≥ check-out → báo lỗi 400 · E3: Số khách vượt `max_guests` → báo lỗi 400 · E4: Guest không cung cấp email/tên → báo lỗi 400 |
| **Hậu điều kiện** | Có 1 bản ghi mới trong bảng `Bookings`; ghi log audit; email đã được đẩy qua SMTP hoặc mock |
| **File liên quan** | `backend/controllers/bookingController.js` (`createBooking`), `backend/utils/availability.js` (`getBookedRoomCountMap`) |

#### UC-05. Đăng nhập

| Mục | Nội dung |
|------|----------|
| **ID** | UC-05 |
| **Actor** | Guest → trở thành Customer/Manager/Admin |
| **Luồng chính** | 1) Người dùng nhập email + password · 2) BE kiểm tra email tồn tại · 3) So sánh `bcrypt.compare(password, password_hash)` · 4) Sinh access-token JWT (7 ngày) + refresh-token (opaque, 30 ngày, hash SHA-256 lưu DB) · 5) Reset `failed_attempts = 0`, cập nhật `last_login`, ghi audit log |
| **Luồng phụ** | E1: Email không tồn tại → 400 · E2: Sai mật khẩu → `failed_attempts++`, nếu ≥5 khóa tài khoản (status = `locked`) · E3: Tài khoản bị disable → 403 |
| **Hậu điều kiện** | Frontend lưu token + user vào `localStorage`, redirect về trang chủ hoặc trang trước |
| **File liên quan** | `backend/controllers/authController.js` (`login`), `frontend/src/pages/Login.js` |

#### UC-07. Hủy đặt phòng

| Mục | Nội dung |
|------|----------|
| **ID** | UC-07 |
| **Actor** | Customer |
| **Tiền điều kiện** | Đang đăng nhập, booking thuộc chính user, status ≠ `cancelled` |
| **Luồng chính** | 1) Chọn booking trong "My Bookings" · 2) Bấm Hủy · 3) BE kiểm tra `check_in > current_date` · 4) Cập nhật `status = 'cancelled'`; nếu đã `paid` → `payment_status = 'refunded'` |
| **Luồng phụ** | E1: Đã qua ngày nhận phòng → 400 "Chỉ có thể hủy trước ngày nhận phòng" · E2: Đã hủy trước đó → 400 |

#### UC-14. Duyệt/Hủy/Xóa booking (Admin)

| Mục | Nội dung |
|------|----------|
| **ID** | UC-14 |
| **Actor** | Admin, Manager |
| **Luồng chính** | 1) Vào `/admin/bookings` xem toàn bộ danh sách · 2) Đổi trạng thái sang `confirmed` / `cancelled` · 3) Nếu status → cancelled và đã paid → auto set `refunded` · 4) Có thể xóa vĩnh viễn |
| **File liên quan** | `backend/controllers/bookingController.js` (`getAllBookings`, `updateBookingStatus`, `deleteBooking`) |

---

## 3. Activity Diagrams

### 3.1. Luồng "Đăng ký tài khoản"

```mermaid
flowchart TD
    A([Bắt đầu]) --> B[Người dùng nhập họ tên, email, phone, password]
    B --> C{Đủ trường bắt buộc?}
    C -- Không --> E1[Trả về 400: Thiếu trường]
    E1 --> Z([Kết thúc])
    C -- Có --> D[Chuẩn hóa email lowercase + trim]
    D --> E[SELECT Users WHERE email = ?]
    E --> F{Email đã tồn tại?}
    F -- Có --> E2[Trả về 400: Email đã tồn tại]
    E2 --> Z
    F -- Chưa --> G[bcrypt.hash password, salt=10]
    G --> H[INSERT Users<br/>role=customer, status=active]
    H --> I[Sinh access-token JWT expiresIn=7d]
    I --> J[Ghi AuditLog action=register]
    J --> K[Gửi email 'Đăng ký thành công']
    K --> L[Trả về 201: token + user payload]
    L --> Z
```

### 3.2. Luồng "Đăng nhập & khóa tài khoản"

```mermaid
flowchart TD
    A([Bắt đầu]) --> B[Nhập email + password]
    B --> C[SELECT Users WHERE email = ?]
    C --> D{Tồn tại user?}
    D -- Không --> E1[400: Email không tồn tại]
    E1 --> Z([Kết thúc])
    D -- Có --> E{status = disabled hoặc<br/>deleted_at != NULL?}
    E -- Có --> E2[403: Tài khoản vô hiệu hóa]
    E2 --> Z
    E -- Không --> F{status = locked?}
    F -- Có --> E3[403: Tài khoản đang bị khóa]
    E3 --> Z
    F -- Không --> G[bcrypt.compare password, password_hash]
    G --> H{Khớp?}
    H -- Không --> I[failed_attempts++]
    I --> J{failed_attempts >= 5?}
    J -- Có --> K[UPDATE status = locked]
    J -- Không --> L[Giữ nguyên status]
    K --> M[400: Sai mật khẩu]
    L --> M
    M --> Z
    H -- Có --> N[Sinh refresh-token opaque<br/>hash SHA-256 lưu DB]
    N --> O[UPDATE last_login, failed_attempts = 0]
    O --> P[Sinh access-token JWT]
    P --> Q[Ghi AuditLog action=login]
    Q --> R[200: token + refresh_token + user]
    R --> Z
```

### 3.3. Luồng "Đặt phòng" (bao gồm nhánh Guest & User)

```mermaid
flowchart TD
    A([Người dùng chọn phòng & ngày]) --> B[POST /api/bookings]
    B --> C[Middleware optionalToken:<br/>parse JWT nếu có, không có → req.user=null]
    C --> D[SELECT Room by id]
    D --> D1{Phòng tồn tại?}
    D1 -- Không --> E1[404: Phòng không tồn tại] --> Z([Kết thúc])
    D1 -- Có --> E[SELECT Hotel by hotel_id]
    E --> E11{Phòng thuộc hotel?}
    E11 -- Không --> E2[400: Phòng không thuộc khách sạn] --> Z
    E11 -- Có --> F{check_in < check_out?}
    F -- Không --> E3[400: Ngày không hợp lệ] --> Z
    F -- Có --> G{status Room = available?}
    G -- Không --> E4[400: Phòng không sẵn sàng] --> Z
    G -- Có --> H{guests <= max_guests?}
    H -- Không --> E5[400: Vượt sức chứa] --> Z
    H -- Có --> I[Query Bookings đã đặt:<br/>status IN pending, confirmed<br/>AND check_in < ? AND check_out > ?]
    I --> J{available_quantity > 0?}
    J -- Không --> E6[400: Phòng đã hết chỗ] --> Z
    J -- Có --> K{req.user tồn tại?}
    K -- Có --> L1[Lấy full_name, email, phone từ Users<br/>booking_source = 'account']
    K -- Không --> L2{guest_name + guest_email đủ?}
    L2 -- Không --> E7[400: Khách vãng lai thiếu thông tin] --> Z
    L2 -- Có --> L3[booking_source = 'guest']
    L1 --> M[Tính total = price_per_night × nights]
    L3 --> M
    M --> N[Xác định payment_method<br/>pay_at_hotel / mock_card / mock_momo]
    N --> O[INSERT Bookings status=pending<br/>payment_status = paid nếu mock_*, else unpaid]
    O --> P[Log AuditLog action=create entity=booking]
    P --> Q[sendBookingConfirmationEmail<br/>SMTP hoặc mock]
    Q --> R[201: booking + email_transport info]
    R --> Z
```

**Điểm quan trọng cần nhấn khi bảo vệ:**

- Backend cho phép **Guest booking** (không token) — dùng middleware `optionalToken`, cột `booking_source` phân biệt (`account` vs `guest`).
- Kiểm tra phòng trống dùng công thức: `total_quantity - COUNT(bookings status IN pending/confirmed AND overlap dates) > 0`.
- **Race condition tiềm ẩn:** giữa bước "kiểm tra còn trống" và bước "INSERT" không có transaction/lock ⇒ 2 người có thể đặt trùng cùng lúc. Đây là điểm yếu cần nêu (đã note trong `docs/README.md`).

### 3.4. Luồng "Hủy đặt phòng"

```mermaid
flowchart TD
    A([User bấm Hủy trong My Bookings]) --> B[PUT /api/bookings/:id/cancel<br/>Header: Bearer token]
    B --> C[verifyToken middleware]
    C --> C1{Token hợp lệ?}
    C1 -- Không --> E1[401/403: Token lỗi] --> Z([Kết thúc])
    C1 -- Có --> D[SELECT Bookings WHERE id=? AND user_id=?]
    D --> D1{Booking tồn tại?}
    D1 -- Không --> E2[404: Không tìm thấy booking] --> Z
    D1 -- Có --> E{status = cancelled?}
    E -- Có --> E3[400: Đã hủy trước đó] --> Z
    E -- Không --> F{check_in > NOW?}
    F -- Không --> E4[400: Chỉ hủy trước ngày nhận phòng] --> Z
    F -- Có --> G[UPDATE status = cancelled<br/>IF payment_status = paid THEN refunded]
    G --> H[Ghi AuditLog action=cancel]
    H --> R[200: Hủy thành công]
    R --> Z
```

### 3.5. Luồng "Đánh giá khách sạn" (Feedback)

```mermaid
flowchart TD
    A([User đã đăng nhập, mở HotelDetail]) --> B[Điền rating 1-5 + nội dung]
    B --> C[POST /api/feedback]
    C --> D[verifyToken]
    D --> E[SELECT Feedbacks WHERE user_id=? AND hotel_id=?]
    E --> F{Đã từng đánh giá?}
    F -- Có --> E1[400: Bạn đã đánh giá khách sạn này rồi] --> Z([Kết thúc])
    F -- Chưa --> G[INSERT Feedbacks<br/>rating, content, timestamp]
    G --> H[201: Gửi đánh giá thành công]
    H --> Z
```

> **Nhược điểm cần biết:** BE hiện KHÔNG kiểm tra user đã từng đặt phòng thành công tại hotel này trước khi cho feedback. Ràng buộc duy nhất là **1 user ↔ 1 hotel = 1 feedback** (nhờ `UQ_Feedbacks_UserHotel`).

### 3.6. Luồng "Admin duyệt Booking"

```mermaid
flowchart TD
    A([Admin/Manager mở /admin/bookings]) --> B[GET /api/bookings/all]
    B --> C[verifyToken + requireRoles admin manager]
    C --> D[SELECT Bookings JOIN Users JOIN Hotels JOIN Rooms<br/>ORDER BY created_at DESC]
    D --> E[Hiển thị bảng có filter theo status]
    E --> F{Admin chọn hành động?}
    F -- Đổi status --> G[PUT /api/bookings/:id/status<br/>body: status = confirmed/cancelled]
    G --> H[UPDATE Bookings.status<br/>Nếu cancelled và paid → payment_status=refunded]
    H --> I[Log AuditLog action=update_status]
    I --> J[200: booking mới]
    F -- Xóa vĩnh viễn --> K[DELETE /api/bookings/:id]
    K --> L[DELETE FROM Bookings WHERE id=?]
    L --> M[Log AuditLog action=delete]
    M --> J
    J --> Z([Kết thúc])
```

---

## 4. Sequence Diagrams (tương tác giữa các thành phần)

### 4.1. Sequence — Đặt phòng thành công (Customer)

```mermaid
sequenceDiagram
    autonumber
    actor U as Customer
    participant FE as React FE (BookingPage)
    participant API as Express API
    participant MW as Middleware<br/>optionalToken
    participant DB as SQL Server
    participant MAIL as EmailService

    U->>FE: Chọn phòng + ngày check-in/out
    FE->>API: POST /api/bookings<br/>Authorization: Bearer <JWT>
    API->>MW: parse Authorization header
    MW->>MW: jwt.verify(token, JWT_SECRET)
    MW-->>API: req.user = { id, role, email }
    API->>DB: SELECT * FROM Rooms WHERE id = @roomId
    DB-->>API: room row
    API->>DB: SELECT * FROM Hotels WHERE id = @hotelId
    DB-->>API: hotel row
    API->>DB: SELECT room_id, COUNT(*) FROM Bookings<br/>WHERE room_id IN (...) AND overlap dates
    DB-->>API: booked_count
    API->>API: available = total_quantity - booked_count
    alt available > 0
        API->>DB: INSERT INTO Bookings ... OUTPUT INSERTED.*
        DB-->>API: new booking row
        API->>DB: INSERT INTO AuditLogs (action='create', entity='booking')
        API->>MAIL: sendBookingConfirmationEmail(...)
        MAIL-->>API: {messageId, mode}
        API-->>FE: 201 { booking, mock_email }
        FE-->>U: Hiển thị màn "Đặt phòng thành công"
    else available == 0
        API-->>FE: 400 { message: 'Phòng đã hết chỗ' }
        FE-->>U: Toast lỗi
    end
```

### 4.2. Sequence — Refresh Access Token

```mermaid
sequenceDiagram
    autonumber
    actor U as Người dùng
    participant FE as React FE
    participant API as Express API
    participant DB as SQL Server

    Note over FE: Access-token cũ hết hạn<br/>(401 từ request bất kỳ)
    FE->>API: POST /api/auth/refresh<br/>body: { refresh_token }
    API->>API: sha256(refresh_token)
    API->>DB: SELECT * FROM Users<br/>WHERE refresh_token_hash = @hash
    DB-->>API: user row
    alt refresh_token_expiry < NOW()
        API-->>FE: 401 'Refresh token đã hết hạn'
        FE-->>U: Điều hướng về /login
    else hợp lệ
        API->>API: jwt.sign({id, role, email}, JWT_SECRET, 7d)
        API-->>FE: 200 { token }
        FE-->>U: Tiếp tục request cũ
    end
```

---

## 5. State Diagram — Vòng đời của một Booking

Booking chạy qua các trạng thái sau, thể hiện trong cột `status` và `payment_status`:

```mermaid
stateDiagram-v2
    [*] --> pending: User đặt phòng<br/>status='pending'<br/>payment_status='unpaid'/'paid'
    pending --> confirmed: Admin duyệt
    pending --> cancelled: User hủy trước check_in<br/>hoặc Admin hủy
    confirmed --> cancelled: Admin hủy
    cancelled --> [*]: (không đổi được nữa)
    confirmed --> [*]: Đã check-out<br/>(hiện chưa có state completed)

    note right of cancelled
        Nếu payment_status = 'paid'
        khi hủy → tự chuyển sang 'refunded'
    end note
```

> **Gợi ý mở rộng:** hệ thống hiện chưa có trạng thái `completed` (check-out xong). Có thể bổ sung để tính doanh thu chính xác hơn (hiện tại doanh thu = tổng `confirmed` + đã paid).

---

## 6. Component Diagram (kiến trúc tổng thể)

```mermaid
flowchart LR
    subgraph Client["Client (Trình duyệt)"]
        UI[React SPA]
        LS[(localStorage:<br/>token, user, theme)]
    end

    subgraph Server["Node.js Express Server (:4000)"]
        R[Routes]
        C[Controllers]
        MW[Middleware<br/>verifyToken, requireRoles]
        S[Services:<br/>email, audit, systemSettings]
        UT[Utils:<br/>availability, mappers, sql]
    end

    subgraph Data["Data Layer"]
        DB[(SQL Server<br/>HotelBooking DB)]
    end

    subgraph External["External Services"]
        SMTP[SMTP Server<br/>Gmail/Mailtrap]
    end

    UI -- Axios REST /api/* --> R
    UI -- Load bundle --> Client
    R --> MW
    MW --> C
    C --> S
    C --> UT
    C --> DB
    S --> DB
    S --> SMTP
    UI -.->|Save/Read| LS
```

---

## 7. Ghi chú khi làm slide

- **Số lượng slide đề xuất:** 6 slide (mỗi phần từ 2→6 là 1 slide).
- **Bản in mờ (backup):** giữ file `.md` này ở phần Phụ lục, đề phòng máy chiếu không hiện Mermaid → dùng ảnh PNG đã export sẵn.
- **Câu hỏi phản biện thường gặp:**
  1. *"Tại sao Guest booking lại được thiết kế cùng flow với User?"* → Vì trải nghiệm giảm ma sát, giảm bounce; điểm khác biệt chỉ ở `booking_source` và bộ thông tin liên hệ.
  2. *"Race condition khi đặt phòng đồng thời xử lý ra sao?"* → Trung thực nêu điểm yếu, hướng khắc phục là dùng `HOLDLOCK, UPDLOCK, ROWLOCK` hoặc `SERIALIZABLE isolation` trong transaction.
  3. *"Vì sao dùng cả JWT (access) và opaque token (refresh)?"* → JWT stateless để verify nhanh, refresh-token opaque + hash trong DB để có thể revoke khi cần.
