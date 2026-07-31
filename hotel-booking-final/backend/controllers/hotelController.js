/**
 * hotelController.js
 * Mục đích: Xử lý các API quản lý khách sạn - tìm kiếm/lọc khách sạn (theo
 * thành phố, giá, đánh giá, tiện ích, ngày trống), xem chi tiết khách sạn,
 * và CRUD khách sạn dành cho Admin.
 * Export chính: getHotels, getHotelById, createHotel, updateHotel, deleteHotel.
 */
const { query, withTransaction } = require('../config/db');
const { mapFeedback, mapHotel, mapRoom } = require('../utils/mappers');
const { computeRoomAvailability, getBookedRoomCountMap, normalizeDateRange } = require('../utils/availability');
const { buildInClause, normalizeStringArray } = require('../utils/sql');

function buildMapQuery(hotel) {
  return [hotel.name, hotel.address, hotel.city].filter(Boolean).join(', ');
}

function parseAmenityFilter(rawValue) {
  if (Array.isArray(rawValue)) {
    return rawValue.flatMap((item) => normalizeStringArray(item));
  }

  return normalizeStringArray(rawValue);
}

/**
 * City alias map: maps Vietnamese user input (diacritics, alternate names)
 * to the actual DB city values. This is necessary because:
 * - DB stores ASCII: "Ho Chi Minh", "Da Nang", "Can Tho", etc.
 * - Users type Vietnamese: "sài gòn", "đà nẵng", "cần thơ", etc.
 * - "Sài Gòn" → "Ho Chi Minh" is a completely different name, not just diacritics
 */
const CITY_ALIAS_MAP = {
  // Ho Chi Minh aliases
  'sai gon': 'Ho Chi Minh',
  'saigon': 'Ho Chi Minh',
  'sài gòn': 'Ho Chi Minh',
  'ho chi minh': 'Ho Chi Minh',
  'hồ chí minh': 'Ho Chi Minh',
  'hcm': 'Ho Chi Minh',
  'tp hcm': 'Ho Chi Minh',
  'tp.hcm': 'Ho Chi Minh',
  'tphcm': 'Ho Chi Minh',
  // Ha Noi aliases
  'ha noi': 'Ha Noi',
  'hanoi': 'Ha Noi',
  'hà nội': 'Ha Noi',
  // Da Nang aliases
  'da nang': 'Da Nang',
  'danang': 'Da Nang',
  'đà nẵng': 'Da Nang',
  // Can Tho aliases
  'can tho': 'Can Tho',
  'cantho': 'Can Tho',
  'cần thơ': 'Can Tho',
  // Da Lat aliases
  'da lat': 'Da Lat',
  'dalat': 'Da Lat',
  'đà lạt': 'Da Lat',
  // Phu Quoc aliases
  'phu quoc': 'Phu Quoc',
  'phuquoc': 'Phu Quoc',
  'phú quốc': 'Phu Quoc',
  // Nha Trang aliases
  'nha trang': 'Nha Trang',
  'nhatrang': 'Nha Trang',
  // Hue aliases
  'hue': 'Hue',
  'huế': 'Hue',
};

/**
 * Resolve a user-typed keyword to a DB city value using the alias map.
 * Returns the DB city string if matched, or null for LIKE fallback.
 */
function resolveCityAlias(keyword) {
  if (!keyword) return null;
  const normalized = keyword.toLowerCase().trim();
  return CITY_ALIAS_MAP[normalized] || null;
}

async function getHotelsByKeyword(keyword = '') {
  if (!keyword) {
    const result = await query('SELECT * FROM dbo.Hotels ORDER BY created_at DESC;');
    return result.recordset.map(mapHotel);
  }

  // First, check if the keyword matches a known city alias
  const resolvedCity = resolveCityAlias(keyword);

  if (resolvedCity) {
    // Exact city match — most reliable for Vietnamese input
    const result = await query(
      `
        SELECT *
        FROM dbo.Hotels
        WHERE city = @city
        ORDER BY created_at DESC;
      `,
      { city: resolvedCity }
    );
    return result.recordset.map(mapHotel);
  }

  // Fallback: LIKE search against name, city, address (for partial/hotel name searches)
  const result = await query(
    `
      SELECT *
      FROM dbo.Hotels
      WHERE name LIKE @keyword
        OR city LIKE @keyword
        OR address LIKE @keyword
      ORDER BY created_at DESC;
    `,
    { keyword: `%${keyword}%` }
  );

  return result.recordset.map(mapHotel);
}


async function getRoomsByHotelIds(hotelIds = []) {
  if (!hotelIds.length) {
    return [];
  }

  const { clause, params } = buildInClause(hotelIds, 'hotelId');
  const result = await query(
    `
      SELECT *
      FROM dbo.Rooms
      WHERE hotel_id IN (${clause})
      ORDER BY created_at DESC;
    `,
    params
  );

  return result.recordset.map(mapRoom);
}

async function getFeedbacksByHotelIds(hotelIds = []) {
  if (!hotelIds.length) {
    return [];
  }

  const { clause, params } = buildInClause(hotelIds, 'hotelFeedbackId');
  const result = await query(
    `
      SELECT *
      FROM dbo.Feedbacks
      WHERE hotel_id IN (${clause});
    `,
    params
  );

  return result.recordset.map(mapFeedback);
}

/**
 * Lấy danh sách khách sạn dựa theo các bộ lọc (filter).
 * Hỗ trợ lọc theo: từ khóa/thành phố, khoảng giá, đánh giá (rating), tiện ích (amenities), và khoảng thời gian (check_in/check_out).
 */
exports.getHotels = async (req, res) => {
  try {
    // Bước 1: Trích xuất tham số lọc từ query và chuẩn hóa (từ khóa, giá, rating, tiện ích, khoảng ngày)
    const {
      city,
      location,
      min_price,
      max_price,
      min_rating,
      check_in,
      check_out,
      amenities,
    } = req.query;

    const keyword = String(location || city || '').trim();
    const minPriceFilter = Number(min_price || 0);
    const maxPriceFilter = Number(max_price || 0);
    const minRatingFilter = Number(min_rating || 0);
    const amenitiesFilter = parseAmenityFilter(amenities).map((item) => item.toLowerCase());
    const dateRange = normalizeDateRange(check_in, check_out);

    // Bước 2: Kiểm tra khoảng ngày check_in/check_out có hợp lệ không
    if (dateRange.hasRange && !dateRange.isValid) {
      return res.status(400).json({ message: 'Ngày nhận/trả phòng không hợp lệ' });
    }

    // Bước 3: Lấy danh sách khách sạn theo từ khóa, cùng phòng và đánh giá liên quan
    const hotels = await getHotelsByKeyword(keyword);
    const hotelIds = hotels.map((hotel) => hotel._id);
    const rooms = await getRoomsByHotelIds(hotelIds);
    const feedbacks = await getFeedbacksByHotelIds(hotelIds);

    // Bước 4: Nếu có khoảng ngày hợp lệ thì tính số phòng đã đặt để suy ra số phòng còn trống
    const bookedMap = dateRange.hasRange && dateRange.isValid
      ? await getBookedRoomCountMap({
          roomIds: rooms.map((room) => room._id),
          checkIn: dateRange.checkIn,
          checkOut: dateRange.checkOut,
        })
      : new Map();

    // Bước 5: Gom nhóm phòng và đánh giá theo từng khách sạn để tiện tính toán bên dưới
    const roomsByHotel = rooms.reduce((accumulator, room) => {
      const key = String(room.hotel_id);
      if (!accumulator[key]) accumulator[key] = [];
      accumulator[key].push(computeRoomAvailability(room, bookedMap.get(String(room._id)) || 0));
      return accumulator;
    }, {});

    const feedbacksByHotel = feedbacks.reduce((accumulator, feedback) => {
      const key = String(feedback.hotel_id);
      if (!accumulator[key]) accumulator[key] = [];
      accumulator[key].push(feedback);
      return accumulator;
    }, {});

    // Bước 6: Tính giá thấp nhất, số phòng trống, đánh giá trung bình cho từng khách sạn và áp dụng các bộ lọc
    const result = hotels
      .map((hotel) => {
        const hotelRooms = roomsByHotel[String(hotel._id)] || [];
        const hotelFeedbacks = feedbacksByHotel[String(hotel._id)] || [];
        const bookableRooms = hotelRooms.filter((room) => room.is_bookable);
        const priceSource = bookableRooms.length > 0 ? bookableRooms : hotelRooms;
        const minPrice = priceSource.length > 0
          ? Math.min(...priceSource.map((room) => Number(room.price_per_night || 0)))
          : null;
        const availableRoomCount = hotelRooms.reduce((sum, room) => sum + Number(room.available_quantity || 0), 0);
        const totalRoomCount = hotelRooms.reduce((sum, room) => sum + Number(room.total_quantity || 0), 0);
        // average_rating KHÔNG được lưu sẵn trong bảng Hotels, mà được TÍNH ĐỘNG mỗi lần
        // gọi API này: cộng dồn rating từ toàn bộ feedback rồi chia số lượng feedback.
        // Đánh đổi: đơn giản hơn (không cần nhớ update lại điểm mỗi khi có feedback mới/bị
        // xóa, tránh lệch số liệu), nhưng tốn CPU hơn nếu khách sạn có rất nhiều đánh giá,
        // vì phải tính lại từ đầu mỗi lần có người xem trang.
        const averageRating = hotelFeedbacks.length > 0
          ? hotelFeedbacks.reduce((sum, item) => sum + Number(item.rating || 0), 0) / hotelFeedbacks.length
          : null;

        const hotelAmenities = hotel.amenities.map((item) => item.toLowerCase());
        const matchesAmenities = amenitiesFilter.length === 0
          ? true
          : amenitiesFilter.every((item) => hotelAmenities.includes(item));

        if (!matchesAmenities) return null;
        if (minPriceFilter && (minPrice === null || minPrice < minPriceFilter)) return null;
        if (maxPriceFilter && (minPrice === null || minPrice > maxPriceFilter)) return null;
        if (minRatingFilter && (averageRating === null || averageRating < minRatingFilter)) return null;
        if (dateRange.hasRange && availableRoomCount <= 0) return null;

        return {
          ...hotel,
          min_price: minPrice,
          available_room_count: availableRoomCount,
          total_room_count: totalRoomCount,
          room_types_count: hotelRooms.length,
          average_rating: averageRating,
          review_count: hotelFeedbacks.length,
          map_query: buildMapQuery(hotel),
          search_meta: {
            check_in: check_in || '',
            check_out: check_out || '',
          },
        };
      })
      .filter(Boolean);

    return res.json(result);
  } catch (err) {
    return res.status(500).json({ message: 'Lỗi server', error: err.message });
  }
};

/**
 * Lấy thông tin chi tiết của một khách sạn cụ thể theo ID.
 * Bao gồm: Thông tin cơ bản, danh sách các loại phòng (kèm theo số lượng trống), và danh sách các đánh giá (feedbacks).
 */
exports.getHotelById = async (req, res) => {
  try {
    // Bước 1: Kiểm tra khoảng ngày check_in/check_out có hợp lệ không
    const { check_in, check_out } = req.query;
    const dateRange = normalizeDateRange(check_in, check_out);
    if (dateRange.hasRange && !dateRange.isValid) {
      return res.status(400).json({ message: 'Ngày nhận/trả phòng không hợp lệ' });
    }

    // Bước 2: Tìm khách sạn theo ID, chặn ngay nếu không tồn tại
    const hotelResult = await query(
      `
        SELECT TOP 1 *
        FROM dbo.Hotels
        WHERE id = @hotelId;
      `,
      { hotelId: Number(req.params.id) }
    );

    const hotel = mapHotel(hotelResult.recordset[0]);
    if (!hotel) {
      return res.status(404).json({ message: 'Không tìm thấy khách sạn' });
    }

    // Bước 3: Lấy danh sách phòng và danh sách đánh giá thuộc khách sạn này
    const roomsResult = await query(
      `
        SELECT *
        FROM dbo.Rooms
        WHERE hotel_id = @hotelId
        ORDER BY created_at DESC;
      `,
      { hotelId: hotel._id }
    );

    const feedbackResult = await query(
      `
        SELECT
          f.*,
          u.full_name AS user_full_name
        FROM dbo.Feedbacks f
        INNER JOIN dbo.Users u ON u.id = f.user_id
        WHERE f.hotel_id = @hotelId
        ORDER BY f.created_at DESC;
      `,
      { hotelId: hotel._id }
    );

    // Bước 4: Nếu có khoảng ngày hợp lệ thì tính số phòng đã đặt để suy ra số phòng còn trống
    const rooms = roomsResult.recordset.map(mapRoom);
    const bookedMap = dateRange.hasRange && dateRange.isValid
      ? await getBookedRoomCountMap({
          roomIds: rooms.map((room) => room._id),
          checkIn: dateRange.checkIn,
          checkOut: dateRange.checkOut,
        })
      : new Map();

    const roomsWithAvailability = rooms.map((room) => (
      computeRoomAvailability(room, bookedMap.get(String(room._id)) || 0)
    ));

    // Bước 5: Chuẩn hóa danh sách đánh giá và tính điểm đánh giá trung bình
    const feedbacks = feedbackResult.recordset.map((row) => ({
      ...mapFeedback(row),
      user_id: {
        full_name: row.user_full_name,
      },
    }));

    const reviewCount = feedbacks.length;
    const averageRating = reviewCount > 0
      ? feedbacks.reduce((sum, item) => sum + Number(item.rating || 0), 0) / reviewCount
      : null;

    // Bước 6: Trả về thông tin khách sạn kèm danh sách phòng, đánh giá và các số liệu tổng hợp
    return res.json({
      ...hotel,
      rooms: roomsWithAvailability,
      feedbacks,
      average_rating: averageRating,
      review_count: reviewCount,
      min_price: roomsWithAvailability.length > 0
        ? Math.min(...roomsWithAvailability.map((room) => Number(room.price_per_night || 0)))
        : null,
      available_room_count: roomsWithAvailability.reduce((sum, room) => sum + Number(room.available_quantity || 0), 0),
      total_room_count: roomsWithAvailability.reduce((sum, room) => sum + Number(room.total_quantity || 0), 0),
      map_query: buildMapQuery(hotel),
      search_meta: {
        check_in: check_in || '',
        check_out: check_out || '',
      },
    });
  } catch (err) {
    return res.status(500).json({ message: 'Lỗi server', error: err.message });
  }
};

/**
 * Thêm mới một khách sạn vào hệ thống. (Chức năng dành cho Admin)
 */
exports.createHotel = async (req, res) => {
  try {
    const payload = {
      name: String(req.body.name || '').trim(),
      city: String(req.body.city || '').trim(),
      address: String(req.body.address || '').trim(),
      description: String(req.body.description || '').trim(),
      propertyType: String(req.body.property_type || 'hotel').trim() || 'hotel',
      starRating: Number(req.body.star_rating || 0),
      isHotDeal: Boolean(req.body.is_hot_deal),
      hotDealDiscountPercent: Number(req.body.hot_deal_discount_percent || 0),
      amenities: JSON.stringify(normalizeStringArray(req.body.amenities)),
      coverImage: String(req.body.cover_image || '').trim(),
      images: JSON.stringify(normalizeStringArray(req.body.images)),
    };

    const result = await query(
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
        OUTPUT INSERTED.*
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
      payload
    );

    return res.status(201).json({
      message: 'Tạo khách sạn thành công',
      hotel: mapHotel(result.recordset[0]),
    });
  } catch (err) {
    return res.status(500).json({ message: 'Lỗi server', error: err.message });
  }
};

/**
 * Cập nhật thông tin của một khách sạn đang tồn tại. (Dành cho Admin)
 */
exports.updateHotel = async (req, res) => {
  try {
    // Bước 1: Tìm khách sạn hiện tại theo ID, chặn ngay nếu không tồn tại
    const currentResult = await query(
      `
        SELECT TOP 1 *
        FROM dbo.Hotels
        WHERE id = @hotelId;
      `,
      { hotelId: Number(req.params.id) }
    );

    const currentHotel = mapHotel(currentResult.recordset[0]);
    if (!currentHotel) {
      return res.status(404).json({ message: 'Không tìm thấy khách sạn' });
    }

    // Bước 2: Cập nhật các trường vào database (giữ giá trị cũ nếu request không truyền lên)
    await query(
      `
        UPDATE dbo.Hotels
        SET
          name = @name,
          city = @city,
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
        WHERE id = @hotelId;
      `,
      {
        hotelId: currentHotel._id,
        name: String(req.body.name ?? currentHotel.name).trim(),
        city: String(req.body.city ?? currentHotel.city).trim(),
        address: String(req.body.address ?? currentHotel.address).trim(),
        description: String(req.body.description ?? currentHotel.description).trim(),
        propertyType: String(req.body.property_type ?? currentHotel.property_type).trim() || 'hotel',
        starRating: Number(req.body.star_rating ?? currentHotel.star_rating ?? 0),
        isHotDeal: req.body.is_hot_deal !== undefined ? Boolean(req.body.is_hot_deal) : Boolean(currentHotel.is_hot_deal),
        hotDealDiscountPercent: Number(req.body.hot_deal_discount_percent ?? currentHotel.hot_deal_discount_percent ?? 0),
        amenities: JSON.stringify(
          req.body.amenities !== undefined ? normalizeStringArray(req.body.amenities) : currentHotel.amenities
        ),
        coverImage: String(req.body.cover_image ?? currentHotel.cover_image ?? '').trim(),
        images: JSON.stringify(
          req.body.images !== undefined ? normalizeStringArray(req.body.images) : currentHotel.images
        ),
      }
    );

    // Bước 3: Lấy lại bản ghi mới nhất sau khi cập nhật để trả về cho client
    const updatedResult = await query(
      `
        SELECT TOP 1 *
        FROM dbo.Hotels
        WHERE id = @hotelId;
      `,
      { hotelId: currentHotel._id }
    );

    return res.json({
      message: 'Cập nhật thành công',
      hotel: mapHotel(updatedResult.recordset[0]),
    });
  } catch (err) {
    return res.status(500).json({ message: 'Lỗi server', error: err.message });
  }
};

/**
 * Xóa hoàn toàn một khách sạn khỏi hệ thống. (Dành cho Admin)
 * Sử dụng Transaction để đảm bảo: Nếu xóa khách sạn thì các phòng, đơn đặt phòng và đánh giá thuộc về khách sạn đó cũng phải được xóa sạch.
 */
exports.deleteHotel = async (req, res) => {
  try {
    const deleted = await withTransaction(async (transaction) => {
      // Bước 1: Kiểm tra khách sạn có tồn tại không, chặn ngay nếu không tìm thấy
      const hotelId = Number(req.params.id);
      const existing = await query(
        `
          SELECT TOP 1 id
          FROM dbo.Hotels
          WHERE id = @hotelId;
        `,
        { hotelId },
        { transaction }
      );

      if (!existing.recordset[0]) {
        return false;
      }

      // Bước 2: Xóa các đánh giá (feedback) thuộc khách sạn
      await query(
        `
          DELETE FROM dbo.Feedbacks
          WHERE hotel_id = @hotelId;
        `,
        { hotelId },
        { transaction }
      );

      // Bước 3: Xóa các đơn đặt phòng thuộc khách sạn
      await query(
        `
          DELETE FROM dbo.Bookings
          WHERE hotel_id = @hotelId;
        `,
        { hotelId },
        { transaction }
      );

      // Bước 4: Xóa các phòng thuộc khách sạn
      await query(
        `
          DELETE FROM dbo.Rooms
          WHERE hotel_id = @hotelId;
        `,
        { hotelId },
        { transaction }
      );

      // Bước 5: Xóa chính bản ghi khách sạn
      await query(
        `
          DELETE FROM dbo.Hotels
          WHERE id = @hotelId;
        `,
        { hotelId },
        { transaction }
      );

      return true;
    });

    if (!deleted) {
      return res.status(404).json({ message: 'Không tìm thấy khách sạn' });
    }

    return res.json({ message: 'Xóa thành công' });
  } catch (err) {
    return res.status(500).json({ message: 'Lỗi server', error: err.message });
  }
};
