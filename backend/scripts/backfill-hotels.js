require('dotenv').config();
const { connectDB, query } = require('../config/db');
const { parseJsonArray } = require('../utils/sql');

const TYPES = ['hotel', 'resort', 'homestay', 'apartment', 'villa', 'hostel', 'boutique', 'motel'];
const STAR_VALUES = [0, 3, 4, 5];

function pick(array) {
  return array[Math.floor(Math.random() * array.length)];
}

async function run() {
  await connectDB();
  const hotelsResult = await query('SELECT * FROM dbo.Hotels;');
  const hotels = hotelsResult.recordset;
  let updated = 0;

  for (const hotel of hotels) {
    let changed = false;
    const nextPayload = {
      propertyType: hotel.property_type,
      starRating: hotel.star_rating,
      isHotDeal: hotel.is_hot_deal,
      hotDealDiscountPercent: hotel.hot_deal_discount_percent,
      amenities: hotel.amenities,
      images: hotel.images,
    };

    if (!hotel.property_type) {
      nextPayload.propertyType = pick(TYPES);
      changed = true;
    }

    if (hotel.star_rating === undefined || hotel.star_rating === null) {
      nextPayload.starRating = pick(STAR_VALUES);
      changed = true;
    }

    if (hotel.is_hot_deal === undefined || hotel.is_hot_deal === null) {
      nextPayload.isHotDeal = Math.random() < 0.25;
      changed = true;
    }

    if (nextPayload.isHotDeal && (!hotel.hot_deal_discount_percent || Number(hotel.hot_deal_discount_percent) === 0)) {
      nextPayload.hotDealDiscountPercent = pick([10, 15, 20, 25, 30, 35]);
      changed = true;
    }

    if (!nextPayload.isHotDeal && hotel.hot_deal_discount_percent) {
      nextPayload.hotDealDiscountPercent = 0;
      changed = true;
    }

    if (!changed) continue;

    await query(
      `
        UPDATE dbo.Hotels
        SET
          property_type = @propertyType,
          star_rating = @starRating,
          is_hot_deal = @isHotDeal,
          hot_deal_discount_percent = @hotDealDiscountPercent,
          amenities = @amenities,
          images = @images,
          updated_at = SYSUTCDATETIME()
        WHERE id = @hotelId;
      `,
      {
        hotelId: hotel.id,
        propertyType: nextPayload.propertyType,
        starRating: nextPayload.starRating,
        isHotDeal: nextPayload.isHotDeal,
        hotDealDiscountPercent: nextPayload.hotDealDiscountPercent,
        amenities: JSON.stringify(parseJsonArray(nextPayload.amenities)),
        images: JSON.stringify(parseJsonArray(nextPayload.images)),
      }
    );

    updated += 1;
  }

  console.log(`Backfill complete. Updated ${updated}/${hotels.length} hotels.`);
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
