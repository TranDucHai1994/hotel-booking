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

async function getHotelsByKeyword(keyword = '') {
  if (!keyword) {
    const result = await query('SELECT * FROM dbo.Hotels ORDER BY created_at DESC;');
    return result.recordset.map(mapHotel);
  }

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

exports.getHotels = async (req, res) => {
  try {
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

    if (dateRange.hasRange && !dateRange.isValid) {
      return res.status(400).json({ message: 'Ngày nhận/trả phòng không hợp lệ' });
    }

    const hotels = await getHotelsByKeyword(keyword);
    const hotelIds = hotels.map((hotel) => hotel._id);
    const rooms = await getRoomsByHotelIds(hotelIds);
    const feedbacks = await getFeedbacksByHotelIds(hotelIds);
    const bookedMap = dateRange.hasRange && dateRange.isValid
      ? await getBookedRoomCountMap({
          roomIds: rooms.map((room) => room._id),
          checkIn: dateRange.checkIn,
          checkOut: dateRange.checkOut,
        })
      : new Map();

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

exports.getHotelById = async (req, res) => {
  try {
    const { check_in, check_out } = req.query;
    const dateRange = normalizeDateRange(check_in, check_out);
    if (dateRange.hasRange && !dateRange.isValid) {
      return res.status(400).json({ message: 'Ngày nhận/trả phòng không hợp lệ' });
    }

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

exports.updateHotel = async (req, res) => {
  try {
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

exports.deleteHotel = async (req, res) => {
  try {
    const deleted = await withTransaction(async (transaction) => {
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

      await query(
        `
          DELETE FROM dbo.Feedbacks
          WHERE hotel_id = @hotelId;
        `,
        { hotelId },
        { transaction }
      );

      await query(
        `
          DELETE FROM dbo.Bookings
          WHERE hotel_id = @hotelId;
        `,
        { hotelId },
        { transaction }
      );

      await query(
        `
          DELETE FROM dbo.Rooms
          WHERE hotel_id = @hotelId;
        `,
        { hotelId },
        { transaction }
      );

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
