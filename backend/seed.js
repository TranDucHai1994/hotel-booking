require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const connectDB = require('./config/db');
const User = require('./models/User');
const Hotel = require('./models/Hotel');
const Room = require('./models/Room');
const Booking = require('./models/Booking');
const Feedback = require('./models/Feedback');

const usersSeed = [
  {
    username: 'admin',
    full_name: 'System Admin',
    email: 'admin@hotelbooking.local',
    phone: '0900000001',
    password: 'Admin@123',
    role: 'admin',
    status: 'active',
  },
  {
    username: 'manager.hcm',
    full_name: 'Tran Minh Quan',
    email: 'manager@hotelbooking.local',
    phone: '0900000002',
    password: 'Manager@123',
    role: 'manager',
    status: 'active',
  },
  {
    username: 'customer.lan',
    full_name: 'Nguyen Ngoc Lan',
    email: 'lan@example.com',
    phone: '0900000003',
    password: 'Customer@123',
    role: 'customer',
    status: 'active',
  },
  {
    username: 'customer.khoa',
    full_name: 'Le Dang Khoa',
    email: 'khoa@example.com',
    phone: '0900000004',
    password: 'Customer@123',
    role: 'customer',
    status: 'active',
  },
];

const hotelsSeed = [
  {
    key: 'saigon-palace',
    name: 'Sai Gon Palace Hotel',
    city: 'Ho Chi Minh',
    address: '86 Nguyen Hue, District 1',
    description: 'Khach san trung tam phu hop cong tac va du lich ngan ngay.',
    property_type: 'hotel',
    star_rating: 4,
    is_hot_deal: true,
    hot_deal_discount_percent: 20,
    amenities: ['WiFi', 'Breakfast', 'Airport shuttle', 'Gym'],
    cover_image: 'https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=1200&q=80',
    images: [
      'https://images.unsplash.com/photo-1551882547-ff40c63fe5fa?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&w=1200&q=80',
    ],
  },
  {
    key: 'danang-ocean',
    name: 'Da Nang Ocean View Resort',
    city: 'Da Nang',
    address: '278 Vo Nguyen Giap, Son Tra',
    description: 'Resort sat bien voi ho boi vo cuc va nha hang hai san.',
    property_type: 'resort',
    star_rating: 5,
    is_hot_deal: true,
    hot_deal_discount_percent: 15,
    amenities: ['WiFi', 'Pool', 'Spa', 'Beachfront', 'Restaurant'],
    cover_image: 'https://images.unsplash.com/photo-1501117716987-c8e1ecb2102f?auto=format&fit=crop&w=1200&q=80',
    images: [
      'https://images.unsplash.com/photo-1573843981267-be1999ff37cd?auto=format&fit=crop&w=1200&q=80',
    ],
  },
  {
    key: 'hanoi-boutique',
    name: 'Hanoi Old Quarter Boutique',
    city: 'Ha Noi',
    address: '12 Hang Bac, Hoan Kiem',
    description: 'Khach san boutique nho gon, gan pho co va ho Hoan Kiem.',
    property_type: 'boutique',
    star_rating: 3,
    is_hot_deal: false,
    hot_deal_discount_percent: 0,
    amenities: ['WiFi', 'Breakfast', 'Bike rental'],
    cover_image: 'https://images.unsplash.com/photo-1445019980597-93fa8acb246c?auto=format&fit=crop&w=1200&q=80',
    images: [],
  },
];

const roomsSeed = [
  {
    hotelKey: 'saigon-palace',
    room_type: 'Deluxe Double',
    max_guests: 2,
    price_per_night: 1200000,
    total_quantity: 8,
    status: 'available',
    description: 'Phong doi co cua so lon, phu hop cap doi hoac khach cong tac.',
    amenities: ['TV', 'Air conditioner', 'Mini bar'],
  },
  {
    hotelKey: 'saigon-palace',
    room_type: 'Family Suite',
    max_guests: 4,
    price_per_night: 2100000,
    total_quantity: 4,
    status: 'available',
    description: 'Phong rong cho gia dinh, co khu vuc tiep khach rieng.',
    amenities: ['TV', 'Bathtub', 'Sofa', 'Mini bar'],
  },
  {
    hotelKey: 'danang-ocean',
    room_type: 'Premier Sea View',
    max_guests: 2,
    price_per_night: 2600000,
    total_quantity: 10,
    status: 'available',
    description: 'Phong view bien, ban cong rieng.',
    amenities: ['Balcony', 'TV', 'Rain shower'],
  },
  {
    hotelKey: 'danang-ocean',
    room_type: 'Two Bedroom Villa',
    max_guests: 5,
    price_per_night: 4800000,
    total_quantity: 3,
    status: 'available',
    description: 'Villa rieng co be boi mini va khu bep.',
    amenities: ['Private pool', 'Kitchen', 'Living room'],
  },
  {
    hotelKey: 'hanoi-boutique',
    room_type: 'Standard Queen',
    max_guests: 2,
    price_per_night: 850000,
    total_quantity: 6,
    status: 'available',
    description: 'Phong co thiet ke am cung, thuan tien di bo pho co.',
    amenities: ['TV', 'Air conditioner'],
  },
];

const bookingsSeed = [
  {
    userEmail: 'lan@example.com',
    hotelKey: 'saigon-palace',
    roomType: 'Deluxe Double',
    check_in: '2026-04-15',
    check_out: '2026-04-17',
    guests: 2,
    status: 'confirmed',
    payment_method: 'mock_card',
    payment_status: 'paid',
    customer_note: 'Nhan phong som neu co the.',
  },
  {
    userEmail: 'khoa@example.com',
    hotelKey: 'danang-ocean',
    roomType: 'Premier Sea View',
    check_in: '2026-04-20',
    check_out: '2026-04-23',
    guests: 2,
    status: 'pending',
    payment_method: 'pay_at_hotel',
    payment_status: 'unpaid',
    customer_note: 'Can phong o tang cao.',
  },
];

const feedbacksSeed = [
  {
    userEmail: 'lan@example.com',
    hotelKey: 'saigon-palace',
    rating: 5,
    content: 'Phong sach, vi tri dep, nhan vien ho tro rat nhanh.',
  },
  {
    userEmail: 'khoa@example.com',
    hotelKey: 'hanoi-boutique',
    rating: 4,
    content: 'Vi tri rat tien, phong gon gang, bua sang on.',
  },
];

function nightsBetween(checkIn, checkOut) {
  return Math.ceil((new Date(checkOut) - new Date(checkIn)) / (1000 * 60 * 60 * 24));
}

async function upsertUsers() {
  const userMap = new Map();

  for (const item of usersSeed) {
    const password_hash = await bcrypt.hash(item.password, 10);
    await User.updateOne(
      { email: item.email.toLowerCase() },
      {
        $set: {
          username: item.username,
          full_name: item.full_name,
          email: item.email.toLowerCase(),
          phone: item.phone,
          password_hash,
          role: item.role,
          status: item.status,
          deleted_at: null,
          failed_attempts: 0,
          refresh_token_hash: null,
          refresh_token_expiry: null,
          reset_password_token_hash: null,
          reset_password_expiry: null,
        },
      },
      { upsert: true }
    );

    const savedUser = await User.findOne({ email: item.email.toLowerCase() });
    userMap.set(item.email.toLowerCase(), savedUser);
  }

  return userMap;
}

async function upsertHotels() {
  const hotelMap = new Map();

  for (const item of hotelsSeed) {
    const payload = {
      name: item.name,
      city: item.city,
      address: item.address,
      description: item.description,
      property_type: item.property_type,
      star_rating: item.star_rating,
      is_hot_deal: item.is_hot_deal,
      hot_deal_discount_percent: item.hot_deal_discount_percent,
      amenities: item.amenities,
      cover_image: item.cover_image,
      images: item.images,
    };

    await Hotel.updateOne(
      { name: item.name, city: item.city },
      { $set: payload },
      { upsert: true }
    );

    const savedHotel = await Hotel.findOne({ name: item.name, city: item.city });
    hotelMap.set(item.key, savedHotel);
  }

  return hotelMap;
}

async function upsertRooms(hotelMap) {
  const roomMap = new Map();

  for (const item of roomsSeed) {
    const hotel = hotelMap.get(item.hotelKey);
    if (!hotel) continue;

    await Room.updateOne(
      { hotel_id: hotel._id, room_type: item.room_type },
      {
        $set: {
          hotel_id: hotel._id,
          room_type: item.room_type,
          max_guests: item.max_guests,
          price_per_night: item.price_per_night,
          total_quantity: item.total_quantity,
          status: item.status || 'available',
          description: item.description,
          amenities: item.amenities,
        },
      },
      { upsert: true }
    );

    const savedRoom = await Room.findOne({ hotel_id: hotel._id, room_type: item.room_type });
    roomMap.set(`${item.hotelKey}:${item.room_type}`, savedRoom);
  }

  return roomMap;
}

async function upsertBookings(userMap, hotelMap, roomMap) {
  for (const item of bookingsSeed) {
    const user = userMap.get(item.userEmail.toLowerCase());
    const hotel = hotelMap.get(item.hotelKey);
    const room = roomMap.get(`${item.hotelKey}:${item.roomType}`);

    if (!user || !hotel || !room) continue;

    const total_amount = room.price_per_night * nightsBetween(item.check_in, item.check_out);

    await Booking.updateOne(
      {
        user_id: user._id,
        hotel_id: hotel._id,
        room_id: room._id,
        check_in: new Date(item.check_in),
        check_out: new Date(item.check_out),
      },
      {
        $set: {
          user_id: user._id,
          hotel_id: hotel._id,
          room_id: room._id,
          check_in: new Date(item.check_in),
          check_out: new Date(item.check_out),
          guests: item.guests,
          total_amount,
          status: item.status,
          payment_method: item.payment_method,
          payment_status: item.payment_status,
          customer_note: item.customer_note,
        },
      },
      { upsert: true }
    );
  }
}

async function upsertFeedbacks(userMap, hotelMap) {
  for (const item of feedbacksSeed) {
    const user = userMap.get(item.userEmail.toLowerCase());
    const hotel = hotelMap.get(item.hotelKey);

    if (!user || !hotel) continue;

    await Feedback.updateOne(
      { user_id: user._id, hotel_id: hotel._id },
      {
        $set: {
          user_id: user._id,
          hotel_id: hotel._id,
          rating: item.rating,
          content: item.content,
        },
      },
      { upsert: true }
    );
  }
}

async function seed() {
  await connectDB();

  const userMap = await upsertUsers();
  const hotelMap = await upsertHotels();
  const roomMap = await upsertRooms(hotelMap);
  await upsertBookings(userMap, hotelMap, roomMap);
  await upsertFeedbacks(userMap, hotelMap);

  const counts = await Promise.all([
    User.countDocuments(),
    Hotel.countDocuments(),
    Room.countDocuments(),
    Booking.countDocuments(),
    Feedback.countDocuments(),
  ]);

  console.log('Seeded MongoDB successfully.');
  console.log(`Users: ${counts[0]}, Hotels: ${counts[1]}, Rooms: ${counts[2]}, Bookings: ${counts[3]}, Feedbacks: ${counts[4]}`);
  console.log('Sample accounts:');
  console.log('- admin@hotelbooking.local / Admin@123');
  console.log('- manager@hotelbooking.local / Manager@123');
  console.log('- lan@example.com / Customer@123');
  console.log('- khoa@example.com / Customer@123');
}

seed()
  .catch((error) => {
    console.error('Seed failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
