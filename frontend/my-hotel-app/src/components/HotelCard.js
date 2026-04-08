import { Link } from 'react-router-dom';
import { FaMapMarkerAlt, FaStar } from 'react-icons/fa';
import { MdHotel } from 'react-icons/md';

export default function HotelCard({ hotel }) {
  const stars = Math.max(0, Math.min(5, Number(hotel.star_rating || 0)));
  return (
    <Link to={`/hotels/${hotel._id}`}
      className="bg-white rounded-2xl shadow-md hover:shadow-xl transition-all duration-300 overflow-hidden group cursor-pointer block">

      {/* Ảnh */}
      <div className="relative overflow-hidden h-52">
        {hotel.cover_image ? (
          <img
            src={hotel.cover_image}
            alt={hotel.name}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center">
            <MdHotel className="text-white text-6xl opacity-50" />
          </div>
        )}
        <div className="absolute top-3 right-3 flex flex-col items-end gap-2">
          {hotel.is_hot_deal && (
            <div className="bg-red-600 text-white px-3 py-1 rounded-full text-xs font-bold shadow">
              🔥 Hot deal{hotel.hot_deal_discount_percent ? ` -${hotel.hot_deal_discount_percent}%` : ''}
            </div>
          )}
          {hotel.property_type && (
            <div className="bg-white px-2 py-1 rounded-full text-xs font-bold text-gray-700 shadow">
              {hotel.property_type}
            </div>
          )}
        </div>
      </div>

      {/* Nội dung */}
      <div className="p-4">
        <h3 className="font-bold text-gray-800 text-lg mb-1 truncate">{hotel.name}</h3>

        <div className="flex items-center gap-1 text-gray-500 text-sm mb-2">
          <FaMapMarkerAlt className="text-blue-500 flex-shrink-0" />
          <span className="truncate">{hotel.city}</span>
        </div>

        <p className="text-gray-500 text-sm mb-3 line-clamp-2">{hotel.description}</p>

        {/* Amenities */}
        {hotel.amenities?.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-3">
            {hotel.amenities.slice(0, 3).map((a, i) => (
              <span key={i} className="bg-blue-50 text-blue-600 text-xs px-2 py-1 rounded-full">{a}</span>
            ))}
            {hotel.amenities.length > 3 && (
              <span className="bg-gray-100 text-gray-500 text-xs px-2 py-1 rounded-full">
                +{hotel.amenities.length - 3}
              </span>
            )}
          </div>
        )}

        {/* Giá & Rating */}
        <div className="flex justify-between items-center pt-3 border-t border-gray-100">
          <div>
            {hotel.min_price ? (
              <>
                <span className="text-gray-400 text-xs">Từ </span>
                <span className="text-blue-600 font-bold text-lg">
                  {Number(hotel.min_price).toLocaleString('vi-VN')}đ
                </span>
                <span className="text-gray-400 text-xs">/đêm</span>
              </>
            ) : (
              <span className="text-gray-400 text-sm">Chưa có phòng</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {stars > 0 ? (
              <div className="flex items-center gap-1 text-yellow-500">
                <FaStar />
                <span className="text-gray-700 text-sm font-semibold">{stars}.0</span>
              </div>
            ) : (
              <span className="text-gray-400 text-xs">Chưa xếp hạng</span>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}