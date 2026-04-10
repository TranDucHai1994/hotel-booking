import { Link } from 'react-router-dom';
import { FaMapMarkerAlt, FaStar } from 'react-icons/fa';
import SafeImage from './SafeImage';
import { formatCurrencyVND } from '../utils/format';

function buildDetailLink(hotelId, searchQuery) {
  return searchQuery ? `/hotels/${hotelId}?${searchQuery}` : `/hotels/${hotelId}`;
}

export default function HotelCard({ hotel, searchQuery = '' }) {
  const stars = Math.max(0, Math.min(5, Number(hotel.star_rating || 0)));
  const ratingValue = hotel.average_rating ? Number(hotel.average_rating).toFixed(1) : stars ? `${stars}.0` : null;
  const imageSources = [hotel.cover_image, ...(hotel.images || [])].filter(Boolean);

  return (
    <Link
      to={buildDetailLink(hotel._id, searchQuery)}
      className="group flex h-full flex-col rounded-[28px] border border-slate-200 bg-white shadow-sm transition duration-300 hover:-translate-y-1 hover:shadow-xl"
    >
      <div className="relative overflow-hidden rounded-t-[28px]">
        <SafeImage
          src={imageSources[0]}
          sources={imageSources.slice(1)}
          alt={hotel.name}
          className="h-56 w-full object-cover transition duration-500 group-hover:scale-105"
          wrapperClassName="h-56 w-full"
          fallbackClassName="h-56 w-full"
          title={hotel.name}
          subtitle={hotel.city}
        />

        <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/50 to-transparent pointer-events-none" />
        <div className="absolute top-4 left-4 right-4 flex items-start justify-between gap-3">
          <div className="flex flex-wrap gap-2">
            {hotel.is_hot_deal && (
              <span className="rounded-full bg-rose-600 px-3 py-1 text-xs font-bold text-white shadow-lg">
                Hot deal{hotel.hot_deal_discount_percent ? ` -${hotel.hot_deal_discount_percent}%` : ''}
              </span>
            )}
            {hotel.property_type && (
              <span className="rounded-full bg-white/90 px-3 py-1 text-xs font-semibold text-slate-700 shadow">
                {hotel.property_type}
              </span>
            )}
          </div>

          {hotel.available_room_count > 0 ? (
            <span className="rounded-full bg-emerald-50/95 px-3 py-1 text-xs font-semibold text-emerald-700 shadow">
              Còn {hotel.available_room_count} phòng
            </span>
          ) : null}
        </div>
      </div>

      <div className="flex flex-1 flex-col p-5">
        <div className="mb-3">
          <h3 className="line-clamp-2 text-lg font-bold text-slate-900">{hotel.name}</h3>
          <div className="mt-2 flex items-center gap-2 text-sm text-slate-500">
            <FaMapMarkerAlt className="shrink-0 text-blue-500" />
            <span className="truncate">{hotel.city}</span>
          </div>
        </div>

        <p className="mb-4 line-clamp-2 text-sm leading-6 text-slate-500">
          {hotel.description || 'Khách sạn đang được cập nhật thêm mô tả chi tiết.'}
        </p>

        {hotel.amenities?.length > 0 && (
          <div className="mb-5 flex flex-wrap gap-2">
            {hotel.amenities.slice(0, 3).map((item, index) => (
              <span key={index} className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700">
                {item}
              </span>
            ))}
            {hotel.amenities.length > 3 && (
              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-500">
                +{hotel.amenities.length - 3}
              </span>
            )}
          </div>
        )}

        <div className="mt-auto flex items-end justify-between border-t border-slate-100 pt-4">
          <div>
            {hotel.min_price ? (
              <>
                <span className="text-xs uppercase tracking-[0.2em] text-slate-400">Giá từ</span>
                <div className="mt-1 text-lg font-bold text-blue-700">
                  {formatCurrencyVND(hotel.min_price)}
                  <span className="ml-1 text-xs font-medium text-slate-400">/đêm</span>
                </div>
              </>
            ) : (
              <span className="text-sm text-slate-400">Chưa có phòng phù hợp</span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {ratingValue ? (
              <div className="flex items-center gap-1.5 text-amber-500">
                <FaStar />
                <span className="text-sm font-semibold text-slate-700">{ratingValue}</span>
                {hotel.review_count ? <span className="text-xs text-slate-400">({hotel.review_count})</span> : null}
              </div>
            ) : (
              <span className="text-xs text-slate-400">Chưa có đánh giá</span>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}
