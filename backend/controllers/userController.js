const bcrypt = require('bcryptjs');
const { query } = require('../config/db');
const { mapUser } = require('../utils/mappers');

const toPublicUser = (row) => {
  const user = mapUser(row);
  return {
    id: user.id,
    username: user.username,
    full_name: user.full_name,
    email: user.email,
    phone: user.phone,
    role: user.role,
    status: user.status,
    failed_attempts: user.failed_attempts,
    last_login: user.last_login,
    created_at: user.createdAt,
    updated_at: user.updatedAt,
  };
};

async function getUserById(id) {
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

async function getUserByEmail(email) {
  const result = await query(
    `
      SELECT TOP 1 *
      FROM dbo.Users
      WHERE email = @email;
    `,
    { email: String(email || '').toLowerCase().trim() }
  );

  return result.recordset[0] || null;
}

async function getUserByUsername(username) {
  const normalizedUsername = String(username || '').trim();
  if (!normalizedUsername) return null;

  const result = await query(
    `
      SELECT TOP 1 *
      FROM dbo.Users
      WHERE username = @username;
    `,
    { username: normalizedUsername }
  );

  return result.recordset[0] || null;
}

exports.listUsers = async (req, res) => {
  try {
    const result = await query(
      `
        SELECT *
        FROM dbo.Users
        WHERE deleted_at IS NULL
        ORDER BY created_at DESC;
      `
    );

    return res.json(result.recordset.map(toPublicUser));
  } catch (err) {
    return res.status(500).json({ message: 'Lỗi server', error: err.message });
  }
};

exports.createUser = async (req, res) => {
  try {
    const { username, full_name, email, phone, password, role, status } = req.body;
    if (!full_name || !email || !password) {
      return res.status(400).json({ message: 'Thiếu full_name/email/password' });
    }

    const existingEmail = await getUserByEmail(email);
    if (existingEmail) {
      return res.status(400).json({ message: 'Email đã tồn tại' });
    }

    if (username) {
      const existingUsername = await getUserByUsername(username);
      if (existingUsername) {
        return res.status(400).json({ message: 'Username đã tồn tại' });
      }
    }

    const result = await query(
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
          @username,
          @fullName,
          @email,
          @phone,
          @passwordHash,
          @role,
          @status
        );
      `,
      {
        username: username ? String(username).trim() : null,
        fullName: String(full_name).trim(),
        email: String(email).toLowerCase().trim(),
        phone: String(phone || '').trim(),
        passwordHash: await bcrypt.hash(String(password), 10),
        role: String(role || 'staff').trim(),
        status: String(status || 'active').trim(),
      }
    );

    return res.status(201).json({
      message: 'Tạo user thành công',
      user: toPublicUser(result.recordset[0]),
    });
  } catch (err) {
    return res.status(500).json({ message: 'Lỗi server', error: err.message });
  }
};

exports.updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const { username, full_name, email, phone, role, status, password } = req.body;
    const user = await getUserById(id);

    if (!user || user.deleted_at) {
      return res.status(404).json({ message: 'Không tìm thấy user' });
    }

    if (email && String(email).toLowerCase().trim() !== user.email) {
      const existingEmail = await getUserByEmail(email);
      if (existingEmail) {
        return res.status(400).json({ message: 'Email đã tồn tại' });
      }
    }

    if (username && String(username).trim() !== (user.username || '')) {
      const existingUsername = await getUserByUsername(username);
      if (existingUsername) {
        return res.status(400).json({ message: 'Username đã tồn tại' });
      }
    }

    const nextPasswordHash = typeof password === 'string' && password.trim()
      ? await bcrypt.hash(password.trim(), 10)
      : user.password_hash;

    await query(
      `
        UPDATE dbo.Users
        SET
          username = @username,
          full_name = @fullName,
          email = @email,
          phone = @phone,
          role = @role,
          status = @status,
          password_hash = @passwordHash,
          refresh_token_hash = CASE WHEN @passwordChanged = 1 THEN NULL ELSE refresh_token_hash END,
          refresh_token_expiry = CASE WHEN @passwordChanged = 1 THEN NULL ELSE refresh_token_expiry END,
          reset_password_token_hash = CASE WHEN @passwordChanged = 1 THEN NULL ELSE reset_password_token_hash END,
          reset_password_expiry = CASE WHEN @passwordChanged = 1 THEN NULL ELSE reset_password_expiry END,
          failed_attempts = CASE WHEN @passwordChanged = 1 THEN 0 ELSE failed_attempts END,
          updated_at = SYSUTCDATETIME()
        WHERE id = @id;
      `,
      {
        id: Number(id),
        username: username !== undefined ? String(username || '').trim() || null : user.username,
        fullName: typeof full_name === 'string' ? full_name : user.full_name,
        email: email !== undefined ? String(email).toLowerCase().trim() : user.email,
        phone: typeof phone === 'string' ? phone : user.phone,
        role: typeof role === 'string' ? role : user.role,
        status: typeof status === 'string' ? status : user.status,
        passwordHash: nextPasswordHash,
        passwordChanged: typeof password === 'string' && password.trim() ? 1 : 0,
      }
    );

    const updated = await getUserById(id);
    return res.json({
      message: 'Cập nhật user thành công',
      user: toPublicUser(updated),
    });
  } catch (err) {
    return res.status(500).json({ message: 'Lỗi server', error: err.message });
  }
};

exports.lockUser = async (req, res) => {
  try {
    const user = await getUserById(req.params.id);
    if (!user || user.deleted_at) {
      return res.status(404).json({ message: 'Không tìm thấy user' });
    }

    await query(
      `
        UPDATE dbo.Users
        SET
          status = N'locked',
          updated_at = SYSUTCDATETIME()
        WHERE id = @id;
      `,
      { id: Number(req.params.id) }
    );

    return res.json({
      message: 'Đã khóa tài khoản',
      user: toPublicUser(await getUserById(req.params.id)),
    });
  } catch (err) {
    return res.status(500).json({ message: 'Lỗi server', error: err.message });
  }
};

exports.unlockUser = async (req, res) => {
  try {
    const user = await getUserById(req.params.id);
    if (!user || user.deleted_at) {
      return res.status(404).json({ message: 'Không tìm thấy user' });
    }

    await query(
      `
        UPDATE dbo.Users
        SET
          status = N'active',
          failed_attempts = 0,
          updated_at = SYSUTCDATETIME()
        WHERE id = @id;
      `,
      { id: Number(req.params.id) }
    );

    return res.json({
      message: 'Đã mở khóa tài khoản',
      user: toPublicUser(await getUserById(req.params.id)),
    });
  } catch (err) {
    return res.status(500).json({ message: 'Lỗi server', error: err.message });
  }
};
