const User = require('../models/User');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { logAudit } = require('../services/auditService');

const ACCESS_TOKEN_EXPIRES_IN = process.env.ACCESS_TOKEN_EXPIRES_IN || '7d';
const REFRESH_TOKEN_EXPIRES_DAYS = Number(process.env.REFRESH_TOKEN_EXPIRES_DAYS || 30);
const RESET_PASSWORD_EXPIRES_MINUTES = Number(process.env.RESET_PASSWORD_EXPIRES_MINUTES || 30);
const MAX_FAILED_LOGIN_ATTEMPTS = Number(process.env.MAX_FAILED_LOGIN_ATTEMPTS || 5);

function sha256(input) {
  return crypto.createHash('sha256').update(input).digest('hex');
}

function signAccessToken(user) {
  return jwt.sign(
    { id: String(user._id), role: user.role, email: user.email },
    process.env.JWT_SECRET,
    { expiresIn: ACCESS_TOKEN_EXPIRES_IN }
  );
}

function newOpaqueToken() {
  return crypto.randomBytes(32).toString('hex');
}

// Đăng ký
exports.register = async (req, res) => {
  const { full_name, email, phone, password } = req.body;
  try {
    const existing = await User.findOne({ email });
    if (existing) return res.status(400).json({ message: 'Email đã tồn tại' });
    const hash = await bcrypt.hash(password, 10);
    await User.create({ full_name, email, phone, password_hash: hash });
    res.status(201).json({ message: 'Đăng ký thành công' });
  } catch (err) {
    res.status(500).json({ message: 'Lỗi server', error: err.message });
  }
};

// Đăng nhập
exports.login = async (req, res) => {
  const { email, password } = req.body;
  try {
    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ message: 'Email không tồn tại' });

    if (user.deleted_at) return res.status(403).json({ message: 'Tài khoản đã bị vô hiệu hóa' });
    if (user.status === 'disabled') return res.status(403).json({ message: 'Tài khoản đã bị vô hiệu hóa' });
    if (user.status === 'locked') return res.status(403).json({ message: 'Tài khoản đang bị khóa' });

    const match = await bcrypt.compare(password, user.password_hash);

    if (!match) {
      const nextFailed = Number(user.failed_attempts || 0) + 1;
      const update = { failed_attempts: nextFailed };
      if (nextFailed >= MAX_FAILED_LOGIN_ATTEMPTS) update.status = 'locked';
      await User.updateOne({ _id: user._id }, update);
      return res.status(400).json({ message: 'Sai mật khẩu' });
    }

    const refreshToken = newOpaqueToken();
    const refreshExpiry = new Date(Date.now() + REFRESH_TOKEN_EXPIRES_DAYS * 24 * 60 * 60 * 1000);

    user.failed_attempts = 0;
    user.last_login = new Date();
    user.refresh_token_hash = sha256(refreshToken);
    user.refresh_token_expiry = refreshExpiry;
    await user.save();

    const token = signAccessToken(user);
    await logAudit({ userId: user._id, action: 'login', entity: 'auth', entityId: null });
    res.json({
      token,
      refresh_token: refreshToken,
      user: { id: user._id, full_name: user.full_name, role: user.role, email: user.email, phone: user.phone }
    });
  } catch (err) {
    res.status(500).json({ message: 'Lỗi server', error: err.message });
  }
};

// Refresh access token
exports.refresh = async (req, res) => {
  const { refresh_token } = req.body;
  if (!refresh_token) return res.status(400).json({ message: 'Thiếu refresh_token' });
  try {
    const tokenHash = sha256(refresh_token);
    const user = await User.findOne({ refresh_token_hash: tokenHash });
    if (!user) return res.status(401).json({ message: 'Refresh token không hợp lệ' });
    if (user.deleted_at) return res.status(403).json({ message: 'Tài khoản đã bị vô hiệu hóa' });
    if (user.status !== 'active') return res.status(403).json({ message: 'Tài khoản không hoạt động' });
    if (!user.refresh_token_expiry || user.refresh_token_expiry < new Date())
      return res.status(401).json({ message: 'Refresh token đã hết hạn' });

    const accessToken = signAccessToken(user);
    res.json({ token: accessToken });
  } catch (err) {
    res.status(500).json({ message: 'Lỗi server', error: err.message });
  }
};

// Forgot password
exports.forgotPassword = async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ message: 'Thiếu email' });
  try {
    const user = await User.findOne({ email: String(email).toLowerCase().trim() });
    // Always respond success to avoid user enumeration
    if (!user || user.deleted_at || user.status === 'disabled') {
      return res.json({ message: 'Nếu email tồn tại, chúng tôi sẽ gửi hướng dẫn đặt lại mật khẩu' });
    }

    const rawToken = newOpaqueToken();
    user.reset_password_token_hash = sha256(rawToken);
    user.reset_password_expiry = new Date(Date.now() + RESET_PASSWORD_EXPIRES_MINUTES * 60 * 1000);
    await user.save();

    // If SMTP is not configured, don't break flow; still return generic message.
    // Optional: expose token only in non-production for testing.
    const response = { message: 'Nếu email tồn tại, chúng tôi sẽ gửi hướng dẫn đặt lại mật khẩu' };
    if ((process.env.NODE_ENV || '').toLowerCase() !== 'production' && process.env.EXPOSE_RESET_TOKEN === 'true') {
      response.reset_token = rawToken;
    }
    return res.json(response);
  } catch (err) {
    res.status(500).json({ message: 'Lỗi server', error: err.message });
  }
};

// Reset password
exports.resetPassword = async (req, res) => {
  const { token, new_password } = req.body;
  if (!token || !new_password) return res.status(400).json({ message: 'Thiếu token hoặc mật khẩu mới' });
  try {
    const tokenHash = sha256(token);
    const user = await User.findOne({ reset_password_token_hash: tokenHash });
    if (!user) return res.status(400).json({ message: 'Token không hợp lệ' });
    if (!user.reset_password_expiry || user.reset_password_expiry < new Date())
      return res.status(400).json({ message: 'Token đã hết hạn' });
    if (user.deleted_at || user.status === 'disabled') return res.status(403).json({ message: 'Tài khoản đã bị vô hiệu hóa' });

    user.password_hash = await bcrypt.hash(new_password, 10);
    user.reset_password_token_hash = null;
    user.reset_password_expiry = null;
    user.failed_attempts = 0;
    user.status = user.status === 'locked' ? 'active' : user.status;
    await user.save();
    res.json({ message: 'Đặt lại mật khẩu thành công' });
  } catch (err) {
    res.status(500).json({ message: 'Lỗi server', error: err.message });
  }
};

// Cập nhật profile
exports.updateProfile = async (req, res) => {
  try {
    const { full_name, phone } = req.body;
    const user = await User.findByIdAndUpdate(
      req.user.id,
      { full_name, phone },
      { new: true }
    );
    res.json({
      message: 'Cập nhật thành công',
      user: { id: user._id, full_name: user.full_name, role: user.role, email: user.email, phone: user.phone }
    });
  } catch (err) {
    res.status(500).json({ message: 'Lỗi server', error: err.message });
  }
};

// Đổi mật khẩu
exports.changePassword = async (req, res) => {
  try {
    const { current_password, new_password } = req.body;
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: 'Không tìm thấy tài khoản' });
    if (user.deleted_at || user.status === 'disabled') return res.status(403).json({ message: 'Tài khoản đã bị vô hiệu hóa' });
    const match = await bcrypt.compare(current_password, user.password_hash);
    if (!match) return res.status(400).json({ message: 'Mật khẩu hiện tại không đúng' });
    user.password_hash = await bcrypt.hash(new_password, 10);
    // Rotate refresh token by invalidating existing one
    user.refresh_token_hash = null;
    user.refresh_token_expiry = null;
    await user.save();
    res.json({ message: 'Đổi mật khẩu thành công' });
  } catch (err) {
    res.status(500).json({ message: 'Lỗi server', error: err.message });
  }
};