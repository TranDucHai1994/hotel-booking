/**
 * middleware/authMiddleware.js
 * Mục đích: Cung cấp các middleware xác thực/phân quyền dùng cho các route Express.
 * Bao gồm: verifyToken (bắt buộc có JWT hợp lệ), optionalToken (xác thực nếu có
 * token nhưng không bắt buộc), isAdmin và requireRoles (kiểm tra quyền theo vai trò).
 */
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

// isAdmin chỉ dùng ở vài chỗ đặc biệt cần đúng vai trò 'admin' tuyệt đối (không chấp nhận
// 'manager'). Đa số route dùng requireRoles(['admin','manager']) bên dưới vì linh hoạt hơn
// (chỉ định được nhiều vai trò cùng lúc), còn isAdmin là bản cứng chỉ kiểm tra 1 vai trò.
const isAdmin = (req, res, next) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Không có quyền admin' });
  }

  return next();
};

// requireRoles là một "hàm tạo middleware" (higher-order function): gọi requireRoles([...])
// sẽ trả về một middleware mới được "cấu hình sẵn" với danh sách vai trò cho phép. Nhờ vậy
// một route có thể viết requireRoles(['admin']), route khác viết requireRoles(['admin','manager'])
// mà không cần viết lại nhiều middleware riêng cho từng tổ hợp vai trò.
// Middleware này LUÔN đặt SAU verifyToken trong route, vì nó cần req.user.role đã được
// gán từ token giải mã - nếu đặt trước verifyToken, req.user sẽ chưa tồn tại và luôn rơi
// vào nhánh lỗi 401 ở dòng dưới.
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
