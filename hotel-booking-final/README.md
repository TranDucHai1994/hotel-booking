# Hotel Booking System

Hotel booking web app with a customer portal and an admin portal.

## Current coverage

- Search hotels by location, stay dates, price range, rating, and amenities
- View hotel details, images, room types, amenities, price, reviews, and map
- Register, login, profile update, password change
- Guest mode booking without login
- Mock booking confirmation email
- Admin CRUD for hotels and rooms
- Admin booking management: list, confirm, cancel, delete
- Dashboard with revenue, payment breakdown, occupancy rate, top hotels, and recent bookings
- Admin system setting: configurable sender email for confirmation emails
- Dark mode
- SQL Server backend
- Large demo dataset for showcase

## Tech stack

- Frontend: React, React Router, Tailwind CSS, Axios
- Backend: Node.js, Express
- Database: SQL Server

## Project structure

- `frontend/my-hotel-app`: customer and admin web UI
- `backend`: API, SQL Server access, seed script

## Backend setup

1. Go to `backend`
2. Install dependencies with `npm install`
3. Configure SQL Server connection in `backend/.env`
4. Load the database — pick ONE:
   - Option A (recommended for teammates): run the ready-made `database/hotel_booking_full.sql` script directly in SQL Server (see [Database script](#database-script-for-teammates) below). Schema + full demo data in one file, no Node/npm needed for this step.
   - Option B: run `npm run seed` to generate schema + demo data through the Node seed script.
5. Start API with `npm run dev` or `npm start`

### Real email sending (SMTP)

By default, this project can run in mock email mode. To send real emails, set SMTP variables in `backend/.env`:

```env
EMAIL_TRANSPORT=smtp
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your_smtp_account@gmail.com
SMTP_PASS=your_app_password
```

Then set sender email in Admin Dashboard (`/admin`) at section `He thong - Cau hinh email gui`.

## Frontend setup

1. Go to `frontend/my-hotel-app`
2. Install dependencies with `npm install`
3. Start app with `npm start`

## Quick start on Windows

- Double-click `start-web.bat` at project root to start both backend and frontend without typing commands.

Frontend default URL:

- `http://localhost:3000`

Backend default URL:

- `http://localhost:4000`

## Seed data

The seed script now creates a larger demo dataset for presentation, with bookings spread across ~3.5 years (2023 to present) so the revenue chart on the Admin Dashboard shows a realistic trend:

- Users: 89
- Hotels: 51
- Rooms: 197
- Bookings: ~1,450
- Feedbacks: 162

### Demo accounts (after `npm run seed`)

| Role | Email | Password | Ghi chú |
| --- | --- | --- | --- |
| Admin | `admin@hotelbooking.local` | `123` | Toàn quyền, xem `/admin` |
| Manager | `manager@hotelbooking.local` | `Manager@123` | Quản lý, không có mục Tài khoản |
| Customer | `lan@example.com` | `Customer@123` | Có sẵn booking + feedback mẫu |
| Customer | `khoa@example.com` | `Customer@123` | Có sẵn booking + feedback mẫu |
| Customer (bulk demo) | `demo.customer1@hotelbooking.local` ... `demo.customer80@hotelbooking.local` | `Customer@123` | 80 tài khoản khách hàng dùng để rải dữ liệu booking/feedback mẫu |

Username tương ứng: `admin`, `manager.hcm`, `customer.lan`, `customer.khoa`, `customer.demo1` ... `customer.demo80`.

## Database script (for teammates)

`database/hotel_booking_full.sql` is a self-contained SQL script (schema + full demo data) generated from a real seeded database — hand this file to a teammate alongside the source code so they can get a fully working DB without running Node at all.

**How to import (pick one):**

- SQL Server Management Studio (SSMS): open `database/hotel_booking_full.sql` → connect to your SQL Server instance → Execute (F5).
- `sqlcmd`:
  ```bash
  sqlcmd -S <server>\<instance> -U sa -P <password> -i database/hotel_booking_full.sql
  ```

The script creates the `HotelBooking` database if missing, creates all tables/indexes/foreign keys, then inserts every row from Users, Hotels, Rooms, Bookings, Feedbacks, and SystemSettings — identity columns keep the exact same IDs as the source, so foreign keys line up correctly. It's safe to run against an empty SQL Server instance; running it twice will fail on duplicate rows (drop the database first if you need to re-import).

After importing, just point `backend/.env` at that SQL Server instance/database and start the API — no need to run `npm run seed`.

**Regenerating the script** (after reseeding or editing data): from `backend/`, run:

```bash
npm run db:export
```

This connects using the same `backend/.env` config and overwrites `database/hotel_booking_full.sql` with the current DB contents.

## Production build

Frontend production build:

```bash
cd frontend/my-hotel-app
npm run build
```

Backend production start:

```bash
cd backend
npm start
```

## Simple deployment flow

1. Build frontend with `npm run build`
2. Run backend with `npm start`
3. Point the frontend API base URL to the backend server
4. Host the frontend build folder on a static web server
5. Keep SQL Server reachable from the backend environment

## Notes

- Booking API response shape was kept stable while adding missing features
- Guest bookings are stored with `booking_source = guest`
- Payment is simulated with `pay_at_hotel`, `mock_card`, and `mock_momo`
