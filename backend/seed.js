require('dotenv').config();
const bcrypt = require('bcryptjs');
const { connectDB, query } = require('./config/db');

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

const hotelImagePool = [
  'https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1551882547-ff40c63fe5fa?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1501117716987-c8e1ecb2102f?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1573843981267-be1999ff37cd?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1445019980597-93fa8acb246c?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1522798514-97ceb8c4f1c8?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=1200&q=80',
];

const cityConfigs = [
  { key: 'ho-chi-minh', city: 'Ho Chi Minh', shortName: 'Sai Gon', streets: ['Nguyen Hue', 'Le Loi', 'Vo Van Kiet', 'Hai Ba Trung'] },
  { key: 'ha-noi', city: 'Ha Noi', shortName: 'Ha Noi', streets: ['Hang Bac', 'Trang Tien', 'Ba Trieu', 'Pham Hung'] },
  { key: 'da-nang', city: 'Da Nang', shortName: 'Da Nang', streets: ['Vo Nguyen Giap', 'Tran Phu', 'Bach Dang', 'Le Duan'] },
  { key: 'nha-trang', city: 'Nha Trang', shortName: 'Nha Trang', streets: ['Tran Phu', 'Hung Vuong', 'Pham Van Dong', 'Nguyen Thien Thuat'] },
  { key: 'da-lat', city: 'Da Lat', shortName: 'Da Lat', streets: ['Tran Hung Dao', 'Ho Tung Mau', 'Ba Thang Hai', 'Le Dai Hanh'] },
  { key: 'hue', city: 'Hue', shortName: 'Hue', streets: ['Le Loi', 'Hung Vuong', 'Vo Thi Sau', 'Tran Hung Dao'] },
  { key: 'phu-quoc', city: 'Phu Quoc', shortName: 'Phu Quoc', streets: ['Tran Hung Dao', 'Duong To', 'Bai Truong', 'Ong Lang'] },
  { key: 'can-tho', city: 'Can Tho', shortName: 'Can Tho', streets: ['Ninh Kieu', 'Hoa Binh', 'Tran Van Kheo', 'Mau Than'] },
];

const hotelDescriptors = ['Central', 'Riverside', 'Skyline', 'Garden', 'Heritage', 'Grand'];
const propertyTypeCycle = ['hotel', 'resort', 'boutique', 'apartment', 'villa', 'homestay'];
const hotelAmenitySets = [
  ['WiFi', 'Breakfast', 'Gym', 'Restaurant'],
  ['WiFi', 'Pool', 'Spa', 'Airport shuttle'],
  ['WiFi', 'Breakfast', 'Bike rental', 'Restaurant'],
  ['WiFi', 'Pool', 'Beachfront', 'Restaurant'],
  ['WiFi', 'Breakfast', 'Airport shuttle', 'Spa'],
  ['WiFi', 'Gym', 'Restaurant', 'City view'],
];
const roomTemplates = [
  { room_type: 'Standard Room', max_guests: 2, price_offset: 0, total_quantity: 8, amenities: ['TV', 'Air conditioner'] },
  { room_type: 'Deluxe Room', max_guests: 2, price_offset: 250000, total_quantity: 6, amenities: ['TV', 'Mini bar', 'Work desk'] },
  { room_type: 'Family Suite', max_guests: 4, price_offset: 750000, total_quantity: 4, amenities: ['Sofa', 'Bathtub', 'Mini bar'] },
  { room_type: 'Executive Suite', max_guests: 4, price_offset: 1350000, total_quantity: 3, amenities: ['Balcony', 'Bathtub', 'Coffee machine'] },
];
const firstNames = ['An', 'Binh', 'Chi', 'Dung', 'Giang', 'Hanh', 'Khanh', 'Linh', 'Minh', 'Ngoc', 'Phuong', 'Quang', 'Trang', 'Vy', 'Yen'];
const lastNames = ['Nguyen', 'Tran', 'Le', 'Pham', 'Hoang', 'Phan', 'Vo', 'Dang'];
const feedbackTemplates = [
  'Phong dep, sach va vi tri di chuyen rat thuan tien tai {city}.',
  'Nhan vien ho tro nhanh, check-in gon va trai nghiem tong the rat on.',
  'Gia phong hop ly, tien ich day du va phu hop cho chuyen di cong tac.',
  'Khach san co khong gian dep, bua sang tot va phong cach phuc vu chuyen nghiep.',
  'View dep, phong yen tinh va gan cac diem tham quan noi bat cua {city}.',
];

function formatSeedDate(value) {
  return value.toISOString().split('T')[0];
}

function buildLargeDemoData() {
  const generatedCustomers = [];

  for (let index = 1; index <= 80; index += 1) {
    const firstName = firstNames[index % firstNames.length];
    const lastName = lastNames[index % lastNames.length];
    const email = `demo.customer${index}@hotelbooking.local`;

    const customer = {
      username: `customer.demo${index}`,
      full_name: `${lastName} ${firstName} ${index}`,
      email,
      phone: `09${String(10000000 + index).padStart(8, '0')}`,
      password: 'Customer@123',
      role: 'customer',
      status: 'active',
    };

    usersSeed.push(customer);
    generatedCustomers.push(customer);
  }

  const generatedHotels = [];

  cityConfigs.forEach((cityConfig, cityIndex) => {
    hotelDescriptors.forEach((descriptor, descriptorIndex) => {
      const propertyType = propertyTypeCycle[(cityIndex + descriptorIndex) % propertyTypeCycle.length];
      const starRating = 3 + ((cityIndex + descriptorIndex) % 3);
      const addressNumber = 40 + cityIndex * 17 + descriptorIndex * 5;
      const street = cityConfig.streets[descriptorIndex % cityConfig.streets.length];
      const imageIndex = (cityIndex * hotelDescriptors.length + descriptorIndex) % hotelImagePool.length;

      const hotel = {
        key: `${cityConfig.key}-${descriptor.toLowerCase()}`,
        name: `${descriptor} ${cityConfig.shortName} ${propertyType.charAt(0).toUpperCase() + propertyType.slice(1)}`,
        city: cityConfig.city,
        address: `${addressNumber} ${street}`,
        description: `${descriptor} ${propertyType} tai ${cityConfig.city}, phu hop cho nghi duong lan cong tac ngan ngay.`,
        property_type: propertyType,
        star_rating: starRating,
        is_hot_deal: descriptorIndex % 2 === 0,
        hot_deal_discount_percent: descriptorIndex % 2 === 0 ? 10 + descriptorIndex * 3 : 0,
        amenities: hotelAmenitySets[(cityIndex + descriptorIndex) % hotelAmenitySets.length],
        cover_image: hotelImagePool[imageIndex],
        images: [
          hotelImagePool[(imageIndex + 1) % hotelImagePool.length],
          hotelImagePool[(imageIndex + 2) % hotelImagePool.length],
        ],
      };

      hotelsSeed.push(hotel);
      generatedHotels.push(hotel);

      roomTemplates.forEach((template, roomIndex) => {
        const propertyExtra = propertyType === 'resort'
          ? 450000
          : propertyType === 'villa'
            ? 650000
            : propertyType === 'apartment'
              ? 250000
              : 0;

        roomsSeed.push({
          hotelKey: hotel.key,
          room_type: template.room_type,
          max_guests: template.max_guests,
          price_per_night: 650000 + starRating * 220000 + template.price_offset + propertyExtra + cityIndex * 30000,
          total_quantity: template.total_quantity + ((cityIndex + roomIndex) % 3),
          status: roomIndex === 3 && (cityIndex + descriptorIndex) % 9 === 0
            ? 'maintenance'
            : roomIndex === 0 && (cityIndex + descriptorIndex) % 13 === 0
              ? 'inactive'
              : 'available',
          description: `${template.room_type} cho ${propertyType} tai ${cityConfig.city}.`,
          amenities: template.amenities,
        });
      });
    });
  });

  const generatedRooms = roomsSeed.filter((room) => room.status === 'available');

  for (let index = 0; index < 320; index += 1) {
    const customer = generatedCustomers[index % generatedCustomers.length];
    const room = generatedRooms[index % generatedRooms.length];
    const stayStart = new Date(Date.UTC(2026, 1, 15 + (index % 120)));
    const nights = 1 + (index % 4);
    const stayEnd = new Date(stayStart);
    stayEnd.setUTCDate(stayEnd.getUTCDate() + nights);
    const paymentMethod = ['mock_card', 'mock_momo', 'pay_at_hotel'][index % 3];
    const status = index % 9 === 0 ? 'cancelled' : index % 4 === 0 ? 'pending' : 'confirmed';
    const paymentStatus = status === 'cancelled' && paymentMethod !== 'pay_at_hotel'
      ? 'refunded'
      : paymentMethod === 'pay_at_hotel'
        ? 'unpaid'
        : 'paid';

    bookingsSeed.push({
      userEmail: customer.email,
      hotelKey: room.hotelKey,
      roomType: room.room_type,
      check_in: formatSeedDate(stayStart),
      check_out: formatSeedDate(stayEnd),
      guests: 1 + (index % Math.max(1, room.max_guests)),
      status,
      payment_method: paymentMethod,
      payment_status: paymentStatus,
      customer_note: `Demo booking #${index + 1} for ${room.room_type}.`,
    });
  }

  for (let index = 0; index < 160; index += 1) {
    const customer = generatedCustomers[index % generatedCustomers.length];
    const hotel = generatedHotels[index % generatedHotels.length];

    feedbacksSeed.push({
      userEmail: customer.email,
      hotelKey: hotel.key,
      rating: 3 + (index % 3),
      content: feedbackTemplates[index % feedbackTemplates.length].replace('{city}', hotel.city),
    });
  }
}

buildLargeDemoData();

function nightsBetween(checkIn, checkOut) {
  return Math.ceil((new Date(checkOut) - new Date(checkIn)) / (1000 * 60 * 60 * 24));
}

async function upsertUser(item) {
  const passwordHash = await bcrypt.hash(item.password, 10);
  const existing = await query(
    `
      SELECT TOP 1 id
      FROM dbo.Users
      WHERE email = @email;
    `,
    { email: item.email.toLowerCase() }
  );

  if (existing.recordset[0]) {
    const updateResult = await query(
      `
        UPDATE dbo.Users
        SET
          username = @username,
          full_name = @fullName,
          email = @email,
          phone = @phone,
          password_hash = @passwordHash,
          role = @role,
          status = @status,
          deleted_at = NULL,
          failed_attempts = 0,
          refresh_token_hash = NULL,
          refresh_token_expiry = NULL,
          reset_password_token_hash = NULL,
          reset_password_expiry = NULL,
          updated_at = SYSUTCDATETIME()
        OUTPUT INSERTED.id
        WHERE email = @email;
      `,
      {
        username: item.username,
        fullName: item.full_name,
        email: item.email.toLowerCase(),
        phone: item.phone,
        passwordHash,
        role: item.role,
        status: item.status,
      }
    );

    return updateResult.recordset[0].id;
  }

  const insertResult = await query(
    `
      INSERT INTO dbo.Users (
        username,
        full_name,
        email,
        phone,
        password_hash,
        role,
        status
      )
      OUTPUT INSERTED.id
      VALUES (
        @username,
        @fullName,
        @email,
        @phone,
        @passwordHash,
        @role,
        @status
      );
    `,
    {
      username: item.username,
      fullName: item.full_name,
      email: item.email.toLowerCase(),
      phone: item.phone,
      passwordHash,
      role: item.role,
      status: item.status,
    }
  );

  return insertResult.recordset[0].id;
}

async function upsertHotel(item) {
  const existing = await query(
    `
      SELECT TOP 1 id
      FROM dbo.Hotels
      WHERE name = @name
        AND city = @city;
    `,
    {
      name: item.name,
      city: item.city,
    }
  );

  if (existing.recordset[0]) {
    const updateResult = await query(
      `
        UPDATE dbo.Hotels
        SET
          address = @address,
          description = @description,
          property_type = @propertyType,
          star_rating = @starRating,
          is_hot_deal = @isHotDeal,
          hot_deal_discount_percent = @hotDealDiscountPercent,
          amenities = @amenities,
          cover_image = @coverImage,
          images = @images,
          updated_at = SYSUTCDATETIME()
        OUTPUT INSERTED.id
        WHERE id = @hotelId;
      `,
      {
        hotelId: existing.recordset[0].id,
        address: item.address,
        description: item.description,
        propertyType: item.property_type,
        starRating: item.star_rating,
        isHotDeal: item.is_hot_deal,
        hotDealDiscountPercent: item.hot_deal_discount_percent,
        amenities: JSON.stringify(item.amenities),
        coverImage: item.cover_image,
        images: JSON.stringify(item.images),
      }
    );

    return updateResult.recordset[0].id;
  }

  const insertResult = await query(
    `
      INSERT INTO dbo.Hotels (
        name,
        city,
        address,
        description,
        property_type,
        star_rating,
        is_hot_deal,
        hot_deal_discount_percent,
        amenities,
        cover_image,
        images
      )
      OUTPUT INSERTED.id
      VALUES (
        @name,
        @city,
        @address,
        @description,
        @propertyType,
        @starRating,
        @isHotDeal,
        @hotDealDiscountPercent,
        @amenities,
        @coverImage,
        @images
      );
    `,
    {
      name: item.name,
      city: item.city,
      address: item.address,
      description: item.description,
      propertyType: item.property_type,
      starRating: item.star_rating,
      isHotDeal: item.is_hot_deal,
      hotDealDiscountPercent: item.hot_deal_discount_percent,
      amenities: JSON.stringify(item.amenities),
      coverImage: item.cover_image,
      images: JSON.stringify(item.images),
    }
  );

  return insertResult.recordset[0].id;
}

async function upsertRoom(item, hotelId) {
  const existing = await query(
    `
      SELECT TOP 1 id
      FROM dbo.Rooms
      WHERE hotel_id = @hotelId
        AND room_type = @roomType;
    `,
    {
      hotelId,
      roomType: item.room_type,
    }
  );

  if (existing.recordset[0]) {
    const updateResult = await query(
      `
        UPDATE dbo.Rooms
        SET
          max_guests = @maxGuests,
          price_per_night = @pricePerNight,
          total_quantity = @totalQuantity,
          status = @status,
          description = @description,
          amenities = @amenities,
          updated_at = SYSUTCDATETIME()
        OUTPUT INSERTED.id
        WHERE id = @roomId;
      `,
      {
        roomId: existing.recordset[0].id,
        maxGuests: item.max_guests,
        pricePerNight: item.price_per_night,
        totalQuantity: item.total_quantity,
        status: item.status,
        description: item.description,
        amenities: JSON.stringify(item.amenities),
      }
    );

    return updateResult.recordset[0].id;
  }

  const insertResult = await query(
    `
      INSERT INTO dbo.Rooms (
        hotel_id,
        room_type,
        max_guests,
        price_per_night,
        total_quantity,
        status,
        description,
        amenities
      )
      OUTPUT INSERTED.id
      VALUES (
        @hotelId,
        @roomType,
        @maxGuests,
        @pricePerNight,
        @totalQuantity,
        @status,
        @description,
        @amenities
      );
    `,
    {
      hotelId,
      roomType: item.room_type,
      maxGuests: item.max_guests,
      pricePerNight: item.price_per_night,
      totalQuantity: item.total_quantity,
      status: item.status,
      description: item.description,
      amenities: JSON.stringify(item.amenities),
    }
  );

  return insertResult.recordset[0].id;
}

async function upsertBooking(item, userId, hotelId, roomId, guestName, guestEmail, guestPhone) {
  const existing = await query(
    `
      SELECT TOP 1 id
      FROM dbo.Bookings
      WHERE user_id = @userId
        AND hotel_id = @hotelId
        AND room_id = @roomId
        AND check_in = @checkIn
        AND check_out = @checkOut;
    `,
    {
      userId,
      hotelId,
      roomId,
      checkIn: item.check_in,
      checkOut: item.check_out,
    }
  );

  const totalAmount = item.total_amount;

  if (existing.recordset[0]) {
    await query(
      `
        UPDATE dbo.Bookings
        SET
          guest_name = @guestName,
          guest_email = @guestEmail,
          guest_phone = @guestPhone,
          guests = @guests,
          total_amount = @totalAmount,
          status = @status,
          payment_method = @paymentMethod,
          payment_status = @paymentStatus,
          customer_note = @customerNote,
          updated_at = SYSUTCDATETIME()
        WHERE id = @bookingId;
      `,
      {
        bookingId: existing.recordset[0].id,
        guestName,
        guestEmail,
        guestPhone,
        guests: item.guests,
        totalAmount,
        status: item.status,
        paymentMethod: item.payment_method,
        paymentStatus: item.payment_status,
        customerNote: item.customer_note,
      }
    );
    return;
  }

  await query(
    `
      INSERT INTO dbo.Bookings (
        user_id,
        hotel_id,
        room_id,
        guest_name,
        guest_email,
        guest_phone,
        booking_source,
        check_in,
        check_out,
        guests,
        total_amount,
        status,
        payment_method,
        payment_status,
        customer_note
      )
      VALUES (
        @userId,
        @hotelId,
        @roomId,
        @guestName,
        @guestEmail,
        @guestPhone,
        N'account',
        @checkIn,
        @checkOut,
        @guests,
        @totalAmount,
        @status,
        @paymentMethod,
        @paymentStatus,
        @customerNote
      );
    `,
    {
      userId,
      hotelId,
      roomId,
      guestName,
      guestEmail,
      guestPhone,
      checkIn: item.check_in,
      checkOut: item.check_out,
      guests: item.guests,
      totalAmount,
      status: item.status,
      paymentMethod: item.payment_method,
      paymentStatus: item.payment_status,
      customerNote: item.customer_note,
    }
  );
}

async function upsertFeedback(item, userId, hotelId) {
  const existing = await query(
    `
      SELECT TOP 1 id
      FROM dbo.Feedbacks
      WHERE user_id = @userId
        AND hotel_id = @hotelId;
    `,
    {
      userId,
      hotelId,
    }
  );

  if (existing.recordset[0]) {
    await query(
      `
        UPDATE dbo.Feedbacks
        SET
          rating = @rating,
          content = @content,
          updated_at = SYSUTCDATETIME()
        WHERE id = @feedbackId;
      `,
      {
        feedbackId: existing.recordset[0].id,
        rating: item.rating,
        content: item.content,
      }
    );
    return;
  }

  await query(
    `
      INSERT INTO dbo.Feedbacks (
        user_id,
        hotel_id,
        rating,
        content
      )
      VALUES (
        @userId,
        @hotelId,
        @rating,
        @content
      );
    `,
    {
      userId,
      hotelId,
      rating: item.rating,
      content: item.content,
    }
  );
}

async function countTable(tableName) {
  const result = await query(`SELECT COUNT(*) AS count FROM dbo.${tableName};`);
  return Number(result.recordset[0]?.count || 0);
}

async function seed() {
  await connectDB();

  const userMap = new Map();
  for (const item of usersSeed) {
    const id = await upsertUser(item);
    userMap.set(item.email.toLowerCase(), {
      id,
      full_name: item.full_name,
      email: item.email.toLowerCase(),
      phone: item.phone,
    });
  }

  const hotelMap = new Map();
  for (const item of hotelsSeed) {
    const id = await upsertHotel(item);
    hotelMap.set(item.key, id);
  }

  const roomMap = new Map();
  for (const item of roomsSeed) {
    const hotelId = hotelMap.get(item.hotelKey);
    const id = await upsertRoom(item, hotelId);
    roomMap.set(`${item.hotelKey}:${item.room_type}`, {
      id,
      price_per_night: item.price_per_night,
    });
  }

  for (const item of bookingsSeed) {
    const user = userMap.get(item.userEmail.toLowerCase());
    const hotelId = hotelMap.get(item.hotelKey);
    const room = roomMap.get(`${item.hotelKey}:${item.roomType}`);
    if (!user || !hotelId || !room) continue;

    await upsertBooking(
      {
        ...item,
        total_amount: room.price_per_night * nightsBetween(item.check_in, item.check_out),
      },
      user.id,
      hotelId,
      room.id,
      user.full_name,
      user.email,
      user.phone
    );
  }

  for (const item of feedbacksSeed) {
    const user = userMap.get(item.userEmail.toLowerCase());
    const hotelId = hotelMap.get(item.hotelKey);
    if (!user || !hotelId) continue;
    await upsertFeedback(item, user.id, hotelId);
  }

  const counts = await Promise.all([
    countTable('Users'),
    countTable('Hotels'),
    countTable('Rooms'),
    countTable('Bookings'),
    countTable('Feedbacks'),
  ]);

  console.log('Seeded SQL Server successfully.');
  console.log(`Users: ${counts[0]}, Hotels: ${counts[1]}, Rooms: ${counts[2]}, Bookings: ${counts[3]}, Feedbacks: ${counts[4]}`);
  console.log('Sample accounts:');
  console.log('- admin@hotelbooking.local / Admin@123');
  console.log('- manager@hotelbooking.local / Manager@123');
  console.log('- lan@example.com / Customer@123');
  console.log('- khoa@example.com / Customer@123');
}

seed().catch((error) => {
  console.error('Seed failed:', error);
  process.exit(1);
});
