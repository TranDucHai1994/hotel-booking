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

function normalizeEmail(email) {
  return String(email || '').toLowerCase().trim();
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

exports.register = async (req, res) => {
  const { full_name, email, phone, password } = req.body;
  try {
    const normalizedEmail = normalizeEmail(email);
    const normalizedName = String(full_name || '').trim();
    const normalizedPhone = String(phone || '').trim();
    const normalizedPassword = String(password || '');

    if (!normalizedName || !normalizedEmail || !normalizedPassword) {
      return res.status(400).json({ message: 'Thieu ho ten, email hoac mat khau' });
    }

    const existing = await User.findOne({ email: normalizedEmail });
    if (existing) return res.status(400).json({ message: 'Email da ton tai' });

    const hash = await bcrypt.hash(normalizedPassword, 10);
    const user = await User.create({
      full_name: normalizedName,
      email: normalizedEmail,
      phone: normalizedPhone,
      password_hash: hash,
      role: 'customer',
      status: 'active',
    });

    const token = signAccessToken(user);
    await logAudit({ userId: user._id, action: 'register', entity: 'auth', entityId: null });

    res.status(201).json({
      message: 'Dang ky thanh cong',
      token,
      user: { id: user._id, full_name: user.full_name, role: user.role, email: user.email, phone: user.phone },
    });
  } catch (err) {
    res.status(500).json({ message: 'Loi server', error: err.message });
  }
};

exports.login = async (req, res) => {
  const { email, password } = req.body;
  try {
    const user = await User.findOne({ email: normalizeEmail(email) });
    if (!user) return res.status(400).json({ message: 'Email khong ton tai' });

    if (user.deleted_at) return res.status(403).json({ message: 'Tai khoan da bi vo hieu hoa' });
    if (user.status === 'disabled') return res.status(403).json({ message: 'Tai khoan da bi vo hieu hoa' });
    if (user.status === 'locked') return res.status(403).json({ message: 'Tai khoan dang bi khoa' });

    const match = await bcrypt.compare(String(password || ''), user.password_hash);

    if (!match) {
      const nextFailed = Number(user.failed_attempts || 0) + 1;
      const update = { failed_attempts: nextFailed };
      if (nextFailed >= MAX_FAILED_LOGIN_ATTEMPTS) update.status = 'locked';
      await User.updateOne({ _id: user._id }, update);
      return res.status(400).json({ message: 'Sai mat khau' });
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
      user: { id: user._id, full_name: user.full_name, role: user.role, email: user.email, phone: user.phone },
    });
  } catch (err) {
    res.status(500).json({ message: 'Loi server', error: err.message });
  }
};

exports.refresh = async (req, res) => {
  const { refresh_token } = req.body;
  if (!refresh_token) return res.status(400).json({ message: 'Thieu refresh_token' });
  try {
    const tokenHash = sha256(refresh_token);
    const user = await User.findOne({ refresh_token_hash: tokenHash });
    if (!user) return res.status(401).json({ message: 'Refresh token khong hop le' });
    if (user.deleted_at) return res.status(403).json({ message: 'Tai khoan da bi vo hieu hoa' });
    if (user.status !== 'active') return res.status(403).json({ message: 'Tai khoan khong hoat dong' });
    if (!user.refresh_token_expiry || user.refresh_token_expiry < new Date()) {
      return res.status(401).json({ message: 'Refresh token da het han' });
    }

    const accessToken = signAccessToken(user);
    res.json({ token: accessToken });
  } catch (err) {
    res.status(500).json({ message: 'Loi server', error: err.message });
  }
};

exports.forgotPassword = async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ message: 'Thieu email' });
  try {
    const user = await User.findOne({ email: normalizeEmail(email) });
    if (!user || user.deleted_at || user.status === 'disabled') {
      return res.json({ message: 'Neu email ton tai, chung toi se gui huong dan dat lai mat khau' });
    }

    const rawToken = newOpaqueToken();
    user.reset_password_token_hash = sha256(rawToken);
    user.reset_password_expiry = new Date(Date.now() + RESET_PASSWORD_EXPIRES_MINUTES * 60 * 1000);
    await user.save();

    const response = { message: 'Neu email ton tai, chung toi se gui huong dan dat lai mat khau' };
    if ((process.env.NODE_ENV || '').toLowerCase() !== 'production' && process.env.EXPOSE_RESET_TOKEN === 'true') {
      response.reset_token = rawToken;
    }
    return res.json(response);
  } catch (err) {
    res.status(500).json({ message: 'Loi server', error: err.message });
  }
};

exports.resetPassword = async (req, res) => {
  const { token, new_password } = req.body;
  if (!token || !new_password) return res.status(400).json({ message: 'Thieu token hoac mat khau moi' });
  try {
    const tokenHash = sha256(token);
    const user = await User.findOne({ reset_password_token_hash: tokenHash });
    if (!user) return res.status(400).json({ message: 'Token khong hop le' });
    if (!user.reset_password_expiry || user.reset_password_expiry < new Date()) {
      return res.status(400).json({ message: 'Token da het han' });
    }
    if (user.deleted_at || user.status === 'disabled') {
      return res.status(403).json({ message: 'Tai khoan da bi vo hieu hoa' });
    }

    user.password_hash = await bcrypt.hash(new_password, 10);
    user.reset_password_token_hash = null;
    user.reset_password_expiry = null;
    user.failed_attempts = 0;
    user.status = user.status === 'locked' ? 'active' : user.status;
    await user.save();
    res.json({ message: 'Dat lai mat khau thanh cong' });
  } catch (err) {
    res.status(500).json({ message: 'Loi server', error: err.message });
  }
};

exports.updateProfile = async (req, res) => {
  try {
    const { full_name, phone } = req.body;
    const user = await User.findByIdAndUpdate(
      req.user.id,
      { full_name, phone },
      { new: true }
    );
    res.json({
      message: 'Cap nhat thanh cong',
      user: { id: user._id, full_name: user.full_name, role: user.role, email: user.email, phone: user.phone },
    });
  } catch (err) {
    res.status(500).json({ message: 'Loi server', error: err.message });
  }
};

exports.changePassword = async (req, res) => {
  try {
    const { current_password, new_password } = req.body;
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: 'Khong tim thay tai khoan' });
    if (user.deleted_at || user.status === 'disabled') {
      return res.status(403).json({ message: 'Tai khoan da bi vo hieu hoa' });
    }
    const match = await bcrypt.compare(current_password, user.password_hash);
    if (!match) return res.status(400).json({ message: 'Mat khau hien tai khong dung' });
    user.password_hash = await bcrypt.hash(new_password, 10);
    user.refresh_token_hash = null;
    user.refresh_token_expiry = null;
    await user.save();
    res.json({ message: 'Doi mat khau thanh cong' });
  } catch (err) {
    res.status(500).json({ message: 'Loi server', error: err.message });
  }
};
