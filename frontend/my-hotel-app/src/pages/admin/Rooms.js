import { useState, useEffect } from 'react';
import api from '../../services/api';
import { FaPlus, FaEdit, FaTrash } from 'react-icons/fa';

export default function AdminRooms() {
  const [rooms, setRooms] = useState([]);
  const [hotels, setHotels] = useState([]);
  const [selectedHotel, setSelectedHotel] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({
    hotel_id: '', room_type: '', max_guests: 2,
    price_per_night: '', total_quantity: 1, description: '', amenities: ''
  });

  useEffect(() => {
    api.get('/hotels').then(r => setHotels(r.data));
  }, []);

  useEffect(() => {
    if (selectedHotel) {
      api.get(`/rooms?hotel_id=${selectedHotel}`).then(r => setRooms(r.data));
    } else {
      setRooms([]);
    }
  }, [selectedHotel]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const data = {
      ...form,
      hotel_id: selectedHotel,
      amenities: form.amenities.split(',').map(a => a.trim()).filter(a => a),
      price_per_night: Number(form.price_per_night),
      max_guests: Number(form.max_guests),
      total_quantity: Number(form.total_quantity),
    };
    try {
      if (editing) {
        await api.put(`/rooms/${editing._id}`, data);
        alert('✅ Cập nhật thành công!');
      } else {
        await api.post('/rooms', data);
        alert('✅ Thêm phòng thành công!');
      }
      setShowForm(false);
      setEditing(null);
      setForm({ hotel_id: '', room_type: '', max_guests: 2, price_per_night: '', total_quantity: 1, description: '', amenities: '' });
      api.get(`/rooms?hotel_id=${selectedHotel}`).then(r => setRooms(r.data));
    } catch (err) {
      alert(err.response?.data?.message || 'Lỗi!');
    }
  };

  const handleEdit = (room) => {
    setEditing(room);
    setForm({
      hotel_id: room.hotel_id,
      room_type: room.room_type,
      max_guests: room.max_guests,
      price_per_night: room.price_per_night,
      total_quantity: room.total_quantity,
      description: room.description || '',
      amenities: room.amenities?.join(', ') || ''
    });
    setShowForm(true);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Xác nhận xóa phòng này?')) return;
    await api.delete(`/rooms/${id}`);
    api.get(`/rooms?hotel_id=${selectedHotel}`).then(r => setRooms(r.data));
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Quản lý Phòng</h1>
          <p className="text-gray-500 text-sm">{rooms.length} phòng</p>
        </div>
        {selectedHotel && (
          <button onClick={() => { setShowForm(true); setEditing(null); }}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl flex items-center gap-2 font-medium transition">
            <FaPlus /> Thêm phòng
          </button>
        )}
      </div>

      {/* Chọn khách sạn */}
      <div className="bg-white rounded-2xl p-4 shadow-sm mb-6">
        <label className="block text-gray-700 text-sm font-medium mb-2">Chọn khách sạn</label>
        <select value={selectedHotel} onChange={e => setSelectedHotel(e.target.value)}
          className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-blue-500">
          <option value="">-- Chọn khách sạn --</option>
          {hotels.map(h => <option key={h._id} value={h._id}>{h.name} - {h.city}</option>)}
        </select>
      </div>

      {/* Form */}
      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-lg max-h-screen overflow-y-auto">
            <h2 className="text-xl font-bold text-gray-800 mb-4">
              {editing ? '✏️ Sửa phòng' : '➕ Thêm phòng mới'}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-3">
              {[
                { label: 'Loại phòng', key: 'room_type', placeholder: 'Deluxe Double', type: 'text' },
                { label: 'Số khách tối đa', key: 'max_guests', placeholder: '2', type: 'number' },
                { label: 'Giá/đêm (VNĐ)', key: 'price_per_night', placeholder: '1500000', type: 'number' },
                { label: 'Số lượng phòng', key: 'total_quantity', placeholder: '5', type: 'number' },
                { label: 'Tiện ích (phân cách bằng dấu phẩy)', key: 'amenities', placeholder: 'TV, Điều hòa, Minibar', type: 'text' },
              ].map(f => (
                <div key={f.key}>
                  <label className="block text-gray-700 text-sm font-medium mb-1">{f.label}</label>
                  <input type={f.type} value={form[f.key]}
                    onChange={e => setForm({ ...form, [f.key]: e.target.value })}
                    placeholder={f.placeholder}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-blue-500" />
                </div>
              ))}
              <div>
                <label className="block text-gray-700 text-sm font-medium mb-1">Mô tả</label>
                <textarea value={form.description}
                  onChange={e => setForm({ ...form, description: e.target.value })}
                  rows="2" placeholder="Mô tả phòng..."
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

      {/* Danh sách phòng */}
      {selectedHotel ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {rooms.map(room => (
            <div key={room._id} className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
              <div className="flex justify-between items-start mb-3">
                <h3 className="font-bold text-gray-800">{room.room_type}</h3>
                <span className="bg-blue-50 text-blue-600 text-xs px-2 py-1 rounded-full font-medium">
                  {room.total_quantity} phòng
                </span>
              </div>
              <p className="text-gray-500 text-sm mb-2">👥 Tối đa {room.max_guests} khách</p>
              <p className="text-blue-600 font-bold mb-3">
                {Number(room.price_per_night).toLocaleString('vi-VN')}đ/đêm
              </p>
              {room.amenities?.length > 0 && (
                <div className="flex flex-wrap gap-1 mb-3">
                  {room.amenities.slice(0, 3).map((a, i) => (
                    <span key={i} className="bg-gray-100 text-gray-600 text-xs px-2 py-1 rounded-full">{a}</span>
                  ))}
                </div>
              )}
              <div className="flex gap-2">
                <button onClick={() => handleEdit(room)}
                  className="flex-1 flex items-center justify-center gap-1 bg-yellow-50 hover:bg-yellow-100 text-yellow-700 py-2 rounded-xl text-sm font-medium transition">
                  <FaEdit /> Sửa
                </button>
                <button onClick={() => handleDelete(room._id)}
                  className="flex-1 flex items-center justify-center gap-1 bg-red-50 hover:bg-red-100 text-red-600 py-2 rounded-xl text-sm font-medium transition">
                  <FaTrash /> Xóa
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-20 text-gray-400">
          <p>👆 Chọn khách sạn để xem danh sách phòng</p>
        </div>
      )}
    </div>
  );
}