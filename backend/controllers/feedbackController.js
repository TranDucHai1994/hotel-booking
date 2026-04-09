const Feedback = require('../models/Feedback');

exports.createFeedback = async (req, res) => {
  try {
    const existing = await Feedback.findOne({
      user_id: req.user.id,
      hotel_id: req.body.hotel_id,
    });
    if (existing) {
      return res.status(400).json({ message: 'Ban da danh gia khach san nay roi' });
    }

    const feedback = await Feedback.create({
      user_id: req.user.id,
      hotel_id: req.body.hotel_id,
      rating: req.body.rating,
      content: req.body.content,
    });
    res.status(201).json({ message: 'Gui danh gia thanh cong', feedback });
  } catch (err) {
    res.status(500).json({ message: 'Loi server', error: err.message });
  }
};

exports.getFeedbackByHotel = async (req, res) => {
  try {
    const feedbacks = await Feedback.find({ hotel_id: req.params.hotel_id })
      .populate('user_id', 'full_name');
    res.json(feedbacks);
  } catch (err) {
    res.status(500).json({ message: 'Loi server', error: err.message });
  }
};

exports.listFeedbacks = async (req, res) => {
  try {
    const feedbacks = await Feedback.find()
      .populate('user_id', 'full_name email')
      .populate('hotel_id', 'name city')
      .sort({ createdAt: -1 });
    res.json(feedbacks);
  } catch (err) {
    res.status(500).json({ message: 'Loi server', error: err.message });
  }
};

exports.deleteFeedback = async (req, res) => {
  try {
    await Feedback.findByIdAndDelete(req.params.id);
    res.json({ message: 'Da xoa phan hoi' });
  } catch (err) {
    res.status(500).json({ message: 'Loi server', error: err.message });
  }
};
