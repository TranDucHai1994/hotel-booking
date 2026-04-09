import { useState, useEffect } from 'react';
import api from '../../services/api';
import toast from 'react-hot-toast';
import { FaPlus, FaEdit, FaTrash } from 'react-icons/fa';
import SafeImage from '../../components/SafeImage';

export default function AdminHotels() {
  const [hotels, setHotels] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({
    name: '', city: '', address: '', description: '',
    amenities: '', cover_image: '',
    property_type: 'hotel',
    star_rating: 0,
    is_hot_deal: false,
    hot_deal_discount_percent: 0,
  });

  const fetchHotels = () => api.get('/hotels').then(r => setHotels(r.data));
  useEffect(() => { fetchHotels(); }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const data = {
      ...form,
      star_rating: Number(form.star_rating) || 0,
      hot_deal_discount_percent: Number(form.hot_deal_discount_percent) || 0,
      amenities: form.amenities.split(',').map(a => a.trim()).filter(a => a),
    };
    try {
      if (editing) {
        await api.put(`/hotels/${editing._id}`, data);
        toast.success('Cập nhật khách sạn thành công!');
      } else {
        await api.post('/hotels', data);
        toast.success('Thêm khách sạn thành công!');
      }
      setShowForm(false);
      setEditing(null);
      setForm({
        name: '', city: '', address: '', description: '', amenities: '', cover_image: '',
        property_type: 'hotel', star_rating: 0, is_hot_deal: false, hot_deal_discount_percent: 0,
      });
      fetchHotels();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Có lỗi xảy ra!');
    }
  };

  const handleEdit = (hotel) => {
    setEditing(hotel);
    setForm({
      name: hotel.name,
      city: hotel.city,
      address: hotel.address,
      description: hotel.description,
      amenities: hotel.amenities?.join(', ') || '',
      cover_image: hotel.cover_image || '',
      property_type: hotel.property_type || 'hotel',
      star_rating: hotel.star_rating ?? 0,
      is_hot_deal: Boolean(hotel.is_hot_deal),
      hot_deal_discount_percent: hotel.hot_deal_discount_percent ?? 0,
    });
    setShowForm(true);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Xác nhận xóa khách sạn này?')) return;
    try {
      await api.delete(`/hotels/${id}`);
      toast.success('Xóa khách sạn thành công!');
      fetchHotels();
    } catch (err) {
      toast.error('Xóa thất bại!');
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Quản lý Khách sạn</h1>
          <p className="text-gray-500 text-sm">{hotels.length} khách sạn</p>
        </div>
        <button onClick={() => {
          setShowForm(true);
          setEditing(null);
          setForm({
            name: '', city: '', address: '', description: '', amenities: '', cover_image: '',
            property_type: 'hotel', star_rating: 0, is_hot_deal: false, hot_deal_discount_percent: 0,
          });
        }}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl flex items-center gap-2 font-medium transition">
          <FaPlus /> Thêm khách sạn
        </button>
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-lg max-h-screen overflow-y-auto">
            <h2 className="text-xl font-bold text-gray-800 mb-4">
              {editing ? '✏️ Sửa khách sạn' : '➕ Thêm khách sạn mới'}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-3">
              {[
                { label: 'Tên khách sạn', key: 'name', placeholder: 'Sài Gòn Palace Hotel' },
                { label: 'Thành phố', key: 'city', placeholder: 'Hồ Chí Minh' },
                { label: 'Địa chỉ', key: 'address', placeholder: '123 Nguyễn Huệ, Quận 1' },
                { label: 'Ảnh bìa (URL)', key: 'cover_image', placeholder: 'https://...' },
                { label: 'Tiện ích (phân cách bằng dấu phẩy)', key: 'amenities', placeholder: 'WiFi, Hồ bơi, Gym' },
              ].map(f => (
                <div key={f.key}>
                  <label className="block text-gray-700 text-sm font-medium mb-1">{f.label}</label>
                  <input value={form[f.key]} onChange={e => setForm({ ...form, [f.key]: e.target.value })}
                    placeholder={f.placeholder}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-blue-500" />
                </div>
              ))}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-gray-700 text-sm font-medium mb-1">Loại hình</label>
                  <select
                    value={form.property_type}
                    onChange={e => setForm({ ...form, property_type: e.target.value })}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
                  >
                    {[
                      { k: 'hotel', t: 'Hotel' },
                      { k: 'resort', t: 'Resort' },
                      { k: 'homestay', t: 'Homestay' },
                      { k: 'apartment', t: 'Apartment' },
                      { k: 'villa', t: 'Villa' },
                      { k: 'hostel', t: 'Hostel' },
                      { k: 'boutique', t: 'Boutique' },
                      { k: 'motel', t: 'Motel' },
                    ].map(o => <option key={o.k} value={o.k}>{o.t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-gray-700 text-sm font-medium mb-1">Hạng sao</label>
                  <select
                    value={form.star_rating}
                    onChange={e => setForm({ ...form, star_rating: e.target.value })}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
                  >
                    {[0, 1, 2, 3, 4, 5].map(n => (
                      <option key={n} value={n}>{n === 0 ? 'Chưa xếp hạng' : `${n} sao`}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="bg-gray-50 rounded-2xl p-4 border border-gray-100">
                <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
                  <input
                    type="checkbox"
                    checked={form.is_hot_deal}
                    onChange={e => setForm({ ...form, is_hot_deal: e.target.checked })}
                  />
                  Hot deal
                </label>
                {form.is_hot_deal && (
                  <div className="mt-3">
                    <label className="block text-gray-700 text-sm font-medium mb-1">Giảm giá (%)</label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={form.hot_deal_discount_percent}
                      onChange={e => setForm({ ...form, hot_deal_discount_percent: e.target.value })}
                      className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
                    />
                  </div>
                )}
              </div>

              <div>
                <label className="block text-gray-700 text-sm font-medium mb-1">Mô tả</label>
                <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })}
                  rows="3" placeholder="Mô tả khách sạn..."
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-blue-500 resize-none" />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="submit"
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-xl font-medium transition">
                  {editing ? 'Cập nhật' : 'Thêm mới'}
                </button>
                <button type="button" onClick={() => setShowForm(false)}
                  className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 py-2 rounded-xl font-medium transition">
                  Hủy
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {hotels.map(hotel => (
          <div key={hotel._id} className="bg-white rounded-2xl shadow-sm overflow-hidden border border-gray-100">
            <div className="h-40 overflow-hidden bg-gradient-to-br from-blue-400 to-blue-600">
              <SafeImage
                src={hotel.cover_image}
                sources={hotel.images || []}
                alt={hotel.name}
                className="w-full h-full object-cover"
                wrapperClassName="h-40 w-full"
                fallbackClassName="h-40 w-full"
                title={hotel.name}
                subtitle={hotel.city}
              />
            </div>
            <div className="p-4">
              <h3 className="font-bold text-gray-800 truncate">{hotel.name}</h3>
              <p className="text-gray-500 text-sm mb-3">📍 {hotel.city}</p>
              <div className="flex flex-wrap gap-2 mb-3">
                <span className="bg-gray-100 text-gray-600 text-xs px-2 py-1 rounded-full font-medium">
                  {hotel.property_type || 'hotel'}
                </span>
                {Number(hotel.star_rating) > 0 && (
                  <span className="bg-yellow-50 text-yellow-700 text-xs px-2 py-1 rounded-full font-medium">
                    {'⭐'.repeat(Number(hotel.star_rating))}
                  </span>
                )}
                {hotel.is_hot_deal && (
                  <span className="bg-red-50 text-red-600 text-xs px-2 py-1 rounded-full font-bold">
                    🔥 Hot deal{hotel.hot_deal_discount_percent ? ` -${hotel.hot_deal_discount_percent}%` : ''}
                  </span>
                )}
              </div>
              <div className="flex gap-2">
                <button onClick={() => handleEdit(hotel)}
                  className="flex-1 flex items-center justify-center gap-1 bg-yellow-50 hover:bg-yellow-100 text-yellow-700 py-2 rounded-xl text-sm font-medium transition">
                  <FaEdit /> Sửa
                </button>
                <button onClick={() => handleDelete(hotel._id)}
                  className="flex-1 flex items-center justify-center gap-1 bg-red-50 hover:bg-red-100 text-red-600 py-2 rounded-xl text-sm font-medium transition">
                  <FaTrash /> Xóa
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
