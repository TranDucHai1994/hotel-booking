const User = require('../models/User');
const bcrypt = require('bcryptjs');

const toPublicUser = (u) => ({
  id: u._id,
  username: u.username,
  full_name: u.full_name,
  email: u.email,
  phone: u.phone,
  role: u.role,
  status: u.status,
  failed_attempts: u.failed_attempts,
  last_login: u.last_login,
  created_at: u.createdAt,
  updated_at: u.updatedAt,
});

exports.listUsers = async (req, res) => {
  try {
    const users = await User.find({ deleted_at: null }).sort({ createdAt: -1 });
    res.json(users.map(toPublicUser));
  } catch (err) {
    res.status(500).json({ message: 'Lỗi server', error: err.message });
  }
};

exports.createUser = async (req, res) => {
  try {
    const { username, full_name, email, phone, password, role, status } = req.body;
    if (!full_name || !email || !password)
      return res.status(400).json({ message: 'Thiếu full_name/email/password' });

    const existingEmail = await User.findOne({ email: String(email).toLowerCase().trim() });
    if (existingEmail) return res.status(400).json({ message: 'Email đã tồn tại' });
    if (username) {
      const existingUsername = await User.findOne({ username: String(username).trim() });
      if (existingUsername) return res.status(400).json({ message: 'Username đã tồn tại' });
    }

    const hash = await bcrypt.hash(password, 10);
    const user = await User.create({
      username: username ? String(username).trim() : undefined,
      full_name,
      email,
      phone,
      password_hash: hash,
      role: role || 'staff',
      status: status || 'active',
    });

    res.status(201).json({ message: 'Tạo user thành công', user: toPublicUser(user) });
  } catch (err) {
    res.status(500).json({ message: 'Lỗi server', error: err.message });
  }
};

exports.updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const { username, full_name, email, phone, role, status, password } = req.body;

    const user = await User.findById(id);
    if (!user || user.deleted_at) return res.status(404).json({ message: 'Không tìm thấy user' });

    if (email && String(email).toLowerCase().trim() !== user.email) {
      const existingEmail = await User.findOne({ email: String(email).toLowerCase().trim() });
      if (existingEmail) return res.status(400).json({ message: 'Email đã tồn tại' });
      user.email = String(email).toLowerCase().trim();
    }

    if (username && String(username).trim() !== (user.username || '')) {
      const existingUsername = await User.findOne({ username: String(username).trim() });
      if (existingUsername) return res.status(400).json({ message: 'Username đã tồn tại' });
      user.username = String(username).trim();
    }

    if (typeof full_name === 'string') user.full_name = full_name;
    if (typeof phone === 'string') user.phone = phone;
    if (typeof role === 'string') user.role = role;
    if (typeof status === 'string') user.status = status;

    // Optional admin password update (for "reset password" / "change password" UI)
    if (typeof password === 'string' && password.trim().length > 0) {
      user.password_hash = await bcrypt.hash(password.trim(), 10);
      // Invalidate tokens after password rotation
      user.refresh_token_hash = null;
      user.refresh_token_expiry = null;
      user.reset_password_token_hash = null;
      user.reset_password_expiry = null;
      user.failed_attempts = 0;
      if (user.status === 'locked') user.status = 'active';
    }

    await user.save();
    res.json({ message: 'Cập nhật user thành công', user: toPublicUser(user) });
  } catch (err) {
    res.status(500).json({ message: 'Lỗi server', error: err.message });
  }
};

exports.lockUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user || user.deleted_at) return res.status(404).json({ message: 'Không tìm thấy user' });
    user.status = 'locked';
    await user.save();
    res.json({ message: 'Đã khóa tài khoản', user: toPublicUser(user) });
  } catch (err) {
    res.status(500).json({ message: 'Lỗi server', error: err.message });
  }
};

exports.unlockUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user || user.deleted_at) return res.status(404).json({ message: 'Không tìm thấy user' });
    user.status = 'active';
    user.failed_attempts = 0;
    await user.save();
    res.json({ message: 'Đã mở khóa tài khoản', user: toPublicUser(user) });
  } catch (err) {
    res.status(500).json({ message: 'Lỗi server', error: err.message });
  }
};

