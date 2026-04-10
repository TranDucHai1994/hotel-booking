import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import api from '../services/api';
import {
  FaCalendarAlt,
  FaExternalLinkAlt,
  FaHotel,
  FaImage,
  FaMapMarkerAlt,
  FaRoute,
  FaStar,
} from 'react-icons/fa';
import SafeImage from '../components/SafeImage';
import { formatCurrencyVND } from '../utils/format';

function statusLabel(status) {
  if (status === 'full') return { text: 'Hết phòng', className: 'bg-red-50 text-red-600' };
  if (status === 'limited') return { text: 'Sắp hết', className: 'bg-yellow-50 text-yellow-700' };
  if (status === 'maintenance') return { text: 'Bảo trì', className: 'bg-gray-100 text-gray-600' };
  if (status === 'inactive') return { text: 'Ngừng bán', className: 'bg-gray-100 text-gray-600' };
  return { text: 'Còn phòng', className: 'bg-emerald-50 text-emerald-700' };
}

function applyStayDates(searchParams, checkIn, checkOut) {
  if (checkIn && checkOut) {
    searchParams.set('check_in', checkIn);
    searchParams.set('check_out', checkOut);
    return searchParams;
  }

  searchParams.delete('check_in');
  searchParams.delete('check_out');
  return searchParams;
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
      } catch (error) {
        console.error(error);
        setHotel(null);
      }
      setLoading(false);
    };

    fetchHotel();
  }, [id, searchParams]);

  const handleApplyFilter = (event) => {
    event.preventDefault();
    setSearchParams(applyStayDates(new URLSearchParams(searchParams), filters.check_in, filters.check_out));
  };

  const gallery = useMemo(() => {
    const unique = new Set();
    return [hotel?.cover_image, ...(hotel?.images || [])].filter((item) => {
      if (!item || unique.has(item)) return false;
      unique.add(item);
      return true;
    });
  }, [hotel]);

  const mapQuery = hotel?.map_query || [hotel?.name, hotel?.address, hotel?.city].filter(Boolean).join(', ');
  const mapUrl = mapQuery
    ? `https://www.google.com/maps?q=${encodeURIComponent(mapQuery)}&z=15&output=embed`
    : '';
  const mapLink = mapQuery
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(mapQuery)}`
    : '';

  if (loading) {
    return (
      <div className="flex justify-center py-40">
        <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!hotel) {
    return <div className="py-20 text-center text-gray-400">Không tìm thấy khách sạn</div>;
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-8 flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="mb-3 flex flex-wrap items-center gap-3">
            <span className="rounded-full bg-blue-50 px-3 py-1 text-sm font-semibold text-blue-700">
              {hotel.property_type || 'hotel'}
            </span>
            {Number(hotel.star_rating || 0) > 0 && (
              <span className="rounded-full bg-yellow-50 px-3 py-1 text-sm font-semibold text-yellow-700">
                {'★'.repeat(Number(hotel.star_rating))}
              </span>
            )}
            {hotel.review_count ? (
              <span className="rounded-full bg-gray-100 px-3 py-1 text-sm font-semibold text-gray-700">
                {Number(hotel.average_rating || 0).toFixed(1)} / 5 ({hotel.review_count} đánh giá)
              </span>
            ) : null}
          </div>

          <h1 className="mb-2 text-3xl font-bold text-gray-800">{hotel.name}</h1>
          <div className="flex flex-wrap items-center gap-4 text-gray-500">
            <span className="flex items-center gap-1">
              <FaMapMarkerAlt className="text-blue-500" />
              {hotel.address}, {hotel.city}
            </span>
            {hotel.min_price ? (
              <span className="font-semibold text-blue-600">
                Từ {formatCurrencyVND(hotel.min_price)} / đêm
              </span>
            ) : null}
            <span className="text-sm text-gray-500">
              {hotel.available_room_count} / {hotel.total_room_count} phòng khả dụng
            </span>
          </div>
        </div>

        <form
          onSubmit={handleApplyFilter}
          className="w-full rounded-2xl border border-gray-100 bg-white p-4 shadow-sm lg:max-w-md"
        >
          <h2 className="mb-3 font-bold text-gray-800">Kiểm tra phòng trống</h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="flex items-center gap-2 rounded-xl border border-gray-200 px-3 py-2">
              <FaCalendarAlt className="text-blue-500" />
              <input
                type="date"
                value={filters.check_in}
                min={new Date().toISOString().split('T')[0]}
                onChange={(event) => setFilters({ ...filters, check_in: event.target.value })}
                className="w-full bg-transparent text-sm text-gray-700 outline-none"
              />
            </div>
            <div className="flex items-center gap-2 rounded-xl border border-gray-200 px-3 py-2">
              <FaCalendarAlt className="text-blue-500" />
              <input
                type="date"
                value={filters.check_out}
                min={filters.check_in || new Date().toISOString().split('T')[0]}
                onChange={(event) => setFilters({ ...filters, check_out: event.target.value })}
                className="w-full bg-transparent text-sm text-gray-700 outline-none"
              />
            </div>
          </div>
          <button
            type="submit"
            className="mt-3 w-full rounded-xl bg-blue-600 py-2.5 font-semibold text-white transition hover:bg-blue-700"
          >
            Áp dụng ngày
          </button>
        </form>
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <div className="rounded-2xl bg-white p-6 shadow-sm">
            <h2 className="mb-3 text-xl font-bold text-gray-800">Giới thiệu</h2>
            <p className="leading-relaxed text-gray-600">
              {hotel.description || 'Khách sạn này chưa có mô tả chi tiết.'}
            </p>
          </div>

          <div className="rounded-2xl bg-white p-6 shadow-sm">
            <div className="mb-4 flex items-center gap-2">
              <FaImage className="text-blue-500" />
              <h2 className="text-xl font-bold text-gray-800">Hình ảnh</h2>
            </div>

            {gallery.length > 0 ? (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <SafeImage
                  src={gallery[0]}
                  sources={gallery.slice(1)}
                  alt={hotel.name}
                  className="h-80 w-full rounded-2xl object-cover"
                  wrapperClassName="md:col-span-2"
                  fallbackClassName="h-80 w-full rounded-2xl"
                  title={hotel.name}
                  subtitle={hotel.city}
                />
                {gallery.slice(1).map((image, index) => (
                  <SafeImage
                    key={`${image}-${index}`}
                    src={image}
                    alt={`${hotel.name}-${index + 2}`}
                    className="h-56 w-full rounded-2xl object-cover"
                    wrapperClassName=""
                    fallbackClassName="h-56 w-full rounded-2xl"
                    title={hotel.name}
                    subtitle="Gallery image unavailable"
                  />
                ))}
              </div>
            ) : (
              <div className="flex h-60 items-center justify-center rounded-2xl bg-gray-100 text-gray-400">
                Chưa có hình ảnh
              </div>
            )}
          </div>

          {hotel.amenities?.length > 0 && (
            <div className="rounded-2xl bg-white p-6 shadow-sm">
              <h2 className="mb-4 text-xl font-bold text-gray-800">Tiện ích khách sạn</h2>
              <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
                {hotel.amenities.map((item) => (
                  <div key={item} className="rounded-xl bg-blue-50 px-3 py-2 text-sm text-gray-700">
                    {item}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="rounded-2xl bg-white p-6 shadow-sm">
            <div className="mb-4 flex items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <FaRoute className="text-blue-500" />
                <h2 className="text-xl font-bold text-gray-800">Bản đồ vị trí</h2>
              </div>
              {mapLink ? (
                <a
                  href={mapLink}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 text-sm font-semibold text-blue-600 hover:text-blue-700"
                >
                  Mở Google Maps <FaExternalLinkAlt className="text-xs" />
                </a>
              ) : null}
            </div>

            <p className="mb-4 text-sm text-gray-500">
              Bản đồ mô phỏng vị trí khách sạn dựa trên địa chỉ và tên khách sạn trong hệ thống.
            </p>

            {mapUrl ? (
              <div className="overflow-hidden rounded-2xl border border-slate-200">
                <iframe
                  title={`map-${hotel.name}`}
                  src={mapUrl}
                  loading="lazy"
                  allowFullScreen
                  className="h-80 w-full border-0"
                />
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-10 text-center text-sm text-slate-400">
                Chưa có dữ liệu vị trí để hiển thị bản đồ
              </div>
            )}
          </div>

          <div className="rounded-2xl bg-white p-6 shadow-sm">
            <div className="mb-4 flex items-center gap-2">
              <FaStar className="text-yellow-500" />
              <h2 className="text-xl font-bold text-gray-800">Đánh giá</h2>
            </div>

            {hotel.feedbacks?.length === 0 ? (
              <p className="text-gray-400">Chưa có đánh giá</p>
            ) : (
              <div className="space-y-4">
                {hotel.feedbacks.map((item) => (
                  <div key={item._id} className="border-b border-gray-100 pb-4 last:border-b-0">
                    <div className="mb-1 flex items-center gap-2">
                      <span className="font-medium text-gray-800">{item.user_id?.full_name}</span>
                      <span className="text-sm text-yellow-500">
                        {'★'.repeat(item.rating)}
                        {'☆'.repeat(5 - item.rating)}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600">{item.content}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-2xl bg-white p-6 shadow-sm">
            <div className="mb-4 flex items-center gap-2">
              <FaHotel className="text-blue-500" />
              <h2 className="text-xl font-bold text-gray-800">Loại phòng</h2>
            </div>

            <div className="space-y-4">
              {hotel.rooms?.map((room) => {
                const badge = statusLabel(room.availability_status);
                const canBook = room.is_bookable;
                const nextQuery = applyStayDates(
                  new URLSearchParams(),
                  searchParams.get('check_in'),
                  searchParams.get('check_out')
                );

                return (
                  <div
                    key={room._id}
                    className="rounded-2xl border border-gray-100 bg-gray-50 p-5 transition hover:border-blue-200"
                  >
                    <div className="mb-2 flex items-start justify-between gap-3">
                      <div>
                        <h3 className="font-bold text-gray-800">{room.room_type}</h3>
                        <p className="text-sm text-gray-500">Tối đa {room.max_guests} khách</p>
                      </div>
                      <span className={`rounded-full px-3 py-1 text-xs font-semibold ${badge.className}`}>
                        {badge.text}
                      </span>
                    </div>

                    <p className="mb-3 text-sm text-gray-600">
                      {room.description || 'Chưa có mô tả cho loại phòng này.'}
                    </p>

                    {room.amenities?.length > 0 && (
                      <div className="mb-3 flex flex-wrap gap-2">
                        {room.amenities.map((item) => (
                          <span
                            key={`${room._id}-${item}`}
                            className="rounded-full border border-gray-200 bg-white px-2 py-1 text-xs text-gray-600"
                          >
                            {item}
                          </span>
                        ))}
                      </div>
                    )}

                    <div className="mb-3 flex items-center justify-between text-sm">
                      <span className="text-gray-500">
                        Còn lại: <strong className="text-gray-800">{room.available_quantity}</strong> /{' '}
                        {room.total_quantity}
                      </span>
                      <span className="font-bold text-blue-600">
                        {formatCurrencyVND(room.price_per_night)} / đêm
                      </span>
                    </div>

                    <button
                      disabled={!canBook}
                      onClick={() =>
                        navigate(
                          `/book/${hotel._id}/${room._id}${nextQuery.toString() ? `?${nextQuery.toString()}` : ''}`
                        )
                      }
                      className={`w-full rounded-xl py-2 font-medium transition ${
                        canBook
                          ? 'bg-blue-600 text-white hover:bg-blue-700'
                          : 'cursor-not-allowed bg-gray-200 text-gray-500'
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
