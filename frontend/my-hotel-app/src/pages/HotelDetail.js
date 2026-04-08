import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../services/api';
import { FaMapMarkerAlt, FaStar } from 'react-icons/fa';

export default function HotelDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [hotel, setHotel] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get(`/hotels/${id}`)
      .then(res => {
        setHotel(res.data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div className="flex justify-center py-40">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!hotel) {
    return (
      <div className="text-center py-20 text-gray-400">
        Không tìm thấy khách sạn
      </div>
    );
  }

  const avgRating = hotel.feedbacks?.length
    ? (
        hotel.feedbacks.reduce((sum, f) => sum + f.rating, 0) /
        hotel.feedbacks.length
      ).toFixed(1)
    : null;

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">

      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-800 mb-2">
          {hotel.name}
        </h1>

        <div className="flex flex-wrap items-center gap-4 text-gray-500">
          <span className="flex items-center gap-1">
            <FaMapMarkerAlt className="text-blue-500" />
            {hotel.address}, {hotel.city}
          </span>

          {avgRating && (
            <span className="flex items-center gap-1 bg-yellow-50 px-3 py-1 rounded-full">
              <FaStar className="text-yellow-500" />
              <span className="font-bold text-gray-700">{avgRating}</span>
              <span className="text-gray-400 text-sm">
                ({hotel.feedbacks.length} đánh giá)
              </span>
            </span>
          )}
        </div>
      </div>

      {/* Image */}
      <div className="mb-8">
        {hotel.cover_image ? (
          <img
            src={hotel.cover_image}
            alt={hotel.name}
            className="w-full h-80 object-cover rounded-2xl"
          />
        ) : (
          <div className="w-full h-80 bg-gray-200 rounded-2xl flex items-center justify-center text-gray-400">
            Không có hình ảnh
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

        {/* LEFT */}
        <div className="lg:col-span-2 space-y-6">

          {/* Description */}
          <div className="bg-white rounded-2xl p-6 shadow-sm">
            <h2 className="text-xl font-bold text-gray-800 mb-3">
              Giới thiệu
            </h2>
            <p className="text-gray-600 leading-relaxed">
              {hotel.description || 'Chưa có mô tả'}
            </p>
          </div>

          {/* Amenities */}
          {hotel.amenities?.length > 0 && (
            <div className="bg-white rounded-2xl p-6 shadow-sm">
              <h2 className="text-xl font-bold text-gray-800 mb-4">
                Tiện ích
              </h2>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {hotel.amenities.map((a, i) => (
                  <div
                    key={i}
                    className="bg-blue-50 px-3 py-2 rounded-xl text-sm text-gray-700"
                  >
                    ✓ {a}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Feedback */}
          <div className="bg-white rounded-2xl p-6 shadow-sm">
            <h2 className="text-xl font-bold text-gray-800 mb-4">
              Đánh giá
            </h2>

            {hotel.feedbacks?.length === 0 ? (
              <p className="text-gray-400">Chưa có đánh giá</p>
            ) : (
              <div className="space-y-4">
                {hotel.feedbacks.map((f, i) => (
                  <div key={i} className="border-b border-gray-100 pb-4">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-gray-800">
                        {f.user_id?.full_name}
                      </span>
                      <span className="text-yellow-400 text-sm">
                        {'★'.repeat(f.rating)}
                        {'☆'.repeat(5 - f.rating)}
                      </span>
                    </div>
                    <p className="text-gray-600 text-sm">
                      {f.content}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* RIGHT - Rooms */}
        <div>
          <h2 className="text-xl font-bold text-gray-800 mb-4">
            Chọn phòng
          </h2>

          <div className="space-y-4">
            {hotel.rooms?.map(room => (
              <div
                key={room._id}
                className="bg-white rounded-2xl p-5 shadow-sm border hover:border-blue-300 transition"
              >
                <h3 className="font-bold text-gray-800 mb-1">
                  {room.room_type}
                </h3>
                <p className="text-gray-500 text-sm mb-2">
                  👥 {room.max_guests} khách
                </p>
                <p className="text-blue-600 font-bold text-lg mb-3">
                  {Number(room.price_per_night).toLocaleString('vi-VN')}đ / đêm
                </p>
                <button
                  onClick={() => navigate(`/book/${hotel._id}/${room._id}`)}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-xl font-medium transition"
                >
                  Đặt ngay
                </button>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}
