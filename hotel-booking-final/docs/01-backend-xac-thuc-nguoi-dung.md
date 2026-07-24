# Tài liệu bảo vệ đồ án — Module Xác thực & Quản lý người dùng (Auth/User)

---

## 1. Tổng quan chức năng

Module xác thực của dự án Hotel Booking gồm các nhóm chức năng chính:

| Nhóm | Chức năng |
|---|---|
| Đăng ký / Đăng nhập | Đăng ký tài khoản khách hàng (`customer`), đăng nhập bằng email + mật khẩu |
| Token | Sinh Access Token (JWT, hạn ngắn) + Refresh Token (chuỗi ngẫu nhiên, hạn dài, lưu DB) để cấp lại Access Token khi hết hạn |
| Phân quyền | 3 vai trò: `customer` (khách hàng), `manager` (quản lý), `admin` (quản trị viên toàn hệ thống) |
| Quên/đổi mật khẩu | `forgot-password` (sinh token reset), `reset-password` (đặt mật khẩu mới bằng token), `change-password` (đổi mật khẩu khi đã đăng nhập, yêu cầu nhập đúng mật khẩu cũ) |
| Hồ sơ cá nhân | Cập nhật họ tên, số điện thoại (`updateProfile`); email không thể đổi qua API này |
| Quản trị người dùng (Admin) | Admin/Manager xem danh sách user; chỉ Admin được tạo mới, cập nhật, khóa (`lock`), mở khóa (`unlock`) tài khoản |
| Chống brute-force cơ bản | Đếm `failed_attempts`, tự động khóa tài khoản (`status = 'locked'`) khi sai mật khẩu quá `MAX_FAILED_LOGIN_ATTEMPTS` lần (mặc định 5) |

Vai trò được lưu trong cột `role` của bảng `dbo.Users` (`admin`, `manager`, `customer`, ...), và được nhúng thẳng vào JWT payload để middleware kiểm tra nhanh không cần query DB mỗi request.

Người dùng mẫu (seed) — xem `backend/seed.js:5-42`:
- `admin@hotelbooking.local` / `123` — role `admin`
- `manager@hotelbooking.local` / `Manager@123` — role `manager`
- `lan@example.com`, `khoa@example.com` / `Customer@123` — role `customer`

---

## 2. Luồng ĐĂNG KÝ (Register) — chi tiết từng bước

### Bước 1 — Giao diện: `frontend/my-hotel-app/src/pages/Register.js`

- Form thu thập `full_name`, `email`, `phone`, `password`, `confirm_password` (`Register.js:12-18`).
- Khi submit (`Register.js:26-56`):
  1. `Register.js:31-35`: So sánh `password` với `confirm_password` ở client trước, nếu không khớp thì báo lỗi ngay, không gọi API.
  2. `Register.js:38-43`: Chuẩn hóa dữ liệu (trim, hạ chữ thường email) trước khi gửi — payload không gửi `confirm_password` lên server.
  3. `Register.js:44`: Gọi `api.post('/auth/register', payload)`.
  4. `Register.js:45-49`: Nếu server trả về `token` và `user`, gọi `login(res.data.user, res.data.token)` từ `AuthContext` để tự động đăng nhập luôn sau khi đăng ký, rồi điều hướng `navigate('/')`. Nếu không có token/user thì điều hướng sang `/login`.

### Bước 2 — Route: `backend/routes/authRoutes.js:14`

```js
router.post('/register', register);
```

Route này **không có middleware** `verifyToken` vì đăng ký là hành động công khai (ai cũng có thể gọi).

### Bước 3 — Controller: `backend/controllers/authController.js:100-170` (`exports.register`)

1. `authController.js:101`: destructure `full_name, email, phone, password` từ `req.body`.
2. `authController.js:104-107`: chuẩn hóa dữ liệu — `normalizeEmail()` (định nghĩa tại dòng 18-20) hạ chữ thường + trim email, tương tự trim tên/điện thoại.
3. `authController.js:109-111`: validate tối thiểu — nếu thiếu tên/email/mật khẩu thì trả `400`.
4. `authController.js:113-116`: kiểm tra trùng email bằng `getUserRowByEmail()` (dòng 57-68) — nếu tồn tại, trả lỗi `400 "Email đã tồn tại"`. Đây là bước chống trùng lặp tài khoản.
5. **`authController.js:118`** — dòng quan trọng nhất để giải thích khi bị hỏi về bảo mật mật khẩu:
   ```js
   const passwordHash = await bcrypt.hash(normalizedPassword, 10);
   ```
   - Dùng thư viện `bcryptjs` (import tại dòng 1).
   - Tham số `10` là **số vòng salt (salt rounds / cost factor)** — bcrypt sẽ băm mật khẩu qua `2^10 = 1024` vòng lặp nội bộ, đồng thời tự sinh salt ngẫu nhiên và nhúng luôn vào chuỗi hash đầu ra (không cần lưu salt riêng).
   - Mật khẩu **không bao giờ** được lưu ở dạng plaintext; chỉ `password_hash` được lưu vào DB.
6. `authController.js:119-147`: `INSERT INTO dbo.Users (...) OUTPUT INSERTED.*` — chèn user mới với `role = 'customer'` cố định (khách tự đăng ký luôn là customer, không thể tự đăng ký admin) và `status = 'active'`. `username` để `NULL` (không bắt buộc khi tự đăng ký).
7. `authController.js:149`: `mapUser()` (từ `backend/utils/mappers.js:9-31`) chuyển row SQL thành object chuẩn hoá (thêm `_id`, ép kiểu số, đổi tên `created_at` → `createdAt`...).
8. `authController.js:150`: **Đăng ký xong đăng nhập luôn** — gọi `signAccessToken(user)` để sinh JWT ngay, không bắt người dùng phải đăng nhập lại lần nữa.
9. `authController.js:152`: ghi log audit (`logAudit`) hành động `register`.
10. `authController.js:153-160`: gửi email thông báo đăng ký thành công (`sendRegisterSuccessEmail`), có `try/catch` riêng — nếu gửi email lỗi thì **không** làm hỏng luồng đăng ký (chỉ log lỗi ra console), thể hiện thiết kế chịu lỗi tốt.
11. `authController.js:162-166`: trả về `201` kèm `message`, `token`, và `user` (được rút gọn qua `toAuthUserPayload()` dòng 34-42 — chỉ trả `id, full_name, role, email, phone`, **không** trả `password_hash` về client).

**Sơ đồ luồng đăng ký:**
```
Register.js (form) 
  -> validate confirm_password (client)
  -> POST /auth/register 
  -> authRoutes.js:14 
  -> authController.register (authController.js:100)
       -> normalize input
       -> check email trùng (SELECT)
       -> bcrypt.hash(password, 10)
       -> INSERT Users (role=customer)
       -> sign JWT
       -> log audit + gửi email (không chặn luồng)
  -> trả 201 { token, user }
  -> AuthContext.login() lưu localStorage
  -> điều hướng "/"
```

---

## 3. Luồng ĐĂNG NHẬP (Login) — chi tiết từng bước

### Bước 1 — Giao diện: `frontend/my-hotel-app/src/pages/Login.js`

- `Login.js:19-34` (`handleSubmit`): gọi `api.post('/auth/login', form)` với `{ email, password }`; nếu thành công gọi `login(res.data.user, res.data.token)` rồi `navigate('/')`; nếu lỗi thì hiển thị `err.response?.data?.message`.

### Bước 2 — Route: `backend/routes/authRoutes.js:15`

```js
router.post('/login', login);
```

### Bước 3 — Controller: `backend/controllers/authController.js:178-251` (`exports.login`)

1. `authController.js:182`: tìm user theo email chuẩn hóa bằng `getUserRowByEmail()`.
2. `authController.js:183-185`: nếu không có user → `400 "Email không tồn tại"` (lưu ý: đây là điểm có thể bị khai thác để dò email tồn tại trong hệ thống — xem mục Hạn chế).
3. `authController.js:187-193`: kiểm tra trạng thái tài khoản — `deleted_at` hoặc `status === 'disabled'` → `403`; `status === 'locked'` → `403 "Tài khoản đang bị khóa"`.
4. **`authController.js:195`** — dòng cốt lõi kiểm tra mật khẩu:
   ```js
   const passwordMatched = await bcrypt.compare(String(password || ''), userRow.password_hash);
   ```
   `bcrypt.compare` tự tách salt ra khỏi `password_hash` đã lưu, băm lại mật khẩu người dùng nhập với salt đó, rồi so sánh hai chuỗi hash — **không bao giờ** giải mã ngược lại mật khẩu gốc (vì bcrypt là hàm băm một chiều).
5. `authController.js:196-215`: **cơ chế chống brute-force cơ bản** — nếu sai mật khẩu:
   - Tăng `failed_attempts` lên 1 (dòng 197).
   - `UPDATE ... SET failed_attempts = @failedAttempts, status = CASE WHEN @failedAttempts >= @maxFailedAttempts THEN N'locked' ELSE status END` (dòng 199-212): nếu số lần sai đạt `MAX_FAILED_LOGIN_ATTEMPTS` (mặc định 5, đọc từ biến môi trường dòng 12) thì tự động đổi `status` thành `locked`.
   - Trả về `400 "Sai mật khẩu"`.
6. Nếu mật khẩu đúng:
   - `authController.js:217-218`: sinh `refreshToken` là chuỗi ngẫu nhiên 32 byte dạng hex (`crypto.randomBytes(32).toString('hex')`, hàm `newOpaqueToken()` dòng 30-32) — đây là **refresh token dạng opaque** (không phải JWT), có hạn `REFRESH_TOKEN_EXPIRES_DAYS` (mặc định 30 ngày, dòng 10).
   - `authController.js:220-236`: reset `failed_attempts = 0`, cập nhật `last_login`, và lưu **hash SHA-256** của refresh token (`sha256(refreshToken)`, hàm dòng 14-16) vào cột `refresh_token_hash` — **không lưu refresh token gốc trong DB**, giống nguyên lý lưu mật khẩu (dù SHA-256 không có salt, khác bcrypt, vì đây là token ngẫu nhiên chứ không phải mật khẩu người dùng chọn nên không cần chống dò từ điển).
   - `authController.js:238-239`: lấy lại user mới nhất từ DB, gọi `signAccessToken()`.
   - **`authController.js:22-28`** — hàm sinh JWT:
     ```js
     function signAccessToken(user) {
       return jwt.sign(
         { id: String(user.id), role: user.role, email: user.email },
         process.env.JWT_SECRET,
         { expiresIn: ACCESS_TOKEN_EXPIRES_IN }
       );
     }
     ```
     - **Payload JWT** chứa: `id`, `role`, `email` (không chứa mật khẩu hay dữ liệu nhạy cảm).
     - **Thuật toán**: mặc định của `jsonwebtoken` khi không truyền `algorithm` là **HS256** (HMAC-SHA256, ký đối xứng bằng `JWT_SECRET`).
     - **Thời gian hết hạn**: `ACCESS_TOKEN_EXPIRES_IN`, đọc từ biến môi trường, mặc định `'7d'` (7 ngày) — xem dòng 9.
   - `authController.js:241`: ghi log audit hành động `login`.
   - `authController.js:243-247`: trả về `{ token, refresh_token, user }` — `token` là Access Token (JWT), `refresh_token` là chuỗi opaque để gọi API `/auth/refresh` sau này.

**Sơ đồ luồng đăng nhập:**
```
Login.js -> POST /auth/login -> authRoutes.js:15
  -> authController.login (authController.js:178)
       -> tìm user theo email
       -> kiểm tra status (disabled/locked)
       -> bcrypt.compare(password, password_hash)
            -> sai: tăng failed_attempts, có thể tự khóa tài khoản -> 400
            -> đúng: sinh refresh_token (random) + JWT access token (HS256, 7d)
                     lưu SHA-256(refresh_token) vào DB
       -> trả { token, refresh_token, user }
  -> AuthContext.login() lưu localStorage("token","user")
  -> navigate("/")
```

### Luồng phụ: Refresh Token — `authController.js:256-286` (`exports.refresh`)

- Client gửi `refresh_token` (chuỗi gốc) trong body.
- `authController.js:263`: server băm SHA-256 chuỗi nhận được rồi tìm user có `refresh_token_hash` khớp — vì vậy dù DB bị lộ, kẻ tấn công cũng không lấy được refresh token gốc để giả mạo.
- `authController.js:276-278`: kiểm tra hạn `refresh_token_expiry`; nếu hết hạn thì `401`.
- `authController.js:281-282`: nếu hợp lệ, ký lại Access Token mới (JWT) và trả về — refresh token không đổi (không rotate), đây cũng là điểm có thể nêu là hạn chế.

### Luồng phụ: Quên/Đặt lại mật khẩu

- `forgotPassword` (`authController.js:293-331`): sinh token reset ngẫu nhiên (`newOpaqueToken()`), lưu **hash SHA-256** + hạn `RESET_PASSWORD_EXPIRES_MINUTES` (mặc định 30 phút, dòng 11) vào DB. Luôn trả về cùng một thông báo chung chung dù email có tồn tại hay không (dòng 302, 322) để **tránh lộ thông tin email nào đã đăng ký** (chống "user enumeration"). Token gốc chỉ được trả trong response khi ở môi trường non-production và bật cờ `EXPOSE_RESET_TOKEN=true` (dòng 323-325) — vì dự án chưa tích hợp gửi email thật cho bước này (khác với email đăng ký ở `sendRegisterSuccessEmail`).
- `resetPassword` (`authController.js:337-381`): tra token qua hash, kiểm tra hạn, sau đó băm lại mật khẩu mới bằng `bcrypt.hash(new_password, 10)` (dòng 373) và xóa toàn bộ token liên quan (reset token, refresh token) + reset `failed_attempts`, mở khóa nếu đang `locked` (dòng 357-375).
- `changePassword` (`authController.js:419-457`, yêu cầu đăng nhập): bắt buộc nhập đúng `current_password` (so sánh bằng `bcrypt.compare`, dòng 432) trước khi cho đổi mật khẩu mới; đổi mật khẩu xong sẽ **thu hồi refresh token hiện tại** (set `NULL`, dòng 442-443) để buộc phải đăng nhập lại trên các phiên khác.

---

## 4. Middleware xác thực — `backend/middleware/authMiddleware.js`

File này export 4 hàm: `verifyToken`, `optionalToken`, `isAdmin`, `requireRoles`.

### 4.1. Trích xuất token — `authMiddleware.js:6-18` (`extractBearerToken`)

```js
function extractBearerToken(req) {
  const authHeader = req.headers.authorization || req.headers.Authorization;
  ...
  const [scheme, token] = authHeader.split(' ');
  if (scheme !== 'Bearer' || !token) return null;
  return token;
}
```
Chuẩn: client phải gửi header `Authorization: Bearer <token>`.

### 4.2. `verifyToken` — `authMiddleware.js:24-36`

```js
const verifyToken = (req, res, next) => {
  const token = extractBearerToken(req);
  if (!token) return res.status(401).json({ message: 'Không có token' });
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    return next();
  } catch {
    return res.status(403).json({ message: 'Token không hợp lệ' });
  }
};
```
- Không có token → `401 Unauthorized` (chưa xác thực).
- Có token nhưng sai/hết hạn (bắt exception từ `jwt.verify`) → `403 Forbidden`.
- Nếu hợp lệ: `jwt.verify` giải mã payload (chứa `id`, `role`, `email` đã ký ở bước login/register) và **gắn thẳng vào `req.user`** (dòng 31) để các controller phía sau dùng (ví dụ `req.user.id` tại `authController.js:399`, `authController.js:422`).
- Đây cũng là nơi JWT tự động kiểm tra **chữ ký** (`JWT_SECRET`) và **hạn dùng** (`exp` được `jsonwebtoken` tự nhúng theo `expiresIn` lúc sign) — token bị sửa đổi hoặc hết hạn sẽ ném exception và rơi vào nhánh `catch`.

### 4.3. `optionalToken` — `authMiddleware.js:38-51`

Dùng cho các route công khai nhưng muốn biết "nếu có đăng nhập thì là ai" (ví dụ hiển thị nội dung cá nhân hóa) — không có token vẫn cho qua (`next()`), có token lỗi thì gán `req.user = null` thay vì chặn request.

### 4.4. `isAdmin` — `authMiddleware.js:53-59`

```js
const isAdmin = (req, res, next) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Không có quyền admin' });
  }
  return next();
};
```
Middleware này **phải được đặt sau `verifyToken`** trong chuỗi route vì nó đọc `req.user.role` — nếu dùng đứng một mình mà chưa qua `verifyToken`, `req.user` sẽ `undefined` và code sẽ crash (lỗi tiềm ẩn, không có kiểm tra `req.user` tồn tại trước khi đọc `.role`). Thực tế trong dự án, `isAdmin` được định nghĩa nhưng **không thấy được sử dụng trực tiếp** trong `userRoutes.js` — route dùng `requireRoles(['admin'])` thay thế.

### 4.5. `requireRoles(roles)` — `authMiddleware.js:61-75`

Middleware factory (hàm trả về hàm) linh hoạt hơn `isAdmin`:
```js
const requireRoles = (roles = []) => (req, res, next) => {
  if (!req.user || !req.user.role) return res.status(401).json({ message: 'Không có token' });
  if (!Array.isArray(roles) || roles.length === 0) return next();
  if (!roles.includes(req.user.role)) return res.status(403).json({ message: 'Không có quyền truy cập' });
  return next();
};
```
- Có kiểm tra `req.user` tồn tại (an toàn hơn `isAdmin`).
- Dùng thực tế tại `backend/routes/userRoutes.js`:
  - `userRoutes.js:11`: `verifyToken, requireRoles(['admin', 'manager'])` cho GET danh sách user (admin và manager đều xem được).
  - `userRoutes.js:12-15`: `verifyToken, requireRoles(['admin'])` cho tạo/sửa/khóa/mở khóa user — **chỉ admin** mới được phép.

**Kết luận về chặn quyền admin**: việc kiểm tra quyền hoàn toàn diễn ra **ở backend, trong middleware, dựa trên `role` được ký cứng bên trong JWT** — client không thể tự sửa role trong token vì token có chữ ký HMAC bằng `JWT_SECRET` (bí mật chỉ server biết); nếu sửa payload mà không có secret, `jwt.verify` sẽ báo lỗi và bị chặn ở `verifyToken`.

---

## 5. Frontend — `AuthContext.js`

File `frontend/my-hotel-app/src/context/AuthContext.js`:

- `AuthContext.js:4`: tạo `React Context` bằng `createContext()`.
- `AuthContext.js:12-15`: khi App khởi động, `useState` đọc `localStorage.getItem('user')` — nếu có, `JSON.parse` để khôi phục lại state `user` ngay (giúp không bị mất đăng nhập khi refresh trang, vì state React sẽ mất khi reload).
- `AuthContext.js:17-21` (`login`):
  ```js
  const login = (userData, token) => {
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(userData));
    setUser(userData);
  };
  ```
  **Access token JWT được lưu trong `localStorage` dưới key `"token"`**, và thông tin user (đã lược bỏ password) lưu dưới key `"user"`.
- `AuthContext.js:23-27` (`logout`): xóa cả `token` và `user` khỏi `localStorage`, set `user = null` trong state — đăng xuất hoàn toàn phía client (lưu ý: **không gọi API nào lên server để thu hồi refresh token**, xem mục Hạn chế).
- `AuthContext.js:36`: `useAuth()` — custom hook để bất kỳ component nào (`Login.js`, `Register.js`, `Profile.js`, `AdminRoute.js`...) gọi `const { user, login, logout } = useAuth();` mà không cần import Context trực tiếp.
- Token được gắn vào header Authorization ở đâu? Không nằm trong file này — nằm trong `frontend/my-hotel-app/src/services/api.js` (interceptor Axios đọc `localStorage.getItem('token')`, gắn header `Authorization: Bearer <token>` cho mỗi request) — nên nhắc tới file này khi được hỏi "vậy token gắn vào request lúc nào".

---

## 6. Frontend — `AdminRoute.js` (chặn route ở phía giao diện)

`frontend/my-hotel-app/src/components/AdminRoute.js:10-16`:

```js
export default function AdminRoute() {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (!['admin', 'manager'].includes(user.role)) return <Navigate to="/" replace />;
  return <Outlet />;
}
```

- Đây là một **Layout Route** dùng với React Router (`<Outlet />` render các route con lồng bên trong nó).
- Logic: chưa đăng nhập (`user` null) → điều hướng `/login`; đã đăng nhập nhưng role không thuộc `['admin', 'manager']` → điều hướng về trang chủ `/`; ngược lại render các trang admin con qua `<Outlet />`.
- **Quan trọng khi bị hỏi phản biện**: đây **chỉ là chặn UI/UX** (ẩn/redirect trang), **hoàn toàn không phải là lớp bảo mật thật sự** — vì `user.role` lấy từ `localStorage` (dữ liệu client hoàn toàn có thể bị sửa bằng DevTools/Console, ví dụ gõ `localStorage.setItem('user', JSON.stringify({...role:"admin"}))`). Nếu chỉ sửa localStorage mà không có JWT hợp lệ tương ứng, mọi lời gọi API admin thật sự vẫn sẽ bị chặn ở backend bởi `requireRoles(['admin'])` trong `userRoutes.js` vì token gửi kèm không có role admin hợp lệ (được ký bởi server). => **Bảo mật thật nằm ở backend (JWT + middleware), `AdminRoute.js` chỉ là lớp trải nghiệm người dùng.**

---

## 7. Bảng toàn bộ API endpoint liên quan Auth/User

| Method | Path | Mô tả | Cần token? | Yêu cầu role | File xử lý |
|---|---|---|---|---|---|
| POST | `/auth/register` | Đăng ký tài khoản khách hàng mới | Không | — | `authController.js:100` (route: `authRoutes.js:14`) |
| POST | `/auth/login` | Đăng nhập, trả JWT + refresh token | Không | — | `authController.js:178` (route: `authRoutes.js:15`) |
| POST | `/auth/refresh` | Cấp lại Access Token mới từ refresh token | Không (dùng refresh_token thay thế) | — | `authController.js:256` (route: `authRoutes.js:16`) |
| POST | `/auth/forgot-password` | Yêu cầu đặt lại mật khẩu, sinh reset token | Không | — | `authController.js:293` (route: `authRoutes.js:17`) |
| POST | `/auth/reset-password` | Đặt mật khẩu mới bằng reset token | Không | — | `authController.js:337` (route: `authRoutes.js:18`) |
| PUT | `/auth/profile` | Cập nhật họ tên, số điện thoại cá nhân | Có (Bearer JWT) | Bất kỳ user đã đăng nhập | `authController.js:387` (route: `authRoutes.js:21`, middleware `verifyToken`) |
| PUT | `/auth/change-password` | Đổi mật khẩu (yêu cầu mật khẩu hiện tại) | Có (Bearer JWT) | Bất kỳ user đã đăng nhập | `authController.js:419` (route: `authRoutes.js:22`, middleware `verifyToken`) |
| GET | `/users` (userRoutes) | Danh sách toàn bộ user (chưa xóa mềm) | Có | `admin` hoặc `manager` | `userController.js:68` (route: `userRoutes.js:11`) |
| POST | `/users` | Tạo user mới (admin tạo, có thể set role bất kỳ) | Có | `admin` | `userController.js:85` (route: `userRoutes.js:12`) |
| PUT | `/users/:id` | Cập nhật thông tin/role/status/mật khẩu user | Có | `admin` | `userController.js:146` (route: `userRoutes.js:13`) |
| PATCH | `/users/:id/lock` | Khóa tài khoản user | Có | `admin` | `userController.js:216` (route: `userRoutes.js:14`) |
| PATCH | `/users/:id/unlock` | Mở khóa + reset `failed_attempts` | Có | `admin` | `userController.js:243` (route: `userRoutes.js:15`) |

*(Ghi chú: đường dẫn gốc `/auth` và `/users` phụ thuộc cách mount router trong `backend/app.js`/`server.js` — hai router `authRoutes.js` và `userRoutes.js` được import và gắn prefix ở file khởi động server, không trình bày lại ở đây vì không nằm trong phạm vi được yêu cầu đọc.)*

---

## 8. Câu hỏi phản biện thường gặp & cách trả lời

**Câu 1: JWT là gì, vì sao dùng JWT thay vì session truyền thống?**

> JWT (JSON Web Token) là một chuỗi token tự chứa thông tin (self-contained), gồm 3 phần `header.payload.signature`, được ký số (ở đây bằng thuật toán HS256 – HMAC SHA-256 với khóa bí mật `JWT_SECRET`). Server không cần lưu trạng thái phiên đăng nhập (stateless) — chỉ cần verify chữ ký là biết token hợp lệ và lấy được `id/role/email` ngay từ payload mà không cần truy vấn DB hay lưu session ở bộ nhớ/Redis. Điều này giúp hệ thống dễ scale ngang (nhiều server không cần chia sẻ session store). Trong `authController.js:22-28`, payload JWT chỉ chứa `id, role, email`, hạn dùng 7 ngày (`ACCESS_TOKEN_EXPIRES_IN`).
> Đánh đổi: JWT khó thu hồi giữa chừng (revoke) trước khi hết hạn — đây là lý do dự án có thêm cơ chế Refresh Token lưu trong DB để ít nhất kiểm soát được việc cấp Access Token mới.

**Câu 2: Vì sao dùng bcrypt mà không phải MD5/SHA-256 để lưu mật khẩu?**

> MD5/SHA-256 là hàm băm nhanh (fast hash) — thiết kế để tính toán nhanh, nên kẻ tấn công có thể brute-force hàng tỷ lần thử/giây bằng GPU, hoặc dùng rainbow table để dò ngược. bcrypt được thiết kế **chủ đích chậm** và có tham số "cost factor" (ở đây là `10`, tức `2^10` vòng lặp, `authController.js:118`) để tăng thời gian tính toán mỗi lần băm — muốn tăng độ khó thì chỉ cần tăng số này. Ngoài ra bcrypt **tự sinh salt ngẫu nhiên cho từng user** và nhúng salt vào chuỗi hash đầu ra, nên hai user cùng mật khẩu vẫn ra hash khác nhau, chống được rainbow table. Đây là lý do dự án dùng SHA-256 (`sha256()` tại `authController.js:14-16`) chỉ cho refresh token/reset token (dữ liệu ngẫu nhiên, không phải mật khẩu người dùng chọn nên không cần chống dò từ điển), còn mật khẩu luôn dùng `bcrypt.hash(..., 10)`.

**Câu 3: Access Token hết hạn thì xử lý thế nào? Refresh Token hoạt động ra sao?**

> Access Token (JWT) có hạn 7 ngày. Khi hết hạn, các API cần đăng nhập sẽ trả lỗi (dòng `authMiddleware.js:33-35`, do `jwt.verify` ném exception khi token hết hạn → middleware trả `403`). Client khi đó gọi `POST /auth/refresh` kèm `refresh_token` (chuỗi ngẫu nhiên nhận lúc login) để xin cấp lại Access Token mới, mà không cần đăng nhập lại bằng mật khẩu (`authController.js:256-286`). Refresh Token có hạn dài hơn (30 ngày, `REFRESH_TOKEN_EXPIRES_DAYS`), được lưu **dưới dạng hash SHA-256** trong DB (không lưu bản gốc) để hạn chế rủi ro nếu DB bị lộ.
> *Lưu ý thành thật nếu bị hỏi sâu*: dự án hiện **chưa implement refresh-token rotation** (mỗi lần refresh không sinh refresh token mới) và **frontend hiện tại (`services/api.js`) cần được kiểm tra xem đã tự động gọi `/auth/refresh` khi gặp lỗi 401/403 hay chưa** — nếu chưa, người dùng sẽ phải đăng nhập lại thủ công khi access token hết hạn dù refresh token vẫn còn hạn.

**Câu 4: Làm sao chống được tấn công đăng nhập brute-force? (đây có phải điểm cần cải thiện không?)**

> Dự án có một cơ chế chống brute-force **ở mức cơ bản**: đếm `failed_attempts` trong bảng `Users`, và tự động khóa tài khoản (`status = 'locked'`) nếu sai quá `MAX_FAILED_LOGIN_ATTEMPTS` (mặc định 5 lần) — xem `authController.js:196-215`. Tài khoản bị khóa sẽ không đăng nhập được nữa cho tới khi Admin mở khóa (`userController.js:243-269`) hoặc người dùng reset mật khẩu thành công (tự động mở khóa, `authController.js:367`).
> **Hạn chế thật sự cần nêu trung thực**: cơ chế này khóa theo **tài khoản (account lockout)**, không có **rate-limiting theo IP** (ví dụ dùng `express-rate-limit`) ở tầng route `authRoutes.js`. Điều này có 2 rủi ro: (1) kẻ tấn công có thể dùng brute-force để cố tình khóa hàng loạt tài khoản người dùng khác (Denial of Service qua account lockout); (2) không giới hạn được số request/giây nói chung nên vẫn có thể bị dò email tồn tại (xem câu 5) ở tốc độ cao trước khi tài khoản bị khóa. Đây là điểm cải thiện hợp lý nếu giảng viên hỏi "còn thiếu gì" — có thể đề xuất thêm rate-limit theo IP + CAPTCHA sau N lần sai.

**Câu 5: Có lộ thông tin email nào đã đăng ký hay không (user enumeration)?**

> Có một điểm không nhất quán đáng lưu ý: ở luồng login, nếu email không tồn tại, server trả thông báo riêng biệt `"Email không tồn tại"` (`authController.js:184`), khác với thông báo khi sai mật khẩu (`"Sai mật khẩu"`, dòng 214) — kẻ tấn công có thể lợi dụng sự khác biệt này để dò xem một email có tồn tại trong hệ thống hay không (user enumeration). Ngược lại, ở luồng `forgotPassword`, dự án đã xử lý đúng: luôn trả về **cùng một thông báo chung chung** dù email tồn tại hay không (`authController.js:302, 322`) để tránh lộ thông tin. => Đây là điểm có thể nêu ra như một hạn chế bảo mật nhỏ ở luồng login, và đối sánh với cách làm đúng ở luồng forgot-password để cho thấy hiểu bản chất vấn đề.

**Câu 6: Phân quyền admin được kiểm tra ở đâu? Người dùng có thể bypass được không?**

> Phân quyền được kiểm tra **hoàn toàn ở backend**, cụ thể tại middleware `requireRoles(['admin'])` / `requireRoles(['admin','manager'])` gắn trên từng route trong `backend/routes/userRoutes.js:11-15`, dựa vào `req.user.role` được middleware `verifyToken` (`authMiddleware.js:24-36`) giải mã từ JWT. Vì JWT được ký bằng `JWT_SECRET` (HMAC, chỉ server biết), người dùng **không thể tự sửa `role` trong token** để giả làm admin — nếu cố tình sửa payload mà không ký lại đúng secret, `jwt.verify` sẽ báo lỗi ngay tại `authMiddleware.js:31` (rơi vào catch, trả `403`).
> Ở phía frontend, `AdminRoute.js:10-16` cũng chặn hiển thị route admin dựa theo `user.role` lấy từ `localStorage`, nhưng đây **chỉ là UX**, không phải bảo mật — sửa localStorage chỉ ẩn/hiện giao diện, không thể gọi thành công API admin thật vì token gửi kèm request vẫn không có quyền admin hợp lệ. Điểm mấu chốt cần nhấn mạnh: **không bao giờ được tin dữ liệu phía client, mọi kiểm tra quyền quan trọng phải nằm ở backend** — và dự án này tuân thủ đúng nguyên tắc đó cho phần authorization.

**Câu 7 (dự phòng): Vì sao đăng nhập trả về cả `token` và `refresh_token` riêng biệt, không gộp làm một?**

> Vì hai token có mục đích khác nhau: `token` (Access Token, JWT) dùng để xác thực mỗi request tới API, nên có hạn ngắn (7 ngày) để giảm thiệt hại nếu bị đánh cắp; `refresh_token` chỉ dùng cho một API duy nhất là `/auth/refresh` để xin cấp Access Token mới, có hạn dài hơn (30 ngày) nhưng được lưu dạng hash trong DB nên có thể vô hiệu hóa được (ví dụ khi đổi mật khẩu, `authController.js:442-443` set về `NULL`) — giúp cân bằng giữa bảo mật (access token ngắn hạn) và trải nghiệm người dùng (không phải đăng nhập lại bằng mật khẩu liên tục).

**Câu 8 (dự phòng): Tại sao khi đổi mật khẩu / reset mật khẩu lại xóa `refresh_token_hash`?**

> Để **thu hồi (revoke)** các phiên đăng nhập cũ đang tồn tại trên các thiết bị khác ngay khi mật khẩu bị đổi — coi như "đăng xuất khỏi mọi nơi". Xem `authController.js:363-365` (reset password) và `authController.js:442-443` (change password): cả hai đều set `refresh_token_hash`/`refresh_token_expiry` về `NULL`, khiến các refresh token cũ không còn khớp với DB nữa và không thể dùng để xin Access Token mới, buộc phải đăng nhập lại bằng mật khẩu mới.

---

## 9. Tóm tắt nhanh để học thuộc (cheat sheet)

- Băm mật khẩu: `bcrypt.hash(password, 10)` — 10 = salt rounds (`authController.js:118`).
- So khớp mật khẩu: `bcrypt.compare(password, hash)` (`authController.js:195`, `authController.js:432`).
- JWT: thuật toán mặc định **HS256**, payload `{id, role, email}`, hạn `7d` (`authController.js:22-28`).
- Refresh token: chuỗi random 32 byte hex, hạn 30 ngày, lưu **SHA-256 hash** trong DB (`authController.js:30-32`, `217-235`).
- Reset password token: cùng cơ chế opaque + SHA-256 hash, hạn 30 phút (`authController.js:11`, `305-320`).
- Chống brute-force: đếm `failed_attempts`, khóa sau 5 lần sai (`authController.js:196-215`) — **chưa có** rate-limit theo IP/CAPTCHA (hạn chế).
- Middleware: `verifyToken` giải mã & gắn `req.user`; `requireRoles([...])` kiểm tra `req.user.role` nằm trong danh sách cho phép (`authMiddleware.js`).
- Frontend lưu token: `localStorage` key `"token"` (JWT) và `"user"` (`AuthContext.js:17-21`).
- Chặn UI admin: `AdminRoute.js` — chỉ là redirect, không phải bảo mật thật; bảo mật thật nằm ở backend middleware.
