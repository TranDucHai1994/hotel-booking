const { parseJsonArray, toBoolean, toNumber } = require('./sql');

function mapUser(row) {
  if (!row) return null;
  return {
    id: row.id,
    _id: row.id,
    username: row.username,
    role: row.role,
    status: row.status,
    deleted_at: row.deleted_at,
    failed_attempts: toNumber(row.failed_attempts),
    last_login: row.last_login,
    full_name: row.full_name,
    email: row.email,
    phone: row.phone || '',
    password_hash: row.password_hash,
    refresh_token_hash: row.refresh_token_hash,
    refresh_token_expiry: row.refresh_token_expiry,
    reset_password_token_hash: row.reset_password_token_hash,
    reset_password_expiry: row.reset_password_expiry,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapHotel(row) {
  if (!row) return null;
  return {
    _id: row.id,
    name: row.name,
    city: row.city || '',
    address: row.address || '',
    description: row.description || '',
    property_type: row.property_type || 'hotel',
    star_rating: toNumber(row.star_rating),
    is_hot_deal: toBoolean(row.is_hot_deal),
    hot_deal_discount_percent: toNumber(row.hot_deal_discount_percent),
    amenities: parseJsonArray(row.amenities),
    cover_image: row.cover_image || '',
    images: parseJsonArray(row.images),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapRoom(row) {
  if (!row) return null;
  return {
    _id: row.id,
    hotel_id: row.hotel_id,
    room_type: row.room_type,
    max_guests: toNumber(row.max_guests, 2),
    price_per_night: toNumber(row.price_per_night),
    total_quantity: toNumber(row.total_quantity, 1),
    status: row.status || 'available',
    description: row.description || '',
    amenities: parseJsonArray(row.amenities),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapBooking(row) {
  if (!row) return null;
  return {
    _id: row.id,
    user_id: row.user_id,
    hotel_id: row.hotel_id,
    room_id: row.room_id,
    guest_name: row.guest_name || '',
    guest_email: row.guest_email || '',
    guest_phone: row.guest_phone || '',
    booking_source: row.booking_source || 'account',
    check_in: row.check_in,
    check_out: row.check_out,
    guests: toNumber(row.guests, 1),
    total_amount: toNumber(row.total_amount),
    status: row.status || 'pending',
    payment_method: row.payment_method || 'pay_at_hotel',
    payment_status: row.payment_status || 'unpaid',
    customer_note: row.customer_note || '',
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapFeedback(row) {
  if (!row) return null;
  return {
    _id: row.id,
    user_id: row.user_id,
    hotel_id: row.hotel_id,
    rating: toNumber(row.rating, 0),
    content: row.content || '',
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

module.exports = {
  mapBooking,
  mapFeedback,
  mapHotel,
  mapRoom,
  mapUser,
};
