const Booking = require('../models/Booking');

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const BLOCKING_BOOKING_STATUSES = ['pending', 'confirmed'];

function parseDateStart(value) {
  if (!value) return null;
  const parsed = new Date(`${value}T00:00:00.000`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function parseDateEnd(value) {
  if (!value) return null;
  const parsed = new Date(`${value}T00:00:00.000`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function normalizeDateRange(checkInRaw, checkOutRaw) {
  const checkIn = parseDateStart(checkInRaw);
  const checkOut = parseDateEnd(checkOutRaw);

  if (!checkIn || !checkOut) {
    return { checkIn: null, checkOut: null, hasRange: false, isValid: false };
  }

  return {
    checkIn,
    checkOut,
    hasRange: true,
    isValid: checkOut > checkIn,
  };
}

function getBookingOverlapMatch({ roomIds, checkIn, checkOut, excludeBookingId = null, statuses = BLOCKING_BOOKING_STATUSES }) {
  const match = {
    status: { $in: statuses },
    room_id: { $in: roomIds },
    check_in: { $lt: checkOut },
    check_out: { $gt: checkIn },
  };

  if (excludeBookingId) {
    match._id = { $ne: excludeBookingId };
  }

  return match;
}

async function getBookedRoomCountMap({ roomIds = [], checkIn, checkOut, excludeBookingId = null }) {
  if (!Array.isArray(roomIds) || roomIds.length === 0 || !checkIn || !checkOut) {
    return new Map();
  }

  const rows = await Booking.aggregate([
    {
      $match: getBookingOverlapMatch({ roomIds, checkIn, checkOut, excludeBookingId }),
    },
    {
      $group: {
        _id: '$room_id',
        count: { $sum: 1 },
      },
    },
  ]);

  return new Map(rows.map((row) => [String(row._id), Number(row.count || 0)]));
}

function computeRoomAvailability(room, bookedCount = 0) {
  const totalQuantity = Number(room.total_quantity || 0);
  const status = room.status || 'available';
  const canSell = status === 'available';
  const availableQuantity = canSell ? Math.max(totalQuantity - bookedCount, 0) : 0;

  let availabilityStatus = 'available';
  if (status === 'maintenance') availabilityStatus = 'maintenance';
  else if (status === 'inactive') availabilityStatus = 'inactive';
  else if (availableQuantity <= 0) availabilityStatus = 'full';
  else if (availableQuantity <= Math.max(1, Math.ceil(totalQuantity * 0.3))) availabilityStatus = 'limited';

  return {
    ...room,
    status,
    booked_quantity: canSell ? bookedCount : totalQuantity,
    available_quantity: availableQuantity,
    availability_status: availabilityStatus,
    is_bookable: canSell && availableQuantity > 0,
  };
}

function computeStayNights(checkIn, checkOut) {
  if (!checkIn || !checkOut) return 0;
  return Math.max(0, Math.ceil((checkOut - checkIn) / MS_PER_DAY));
}

function calculateOverlapNights(booking, rangeStart, rangeEnd) {
  const bookingStart = new Date(booking.check_in);
  const bookingEnd = new Date(booking.check_out);
  const overlapStart = bookingStart > rangeStart ? bookingStart : rangeStart;
  const overlapEnd = bookingEnd < rangeEnd ? bookingEnd : rangeEnd;

  if (overlapEnd <= overlapStart) return 0;
  return Math.ceil((overlapEnd - overlapStart) / MS_PER_DAY);
}

module.exports = {
  BLOCKING_BOOKING_STATUSES,
  calculateOverlapNights,
  computeRoomAvailability,
  computeStayNights,
  getBookedRoomCountMap,
  normalizeDateRange,
  parseDateEnd,
  parseDateStart,
};
