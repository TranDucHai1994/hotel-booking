/**
 * feedbackRoutes.js
 * Mục đích: Định nghĩa các route Express cho chức năng đánh giá (feedback)
 * khách sạn, gồm xem danh sách, tạo mới, xóa và lấy đánh giá theo khách sạn.
 */
const router = require('express').Router();
const ctrl = require('../controllers/feedbackController');
const { verifyToken, requireRoles } = require('../middleware/authMiddleware');

/**
 * Định tuyến (Routes) cho hệ thống Đánh giá (Feedback).
 */
// listFeedbacks (xem toàn bộ đánh giá trên hệ thống) chỉ dành cho admin/manager kiểm duyệt.
router.get('/', verifyToken, requireRoles(['admin', 'manager']), ctrl.listFeedbacks);
// createFeedback chỉ cần đăng nhập (verifyToken), không cần vai trò đặc biệt - user thường
// nào cũng được gửi đánh giá.
router.post('/', verifyToken, ctrl.createFeedback);
// deleteFeedback giới hạn admin/manager vì đây là hành động kiểm duyệt (xóa đánh giá của
// bất kỳ ai), nên không cần thêm điều kiện user_id trong controller - xem comment chi tiết
// trong feedbackController.js.
router.delete('/:id', verifyToken, requireRoles(['admin', 'manager']), ctrl.deleteFeedback);
// Xem đánh giá theo khách sạn là thông tin công khai (giống xem review sản phẩm), không
// cần đăng nhập.
router.get('/:hotel_id', ctrl.getFeedbackByHotel);

module.exports = router;
