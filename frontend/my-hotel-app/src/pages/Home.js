import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import api from '../services/api';
import HotelCard from '../components/HotelCard';
import {
  FaCalendarAlt,
  FaCheckCircle,
  FaEnvelopeOpenText,
  FaHotel,
  FaMapMarkerAlt,
  FaMoneyBillWave,
  FaSearch,
  FaShieldAlt,
} from 'react-icons/fa';

const AMENITY_OPTIONS = [
  { value: 'WiFi', label: 'WiFi' },
  { value: 'Breakfast', label: 'Bữa sáng' },
  { value: 'Airport shuttle', label: 'Đưa đón sân bay' },
  { value: 'Gym', label: 'Phòng gym' },
  { value: 'Pool', label: 'Hồ bơi' },
  { value: 'Spa', label: 'Spa' },
  { value: 'Restaurant', label: 'Nhà hàng' },
  { value: 'Beachfront', label: 'Sát biển' },
  { value: 'Bike rental', label: 'Thuê xe đạp' },
];

function parseAmenities(searchParams) {
  return (searchParams.get('amenities') || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function readSearchState(searchParams) {
  return {
    location: searchParams.get('location') || '',
    check_in: searchParams.get('check_in') || '',
    check_out: searchParams.get('check_out') || '',
    min_price: searchParams.get('min_price') || '',
    max_price: searchParams.get('max_price') || '',
    min_rating: searchParams.get('min_rating') || '',
    amenities: parseAmenities(searchParams),
  };
}

function buildSearchParams(search) {
  const nextParams = new URLSearchParams();
  Object.entries(search).forEach(([key, value]) => {
    if (Array.isArray(value)) {
      if (value.length) nextParams.set(key, value.join(','));
      return;
    }
    if (value) nextParams.set(key, value);
  });
  return nextParams;
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
            min_rating: params.min_rating,
            amenities: params.amenities.join(','),
          },
        });
        setHotels(res.data);
      } catch (error) {
        console.error(error);
        setHotels([]);
      }
      setLoading(false);
    };

    fetchHotels();
  }, [searchParams]);

  const searchQuery = useMemo(() => {
    return buildSearchParams(search).toString();
  }, [search]);

  const activeAmenityLabels = useMemo(
    () => AMENITY_OPTIONS.filter((option) => search.amenities.includes(option.value)).map((option) => option.label),
    [search.amenities]
  );

  const activeFilterCount = [
    search.location,
    search.check_in && search.check_out ? 'date-range' : '',
    search.min_price,
    search.max_price,
    search.min_rating,
    search.amenities.length ? 'amenities' : '',
  ].filter(Boolean).length;

  const hotDeals = hotels.filter((hotel) => hotel.is_hot_deal).slice(0, 6);

  const handleSearch = (event) => {
    event.preventDefault();
    setSearchParams(buildSearchParams(search));
  };

  const handleReset = () => {
    setSearch({
      location: '',
      check_in: '',
      check_out: '',
      min_price: '',
      max_price: '',
      min_rating: '',
      amenities: [],
    });
    setSearchParams(new URLSearchParams());
  };

  const toggleAmenity = (value) => {
    setSearch((current) => ({
      ...current,
      amenities: current.amenities.includes(value)
        ? current.amenities.filter((item) => item !== value)
        : [...current.amenities, value],
    }));
  };

  return (
    <div className="bg-slate-50">
      <section className="relative overflow-hidden bg-[linear-gradient(135deg,#0f172a_0%,#1d4ed8_45%,#0ea5e9_100%)] px-4 pb-24 pt-16 text-white lg:pb-28 lg:pt-20">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(255,255,255,0.25),_transparent_35%)]" />
        <div className="absolute -left-20 bottom-10 h-72 w-72 rounded-full bg-cyan-300/10 blur-3xl" />
        <div className="absolute -right-24 top-16 h-64 w-64 rounded-full bg-blue-200/10 blur-3xl" />

        <div className="relative mx-auto max-w-[1380px]">
          <div className="mx-auto max-w-4xl text-center">
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-2 text-sm font-medium text-blue-100 backdrop-blur-sm">
              <FaHotel className="text-yellow-300" />
              Nền tảng đặt phòng thông minh cho cả khách thành viên và khách vãng lai
            </div>

            <h1 className="mx-auto max-w-4xl text-4xl font-black leading-tight tracking-tight md:text-5xl xl:text-6xl">
              Tìm khách sạn phù hợp,
              <span className="text-yellow-300"> đặt nhanh trong vài phút</span>
            </h1>

            <p className="mx-auto mt-5 max-w-3xl text-base leading-7 text-blue-100 md:text-lg">
              Lọc theo vị trí, khoảng giá, đánh giá, tiện ích và ngày ở. Hệ thống tự tính phòng còn trống,
              hỗ trợ guest mode và mô phỏng email xác nhận ngay sau khi đặt.
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
                      onChange={(event) => setSearch({ ...search, location: event.target.value })}
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
                        onChange={(event) => setSearch({ ...search, check_in: event.target.value })}
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
                        onChange={(event) => setSearch({ ...search, check_out: event.target.value })}
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
                        onChange={(event) => setSearch({ ...search, min_price: event.target.value })}
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
                        onChange={(event) => setSearch({ ...search, max_price: event.target.value })}
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

              <div className="mt-4 grid grid-cols-1 gap-4 border-t border-slate-200 pt-4 lg:grid-cols-[1.1fr,2fr]">
                <div>
                  <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                    Đánh giá tối thiểu
                  </label>
                  <select
                    value={search.min_rating}
                    onChange={(event) => setSearch({ ...search, min_rating: event.target.value })}
                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none"
                  >
                    <option value="">Tất cả mức đánh giá</option>
                    <option value="3">Từ 3 sao trở lên</option>
                    <option value="4">Từ 4 sao trở lên</option>
                    <option value="4.5">Từ 4.5 điểm trở lên</option>
                  </select>
                </div>

                <div>
                  <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                    Tiện ích nổi bật
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {AMENITY_OPTIONS.map((option) => {
                      const selected = search.amenities.includes(option.value);
                      return (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() => toggleAmenity(option.value)}
                          className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                            selected
                              ? 'bg-blue-600 text-white shadow-sm'
                              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                          }`}
                        >
                          {option.label}
                        </button>
                      );
                    })}
                  </div>
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
              icon: <FaCheckCircle className="text-2xl text-emerald-500" />,
              title: 'Tìm kiếm nâng cao',
              desc: 'Kết hợp vị trí, khoảng giá, đánh giá và tiện ích để lọc khách sạn sát nhu cầu hơn.',
            },
            {
              icon: <FaEnvelopeOpenText className="text-2xl text-blue-600" />,
              title: 'Guest mode và email mô phỏng',
              desc: 'Khách chưa có tài khoản vẫn đặt được phòng và nhận xác nhận giả lập ngay trên hệ thống.',
            },
            {
              icon: <FaShieldAlt className="text-2xl text-amber-500" />,
              title: 'Kiểm tra tồn phòng theo ngày',
              desc: 'Backend tính sẵn số phòng còn trống để tránh đặt vượt công suất thực tế.',
            },
          ].map((feature) => (
            <div key={feature.title} className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
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
                {activeFilterCount > 0
                  ? `Đang lọc theo ${activeFilterCount} nhóm điều kiện để tìm khách sạn phù hợp nhất.`
                  : 'Gợi ý các khách sạn nổi bật, sẵn sàng cho chuyến đi tiếp theo của bạn.'}
              </p>
            </div>

            {activeFilterCount > 0 && (
              <div className="rounded-2xl bg-blue-50 px-4 py-3 text-sm text-slate-600">
                {search.location ? `Vị trí: ${search.location}` : 'Tất cả vị trí'}
                {search.check_in && search.check_out ? ` • ${search.check_in} - ${search.check_out}` : ''}
                {search.min_rating ? ` • Từ ${search.min_rating} điểm` : ''}
              </div>
            )}
          </div>

          {activeAmenityLabels.length > 0 && (
            <div className="mb-6 flex flex-wrap gap-2">
              {activeAmenityLabels.map((label) => (
                <span
                  key={label}
                  className="rounded-full border border-blue-100 bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700"
                >
                  {label}
                </span>
              ))}
            </div>
          )}

          {!loading && hotDeals.length > 0 && (
            <div className="mb-10">
              <div className="mb-4">
                <h3 className="text-2xl font-bold text-slate-900">Hot deals hôm nay</h3>
                <p className="mt-1 text-sm text-slate-500">Ưu đãi nổi bật với mức giá tốt theo dữ liệu hiện tại</p>
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
              <p className="text-xl">Không tìm thấy khách sạn phù hợp với bộ lọc hiện tại</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
              {hotels.map((hotel) => (
                <HotelCard key={hotel._id} hotel={hotel} searchQuery={searchQuery} />
              ))}
            </div>
          )}

          {!loading && hotels.length > 0 && (
            <div className="mt-6 text-sm text-slate-500">
              Tìm thấy <span className="font-semibold text-slate-700">{hotels.length}</span> khách sạn phù hợp.
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
