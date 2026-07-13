const router = require('express').Router();
const ctrl = require('../controllers/feedbackController');
const { verifyToken, requireRoles } = require('../middleware/authMiddleware');

/**
 * Định tuyến (Routes) cho hệ thống Đánh giá (Feedback).
 */
router.get('/', verifyToken, requireRoles(['admin', 'manager']), ctrl.listFeedbacks);
router.post('/', verifyToken, ctrl.createFeedback);
router.delete('/:id', verifyToken, requireRoles(['admin', 'manager']), ctrl.deleteFeedback);
router.get('/:hotel_id', ctrl.getFeedbackByHotel);

module.exports = router;
