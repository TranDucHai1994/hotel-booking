const { query } = require('../config/db');
const { mapFeedback } = require('../utils/mappers');

exports.createFeedback = async (req, res) => {
  try {
    const existing = await query(
      `
        SELECT TOP 1 id
        FROM dbo.Feedbacks
        WHERE user_id = @userId
          AND hotel_id = @hotelId;
      `,
      {
        userId: Number(req.user.id),
        hotelId: Number(req.body.hotel_id),
      }
    );

    if (existing.recordset[0]) {
      return res.status(400).json({ message: 'Bạn đã đánh giá khách sạn này rồi' });
    }

    const result = await query(
      `
        INSERT INTO dbo.Feedbacks (
          user_id,
          hotel_id,
          rating,
          content
        )
        OUTPUT INSERTED.*
        VALUES (
          @userId,
          @hotelId,
          @rating,
          @content
        );
      `,
      {
        userId: Number(req.user.id),
        hotelId: Number(req.body.hotel_id),
        rating: Number(req.body.rating || 0),
        content: String(req.body.content || '').trim(),
      }
    );

    return res.status(201).json({
      message: 'Gửi đánh giá thành công',
      feedback: mapFeedback(result.recordset[0]),
    });
  } catch (err) {
    return res.status(500).json({ message: 'Lỗi server', error: err.message });
  }
};

exports.getFeedbackByHotel = async (req, res) => {
  try {
    const result = await query(
      `
        SELECT
          f.*,
          u.full_name AS user_full_name
        FROM dbo.Feedbacks f
        INNER JOIN dbo.Users u ON u.id = f.user_id
        WHERE f.hotel_id = @hotelId
        ORDER BY f.created_at DESC;
      `,
      { hotelId: Number(req.params.hotel_id) }
    );

    return res.json(result.recordset.map((row) => ({
      ...mapFeedback(row),
      user_id: {
        full_name: row.user_full_name,
      },
    })));
  } catch (err) {
    return res.status(500).json({ message: 'Lỗi server', error: err.message });
  }
};

exports.listFeedbacks = async (req, res) => {
  try {
    const result = await query(
      `
        SELECT
          f.*,
          u.full_name AS user_full_name,
          u.email AS user_email,
          h.name AS hotel_name,
          h.city AS hotel_city
        FROM dbo.Feedbacks f
        INNER JOIN dbo.Users u ON u.id = f.user_id
        INNER JOIN dbo.Hotels h ON h.id = f.hotel_id
        ORDER BY f.created_at DESC;
      `
    );

    return res.json(result.recordset.map((row) => ({
      ...mapFeedback(row),
      user_id: {
        full_name: row.user_full_name,
        email: row.user_email,
      },
      hotel_id: {
        _id: row.hotel_id,
        name: row.hotel_name,
        city: row.hotel_city,
      },
    })));
  } catch (err) {
    return res.status(500).json({ message: 'Lỗi server', error: err.message });
  }
};

exports.deleteFeedback = async (req, res) => {
  try {
    await query(
      `
        DELETE FROM dbo.Feedbacks
        WHERE id = @feedbackId;
      `,
      { feedbackId: Number(req.params.id) }
    );

    return res.json({ message: 'Đã xóa phản hồi' });
  } catch (err) {
    return res.status(500).json({ message: 'Lỗi server', error: err.message });
  }
};
