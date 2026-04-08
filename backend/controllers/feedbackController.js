const Feedback = require('../models/Feedback');

exports.createFeedback = async (req, res) => {
  try {
    const feedback = await Feedback.create({
      user_id: req.user.id,
      hotel_id: req.body.hotel_id,
      rating: req.body.rating,
      content: req.body.content
    });
    res.status(201).json({ message: 'Gửi đánh giá thành công', feedback });
  } catch (err) {
    res.status(500).json({ message: 'Lỗi server', error: err.message });
  }
};

exports.getFeedbackByHotel = async (req, res) => {
  try {
    const feedbacks = await Feedback.find({ hotel_id: req.params.hotel_id })
      .populate('user_id', 'full_name');
    res.json(feedbacks);
  } catch (err) {
    res.status(500).json({ message: 'Lỗi server', error: err.message });
  }
};