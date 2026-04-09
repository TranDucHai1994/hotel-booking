import { useEffect, useState } from 'react';
import api from '../../services/api';
import toast from 'react-hot-toast';

export default function AdminFeedbacks() {
  const [feedbacks, setFeedbacks] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadFeedbacks = async () => {
    setLoading(true);
    try {
      const res = await api.get('/feedback');
      setFeedbacks(res.data);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Không tải được phản hồi');
    }
    setLoading(false);
  };

  useEffect(() => {
    loadFeedbacks();
  }, []);

  const handleDelete = async (id) => {
    if (!window.confirm('Xóa phản hồi này?')) return;
    try {
      await api.delete(`/feedback/${id}`);
      toast.success('Đã xóa phản hồi');
      loadFeedbacks();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Xóa phản hồi thất bại');
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-40">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Quản lý phản hồi</h1>
        <p className="text-gray-500 text-sm">{feedbacks.length} phản hồi</p>
      </div>

      <div className="space-y-4">
        {feedbacks.map((item) => (
          <div key={item._id} className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
            <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="font-bold text-gray-800">{item.hotel_id?.name}</h3>
                  <span className="bg-yellow-50 text-yellow-700 px-2 py-1 rounded-full text-xs font-semibold">
                    {item.rating}/5
                  </span>
                </div>
                <p className="text-gray-500 text-sm">
                  {item.user_id?.full_name} · {item.user_id?.email}
                </p>
                <p className="text-gray-500 text-sm">{item.hotel_id?.city}</p>
                <p className="text-gray-700 mt-3">{item.content}</p>
                <p className="text-xs text-gray-400 mt-3">
                  {new Date(item.createdAt).toLocaleString('vi-VN')}
                </p>
              </div>

              <button
                onClick={() => handleDelete(item._id)}
                className="bg-red-50 hover:bg-red-100 text-red-600 px-4 py-2 rounded-xl text-sm font-medium transition"
              >
                Xóa phản hồi
              </button>
            </div>
          </div>
        ))}

        {feedbacks.length === 0 && <div className="text-center py-20 text-gray-400">Chưa có phản hồi nào</div>}
      </div>
    </div>
  );
}
