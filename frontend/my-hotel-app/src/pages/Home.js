import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import HotelCard from '../components/HotelCard';
import { FaSearch, FaMapMarkerAlt, FaHotel, FaStar, FaShieldAlt } from 'react-icons/fa';

export default function Home() {
  const [hotels, setHotels] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState({ city: '', min_price: '', max_price: '' });
  const navigate = useNavigate();

  const fetchHotels = async (params = {}) => {
    setLoading(true);
    try {
      const res = await api.get('/hotels', { params });
      setHotels(res.data);
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  };

  useEffect(() => { fetchHotels(); }, []);

  const hotDeals = hotels.filter(h => h.is_hot_deal).slice(0, 6);

  const handleSearch = (e) => {
    e.preventDefault();
    fetchHotels(search);
  };

  return (
    <div>
      {/* Hero Section */}
      <div className="relative bg-gradient-to-r from-blue-700 to-blue-500 text-white py-24 px-4">
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute inset-0 bg-black opacity-30"></div>
        </div>
        <div className="relative max-w-4xl mx-auto text-center">
          <h1 className="text-5xl font-extrabold mb-4 leading-tight">
            Tìm Khách Sạn <span className="text-yellow-400">Hoàn Hảo</span>
          </h1>
          <p className="text-xl text-blue-100 mb-10">
            Hàng nghìn khách sạn, homestay trên toàn quốc với giá tốt nhất
          </p>

          {/* Search Box */}
          <form onSubmit={handleSearch}
            className="bg-white rounded-2xl shadow-2xl p-4 flex flex-wrap gap-3 items-center">
            <div className="flex items-center gap-2 flex-1 min-w-48 border border-gray-200 rounded-xl px-3 py-2">
              <FaMapMarkerAlt className="text-blue-500" />
              <input
                placeholder="Tìm theo thành phố..."
                value={search.city}
                onChange={e => setSearch({ ...search, city: e.target.value })}
                className="outline-none text-gray-700 w-full text-sm"
              />
            </div>
            <div className="flex items-center gap-2 border border-gray-200 rounded-xl px-3 py-2">
              <span className="text-gray-400 text-sm">Giá từ</span>
              <input
                type="number"
                placeholder="0"
                value={search.min_price}
                onChange={e => setSearch({ ...search, min_price: e.target.value })}
                className="outline-none text-gray-700 w-24 text-sm"
              />
            </div>
            <div className="flex items-center gap-2 border border-gray-200 rounded-xl px-3 py-2">
              <span className="text-gray-400 text-sm">Đến</span>
              <input
                type="number"
                placeholder="∞"
                value={search.max_price}
                onChange={e => setSearch({ ...search, max_price: e.target.value })}
                className="outline-none text-gray-700 w-24 text-sm"
              />
            </div>
            <button type="submit"
              className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-xl font-semibold flex items-center gap-2 transition">
              <FaSearch /> Tìm kiếm
            </button>
          </form>
        </div>
      </div>

      {/* Features */}
      <div className="bg-white py-12 px-4">
        <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-8">
          {[
            { icon: <FaHotel className="text-3xl text-blue-600" />, title: 'Hàng nghìn khách sạn', desc: 'Đa dạng lựa chọn từ budget đến luxury' },
            { icon: <FaStar className="text-3xl text-yellow-500" />, title: 'Đánh giá thực tế', desc: 'Reviews từ khách hàng đã trải nghiệm' },
            { icon: <FaShieldAlt className="text-3xl text-green-500" />, title: 'Đặt phòng an toàn', desc: 'Thanh toán bảo mật, xác nhận ngay lập tức' },
          ].map((f, i) => (
            <div key={i} className="flex items-start gap-4 p-6 rounded-2xl bg-gray-50">
              <div className="p-3 bg-white rounded-xl shadow-sm">{f.icon}</div>
              <div>
                <h3 className="font-bold text-gray-800 mb-1">{f.title}</h3>
                <p className="text-gray-500 text-sm">{f.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Hotel List */}
      <div className="max-w-7xl mx-auto px-4 py-12">
        <h2 className="text-3xl font-bold text-gray-800 mb-2">Khách sạn nổi bật</h2>
        <p className="text-gray-500 mb-8">Những lựa chọn được yêu thích nhất</p>

        {!loading && hotDeals.length > 0 && (
          <div className="mb-10">
            <div className="flex items-end justify-between mb-4">
              <div>
                <h3 className="text-xl font-extrabold text-gray-800">🔥 Hot deals hôm nay</h3>
                <p className="text-gray-500 text-sm">Ưu đãi nổi bật, số lượng có hạn</p>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {hotDeals.map(hotel => <HotelCard key={hotel._id} hotel={hotel} />)}
            </div>
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-20">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        ) : hotels.length === 0 ? (
          <div className="text-center py-20 text-gray-400">
            <FaHotel className="text-6xl mx-auto mb-4 opacity-30" />
            <p className="text-xl">Không tìm thấy khách sạn nào</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {hotels.map(hotel => <HotelCard key={hotel._id} hotel={hotel} />)}
          </div>
        )}
      </div>
    </div>
  );
}