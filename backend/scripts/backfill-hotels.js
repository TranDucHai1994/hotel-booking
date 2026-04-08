require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('../config/db');
const Hotel = require('../models/Hotel');

const TYPES = ['hotel', 'resort', 'homestay', 'apartment', 'villa', 'hostel', 'boutique', 'motel'];
const STAR_VALUES = [0, 3, 4, 5];

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

async function run() {
  await connectDB();
  const hotels = await Hotel.find();
  let updated = 0;

  for (const h of hotels) {
    let changed = false;

    if (!h.property_type) {
      h.property_type = pick(TYPES);
      changed = true;
    }

    if (h.star_rating === undefined || h.star_rating === null) {
      h.star_rating = pick(STAR_VALUES);
      changed = true;
    }

    if (h.is_hot_deal === undefined || h.is_hot_deal === null) {
      h.is_hot_deal = Math.random() < 0.25;
      changed = true;
    }

    if (h.is_hot_deal && (!h.hot_deal_discount_percent || h.hot_deal_discount_percent === 0)) {
      h.hot_deal_discount_percent = pick([10, 15, 20, 25, 30, 35]);
      changed = true;
    }

    if (!h.is_hot_deal && h.hot_deal_discount_percent) {
      h.hot_deal_discount_percent = 0;
      changed = true;
    }

    if (changed) {
      await h.save();
      updated++;
    }
  }

  console.log(`Backfill complete. Updated ${updated}/${hotels.length} hotels.`);
  await mongoose.disconnect();
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});

