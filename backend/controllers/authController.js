const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { query } = require('../config/db');
const { mapUser } = require('../utils/mappers');
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
    { id: String(user.id), role: user.role, email: user.email },
    process.env.JWT_SECRET,
    { expiresIn: ACCESS_TOKEN_EXPIRES_IN }
  );
}

function newOpaqueToken() {
  return crypto.randomBytes(32).toString('hex');
}

function toAuthUserPayload(user) {
  return {
    id: user.id,
    full_name: user.full_name,
    role: user.role,
    email: user.email,
    phone: user.phone,
  };
}

async function getUserRowById(id) {
  const result = await query(
    `
      SELECT TOP 1 *
      FROM dbo.Users
      WHERE id = @id;
    `,
    { id: Number(id) }
  );

  return result.recordset[0] || null;
}

async function getUserRowByEmail(email) {
  const result = await query(
    `
      SELECT TOP 1 *
      FROM dbo.Users
      WHERE email = @email;
    `,
    { email }
  );

  return result.recordset[0] || null;
}

async function getUserByRefreshTokenHash(tokenHash) {
  const result = await query(
    `
      SELECT TOP 1 *
      FROM dbo.Users
      WHERE refresh_token_hash = @tokenHash;
    `,
    { tokenHash }
  );

  return result.recordset[0] || null;
}

async function getUserByResetTokenHash(tokenHash) {
  const result = await query(
    `
      SELECT TOP 1 *
      FROM dbo.Users
      WHERE reset_password_token_hash = @tokenHash;
    `,
    { tokenHash }
  );

  return result.recordset[0] || null;
}

exports.register = async (req, res) => {
  const { full_name, email, phone, password } = req.body;

  try {
    const normalizedEmail = normalizeEmail(email);
    const normalizedName = String(full_name || '').trim();
    const normalizedPhone = String(phone || '').trim();
    const normalizedPassword = String(password || '');

    if (!normalizedName || !normalizedEmail || !normalizedPassword) {
      return res.status(400).json({ message: 'Thiếu họ tên, email hoặc mật khẩu' });
    }

    const existing = await getUserRowByEmail(normalizedEmail);
    if (existing) {
      return res.status(400).json({ message: 'Email đã tồn tại' });
    }

    const passwordHash = await bcrypt.hash(normalizedPassword, 10);
    const insertResult = await query(
      `
        INSERT INTO dbo.Users (
          username,
          full_name,
          email,
          phone,
          password_hash,
          role,
          status
        )
        OUTPUT INSERTED.*
        VALUES (
          NULL,
          @fullName,
          @email,
          @phone,
          @passwordHash,
          N'customer',
          N'active'
        );
      `,
      {
        fullName: normalizedName,
        email: normalizedEmail,
        phone: normalizedPhone,
        passwordHash,
      }
    );

    const user = mapUser(insertResult.recordset[0]);
    const token = signAccessToken(user);

    await logAudit({ userId: user.id, action: 'register', entity: 'auth', entityId: null });

    return res.status(201).json({
      message: 'Đăng ký thành công',
      token,
      user: toAuthUserPayload(user),
    });
  } catch (err) {
    return res.status(500).json({ message: 'Lỗi server', error: err.message });
  }
};

exports.login = async (req, res) => {
  const { email, password } = req.body;

  try {
    const userRow = await getUserRowByEmail(normalizeEmail(email));
    if (!userRow) {
      return res.status(400).json({ message: 'Email không tồn tại' });
    }

    if (userRow.deleted_at || userRow.status === 'disabled') {
      return res.status(403).json({ message: 'Tài khoản đã bị vô hiệu hóa' });
    }

    if (userRow.status === 'locked') {
      return res.status(403).json({ message: 'Tài khoản đang bị khóa' });
    }

    const passwordMatched = await bcrypt.compare(String(password || ''), userRow.password_hash);
    if (!passwordMatched) {
      const nextFailedAttempts = Number(userRow.failed_attempts || 0) + 1;
      await query(
        `
          UPDATE dbo.Users
          SET
            failed_attempts = @failedAttempts,
            status = CASE WHEN @failedAttempts >= @maxFailedAttempts THEN N'locked' ELSE status END,
            updated_at = SYSUTCDATETIME()
          WHERE id = @id;
        `,
        {
          id: userRow.id,
          failedAttempts: nextFailedAttempts,
          maxFailedAttempts: MAX_FAILED_LOGIN_ATTEMPTS,
        }
      );

      return res.status(400).json({ message: 'Sai mật khẩu' });
    }

    const refreshToken = newOpaqueToken();
    const refreshExpiry = new Date(Date.now() + REFRESH_TOKEN_EXPIRES_DAYS * 24 * 60 * 60 * 1000);

    await query(
      `
        UPDATE dbo.Users
        SET
          failed_attempts = 0,
          last_login = SYSUTCDATETIME(),
          refresh_token_hash = @refreshTokenHash,
          refresh_token_expiry = @refreshTokenExpiry,
          updated_at = SYSUTCDATETIME()
        WHERE id = @id;
      `,
      {
        id: userRow.id,
        refreshTokenHash: sha256(refreshToken),
        refreshTokenExpiry: refreshExpiry,
      }
    );

    const refreshedUser = mapUser(await getUserRowById(userRow.id));
    const token = signAccessToken(refreshedUser);

    await logAudit({ userId: refreshedUser.id, action: 'login', entity: 'auth', entityId: null });

    return res.json({
      token,
      refresh_token: refreshToken,
      user: toAuthUserPayload(refreshedUser),
    });
  } catch (err) {
    return res.status(500).json({ message: 'Lỗi server', error: err.message });
  }
};

exports.refresh = async (req, res) => {
  const { refresh_token } = req.body;
  if (!refresh_token) {
    return res.status(400).json({ message: 'Thiếu refresh_token' });
  }

  try {
    const userRow = await getUserByRefreshTokenHash(sha256(refresh_token));
    if (!userRow) {
      return res.status(401).json({ message: 'Refresh token không hợp lệ' });
    }

    if (userRow.deleted_at || userRow.status === 'disabled') {
      return res.status(403).json({ message: 'Tài khoản đã bị vô hiệu hóa' });
    }

    if (userRow.status !== 'active') {
      return res.status(403).json({ message: 'Tài khoản không hoạt động' });
    }

    if (!userRow.refresh_token_expiry || new Date(userRow.refresh_token_expiry) < new Date()) {
      return res.status(401).json({ message: 'Refresh token đã hết hạn' });
    }

    const user = mapUser(userRow);
    const accessToken = signAccessToken(user);
    return res.json({ token: accessToken });
  } catch (err) {
    return res.status(500).json({ message: 'Lỗi server', error: err.message });
  }
};

exports.forgotPassword = async (req, res) => {
  const { email } = req.body;
  if (!email) {
    return res.status(400).json({ message: 'Thiếu email' });
  }

  try {
    const userRow = await getUserRowByEmail(normalizeEmail(email));
    if (!userRow || userRow.deleted_at || userRow.status === 'disabled') {
      return res.json({ message: 'Nếu email tồn tại, chúng tôi sẽ gửi hướng dẫn đặt lại mật khẩu' });
    }

    const rawToken = newOpaqueToken();
    await query(
      `
        UPDATE dbo.Users
        SET
          reset_password_token_hash = @tokenHash,
          reset_password_expiry = @tokenExpiry,
          updated_at = SYSUTCDATETIME()
        WHERE id = @id;
      `,
      {
        id: userRow.id,
        tokenHash: sha256(rawToken),
        tokenExpiry: new Date(Date.now() + RESET_PASSWORD_EXPIRES_MINUTES * 60 * 1000),
      }
    );

    const response = { message: 'Nếu email tồn tại, chúng tôi sẽ gửi hướng dẫn đặt lại mật khẩu' };
    if ((process.env.NODE_ENV || '').toLowerCase() !== 'production' && process.env.EXPOSE_RESET_TOKEN === 'true') {
      response.reset_token = rawToken;
    }

    return res.json(response);
  } catch (err) {
    return res.status(500).json({ message: 'Lỗi server', error: err.message });
  }
};

exports.resetPassword = async (req, res) => {
  const { token, new_password } = req.body;
  if (!token || !new_password) {
    return res.status(400).json({ message: 'Thiếu token hoặc mật khẩu mới' });
  }

  try {
    const userRow = await getUserByResetTokenHash(sha256(token));
    if (!userRow) {
      return res.status(400).json({ message: 'Token không hợp lệ' });
    }

    if (!userRow.reset_password_expiry || new Date(userRow.reset_password_expiry) < new Date()) {
      return res.status(400).json({ message: 'Token đã hết hạn' });
    }

    if (userRow.deleted_at || userRow.status === 'disabled') {
      return res.status(403).json({ message: 'Tài khoản đã bị vô hiệu hóa' });
    }

    await query(
      `
        UPDATE dbo.Users
        SET
          password_hash = @passwordHash,
          reset_password_token_hash = NULL,
          reset_password_expiry = NULL,
          refresh_token_hash = NULL,
          refresh_token_expiry = NULL,
          failed_attempts = 0,
          status = CASE WHEN status = N'locked' THEN N'active' ELSE status END,
          updated_at = SYSUTCDATETIME()
        WHERE id = @id;
      `,
      {
        id: userRow.id,
        passwordHash: await bcrypt.hash(String(new_password), 10),
      }
    );

    return res.json({ message: 'Đặt lại mật khẩu thành công' });
  } catch (err) {
    return res.status(500).json({ message: 'Lỗi server', error: err.message });
  }
};

exports.updateProfile = async (req, res) => {
  try {
    await query(
      `
        UPDATE dbo.Users
        SET
          full_name = @fullName,
          phone = @phone,
          updated_at = SYSUTCDATETIME()
        WHERE id = @id;
      `,
      {
        id: Number(req.user.id),
        fullName: String(req.body.full_name || '').trim(),
        phone: String(req.body.phone || '').trim(),
      }
    );

    const user = mapUser(await getUserRowById(req.user.id));
    return res.json({
      message: 'Cập nhật thành công',
      user: toAuthUserPayload(user),
    });
  } catch (err) {
    return res.status(500).json({ message: 'Lỗi server', error: err.message });
  }
};

exports.changePassword = async (req, res) => {
  try {
    const { current_password, new_password } = req.body;
    const userRow = await getUserRowById(req.user.id);

    if (!userRow) {
      return res.status(404).json({ message: 'Không tìm thấy tài khoản' });
    }

    if (userRow.deleted_at || userRow.status === 'disabled') {
      return res.status(403).json({ message: 'Tài khoản đã bị vô hiệu hóa' });
    }

    const passwordMatched = await bcrypt.compare(String(current_password || ''), userRow.password_hash);
    if (!passwordMatched) {
      return res.status(400).json({ message: 'Mật khẩu hiện tại không đúng' });
    }

    await query(
      `
        UPDATE dbo.Users
        SET
          password_hash = @passwordHash,
          refresh_token_hash = NULL,
          refresh_token_expiry = NULL,
          updated_at = SYSUTCDATETIME()
        WHERE id = @id;
      `,
      {
        id: userRow.id,
        passwordHash: await bcrypt.hash(String(new_password || ''), 10),
      }
    );

    return res.json({ message: 'Đổi mật khẩu thành công' });
  } catch (err) {
    return res.status(500).json({ message: 'Lỗi server', error: err.message });
  }
};
