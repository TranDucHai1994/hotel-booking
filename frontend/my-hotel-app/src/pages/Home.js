import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import api from '../services/api';
import HotelCard from '../components/HotelCard';
import { FaSearch, FaMapMarkerAlt, FaHotel, FaStar, FaShieldAlt, FaCalendarAlt, FaMoneyBillWave } from 'react-icons/fa';

function readSearchState(searchParams) {
  return {
    location: searchParams.get('location') || '',
    check_in: searchParams.get('check_in') || '',
    check_out: searchParams.get('check_out') || '',
    min_price: searchParams.get('min_price') || '',
    max_price: searchParams.get('max_price') || '',
  };
}

export default function Home() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [hotels, setHotels] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState(() => readSearchState(searchParams));

  useEffect(() => {
    setSearch(readSearchState(searchParams));
  }, [searchParams]);

  useEffect(() => {
    const params = readSearchState(searchParams);

    const fetchHotels = async () => {
      setLoading(true);
      try {
        const res = await api.get('/hotels', {
          params: {
            location: params.location,
            check_in: params.check_in,
            check_out: params.check_out,
            min_price: params.min_price,
            max_price: params.max_price,
          },
        });
        setHotels(res.data);
      } catch (err) {
        console.error(err);
        setHotels([]);
      }
      setLoading(false);
    };

    fetchHotels();
  }, [searchParams]);

  const searchQuery = useMemo(() => {
    const nextParams = new URLSearchParams();
    Object.entries(search).forEach(([key, value]) => {
      if (value) nextParams.set(key, value);
    });
    return nextParams.toString();
  }, [search]);

  const hotDeals = hotels.filter((hotel) => hotel.is_hot_deal).slice(0, 6);

  const handleSearch = (e) => {
    e.preventDefault();
    const nextParams = new URLSearchParams();
    Object.entries(search).forEach(([key, value]) => {
      if (value) nextParams.set(key, value);
    });
    setSearchParams(nextParams);
  };

  const handleReset = () => {
    setSearch({
      location: '',
      check_in: '',
      check_out: '',
      min_price: '',
      max_price: '',
    });
    setSearchParams(new URLSearchParams());
  };

  return (
    <div className="bg-slate-50">
      <section className="relative overflow-hidden bg-[linear-gradient(135deg,#1d4ed8_0%,#2563eb_45%,#0f172a_100%)] px-4 pb-24 pt-16 text-white lg:pb-28 lg:pt-20">
        <div className="absolute inset-0 opacity-20 bg-[radial-gradient(circle_at_top_left,_white,_transparent_35%)]" />
        <div className="absolute -right-24 top-16 h-64 w-64 rounded-full bg-cyan-300/10 blur-3xl" />
        <div className="absolute -left-20 bottom-10 h-72 w-72 rounded-full bg-blue-300/10 blur-3xl" />

        <div className="relative mx-auto max-w-[1380px]">
          <div className="mx-auto max-w-4xl text-center">
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-2 text-sm font-medium text-blue-100 backdrop-blur-sm">
              <FaHotel className="text-yellow-300" />
              Nền tảng tìm kiếm và đặt phòng khách sạn
            </div>

            <h1 className="mx-auto max-w-4xl text-4xl font-black leading-tight tracking-tight md:text-5xl xl:text-6xl">
              Tìm khách sạn <span className="text-yellow-300">đúng ngày</span>, đúng nơi, đúng ngân sách
            </h1>

            <p className="mx-auto mt-5 max-w-3xl text-base leading-7 text-blue-100 md:text-lg">
              Tìm theo vị trí, ngày nhận phòng, ngày trả phòng và khoảng giá ngay trên trang chủ.
              Danh sách khách sạn sẽ hiển thị số phòng còn trống theo ngày bạn chọn.
            </p>
          </div>

          <div className="mx-auto mt-10 max-w-6xl">
            <form
              onSubmit={handleSearch}
              className="rounded-[32px] border border-white/15 bg-white/95 p-4 shadow-2xl backdrop-blur-xl md:p-5"
            >
              <div className="grid grid-cols-1 gap-3 xl:grid-cols-12">
                <div className="xl:col-span-3">
                  <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                    Vị trí
                  </label>
                  <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3">
                    <FaMapMarkerAlt className="text-blue-500" />
                    <input
                      placeholder="Vị trí hoặc tên khách sạn"
                      value={search.location}
                      onChange={(e) => setSearch({ ...search, location: e.target.value })}
                      className="w-full bg-transparent text-sm text-slate-700 outline-none"
                    />
                  </div>
                </div>

                <div className="sm:grid sm:grid-cols-2 sm:gap-3 xl:col-span-4">
                  <div>
                    <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                      Nhận phòng
                    </label>
                    <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3">
                      <FaCalendarAlt className="text-blue-500" />
                      <input
                        type="date"
                        value={search.check_in}
                        min={new Date().toISOString().split('T')[0]}
                        onChange={(e) => setSearch({ ...search, check_in: e.target.value })}
                        className="w-full bg-transparent text-sm text-slate-700 outline-none"
                      />
                    </div>
                  </div>

                  <div className="mt-3 sm:mt-0">
                    <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                      Trả phòng
                    </label>
                    <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3">
                      <FaCalendarAlt className="text-blue-500" />
                      <input
                        type="date"
                        value={search.check_out}
                        min={search.check_in || new Date().toISOString().split('T')[0]}
                        onChange={(e) => setSearch({ ...search, check_out: e.target.value })}
                        className="w-full bg-transparent text-sm text-slate-700 outline-none"
                      />
                    </div>
                  </div>
                </div>

                <div className="sm:grid sm:grid-cols-2 sm:gap-3 xl:col-span-3">
                  <div>
                    <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                      Giá từ
                    </label>
                    <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3">
                      <FaMoneyBillWave className="text-blue-500" />
                      <input
                        type="number"
                        placeholder="0"
                        value={search.min_price}
                        onChange={(e) => setSearch({ ...search, min_price: e.target.value })}
                        className="w-full bg-transparent text-sm text-slate-700 outline-none"
                      />
                    </div>
                  </div>

                  <div className="mt-3 sm:mt-0">
                    <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                      Giá đến
                    </label>
                    <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3">
                      <FaMoneyBillWave className="text-blue-500" />
                      <input
                        type="number"
                        placeholder="5000000"
                        value={search.max_price}
                        onChange={(e) => setSearch({ ...search, max_price: e.target.value })}
                        className="w-full bg-transparent text-sm text-slate-700 outline-none"
                      />
                    </div>
                  </div>
                </div>

                <div className="flex items-end gap-2 xl:col-span-2">
                  <button
                    type="submit"
                    className="flex-1 rounded-2xl bg-blue-600 px-5 py-3 font-semibold text-white transition hover:bg-blue-700"
                  >
                    <span className="flex items-center justify-center gap-2">
                      <FaSearch /> Tìm kiếm
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={handleReset}
                    className="rounded-2xl bg-slate-100 px-4 py-3 font-semibold text-slate-600 transition hover:bg-slate-200"
                  >
                    Xóa
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      </section>

      <section className="-mt-10 px-4">
        <div className="mx-auto grid max-w-[1380px] grid-cols-1 gap-4 md:grid-cols-3">
          {[
            {
              icon: <FaHotel className="text-2xl text-blue-600" />,
              title: 'Danh sách khách sạn rõ ràng',
              desc: 'Hiển thị loại hình, giá nhỏ nhất và số phòng còn trống theo ngày đã chọn.',
            },
            {
              icon: <FaStar className="text-2xl text-yellow-500" />,
              title: 'Đủ thông tin để so sánh',
              desc: 'Xem đánh giá, tiện ích, ảnh và thông tin chi tiết trước khi đặt phòng.',
            },
            {
              icon: <FaShieldAlt className="text-2xl text-emerald-500" />,
              title: 'Đặt phòng an toàn',
              desc: 'Kiểm tra ngày hợp lệ và số lượng phòng còn trống ngay từ backend.',
            },
          ].map((feature, index) => (
            <div
              key={index}
              className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm"
            >
              <div className="mb-4 inline-flex rounded-2xl bg-slate-50 p-3">{feature.icon}</div>
              <h3 className="mb-2 text-lg font-bold text-slate-900">{feature.title}</h3>
              <p className="text-sm leading-6 text-slate-500">{feature.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="px-4 py-14">
        <div className="mx-auto max-w-[1380px]">
          <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <h2 className="text-3xl font-black tracking-tight text-slate-900">Khách sạn nổi bật</h2>
              <p className="mt-2 text-slate-500">
                {search.location || search.check_in || search.check_out || search.min_price || search.max_price
                  ? 'Kết quả đang được lọc theo yêu cầu tìm kiếm của bạn.'
                  : 'Những lựa chọn được yêu thích nhất và sẵn sàng để bạn khám phá.'}
              </p>
            </div>

            {(search.location || search.check_in || search.check_out || search.min_price || search.max_price) && (
              <div className="rounded-2xl bg-blue-50 px-4 py-3 text-sm text-slate-600">
                {search.location ? `Vị trí: ${search.location}` : 'Tất cả vị trí'}
                {search.check_in && search.check_out ? ` • ${search.check_in} - ${search.check_out}` : ''}
              </div>
            )}
          </div>

          {!loading && hotDeals.length > 0 && (
            <div className="mb-10">
              <div className="mb-4">
                <h3 className="text-2xl font-bold text-slate-900">Hot deals hôm nay</h3>
                <p className="mt-1 text-sm text-slate-500">Ưu đãi nổi bật, số lượng có hạn</p>
              </div>

              <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
                {hotDeals.map((hotel) => (
                  <HotelCard key={hotel._id} hotel={hotel} searchQuery={searchQuery} />
                ))}
              </div>
            </div>
          )}

          {loading ? (
            <div className="flex justify-center py-20">
              <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-blue-600"></div>
            </div>
          ) : hotels.length === 0 ? (
            <div className="rounded-[28px] border border-dashed border-slate-300 bg-white py-20 text-center text-slate-400">
              <FaHotel className="mx-auto mb-4 text-6xl opacity-30" />
              <p className="text-xl">Không tìm thấy khách sạn nào phù hợp</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
              {hotels.map((hotel) => (
                <HotelCard key={hotel._id} hotel={hotel} searchQuery={searchQuery} />
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
