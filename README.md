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
4. Run `npm run seed`
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

The seed script now creates a larger demo dataset for presentation:

- Users: 84
- Hotels: 51
- Rooms: 197
- Bookings: 322
- Feedbacks: 162

Sample accounts after seed:

- `admin@hotelbooking.local / Admin@123`
- `manager@hotelbooking.local / Manager@123`
- `lan@example.com / Customer@123`
- `khoa@example.com / Customer@123`

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

123
