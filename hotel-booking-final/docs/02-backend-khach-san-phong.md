# 02 — Backend & Frontend: Khách sạn, Phòng, Tìm kiếm & Tình trạng còn phòng

> Tài liệu này giải thích chi tiết module "Hotel & Room" của hệ thống đặt phòng khách sạn — từ API backend đến giao diện tìm kiếm/hiển thị ở frontend. Mục tiêu: học thuộc để trả lời phản biện.

---

## 1. Tổng quan chức năng

Module này phục vụ 4 nhóm chức năng chính cho **khách (không cần đăng nhập)**:

1. **Tìm kiếm khách sạn** theo từ khóa tự do hoặc tên thành phố (kể cả tiếng Việt có dấu như "Sài Gòn", "Đà Nẵng").
2. **Lọc kết quả** theo: khoảng giá (min/max), số sao đánh giá trung bình (rating), tiện ích (amenities: hồ bơi, wifi, bữa sáng...), và khoảng ngày check-in/check-out (chỉ hiển thị khách sạn còn phòng trống trong khoảng ngày đó).
3. **Xem chi tiết 1 khách sạn**: thông tin, ảnh, tiện ích, bản đồ Google Maps nhúng, đánh giá (feedback), và danh sách loại phòng kèm trạng thái còn/hết phòng.
4. **Xem danh sách phòng của một khách sạn** kèm tính toán số lượng phòng còn trống theo ngày (dùng riêng cho trang đặt phòng).

Ngoài ra module còn có các API quản trị (CRUD khách sạn/phòng) dành cho `admin`/`manager`, được bảo vệ bởi middleware xác thực.

**Luồng dữ liệu tổng quát:**

```
Frontend (Home.js / HeroSearchBar) 
   → gọi GET /api/hotels?location=...&check_in=...&check_out=...&min_price=...
   → hotelController.getHotels
       → hotelController.getHotelsByKeyword()   (query SQL Hotels)
       → getRoomsByHotelIds()                   (query SQL Rooms theo hotel_id IN (...))
       → getFeedbacksByHotelIds()               (query SQL Feedbacks)
       → availability.getBookedRoomCountMap()   (query SQL Bookings, đếm phòng đã đặt theo ngày)
       → availability.computeRoomAvailability() (tính available_quantity, is_bookable...)
       → lọc theo amenities/price/rating (xử lý trong JS, không phải SQL)
   → trả JSON mảng khách sạn đã được làm giàu dữ liệu (min_price, available_room_count,...)
   → Frontend nhận, filter thêm theo destination chip, sort, rồi render HotelCardPremium
```

---

## 2. API lấy danh sách khách sạn — `getHotels` / `getHotelsByKeyword`

File: `backend/controllers/hotelController.js`

### 2.1. Query SQL sử dụng

Hàm `getHotelsByKeyword(keyword)` (dòng `backend/controllers/hotelController.js:74-111`) xử lý theo 3 nhánh:

- **Không có từ khóa** (`backend/controllers/hotelController.js:75-78`): lấy toàn bộ khách sạn.
  ```sql
  SELECT * FROM dbo.Hotels ORDER BY created_at DESC;
  ```

- **Từ khóa khớp với "city alias"** (`backend/controllers/hotelController.js:81-95`): Vì DB lưu tên thành phố dạng ASCII không dấu (`"Ho Chi Minh"`, `"Da Nang"`...) còn người dùng gõ tiếng Việt có dấu (`"sài gòn"`, `"đà nẵng"`), dự án dùng một **bảng ánh xạ tĩnh** `CITY_ALIAS_MAP` (dòng `backend/controllers/hotelController.js:25-62`) để chuyển từ khóa người dùng gõ (đã lowercase, trim) sang đúng giá trị `city` trong DB. Nếu khớp, chạy:
  ```sql
  SELECT * FROM dbo.Hotels WHERE city = @city ORDER BY created_at DESC;
  ```
  Đây là so khớp **chính xác (exact match)**, không phải LIKE — nên độ chính xác cao hơn cho tên thành phố.

- **Không khớp alias nào** (`backend/controllers/hotelController.js:97-110`): fallback dùng `LIKE` để tìm theo tên khách sạn/thành phố/địa chỉ:
  ```sql
  SELECT * FROM dbo.Hotels
  WHERE name LIKE @keyword OR city LIKE @keyword OR address LIKE @keyword
  ORDER BY created_at DESC;
  ```
  với `@keyword = '%' + keyword + '%'` (dòng 107) — tham số hoá đầy đủ, không nối chuỗi trực tiếp vào câu SQL.

### 2.2. Vì sao cần bảng alias thành phố?

Vì "Sài Gòn" ánh xạ sang `"Ho Chi Minh"` — đây **không phải vấn đề dấu tiếng Việt** (bỏ dấu "Sài Gòn" → "Sai Gon" vẫn khác hẳn "Ho Chi Minh") mà là vấn đề **tên gọi khác nhau hoàn toàn của cùng một thành phố**. Không thể xử lý bằng cách bỏ dấu đơn thuần, bắt buộc phải có bảng tra cứu thủ công (`CITY_ALIAS_MAP`, dòng 25-62).

### 2.3. Lọc theo amenities/giá/rating — thực hiện ở đâu?

Toàn bộ được lọc **ở tầng ứng dụng (application/JS layer), không phải trong câu SQL WHERE**. Xem hàm `exports.getHotels` (`backend/controllers/hotelController.js:155-252`):

1. Lấy toàn bộ khách sạn khớp từ khóa/thành phố từ DB (`hotels`, dòng 179).
2. Lấy toàn bộ phòng của các khách sạn đó (`getRoomsByHotelIds`, dòng 181, query `WHERE hotel_id IN (...)` — dòng 114-131).
3. Lấy toàn bộ feedback của các khách sạn đó (`getFeedbacksByHotelIds`, dòng 182).
4. Với mỗi khách sạn, tính `min_price`, `available_room_count`, `average_rating` bằng JS (`reduce`, `Math.min`, dòng 205-244).
5. Áp filter bằng JS thuần:
   - Amenities: `amenitiesFilter.every((item) => hotelAmenities.includes(item))` (dòng 220-223) — kiểm tra khách sạn có **đủ tất cả** tiện ích được chọn.
   - Giá: so `minPrice` với `minPriceFilter`/`maxPriceFilter` (dòng 226-227).
   - Rating: so `averageRating` với `minRatingFilter` (dòng 228).
   - Ngày ở (nếu có `check_in`/`check_out`): loại khách sạn có `availableRoomCount <= 0` (dòng 229).
6. `.filter(Boolean)` loại bỏ các khách sạn `null` (không đạt điều kiện) (dòng 246).

---

## 3. Logic kiểm tra phòng còn trống — `availability.js`

File: `backend/utils/availability.js`

### 3.1. Chuẩn hóa khoảng ngày — `normalizeDateRange`

Dòng 21-36: parse `check_in`/`check_out` (dạng chuỗi `YYYY-MM-DD`) thành `Date` ở giờ 00:00:00 (`parseDateStart`, dòng 11-15), và bắt buộc `checkOut > checkIn` (dòng 34) — không chấp nhận ở 0 đêm hoặc ngày trả trước ngày nhận.

### 3.2. Đếm số phòng đã bị đặt trong khoảng ngày — `getBookedRoomCountMap`

Dòng 42-74. Đây là hàm cốt lõi trả lời câu hỏi "phòng này còn trống không trong khoảng ngày X-Y?".

```sql
SELECT room_id, COUNT(*) AS count
FROM dbo.Bookings
WHERE status IN ('pending', 'confirmed')
  AND room_id IN (@roomId0, @roomId1, ...)
  AND check_in < @checkOut
  AND check_out > @checkIn
GROUP BY room_id;
```//dòng 53-63

**Thuật toán kiểm tra overlap (giao nhau) giữa 2 khoảng ngày**: điều kiện `check_in < @checkOut AND check_out > @checkIn` là công thức kinh điển để phát hiện 2 khoảng thời gian `[A_start, A_end)` và `[B_start, B_end)` có giao nhau hay không. Hai khoảng **không giao nhau** chỉ khi một khoảng kết thúc trước hoặc đúng lúc khoảng kia bắt đầu. Phủ định điều đó ra được đúng công thức trên.

**Ví dụ cụ thể:**
- Booking hiện có: check_in = 10/8, check_out = 15/8 (khách ở từ đêm 10 đến sáng 15).
- Người dùng tìm phòng trống: check_in = 12/8, check_out = 18/8.
- Kiểm tra: `10/8 < 18/8` (true) **và** `15/8 > 12/8` (true) → cả hai đều đúng → **có giao nhau** → phòng này bị tính là "đã đặt" trong khoảng tìm kiếm, dù ngày trả (15/8) đã trước ngày người dùng muốn ở đến (18/8). Đây là đúng về nghiệp vụ vì khách ở từ 12-15/8 sẽ trùng với booking cũ.
- Ngược lại nếu người tìm chọn check_in = 15/8, check_out = 18/8 (nhận phòng đúng ngày khách cũ trả phòng): `10/8 < 18/8` (true) nhưng `15/8 > 15/8` là **false** → không giao nhau → phòng được tính là còn trống. Điều này khớp với quy ước khách sạn: ngày trả phòng của người này có thể là ngày nhận phòng của người khác (nửa đóng nửa mở `[check_in, check_out)`).

Hàm `calculateOverlapNights` (dòng 117-130) áp dụng cùng nguyên lý (lấy max của 2 điểm bắt đầu, min của 2 điểm kết thúc) để tính **số đêm bị giao nhau cụ thể**, dùng cho các tính năng khác (không dùng trực tiếp trong `getBookedRoomCountMap` nhưng cùng logic nền tảng).

### 3.3. Tính trạng thái phòng — `computeRoomAvailability`

Dòng 80-104:
- `availableQuantity = max(total_quantity - bookedCount, 0)` nếu phòng đang ở trạng thái `available` (`canSell`, dòng 83, 86). Nếu phòng đang `maintenance`/`inactive` thì `availableQuantity = 0` luôn.
- `availability_status` được gán theo thứ tự ưu tiên (dòng 88-94):
  1. `maintenance` nếu `status === 'maintenance'`
  2. `inactive` nếu `status === 'inactive'`
  3. `full` nếu `availableQuantity <= 0`
  4. `limited` nếu `availableQuantity <= max(1, ceil(total_quantity * 0.3))` (còn ≤ 30% tổng số phòng)
  5. mặc định `available`
- `is_bookable = canSell && availableQuantity > 0` (dòng 102) — cờ boolean dùng ở frontend để bật/tắt nút "Đặt phòng".

---

## 4. `roomController.js` — Lấy phòng theo khách sạn

File: `backend/controllers/roomController.js`

`getRoomsByHotel` (dòng 10-44):
1. Lấy `hotel_id`, `check_in`, `check_out` từ query string (dòng 12).
2. `normalizeDateRange` để validate ngày (dòng 13, 15-17) — nếu có truyền ngày nhưng không hợp lệ (checkOut ≤ checkIn hoặc parse lỗi) thì trả về `400`.
3. Query toàn bộ phòng của khách sạn:
   ```sql
   SELECT * FROM dbo.Rooms WHERE hotel_id = @hotelId ORDER BY created_at DESC;
   ```
   (dòng 19-27)
4. Nếu có khoảng ngày hợp lệ, gọi `getBookedRoomCountMap` để lấy số phòng đã đặt cho từng `room_id` (dòng 30-36).
5. Map từng phòng qua `computeRoomAvailability(room, bookedMap.get(...) || 0)` (dòng 38-40) để đính kèm `available_quantity`, `availability_status`, `is_bookable` vào response.

Đây chính là API dùng khi vào trang đặt phòng (route `/api/rooms?hotel_id=...`), tách biệt với API `getHotelById` (dùng cho trang chi tiết, cũng có logic tương tự lặp lại — xem mục 8).

---

## 5. `mappers.js` và `sql.js` — Chuyển đổi dữ liệu & chống SQL Injection

### 5.1. `mappers.js` — vai trò

File `backend/utils/mappers.js` chứa các hàm `mapHotel`, `mapRoom`, `mapBooking`, `mapFeedback`, `mapUser`. Vai trò: chuyển 1 **row thô từ SQL Server** (object với các cột `snake_case` như `star_rating`, `is_hot_deal`, `cover_image`) thành **object JSON chuẩn hoá** để trả về frontend, cụ thể:

- Đổi tên field DB `id` → thêm cả `id` và `_id` (dòng `mappers.js:36` cho hotel, `mappers.js:56` cho room) — giữ tương thích với code cũ có thể từng dùng `_id` kiểu MongoDB.
- Ép kiểu dữ liệu an toàn bằng `toNumber`/`toBoolean` (vd `star_rating` — `mappers.js:42`, `is_hot_deal` — `mappers.js:43`) để tránh trả về `NULL`/chuỗi gây lỗi ở frontend.
- Parse cột lưu dạng JSON string trong DB (`amenities`, `images` — kiểu `NVARCHAR(MAX)` chứa chuỗi JSON) thành mảng JS thực sự, qua `parseJsonArray` (`mappers.js:45, 47`).
- Set giá trị mặc định cho field rỗng (`row.city || ''`, `mappers.js:38`).

### 5.2. `sql.js` — vai trò & chống SQL Injection

File `backend/utils/sql.js` là tầng tiện ích dùng chung:

- **`buildInClause(values, prefix)`** (dòng 5-17): sinh câu `IN (...)` an toàn cho danh sách ID động (vd tìm phòng theo nhiều `hotel_id`). Thay vì nối chuỗi ID trực tiếp vào SQL (`WHERE id IN (1,2,3)` — dễ bị injection nếu ID đến từ input không kiểm soát), hàm này tạo ra **danh sách tham số riêng biệt** `@hotelId0, @hotelId1, ...` và trả về object `params` tương ứng để bind an toàn. Ví dụ dùng thực tế tại `backend/controllers/hotelController.js:119-128`:
  ```js
  const { clause, params } = buildInClause(hotelIds, 'hotelId');
  const result = await query(
    `SELECT * FROM dbo.Rooms WHERE hotel_id IN (${clause}) ORDER BY created_at DESC;`,
    params
  );
  ```
  Câu SQL cuối cùng sẽ là `WHERE hotel_id IN (@hotelId0, @hotelId1, @hotelId2)` — mỗi giá trị được binding qua `request.input(key, value)` trong `backend/config/db.js:309-311`, dùng driver `mssql` — driver này tự escape/parameterize giá trị ở tầng giao thức TDS, không cho phép ký tự SQL đặc biệt phá vỡ câu lệnh.

- **`normalizeStringArray`** (dòng 36-49): chuẩn hoá input amenities (có thể là mảng hoặc chuỗi phân tách bởi dấu phẩy) thành mảng string đã trim, loại bỏ rỗng.
- **`parseJsonArray`** (dòng 19-34): parse an toàn — nếu `JSON.parse` lỗi thì trả về `[]` thay vì throw, tránh crash server khi dữ liệu DB bị hỏng.
- **`toBoolean`/`toNumber`** (dòng 51-58): ép kiểu an toàn có fallback.

### 5.3. Cơ chế chống SQL Injection tổng thể

Toàn bộ dự án dùng **parameterized query** thông qua hàm `query(text, params)` (`backend/config/db.js:304-314`): mỗi giá trị được truyền qua `request.input(key, value)` của thư viện `mssql`, KHÔNG bao giờ nối chuỗi giá trị người dùng trực tiếp vào câu SQL text. Ví dụ điển hình 1 câu SQL có tham số:
```js
// backend/controllers/hotelController.js:98-108
const result = await query(
  `SELECT * FROM dbo.Hotels
   WHERE name LIKE @keyword OR city LIKE @keyword OR address LIKE @keyword
   ORDER BY created_at DESC;`,
  { keyword: `%${keyword}%` }
);
```
Ở đây `keyword` (input người dùng) được gắn vào placeholder `@keyword`, không phải nối thẳng vào chuỗi SQL — nên dù người dùng gõ `' OR '1'='1` thì giá trị đó chỉ được coi là **dữ liệu literal** để so khớp LIKE, không thể phá vỡ cấu trúc câu lệnh.

Ngoại lệ duy nhất là `escapeIdentifier` trong `backend/config/db.js:42-44` dùng khi tạo tên database động (`CREATE DATABASE [...]`) — đây không thể dùng tham số hoá vì SQL Server không hỗ trợ parameter cho tên định danh (identifier), nên phải tự escape ký tự `]`. Đây là phần cấu hình nội bộ (đọc từ biến môi trường `.env`), không nhận input trực tiếp từ người dùng qua HTTP.

---

## 6. `HeroSearchBar.js` — Thanh tìm kiếm & build query string

File: `frontend/my-hotel-app/src/components/HeroSearchBar.js`

Component này **tự quản lý state nội bộ** (không dùng URL params trực tiếp): `destination`, `checkIn`, `checkOut`, `guests`, `priceRange` (dòng 11-15). Khi bấm nút "Tìm kiếm", hàm `handleSearchClick` (dòng 17-35):

1. Parse `priceRange` (chuỗi dạng `"1000000-3000000"` từ dropdown, dòng 118-122) thành `minPrice`/`maxPrice` bằng `split('-')` (dòng 21-25).
2. Gọi callback `onSearch({ destination, checkIn, checkOut, guests, minPrice, maxPrice })` (dòng 27-34) — component này **không tự gọi API hay điều hướng**, mà đẩy toàn bộ dữ liệu lên component cha.

Ở `Home.js`, callback này được nhận bởi `handleHeroSearch` (`frontend/my-hotel-app/src/pages/Home.js:270-282`):
```js
const handleHeroSearch = ({ destination, checkIn, checkOut, guests, minPrice, maxPrice }) => {
  const next = {
    ...search,
    location: destination || search.location,
    check_in: checkIn || search.check_in,
    check_out: checkOut || search.check_out,
    min_price: minPrice || '',
    max_price: maxPrice || '',
  };
  setSearch(next);
  setSearchParams(buildSearchParams(next));   // ghi vào URL: ?location=...&check_in=...
  setActiveDestination(DESTINATIONS[0]);
};
```
`setSearchParams` cập nhật URL query string (`useSearchParams` của React Router), điều này kích hoạt lại `useEffect` (`Home.js:171-197`) để gọi API `GET /hotels` với params mới. Đây là kỹ thuật "URL là nguồn sự thật" (URL as single source of truth) — cho phép copy link tìm kiếm và chia sẻ, cũng như nút Back/Forward của trình duyệt hoạt động đúng.

Lưu ý: field `guests` (số khách) được thu thập ở `HeroSearchBar` nhưng **không được backend sử dụng** — API `/hotels` không có tham số lọc theo số khách tối đa (`max_guests` của phòng); đây là điểm sinh viên cần lưu ý nếu bị hỏi.

---

## 7. `HotelDetail.js` — Trang chi tiết khách sạn

File: `frontend/my-hotel-app/src/pages/HotelDetail.js`

### 7.1. Gọi API lấy chi tiết

`useEffect` (dòng 59-79) gọi:
```js
const res = await api.get(`/hotels/${id}`, { params });
```
với `params.check_in`/`params.check_out` chỉ được gửi nếu cả hai đều tồn tại trong URL (dòng 64-68), tương ứng route `GET /api/hotels/:id` xử lý bởi `exports.getHotelById` (`backend/controllers/hotelController.js:258-348`) — trả về hotel + `rooms` (đã có `availability_status`) + `feedbacks` + `average_rating`/`min_price`/`available_room_count`.

### 7.2. Bản đồ Google Maps nhúng qua iframe

Backend trả sẵn field `map_query` (built bởi `buildMapQuery(hotel)`, `backend/controllers/hotelController.js:6-8`, ghép `name, address, city`). Frontend dùng lại hoặc tự build fallback (dòng `HotelDetail.js:95`):
```js
const mapQuery = hotel?.map_query || [hotel?.name, hotel?.address, hotel?.city].filter(Boolean).join(', ');
const mapUrl = mapQuery
  ? `https://www.google.com/maps?q=${encodeURIComponent(mapQuery)}&z=15&output=embed`
  : '';
const mapLink = mapQuery
  ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(mapQuery)}`
  : '';
```
(dòng 95-101)

- `mapUrl` được nhúng vào `<iframe src={mapUrl} ... />` (dòng 270-279) để hiển thị bản đồ trực tiếp trên trang — đây là dạng **Google Maps Embed không cần API key** (dùng tham số `q=` + `output=embed`), độ chính xác phụ thuộc vào việc Google Maps tìm được địa chỉ text (`name, address, city`) chứ **không dùng tọa độ (lat/lng) lưu sẵn trong DB** — vì DB không có cột lat/lng.
- `mapLink` là link để mở Google Maps ở tab mới (nút "Mở Google Maps", dòng 254-263).

### 7.3. Hiển thị danh sách phòng

Phần "Loại phòng" (dòng 314-393) lặp qua `hotel.rooms` (đã có `availability_status`, `is_bookable` từ backend), hiển thị badge trạng thái qua hàm `statusLabel` (dòng 16-22, map trạng thái sang text + màu tiếng Việt: "Hết phòng", "Sắp hết", "Bảo trì", "Ngừng bán", "Còn phòng"). Nút "Đặt phòng" bị `disabled` nếu `!room.is_bookable` (dòng 374, 380-384), và khi bấm sẽ điều hướng sang `/book/:hotelId/:roomId` kèm theo `check_in`/`check_out` hiện tại trong URL (dòng 325-329, 373-379) để trang đặt phòng biết đúng khoảng ngày người dùng đã chọn.

---

## 8. Bảng API endpoint liên quan Hotel/Room

| Method | Path | Mô tả | Query/Body params chính | File xử lý:dòng |
|---|---|---|---|---|
| GET | `/api/hotels` | Danh sách khách sạn (tìm kiếm + lọc) | `location`/`city`, `check_in`, `check_out`, `min_price`, `max_price`, `min_rating`, `amenities` | `backend/routes/hotelRoutes.js:6` → `backend/controllers/hotelController.js:155` (`getHotels`) |
| GET | `/api/hotels/:id` | Chi tiết 1 khách sạn (kèm rooms + feedbacks) | param `:id`; query `check_in`, `check_out` | `backend/routes/hotelRoutes.js:7` → `backend/controllers/hotelController.js:258` (`getHotelById`) |
| POST | `/api/hotels` | Tạo khách sạn mới (admin/manager) | body: `name, city, address, description, property_type, star_rating, is_hot_deal, hot_deal_discount_percent, amenities, cover_image, images` | `backend/routes/hotelRoutes.js:10` → `backend/controllers/hotelController.js:353` (`createHotel`) |
| PUT | `/api/hotels/:id` | Cập nhật khách sạn (admin/manager) | param `:id`; body tương tự POST (partial update) | `backend/routes/hotelRoutes.js:11` → `backend/controllers/hotelController.js:414` (`updateHotel`) |
| DELETE | `/api/hotels/:id` | Xóa khách sạn + cascade Rooms/Bookings/Feedbacks (admin/manager) | param `:id` | `backend/routes/hotelRoutes.js:12` → `backend/controllers/hotelController.js:490` (`deleteHotel`) |
| GET | `/api/rooms` | Danh sách phòng theo khách sạn + tình trạng còn trống | `hotel_id`, `check_in`, `check_out` | `backend/routes/roomRoutes.js:9` → `backend/controllers/roomController.js:10` (`getRoomsByHotel`) |
| POST | `/api/rooms` | Tạo phòng mới (admin/manager) | body: `hotel_id, room_type, max_guests, price_per_night, total_quantity, status, description, amenities` | `backend/routes/roomRoutes.js:10` → `backend/controllers/roomController.js:46` (`createRoom`) |
| PUT | `/api/rooms/:id` | Cập nhật phòng (admin/manager) | param `:id`; body tương tự POST | `backend/routes/roomRoutes.js:11` → `backend/controllers/roomController.js:93` (`updateRoom`) |
| DELETE | `/api/rooms/:id` | Xóa phòng + cascade Bookings (admin/manager) | param `:id` | `backend/routes/roomRoutes.js:12` → `backend/controllers/roomController.js:157` (`deleteRoom`) |

Ghi chú: các route POST/PUT/DELETE đều đi qua middleware `verifyToken` + `requireRoles(['admin', 'manager'])` (`backend/routes/hotelRoutes.js:10-12`, `backend/routes/roomRoutes.js:10-12`) — route GET là public, không cần token.

---

## 9. Câu hỏi phản biện thường gặp & cách trả lời

**1. "Thuật toán kiểm tra phòng trống có xử lý được trường hợp đặt đồng thời (race condition) không?"**

→ **Không hoàn toàn.** `getBookedRoomCountMap` (`backend/utils/availability.js:42-74`) chỉ **đọc** (SELECT COUNT) số phòng đã đặt tại thời điểm request, không có cơ chế khóa (lock) hàng hay ràng buộc mức DB nào ngăn 2 người dùng cùng đọc "còn 1 phòng trống" và cùng tạo booking thành công. Nếu `bookingController` (không thuộc phạm vi file được giao đọc ở đây) không tự bọc bước kiểm tra + insert trong 1 transaction có khóa (`SELECT ... WITH (UPDLOCK, HOLDLOCK)` hoặc constraint DB), thì hệ thống có nguy cơ **overbooking** khi 2 request xảy ra gần như đồng thời. Đây là hạn chế thực tế cần nêu thẳng khi bị hỏi, và hướng khắc phục là dùng transaction với khóa bi quan (pessimistic lock) hoặc constraint tổng số phòng đã đặt không vượt `total_quantity` tại tầng DB.

**2. "Vì sao lọc theo amenities lại làm ở client-side (JS) thay vì SQL WHERE?"**

→ Vì `amenities` được lưu dưới dạng **chuỗi JSON** trong 1 cột `NVARCHAR(MAX)` (`amenities NVARCHAR(MAX) ... DEFAULT N'[]'`, `backend/config/db.js:84`), không phải bảng con dạng chuẩn hoá (normalized, vd bảng `HotelAmenities` với `hotel_id, amenity`). SQL Server không có toán tử JSON array containment tiện lợi như PostgreSQL (`@>`), nên viết điều kiện lọc "khách sạn có TẤT CẢ tiện ích X, Y, Z" bằng SQL thuần trên cột JSON string sẽ phức tạp (phải dùng `OPENJSON` + `EXISTS` nhiều lần). Nhóm chọn cách đơn giản hơn: parse JSON ra mảng JS bằng `parseJsonArray` (`backend/utils/sql.js:19-34`) rồi lọc bằng `Array.prototype.every/includes` (`backend/controllers/hotelController.js:220-223`). Đánh đổi: đơn giản code nhưng **không tối ưu** khi dữ liệu lớn (xem câu 4).

**3. "SQL injection được chống ra sao trong dự án này?"**

→ Toàn bộ query dùng **parameterized query** qua hàm `query(text, params)` (`backend/config/db.js:304-314`), với `mssql` package bind từng giá trị qua `request.input(key, value)` — giá trị người dùng không bao giờ được nối trực tiếp vào chuỗi SQL. Với danh sách ID động (`IN (...)`), dự án dùng `buildInClause` (`backend/utils/sql.js:5-17`) để sinh nhiều tham số riêng biệt thay vì nối chuỗi. Ví dụ cụ thể: `backend/controllers/hotelController.js:98-108` — biến `keyword` được truyền qua `{ keyword: \`%${keyword}%\` }` và bind vào placeholder `@keyword`, không phải nối vào text SQL.

**4. "Nếu dữ liệu khách sạn lớn (hàng triệu dòng) thì cách tìm kiếm hiện tại có ổn không, cải thiện thế nào?"**

→ **Không ổn.** Hiện tại `getHotels` load **toàn bộ** khách sạn khớp từ khóa (`SELECT *`, không có `LIMIT`/phân trang ở tầng SQL — `backend/controllers/hotelController.js:76, 86-94, 98-108`), rồi load toàn bộ Rooms và Feedbacks liên quan, rồi lọc/sort/paginate **hoàn toàn trên Node.js/JS** (kể cả phân trang ở frontend, `PAGE_SIZE = 9`, `frontend/my-hotel-app/src/pages/Home.js:26, 254-258`). Với hàng triệu dòng, việc này sẽ kéo toàn bộ dữ liệu vào RAM ứng dụng ở mỗi request, rất chậm. Cách cải thiện: (a) đẩy filter (price, rating, amenities) xuống SQL WHERE bằng cách chuẩn hoá schema (bảng amenities riêng, cột min_price tính sẵn/denormalize), (b) dùng phân trang ở SQL (`OFFSET/FETCH`), (c) đánh index cho các cột lọc thường dùng (`city`, `price_per_night`), (d) cân nhắc dùng full-text search hoặc search engine (Elasticsearch) cho tìm kiếm từ khóa thay vì `LIKE '%...%'` (LIKE với wildcard ở đầu chuỗi không dùng được index B-Tree thông thường).

**5. "Tại sao dùng `LIKE '%keyword%'` mà không lo bị lợi dụng ký tự đại diện SQL (`%`, `_`) do người dùng nhập?"**

→ Đây đúng là một điểm yếu nhỏ (không phải SQL injection, mà là "wildcard injection"): nếu người dùng gõ `%` hoặc `_` trong ô tìm kiếm, nó sẽ được hiểu là ký tự đại diện LIKE thật sự (vd gõ `_` sẽ khớp bất kỳ 1 ký tự nào), có thể trả kết quả rộng hơn mong đợi hoặc gây quét toàn bảng chậm hơn. Vì giá trị vẫn được bind qua tham số (`@keyword`, `backend/controllers/hotelController.js:107`) nên **không có nguy cơ injection phá vỡ câu lệnh**, chỉ ảnh hưởng độ chính xác/hiệu năng tìm kiếm. Cách khắc phục triệt để: escape `%`, `_`, `[` trước khi nối vào chuỗi keyword (vd `keyword.replace(/[%_[]/g, '[$&]')`).

**6. "Trạng thái `limited` (sắp hết phòng) được tính dựa trên điều kiện gì? Có hợp lý không?"**

→ Theo `computeRoomAvailability` (`backend/utils/availability.js:94`): `availabilityStatus = 'limited'` khi `availableQuantity <= max(1, ceil(total_quantity * 0.3))` — tức còn lại ≤ 30% tổng số phòng (làm tròn lên, tối thiểu 1). Ví dụ `total_quantity = 10` → ngưỡng "sắp hết" là còn ≤ 3 phòng. Đây là ngưỡng **hard-code cứng trong code**, không cấu hình được qua admin UI — nếu bị hỏi "khách sạn có thể tùy chỉnh ngưỡng này không", câu trả lời trung thực là "hiện chưa hỗ trợ, đây là hằng số cố định trong logic".

**7. "Vì sao `getHotelById` và `getRoomsByHotel` có logic tính availability trùng lặp nhau?"**

→ Đúng vậy, cả hai đều gọi `normalizeDateRange` → `getBookedRoomCountMap` → `computeRoomAvailability` gần như y hệt (`backend/controllers/hotelController.js:260-314` và `backend/controllers/roomController.js:12-40`). Đây là sự trùng lặp code (không vi phạm DRY một cách nghiêm trọng vì đã tách hàm dùng chung trong `availability.js`), nhưng phần **orchestration** (gọi theo thứ tự, build response) bị lặp ở 2 controller khác nhau vì chúng phục vụ 2 use-case khác nhau (trang chi tiết đầy đủ vs. API rooms riêng cho trang đặt phòng). Có thể cải thiện bằng cách gộp thành 1 service dùng chung `getHotelRoomsWithAvailability(hotelId, dateRange)`.

**8. "Trường `guests` (số khách) người dùng nhập ở HeroSearchBar có được dùng để lọc không?"**

→ **Không.** `HeroSearchBar.js` (dòng 27-34) có thu thập `guests` và gửi lên qua `onSearch`, nhưng ở `Home.js:handleHeroSearch` (dòng 270-282) trường này **không được đưa vào object `next`** để lưu vào URL/gọi API — nghĩa là dữ liệu bị "rơi" (dropped) và không ảnh hưởng đến kết quả tìm kiếm. Đây là một thiếu sót cần nêu ra nếu thầy hỏi kỹ, và hướng khắc phục là thêm field `guests`/`max_guests` vào cả URL params và điều kiện lọc ở `hotelController.js` (so `room.max_guests >= guests`).

---

## 10. Tóm tắt nhanh trước khi vào phòng bảo vệ

- **3 tầng chính**: `routes` (định tuyến + phân quyền) → `controllers` (nghiệp vụ, gọi query + tổng hợp dữ liệu) → `utils` (`availability.js` tính tình trạng phòng, `mappers.js` chuẩn hoá output, `sql.js` tiện ích SQL an toàn).
- **Không dùng ORM** — toàn bộ query SQL viết tay bằng thư viện `mssql`, tham số hoá thủ công qua object `params` và `request.input()`.
- **Amenities/images** lưu dạng chuỗi JSON trong 1 cột `NVARCHAR(MAX)`, được parse ở tầng `mappers.js`.
- **Kiểm tra phòng trống** dựa trên nguyên lý overlap khoảng thời gian `check_in < X.checkOut AND check_out > X.checkIn`, đếm qua bảng `Bookings` với status `pending`/`confirmed`.
- **Điểm yếu đã biết** (chủ động nêu khi bị hỏi): (1) không khóa transaction khi kiểm tra + đặt phòng → có race condition; (2) lọc amenities/giá/rating ở tầng ứng dụng, không scale tốt với dữ liệu lớn; (3) `guests` không thực sự được dùng để lọc; (4) `LIKE` không escape wildcard `%`/`_` do người dùng nhập.
