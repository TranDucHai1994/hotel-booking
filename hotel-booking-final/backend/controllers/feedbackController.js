/**
 * feedbackController.js
 * Mục đích: Xử lý các API liên quan đến đánh giá (feedback) khách sạn -
 * tạo đánh giá của người dùng, lấy đánh giá theo khách sạn, liệt kê toàn bộ
 * đánh giá (admin), và xóa đánh giá.
 * Export chính: createFeedback, getFeedbackByHotel, listFeedbacks, deleteFeedback.
 */
const { query } = require('../config/db');
const { mapFeedback } = require('../utils/mappers');

/**
 * Quản lý Đánh giá (Feedback) từ người dùng.
 * Người dùng có thể tạo đánh giá cho khách sạn họ đã ở. 
 * Hệ thống sẽ tự cập nhật lại điểm đánh giá trung bình (average_rating) của khách sạn đó.
 */
// LƯU Ý (hạn chế cần biết): dù comment ở đầu file nói "khách sạn họ đã ở",
// hàm này CHƯA kiểm tra user có từng đặt phòng/hoàn tất ở khách sạn đó hay không. Điều kiện
// duy nhất được kiểm tra là chống đánh giá trùng (bước 1). Nghĩa là bất kỳ user đã đăng nhập
// nào cũng gửi được đánh giá cho khách sạn bất kỳ, kể cả chưa từng đặt phòng ở đó. Đây là
// điểm có thể nêu ra như "hướng cải tiến trong tương lai" nếu hội đồng hỏi.
exports.createFeedback = async (req, res) => {
  try {
    // Bước 1: Kiểm tra user đã đánh giá khách sạn này chưa, tránh đánh giá trùng
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

    // Bước 2: Lưu đánh giá mới vào cơ sở dữ liệu và trả kết quả về cho client
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

// Route dùng requireRoles(['admin', 'manager']) (xem feedbackRoutes.js) - vì vậy hàm này
// KHÔNG cần lọc theo user_id như cancelBooking: chỉ admin/manager mới gọi được API xóa
// feedback, và họ có quyền kiểm duyệt/xóa BẤT KỲ đánh giá nào, không chỉ đánh giá của
// chính họ. Việc "ai được phép làm gì" được chặn ở tầng route, nên tầng controller không
// cần lặp lại điều kiện sở hữu.
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
