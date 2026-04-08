const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  username: { type: String, trim: true, unique: true, sparse: true },
  role: { type: String, enum: ['customer', 'admin', 'manager', 'staff'], default: 'customer' },
  status: { type: String, enum: ['active', 'locked', 'disabled'], default: 'active' },
  deleted_at: { type: Date, default: null },
  failed_attempts: { type: Number, default: 0 },
  last_login: { type: Date, default: null },
  full_name: { type: String, required: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  phone: { type: String, default: '' },
  password_hash: { type: String, required: true },
  refresh_token_hash: { type: String, default: null },
  refresh_token_expiry: { type: Date, default: null },
  reset_password_token_hash: { type: String, default: null },
  reset_password_expiry: { type: Date, default: null },
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);