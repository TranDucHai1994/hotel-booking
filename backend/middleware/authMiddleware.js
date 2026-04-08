const jwt = require('jsonwebtoken');

const verifyToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ message: 'Không có token' });
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch {
    return res.status(403).json({ message: 'Token không hợp lệ' });
  }
};

const isAdmin = (req, res, next) => {
  if (req.user.role !== 'admin')
    return res.status(403).json({ message: 'Không có quyền admin' });
  next();
};

const requireRoles = (roles = []) => (req, res, next) => {
  if (!req.user || !req.user.role) return res.status(401).json({ message: 'Không có token' });
  if (!Array.isArray(roles) || roles.length === 0) return next();
  if (!roles.includes(req.user.role))
    return res.status(403).json({ message: 'Không có quyền truy cập' });
  next();
};

module.exports = { verifyToken, isAdmin, requireRoles };