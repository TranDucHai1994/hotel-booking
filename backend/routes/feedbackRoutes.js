const router = require('express').Router();
const ctrl = require('../controllers/feedbackController');
const { verifyToken } = require('../middleware/authMiddleware');

router.post('/', verifyToken, ctrl.createFeedback);
router.get('/:hotel_id', ctrl.getFeedbackByHotel);

module.exports = router;