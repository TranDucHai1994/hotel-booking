# 06 — Frontend: Kiến trúc chung & Thành phần dùng chung (App, Router, Axios, Theme, Navbar, Footer)

---

## 1. Tổng quan kiến trúc frontend

Frontend là một **Single Page Application (SPA)** viết bằng **React**, nằm tại:
`frontend/my-hotel-app/`

Cấu trúc thư mục `src/` được tổ chức theo *loại chức năng* (feature-by-type), không phải theo module nghiệp vụ:

| Thư mục | Vai trò |
|---|---|
| `src/pages/` | Mỗi file là **một trang hoàn chỉnh** ứng với 1 route (Home, Login, BookingPage, admin/Dashboard...) |
| `src/components/` | Các **thành phần dùng lại nhiều nơi** (Navbar, Footer, AdminRoute, HeroSearchBar, HotelListingSection...) |
| `src/context/` | Các **React Context** giữ state toàn cục, chia sẻ xuyên suốt cây component mà không cần truyền props qua nhiều tầng (AuthContext, ThemeContext) |
| `src/services/` | Nơi cấu hình **gọi API** (axios instance) — tầng trung gian giữa UI và Backend |
| `src/index.css` | CSS gốc, khai báo Tailwind + biến CSS (design token) cho dark/light mode |
| `src/App.js` | Khai báo toàn bộ **route** của ứng dụng |
| `src/index.js` | Điểm khởi động (entry point), render `<App />` vào DOM |

Luồng dữ liệu tổng quát: `Component (pages/) → gọi api.js (axios) → Backend Express → trả JSON → Component cập nhật state → render lại giao diện`. Đây là mô hình SPA điển hình: trình duyệt chỉ tải 1 lần `index.html` + bundle JS, sau đó `react-router-dom` tự vẽ lại nội dung khi đổi URL mà **không reload trang**.

---

## 2. `App.js` — Khai báo route toàn ứng dụng

File: `frontend/my-hotel-app/src/App.js`

### 2.1 Cấu trúc Provider lồng nhau (dòng 27-72)

```
<AuthProvider>          // dòng 30 — cung cấp user/login/logout toàn app
  <ThemeProvider>        // dòng 32 — cung cấp theme sáng/tối toàn app
    <BrowserRouter>       // dòng 34 — bật SPA routing (URL không reload)
      <Navbar />           // dòng 37 — luôn hiển thị đầu trang
      <Routes>…</Routes>    // dòng 40-62 — nội dung thay đổi theo URL
      <Footer />            // dòng 66 — luôn hiển thị cuối trang
```

Nguyên tắc: Provider càng cần thiết sớm (Auth) thì bọc càng ngoài, để component nào bên trong cũng có thể `useAuth()`/`useTheme()`.

### 2.2 Bảng route đầy đủ (dòng 42-61)

| Path | Component | File nguồn | Có bảo vệ? |
|---|---|---|---|
| `/` | `Home` | `pages/Home.js` | Không |
| `/hotels` | `Home` | `pages/Home.js` | Không (alias trùng component với `/`) |
| `/premium-demo` | `PremiumDemo` | `pages/PremiumDemo.js` | Không — **trang demo UI, không thuộc nghiệp vụ** (xem mục 8) |
| `/hotels/:id` | `HotelDetail` | `pages/HotelDetail.js` | Không |
| `/book/:hotelId/:roomId` | `BookingPage` | `pages/BookingPage.js` | Không (route công khai, nhưng logic bên trong trang có thể tự kiểm tra `user`) |
| `/login` | `Login` | `pages/Login.js` | Không |
| `/register` | `Register` | `pages/Register.js` | Không |
| `/my-bookings` | `MyBookings` | `pages/MyBookings.js` | Không (route không guard, nhưng API bên trong sẽ trả lỗi 401 nếu chưa đăng nhập) |
| `/profile` | `Profile` | `pages/Profile.js` | Không |
| `/admin` | `Dashboard` | `pages/admin/Dashboard.js` | **Có** — qua `AdminRoute` |
| `/admin/hotels` | `AdminHotels` | `pages/admin/Hotels.js` | **Có** |
| `/admin/rooms` | `AdminRooms` | `pages/admin/Rooms.js` | **Có** |
| `/admin/bookings` | `AdminBookings` | `pages/admin/Bookings.js` | **Có** |
| `/admin/feedbacks` | `AdminFeedbacks` | `pages/admin/Feedbacks.js` | **Có** |
| `/admin/users` | `AdminUsers` | `pages/admin/Users.js` | **Có** |

### 2.3 Cơ chế bảo vệ route Admin (App.js dòng 54-61 + AdminRoute.js)

```js
<Route element={<AdminRoute />}>       // App.js:54
  <Route path="/admin" element={<Dashboard />} />   // App.js:55
  ...
</Route>                                 // App.js:61
```

Đây là kỹ thuật **"layout route" / nested route của react-router-dom v6**: `AdminRoute` không nhận `path`, nó bọc quanh 6 route con và dùng `<Outlet />` để render route con nếu hợp lệ.

Nội dung `AdminRoute.js` (toàn bộ file):

```js
// frontend/my-hotel-app/src/components/AdminRoute.js:10-16
export default function AdminRoute() {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (!['admin', 'manager'].includes(user.role)) return <Navigate to="/" replace />;
  return <Outlet />;
}
```

Giải thích:
- `AdminRoute.js:13` — chưa đăng nhập (`user` null) → redirect `/login`.
- `AdminRoute.js:14` — đã đăng nhập nhưng role không phải `admin`/`manager` → redirect về trang chủ `/`.
- `AdminRoute.js:15` — hợp lệ → `<Outlet />` render route con tương ứng.

**Lưu ý khi bị hỏi**: đây chỉ là bảo vệ ở **phía client (UI)**. Nó ngăn người dùng thường *nhìn thấy* giao diện admin, nhưng **không thay thế cho việc bảo vệ API ở backend** (middleware `verifyToken`/`checkRole` phía Express) — nếu chỉ dựa vào `AdminRoute` mà API không kiểm tra quyền, người dùng vẫn có thể gọi thẳng API bằng Postman/curl để bypass.

### 2.4 `PremiumDemo` không nằm trong 2 nhóm route trên

Route `/premium-demo` (App.js:44) được khai báo riêng lẻ ngoài nhóm Guest/Admin, dùng để xem thử giao diện — xem chi tiết ở mục 7.

---

## 3. `index.js` — Điểm khởi động ứng dụng

File: `frontend/my-hotel-app/src/index.js`

- Dòng 8: `ReactDOM.createRoot(document.getElementById('root'))` — lấy thẻ `<div id="root">` trong `public/index.html` làm nơi React "cắm rễ".
- Dòng 11-30: `root.render(...)` vẽ cây component vào DOM đó.
- Dòng 13 (`<React.StrictMode>`): chỉ có tác dụng ở môi trường **development**, giúp phát hiện side-effect không an toàn (không ảnh hưởng bản build production).
- Dòng 15-28 (`<Toaster />`): thư viện `react-hot-toast`, hiển thị thông báo popup góc màn hình. Cấu hình sẵn màu xanh cho `success` và đỏ cho `error`, tồn tại 3000ms (`duration: 3000`, dòng 26).
- Dòng 29: `<App />` — toàn bộ ứng dụng thực sự nằm trong `App.js`, `index.js` chỉ là nơi "cắm" nó vào trang HTML.

---

## 4. `services/api.js` — Cấu hình Axios dùng chung

File: `frontend/my-hotel-app/src/services/api.js`

### 4.1 Tạo axios instance với baseURL cố định (dòng 10-12)

```js
const api = axios.create({
  baseURL: 'http://localhost:4000/api',
});
```

- **Đây là điểm cần lưu ý/hạn chế thật sự**: baseURL đang bị **hard-code** thẳng vào code (`api.js:11`), **không** đọc từ biến môi trường `process.env.REACT_APP_API_URL` như cách làm chuẩn của Create React App. Hệ quả: khi deploy lên môi trường khác (staging/production với domain khác `localhost:4000`), phải sửa trực tiếp source code và build lại, thay vì chỉ đổi file `.env`. Nếu bị hỏi "vì sao không dùng biến môi trường?", nên trả lời trung thực đây là điểm có thể cải thiện, và nêu hướng sửa: `baseURL: process.env.REACT_APP_API_URL || 'http://localhost:4000/api'`.

### 4.2 Request Interceptor — tự động đính JWT token (dòng 15-19)

```js
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');       // api.js:16
  if (token) config.headers.Authorization = `Bearer ${token}`;  // api.js:17
  return config;
});
```

Cơ chế: **mọi** request gửi qua instance `api` (import từ file này) đều tự động chạy qua hàm này trước khi thực sự gửi đi. Nếu `localStorage` có `token` (được lưu khi đăng nhập — xem `AuthContext.js:18`), nó sẽ gắn header `Authorization: Bearer <token>`. Nhờ vậy các trang gọi API (MyBookings, Profile, admin/*...) không cần tự viết code gắn token thủ công mỗi lần gọi.

### 4.3 Response Interceptor — tự động xử lý lỗi xác thực & logout (dòng 22-49)

```js
api.interceptors.response.use(
  (res) => res,
  (error) => {
    const status = error?.response?.status;                 // api.js:25
    const message = error?.response?.data?.message;          // api.js:26
    const authMessages = [ ... ];                              // api.js:27-32
    const isAuthError = status === 401 || (status === 403 && authMessages.includes(message)); // api.js:34

    if (isAuthError) {
      localStorage.removeItem('token');   // api.js:37
      localStorage.removeItem('user');    // api.js:38
      if (window.location.pathname !== '/login') window.location.assign('/login'); // api.js:40
      error.__authRedirect = true;        // api.js:44
    }
    return Promise.reject(error);
  }
);
```

Giải thích logic từng dòng:
- `api.js:34` — coi là lỗi xác thực nếu status `401` (Unauthorized), **hoặc** status `403` kèm message khớp với danh sách câu thông báo "token không hợp lệ/không có token" (cả bản không dấu và có dấu, do backend có thể trả 1 trong 2 dạng chuỗi).
- `api.js:37-38` — nếu đúng là lỗi xác thực: xoá `token` và `user` khỏi `localStorage` (tức logout tự động).
- `api.js:40` — chuyển hướng trình duyệt về `/login` bằng `window.location.assign` (reload cứng, không phải điều hướng SPA) — chỉ làm việc này nếu đang **không ở sẵn** trang `/login` (tránh vòng lặp redirect).
- `api.js:44` — gắn cờ `__authRedirect = true` lên object lỗi để nơi gọi API (nếu muốn) có thể phân biệt "lỗi đã tự xử lý redirect" và không cần hiển thị thêm toast lỗi trùng lặp.
- `api.js:47` — vẫn `reject` lỗi để nơi gọi (`try/catch` trong component) có thể xử lý thêm nếu cần (ví dụ ẩn loading spinner).

Đây chính là **axios interceptor pattern** — kỹ thuật "middleware" phía client giúp tập trung xử lý auth ở một nơi duy nhất thay vì lặp lại ở từng lời gọi API.

---

## 5. `context/ThemeContext.js` — Cơ chế Dark mode / Light mode

File: `frontend/my-hotel-app/src/context/ThemeContext.js`

### 5.1 Lưu trữ preference (dòng 3, 12-15, 25)

```js
const STORAGE_KEY = 'hotel-booking-theme';         // ThemeContext.js:3

function readInitialTheme() {
  const savedTheme = localStorage.getItem(STORAGE_KEY);  // ThemeContext.js:13
  return savedTheme === 'dark' ? 'dark' : 'light';        // ThemeContext.js:14
}
```

- Theme được lưu trong **`localStorage`** với key `'hotel-booking-theme'` (khác hẳn key `'token'`/`'user'` của Auth).
- Khi khởi tạo state (`useState(readInitialTheme)` — dòng 18), component đọc ngay giá trị đã lưu, mặc định `'light'` nếu chưa từng chọn hoặc giá trị không hợp lệ.
- Dòng 25: mỗi lần `theme` đổi, `localStorage.setItem(STORAGE_KEY, theme)` ghi lại giá trị mới → lần truy cập sau (F5, mở tab mới) vẫn giữ đúng theme đã chọn.

### 5.2 Áp dụng theme vào DOM (dòng 20-26)

```js
useEffect(() => {
  const isDark = theme === 'dark';
  document.documentElement.classList.toggle('theme-dark', isDark);  // ThemeContext.js:22
  document.body.classList.toggle('theme-dark', isDark);             // ThemeContext.js:23
  document.documentElement.setAttribute('data-theme', theme);       // ThemeContext.js:24
  localStorage.setItem(STORAGE_KEY, theme);                          // ThemeContext.js:25
}, [theme]);
```

- Thay vì chỉ lưu state trong React, ThemeProvider **gắn trực tiếp class `theme-dark`** lên thẻ `<html>` và `<body>`. Đây là kỹ thuật kinh điển để làm dark mode với CSS thuần/Tailwind: các rule CSS trong `index.css` (ví dụ `html.theme-dark .bg-white { background-color: #0f172a !important; }` — `index.css:52-55`) chỉ có tác dụng khi thẻ `<html>` có class `theme-dark`.
- `index.css:14-22` định nghĩa các **biến CSS (design token)** cho theme sáng (`:root { --color-surface: 255 255 255; ... }`), và `index.css:25-33` định nghĩa lại đúng những biến đó cho theme tối (`html.theme-dark { --color-surface: 30 41 59; ... }`). `tailwind.config.js:20-29` tham chiếu các biến này (`rgb(var(--color-surface) / <alpha-value>)`) để sinh ra các class Tailwind như `bg-surface`, `text-text-primary`... tự động đổi màu theo theme mà không cần class `dark:` riêng lẻ ở từng nơi.

### 5.3 Cung cấp API cho component con (dòng 28-36, 38-46)

```js
const value = useMemo(() => ({
  theme, isDark: theme === 'dark', setTheme,
  toggleTheme: () => setTheme((current) => (current === 'dark' ? 'light' : 'dark')),  // ThemeContext.js:32
}), [theme]);
```

- `useTheme()` (dòng 38-46) là custom hook để component con lấy `{ theme, isDark, toggleTheme }`; nếu gọi ngoài `ThemeProvider` sẽ `throw Error` (dòng 42) — kỹ thuật phòng lỗi dùng sai context điển hình.
- `Navbar.js:14` gọi `useTheme()` để lấy `isDark` và `toggleTheme` cho nút chuyển theme.

---

## 6. `components/Navbar.js` — Thanh điều hướng

File: `frontend/my-hotel-app/src/components/Navbar.js`

### 6.1 Lấy dữ liệu từ 2 context (dòng 13-14)

```js
const { user, logout } = useAuth();      // Navbar.js:13
const { isDark, toggleTheme } = useTheme();  // Navbar.js:14
```

Navbar không tự giữ state đăng nhập/theme — nó **đọc** từ `AuthContext` và `ThemeContext` đã bọc ở `App.js`.

### 6.2 Hiển thị khác nhau theo trạng thái đăng nhập (dòng 52-109)

- **Chưa đăng nhập** (`!user`, dòng 52-60 và 100-109): hiện nút "Guest" (chỉ set `localStorage.setItem('isGuest', 'true')` rồi điều hướng `/hotels`, dòng 23-26), cùng 2 link "Đăng nhập" / "Đăng ký".
- **Đã đăng nhập** (dòng 73-99): hiện avatar chữ cái đầu tên (`user.full_name?.charAt(0).toUpperCase()` — dòng 77) và tên rút gọn (`truncate`, dòng 79), kèm menu thả xuống (dropdown) khi hover (`group-hover:visible` — dòng 82).
  - Trong dropdown, mục **"Quản trị"** (link tới `/admin`) chỉ hiện nếu `['admin', 'manager'].includes(user.role)` (dòng 83) — đây là **lớp UI ẩn/hiện theo role**, tách biệt với `AdminRoute` (lớp chặn truy cập). Hai lớp này phối hợp: Navbar ẩn link để user thường không thấy đường vào trang admin; `AdminRoute` chặn cứng nếu ai đó cố tình gõ thẳng URL `/admin`.
  - Nút "Đăng xuất" gọi `handleLogout` (dòng 17-20): gọi `logout()` từ AuthContext (xoá `token`/`user` khỏi localStorage, `AuthContext.js:23-27`) rồi `navigate('/')`.

### 6.3 Nút chuyển theme (dòng 63-69)

```js
<button onClick={toggleTheme}>
  {isDark ? <FaSun className="text-amber-500" /> : <FaMoon />}
</button>
```

Icon đổi giữa mặt trời/mặt trăng tuỳ theme hiện tại; click gọi thẳng `toggleTheme` lấy từ `ThemeContext`.

### 6.4 Ghi chú về code cũ bị comment (dòng 115-123)

Trong file có một khối `<nav>` cũ bị **comment JSX** lại (dòng 118-123, ghi chú "CODE CŨ (ĐÃ KHÓA BẰNG COMMENT JSX)"). Đây là dấu vết code không được dọn dẹp — nếu bị hỏi, có thể trả lời thẳng: đây là bản Navbar cũ được giữ lại tạm thời khi thử giao diện mới (dòng 30-32 ghi "CODE Ý TƯỞNG MỚI (ĐANG CHẠY THỬ)"), không ảnh hưởng runtime vì JSX comment không được render, nhưng về mặt vệ sinh code nên xoá hẳn khi đã chốt giao diện.

---

## 7. `components/Footer.js` — Chân trang

File: `frontend/my-hotel-app/src/components/Footer.js`

Là component **thuần tĩnh** (static), không gọi API, không dùng context — chỉ nhận layout 4 cột bằng Tailwind grid (`grid-cols-1 md:grid-cols-4` — dòng 12):

1. **Cột giới thiệu** (dòng 13-38): logo, mô tả ngắn, 3 icon mạng xã hội (Facebook/Instagram/Twitter) — link cứng tới `facebook.com`, `instagram.com`, `twitter.com` (dòng 23-25), không phải trang thật của dự án.
2. **Cột "Khám phá"** (dòng 40-57): danh sách link nội bộ dùng `<Link>` của react-router (Trang chủ, Khách sạn, Đặt phòng của tôi, Đăng nhập, Đăng ký) — render bằng `.map()` từ mảng object (dòng 43-49), tránh lặp code JSX.
3. **Cột "Điểm đến nổi bật"** (dòng 59-68): danh sách tên thành phố tĩnh (Hồ Chí Minh, Hà Nội...), chỉ là text, **không phải link/filter thật** — bấm vào không có tác dụng lọc khách sạn theo thành phố.
4. **Cột "Liên hệ"** (dòng 70-91): địa chỉ, số điện thoại, email — đều là dữ liệu mẫu tĩnh, không lấy từ backend.

Dòng 94-101: dòng cuối bản quyền `© 2025 HotelBooking` và 3 link "Chính sách bảo mật / Điều khoản sử dụng / Hỗ trợ" — thực chất trỏ vào `/profile`, `/hotels`, `/login` (dòng 97-99), tức là **không có trang chính sách/điều khoản thật**, chỉ là placeholder điều hướng tạm.

**Kết luận khi bị hỏi**: Footer không chứa logic nghiệp vụ, hoàn toàn là JSX tĩnh phục vụ mục đích trình bày, không cần học sâu ngoài việc biết cấu trúc 4 cột.

---

## 8. `pages/PremiumDemo.js` — Trang demo UI, KHÔNG thuộc luồng nghiệp vụ chính

File: `frontend/my-hotel-app/src/pages/PremiumDemo.js`

- Dòng 1-4 (comment đầu file) tự mô tả rõ: *"Demo page showcasing HeroSearchBar, HotelCardPremium, and HotelListingSection with realistic Vietnamese hotel data. Import this into App.js as a route to preview."*
- Nội dung: một mảng `SAMPLE_HOTELS` **hard-code cứng trong code** (dòng 10 trở đi — 6 khách sạn mẫu với ảnh Unsplash, giá, rating...), dùng để hiển thị thử 2 component `HeroSearchBar` và `HotelListingSection` (dòng 7-8) mà **không gọi API thật, không có state nghiệp vụ** (đặt phòng, thanh toán...).
- Route tương ứng `/premium-demo` (`App.js:44`) không nằm trong nhóm route Guest hay Admin, không có trong Navbar/Footer (không có link nào trỏ tới), chỉ để nhà phát triển gõ tay URL khi cần xem trước giao diện mới.

**Ghi nhớ khi phản biện**: Nếu thầy hỏi tới trang này, trả lời ngắn gọn: *"Đây là trang demo dữ liệu mẫu để xem trước bộ giao diện tìm kiếm/khách sạn mới, không thuộc luồng nghiệp vụ đặt phòng thật, không cần trình bày sâu."* Không cần học thuộc logic bên trong `HeroSearchBar`/`HotelListingSection` nếu không được hỏi trực tiếp.

---

## 9. Cấu hình TailwindCSS — Utility-first CSS

Files liên quan: `frontend/my-hotel-app/tailwind.config.js`, `frontend/my-hotel-app/src/index.css`

### 9.1 Utility-first là gì?

Thay vì viết CSS riêng cho từng thành phần (`.navbar-logo { display:flex; gap:12px; ... }`) rồi gán class đó vào HTML, Tailwind cung cấp sẵn hàng nghìn **class tiện ích nhỏ, mỗi class làm đúng một việc** (`flex`, `gap-3`, `rounded-xl`, `bg-blue-600`, `shadow-lg`...) và ghép nhiều class lại ngay trong `className` để tạo giao diện — ví dụ `Navbar.js:38`:

```jsx
<div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-white shadow-lg shadow-blue-100">
```

### 9.2 Cấu hình dự án (`tailwind.config.js`)

- `content: ["./src/**/*.{js,jsx,ts,tsx}"]` (dòng 3-5): khai báo Tailwind chỉ quét class trong thư mục `src/` để build đúng những class thực sự được dùng (tree-shaking CSS không dùng tới, giúp file CSS cuối cùng nhỏ gọn).
- `theme.extend.colors` (dòng 11-29): mở rộng thêm bảng màu riêng của dự án — `primary` (xanh dương thương hiệu `#0057FF`), và đặc biệt các màu **tham chiếu biến CSS** như `surface`, `background`, `text-primary`... (dòng 20-24) dùng cú pháp `rgb(var(--color-surface) / <alpha-value>)` để một class như `bg-surface/90` (90% độ mờ) vẫn hoạt động đúng dù giá trị màu gốc đổi theo light/dark theme.
- `theme.extend.borderRadius`, `boxShadow`, `spacing`, `fontSize` (dòng 31-46): định nghĩa thêm các giá trị tuỳ biến riêng cho thiết kế (card, input, hero, card-default shadow...) để dùng nhất quán xuyên toàn bộ ứng dụng thay vì mỗi nơi viết một giá trị pixel khác nhau.
- `index.css:1-3` (`@tailwind base/components/utilities`) là 3 dòng bắt buộc để Tailwind "tiêm" toàn bộ CSS của nó vào file, PostCSS sẽ xử lý ở bước build.

### 9.3 Vì sao dùng Tailwind thay vì CSS thuần hoặc Bootstrap?

- **So với CSS thuần**: không cần đặt tên class riêng cho từng thành phần (tránh xung đột tên, tránh "CSS đặc tả một nơi — dùng một nơi" gây phình file `.css`), sửa giao diện trực tiếp ngay trong JSX mà không phải nhảy qua lại giữa file `.js` và `.css`.
- **So với Bootstrap**: Bootstrap cung cấp sẵn **component** hoàn chỉnh (navbar, card, button...) với giao diện định sẵn → nhanh nhưng khó tuỳ biến sâu, dễ bị trùng giao diện với các site khác dùng Bootstrap. Tailwind chỉ cung cấp *utility* (đơn vị nhỏ nhất), nên linh hoạt thiết kế giao diện riêng biệt (như bảng màu `primary #0057FF`, bo góc `card: 12px` của dự án) mà không cần override CSS của thư viện thứ ba.
- Dự án tận dụng thêm **CSS variables** (`index.css:14-33`) kết hợp Tailwind để giải quyết bài toán dark mode mà không cần viết class `dark:` lặp lại ở mọi nơi — chỉ cần đổi giá trị biến khi `<html>` có class `theme-dark`.

---

## 10. Câu hỏi phản biện thường gặp & cách trả lời

**Q1. Vì sao dự án dùng Context API (`AuthContext`, `ThemeContext`) thay vì Redux?**
Trả lời: Vì lượng state toàn cục ở đây khá đơn giản (chỉ `user` và `theme`), thay đổi không thường xuyên và không cần các tính năng nâng cao của Redux (middleware, time-travel debugging, devtools phức tạp). Context API là giải pháp có sẵn trong React, không cần cài thêm thư viện, đủ dùng cho quy mô đồ án. Nếu ứng dụng lớn hơn nhiều (nhiều state liên quan nhau, cần cache dữ liệu server phức tạp), Redux hoặc React Query sẽ hợp lý hơn.

**Q2. Token JWT lưu ở `localStorage` (`AuthContext.js:18`, `api.js:16`) có an toàn không? Rủi ro XSS là gì?**
Trả lời trung thực: Đây là điểm hạn chế thật sự của dự án. `localStorage` có thể bị **bất kỳ đoạn JavaScript nào chạy trên cùng trang** đọc được (kể cả mã độc chèn qua lỗ hổng XSS — ví dụ nếu có chỗ render HTML từ input người dùng mà không escape). Nếu kẻ tấn công chèn được script, chúng có thể đọc `localStorage.getItem('token')` và đánh cắp phiên đăng nhập. Giải pháp an toàn hơn là lưu token trong **httpOnly cookie** (JavaScript phía client không đọc được, chỉ trình duyệt tự gửi kèm request), kết hợp cờ `Secure` + `SameSite` để chống CSRF/XSS tốt hơn. Trong đồ án ở quy mô học tập, `localStorage` được chấp nhận vì đơn giản, dễ triển khai, nhưng nếu triển khai thực tế nên nâng cấp.

**Q3. SPA là gì? Ưu/nhược điểm so với server-side rendering (SSR) truyền thống?**
Trả lời: SPA (Single Page Application) là mô hình chỉ tải **một trang HTML duy nhất** ban đầu, sau đó `react-router-dom` (`BrowserRouter` — `App.js:34`) tự vẽ lại nội dung theo URL bằng JavaScript, không cần gọi lại server để lấy HTML mới mỗi lần chuyển trang. 
- *Ưu điểm*: chuyển trang mượt, không giật/trắng trang, trải nghiệm giống ứng dụng desktop, giảm tải cho server (server chỉ trả JSON qua API, không phải render HTML).
- *Nhược điểm*: SEO kém hơn (crawler cần chạy JavaScript mới thấy nội dung), thời gian tải lần đầu (First load) có thể lâu hơn do phải tải toàn bộ bundle JS, cần xử lý thêm loading state/skeleton khi chờ gọi API.

**Q4. Responsive design được xử lý ra sao trong dự án?**
Trả lời: Dùng **breakpoint có sẵn của Tailwind** (`md:`, `lg:`...) ngay trong class, ví dụ `Navbar.js:47` (`hidden ... md:block` — ẩn trên mobile, hiện từ màn hình `md` trở lên) hay `Footer.js:12` (`grid-cols-1 md:grid-cols-4` — 1 cột trên mobile, 4 cột trên desktop). Không cần viết media query CSS thủ công, mọi điều chỉnh responsive nằm ngay trong JSX.

**Q5. Axios interceptor là gì, giải quyết vấn đề gì mà không dùng interceptor thì phải làm sao?**
Trả lời: Interceptor (`api.js:15-19` cho request, `api.js:22-49` cho response) là hàm được axios tự động chạy **trước khi gửi** hoặc **sau khi nhận** mọi request/response qua instance đó. Nếu không có interceptor, mỗi lần gọi API ở từng trang phải tự viết lại code gắn header `Authorization`, và tự viết code kiểm tra lỗi 401/403 để logout — vừa lặp code (vi phạm DRY) vừa dễ sót một chỗ quên xử lý. Interceptor tập trung logic này về một nơi duy nhất.

**Q6. `AdminRoute` bảo vệ được những gì và KHÔNG bảo vệ được những gì?**
Trả lời: `AdminRoute` (`components/AdminRoute.js:10-16`) chỉ chặn ở **phía giao diện (client)** — ngăn không cho render các trang `/admin/*` nếu chưa đăng nhập hoặc không đúng role. Nó **không** thay thế việc backend phải tự kiểm tra quyền trong middleware (`verifyToken`, kiểm tra `role` trong token) ở mỗi API `/admin/*`. Vì React chạy trên trình duyệt của người dùng, ai đó có thể sửa code, tắt JavaScript, hoặc gọi thẳng API bằng Postman để bỏ qua toàn bộ lớp bảo vệ này — do đó bảo mật thật sự luôn phải nằm ở backend, `AdminRoute` chỉ là lớp trải nghiệm người dùng (UX) để ẩn đường link/trang mà thôi.

**Q7. `baseURL` của axios đang hard-code `http://localhost:4000/api` (`api.js:11`) — khi deploy thật thì sao?**
Trả lời thẳng đây là hạn chế: khi deploy, domain backend chắc chắn khác `localhost:4000`, nên phải sửa trực tiếp dòng này và build lại. Cách khắc phục chuẩn là đọc từ biến môi trường Create React App cung cấp, ví dụ `process.env.REACT_APP_API_URL`, đặt trong file `.env`/`.env.production` để mỗi môi trường (dev/staging/production) có một file cấu hình riêng mà không phải sửa code.

**Q8. Vì sao Theme (dark/light) và Auth (user/token) lại tách thành 2 Context riêng thay vì gộp chung 1 Context?**
Trả lời: Tách theo **trách nhiệm đơn lẻ (Single Responsibility)** — Theme không liên quan gì tới đăng nhập, và ngược lại. Việc tách giúp: (1) component nào chỉ cần theme thì chỉ `useTheme()`, không phải kéo theo toàn bộ logic Auth không dùng tới; (2) khi 1 trong 2 Context thay đổi giá trị, chỉ những component dùng đúng Context đó re-render, tránh re-render thừa; (3) dễ đọc, dễ bảo trì, dễ test độc lập từng Context.
