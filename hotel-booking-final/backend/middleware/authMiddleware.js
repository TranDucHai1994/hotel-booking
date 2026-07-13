const jwt = require('jsonwebtoken');

/**
 * Hàm hỗ trợ: Lấy token từ chuỗi "Bearer <token>" trong Header của request.
 */
function extractBearerToken(req) {
  const authHeader = req.headers.authorization || req.headers.Authorization;
  if (!authHeader || typeof authHeader !== 'string') {
    return null;
  }

  const [scheme, token] = authHeader.split(' ');
  if (scheme !== 'Bearer' || !token) {
    return null;
  }

  return token;
}

/**
 * Middleware bắt buộc đăng nhập (Verify Token)
 * Nếu không có token hoặc token sai -> Trả về lỗi 401/403.
 */
const verifyToken = (req, res, next) => {
  const token = extractBearerToken(req);
  if (!token) {
    return res.status(401).json({ message: 'Không có token' });
  }

  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    return next();
  } catch {
    return res.status(403).json({ message: 'Token không hợp lệ' });
  }
};

const optionalToken = (req, res, next) => {
  const token = extractBearerToken(req);
  if (!token) {
    return next();
  }

  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    req.user = null;
  }

  return next();
};

const isAdmin = (req, res, next) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Không có quyền admin' });
  }

  return next();
};

const requireRoles = (roles = []) => (req, res, next) => {
  if (!req.user || !req.user.role) {
    return res.status(401).json({ message: 'Không có token' });
  }

  if (!Array.isArray(roles) || roles.length === 0) {
    return next();
  }

  if (!roles.includes(req.user.role)) {
    return res.status(403).json({ message: 'Không có quyền truy cập' });
  }

  return next();
};

module.exports = { verifyToken, optionalToken, isAdmin, requireRoles };
