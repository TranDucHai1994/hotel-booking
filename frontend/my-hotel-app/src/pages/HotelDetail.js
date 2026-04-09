import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import api from '../services/api';
import { FaMapMarkerAlt, FaStar, FaCalendarAlt, FaHotel, FaImage } from 'react-icons/fa';
import SafeImage from '../components/SafeImage';

function statusLabel(status) {
  if (status === 'full') return { text: 'Hết phòng', className: 'bg-red-50 text-red-600' };
  if (status === 'limited') return { text: 'Sắp hết', className: 'bg-yellow-50 text-yellow-700' };
  if (status === 'maintenance') return { text: 'Bảo trì', className: 'bg-gray-100 text-gray-600' };
  if (status === 'inactive') return { text: 'Ngưng bán', className: 'bg-gray-100 text-gray-600' };
  return { text: 'Còn phòng', className: 'bg-emerald-50 text-emerald-700' };
}

export default function HotelDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [hotel, setHotel] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    check_in: searchParams.get('check_in') || '',
    check_out: searchParams.get('check_out') || '',
  });

  useEffect(() => {
    setFilters({
      check_in: searchParams.get('check_in') || '',
      check_out: searchParams.get('check_out') || '',
    });
  }, [searchParams]);

  useEffect(() => {
    const fetchHotel = async () => {
      setLoading(true);
      try {
        const params = {};
        if (searchParams.get('check_in') && searchParams.get('check_out')) {
          params.check_in = searchParams.get('check_in');
          params.check_out = searchParams.get('check_out');
        }
        const res = await api.get(`/hotels/${id}`, { params });
        setHotel(res.data);
      } catch (err) {
        console.error(err);
        setHotel(null);
      }
      setLoading(false);
    };

    fetchHotel();
  }, [id, searchParams]);

  const handleApplyFilter = (e) => {
    e.preventDefault();
    const nextParams = new URLSearchParams(searchParams);
    if (filters.check_in && filters.check_out) {
      nextParams.set('check_in', filters.check_in);
      nextParams.set('check_out', filters.check_out);
    } else {
      nextParams.delete('check_in');
      nextParams.delete('check_out');
    }
    setSearchParams(nextParams);
  };

  const gallery = useMemo(() => {
    const unique = new Set();
    return [hotel?.cover_image, ...(hotel?.images || [])].filter((item) => {
      if (!item || unique.has(item)) return false;
      unique.add(item);
      return true;
    });
  }, [hotel]);
  const featuredSources = gallery;
  const secondaryImages = (hotel?.images || []).filter(Boolean);

  if (loading) {
    return (
      <div className="flex justify-center py-40">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!hotel) {
    return <div className="text-center py-20 text-gray-400">Không tìm thấy khách sạn</div>;
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="mb-8 flex flex-col lg:flex-row lg:items-start lg:justify-between gap-6">
        <div>
          <div className="flex flex-wrap items-center gap-3 mb-3">
            <span className="bg-blue-50 text-blue-700 px-3 py-1 rounded-full text-sm font-semibold">
              {hotel.property_type || 'hotel'}
            </span>
            {Number(hotel.star_rating || 0) > 0 && (
              <span className="bg-yellow-50 text-yellow-700 px-3 py-1 rounded-full text-sm font-semibold">
                {'★'.repeat(Number(hotel.star_rating))}
              </span>
            )}
            {hotel.review_count ? (
              <span className="bg-gray-100 text-gray-700 px-3 py-1 rounded-full text-sm font-semibold">
                {Number(hotel.average_rating || 0).toFixed(1)} / 5 ({hotel.review_count} đánh giá)
              </span>
            ) : null}
          </div>

          <h1 className="text-3xl font-bold text-gray-800 mb-2">{hotel.name}</h1>
          <div className="flex flex-wrap items-center gap-4 text-gray-500">
            <span className="flex items-center gap-1">
              <FaMapMarkerAlt className="text-blue-500" />
              {hotel.address}, {hotel.city}
            </span>
            {hotel.min_price ? (
              <span className="font-semibold text-blue-600">
                Từ {Number(hotel.min_price).toLocaleString('vi-VN')}đ / đêm
              </span>
            ) : null}
            <span className="text-sm text-gray-500">
              {hotel.available_room_count} / {hotel.total_room_count} phòng khả dụng
            </span>
          </div>
        </div>

        <form onSubmit={handleApplyFilter} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 w-full lg:max-w-md">
          <h2 className="font-bold text-gray-800 mb-3">Kiểm tra phòng trống</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="flex items-center gap-2 border border-gray-200 rounded-xl px-3 py-2">
              <FaCalendarAlt className="text-blue-500" />
              <input
                type="date"
                value={filters.check_in}
                min={new Date().toISOString().split('T')[0]}
                onChange={(e) => setFilters({ ...filters, check_in: e.target.value })}
                className="w-full outline-none text-sm text-gray-700 bg-transparent"
              />
            </div>
            <div className="flex items-center gap-2 border border-gray-200 rounded-xl px-3 py-2">
              <FaCalendarAlt className="text-blue-500" />
              <input
                type="date"
                value={filters.check_out}
                min={filters.check_in || new Date().toISOString().split('T')[0]}
                onChange={(e) => setFilters({ ...filters, check_out: e.target.value })}
                className="w-full outline-none text-sm text-gray-700 bg-transparent"
              />
            </div>
          </div>
          <button
            type="submit"
            className="mt-3 w-full bg-blue-600 hover:bg-blue-700 text-white py-2.5 rounded-xl font-semibold transition"
          >
            Áp dụng ngày
          </button>
        </form>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-2xl p-6 shadow-sm">
            <h2 className="text-xl font-bold text-gray-800 mb-3">Giới thiệu</h2>
            <p className="text-gray-600 leading-relaxed">{hotel.description || 'Chưa có mô tả cho khách sạn này.'}</p>
          </div>

          <div className="bg-white rounded-2xl p-6 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <FaImage className="text-blue-500" />
              <h2 className="text-xl font-bold text-gray-800">Hình ảnh</h2>
            </div>
            {featuredSources.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <SafeImage
                  src={featuredSources[0]}
                  sources={featuredSources.slice(1)}
                  alt={hotel.name}
                  className="h-80 w-full object-cover rounded-2xl"
                  wrapperClassName="md:col-span-2"
                  fallbackClassName="h-80 w-full rounded-2xl"
                  title={hotel.name}
                  subtitle={hotel.city}
                />
                {secondaryImages.map((image, index) => (
                  <SafeImage
                    key={`${image}-${index}`}
                    src={image}
                    alt={`${hotel.name}-${index + 2}`}
                    className="h-56 w-full object-cover rounded-2xl"
                    wrapperClassName=""
                    fallbackClassName="h-56 w-full rounded-2xl"
                    title={hotel.name}
                    subtitle="Gallery image unavailable"
                  />
                ))}
              </div>
            ) : (
              <div className="h-60 bg-gray-100 rounded-2xl flex items-center justify-center text-gray-400">
                Chưa có hình ảnh
              </div>
            )}
          </div>

          {hotel.amenities?.length > 0 && (
            <div className="bg-white rounded-2xl p-6 shadow-sm">
              <h2 className="text-xl font-bold text-gray-800 mb-4">Tiện ích khách sạn</h2>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {hotel.amenities.map((item, index) => (
                  <div key={index} className="bg-blue-50 px-3 py-2 rounded-xl text-sm text-gray-700">
                    {item}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="bg-white rounded-2xl p-6 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <FaStar className="text-yellow-500" />
              <h2 className="text-xl font-bold text-gray-800">Đánh giá</h2>
            </div>

            {hotel.feedbacks?.length === 0 ? (
              <p className="text-gray-400">Chưa có đánh giá</p>
            ) : (
              <div className="space-y-4">
                {hotel.feedbacks.map((item) => (
                  <div key={item._id} className="border-b border-gray-100 pb-4">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-gray-800">{item.user_id?.full_name}</span>
                      <span className="text-yellow-500 text-sm">
                        {'★'.repeat(item.rating)}
                        {'☆'.repeat(5 - item.rating)}
                      </span>
                    </div>
                    <p className="text-gray-600 text-sm">{item.content}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-white rounded-2xl p-6 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <FaHotel className="text-blue-500" />
              <h2 className="text-xl font-bold text-gray-800">Loại phòng</h2>
            </div>

            <div className="space-y-4">
              {hotel.rooms?.map((room) => {
                const badge = statusLabel(room.availability_status);
                const canBook = room.is_bookable;
                const nextQuery = new URLSearchParams();
                if (searchParams.get('check_in')) nextQuery.set('check_in', searchParams.get('check_in'));
                if (searchParams.get('check_out')) nextQuery.set('check_out', searchParams.get('check_out'));

                return (
                  <div
                    key={room._id}
                    className="bg-gray-50 rounded-2xl p-5 border border-gray-100 hover:border-blue-200 transition"
                  >
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <div>
                        <h3 className="font-bold text-gray-800">{room.room_type}</h3>
                        <p className="text-gray-500 text-sm">Tối đa {room.max_guests} khách</p>
                      </div>
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold ${badge.className}`}>
                        {badge.text}
                      </span>
                    </div>

                    <p className="text-gray-600 text-sm mb-3">{room.description || 'Chưa có mô tả cho loại phòng này.'}</p>

                    {room.amenities?.length > 0 && (
                      <div className="flex flex-wrap gap-2 mb-3">
                        {room.amenities.map((item, index) => (
                          <span key={index} className="bg-white text-gray-600 text-xs px-2 py-1 rounded-full border border-gray-200">
                            {item}
                          </span>
                        ))}
                      </div>
                    )}

                    <div className="flex items-center justify-between text-sm mb-3">
                      <span className="text-gray-500">
                        Còn lại: <strong className="text-gray-800">{room.available_quantity}</strong> / {room.total_quantity}
                      </span>
                      <span className="text-blue-600 font-bold">
                        {Number(room.price_per_night).toLocaleString('vi-VN')}đ / đêm
                      </span>
                    </div>

                    <button
                      disabled={!canBook}
                      onClick={() => navigate(`/book/${hotel._id}/${room._id}${nextQuery.toString() ? `?${nextQuery.toString()}` : ''}`)}
                      className={`w-full py-2 rounded-xl font-medium transition ${
                        canBook ? 'bg-blue-600 hover:bg-blue-700 text-white' : 'bg-gray-200 text-gray-500 cursor-not-allowed'
                      }`}
                    >
                      {canBook ? 'Đặt phòng' : 'Không thể đặt'}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
