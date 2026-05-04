
import { useEffect, useMemo, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import api from '../services/api';
import HotelCardPremium from '../components/HotelCardPremium';
import HeroSearchBar from '../components/HeroSearchBar';
import { formatCurrencyVND } from '../utils/format';
import { cn } from '../utils/cn';
import {
  CheckCircle,
  Mail,
  ShieldCheck,
  Hotel,
  ArrowRight,
  ChevronDown,
  Star,
  MapPin,
  Sparkles,
  Clock,
  BadgeCheck,
  Zap,
} from 'lucide-react';

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

/**
 * FIX: Destination chips now use a mapping from display name → DB city values.
 * Previously, the chips used Vietnamese diacritics (e.g. "Cần Thơ") but the DB
 * stores ASCII (e.g. "Can Tho"), so `.includes()` always failed.
 * "Sài Gòn" also needs to map to "Ho Chi Minh" which is a completely different string.
 */
const DESTINATIONS = [
  { label: 'Tất cả', dbValues: [] },
  { label: 'Cần Thơ', dbValues: ['Can Tho'] },
  { label: 'Phú Quốc', dbValues: ['Phu Quoc'] },
  { label: 'Đà Lạt', dbValues: ['Da Lat'] },
  { label: 'Đà Nẵng', dbValues: ['Da Nang'] },
  { label: 'Sài Gòn', dbValues: ['Ho Chi Minh'] },
];

const FILTER_OPTIONS = [
  { value: 'Pool', label: 'Có hồ bơi' },
  { value: 'Breakfast', label: 'Bữa sáng' },
  { value: 'Spa', label: 'Spa' },
  { value: 'Beachfront', label: 'Sát biển' },
];

const SORT_OPTIONS = [
  { value: 'popular', label: 'Phổ biến nhất' },
  { value: 'price_asc', label: 'Giá tăng dần' },
  { value: 'price_desc', label: 'Giá giảm dần' },
  { value: 'rating', label: 'Đánh giá cao nhất' },
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

/** Map API hotel data to HotelCardPremium props */
function mapHotelToCardProps(hotel) {
  const stars = Math.max(0, Math.min(5, Number(hotel.star_rating || 0)));
  const rating = hotel.average_rating ? Number(hotel.average_rating) : stars || 0;
  const imageSources = [hotel.cover_image, ...(hotel.images || [])].filter(Boolean);

  return {
    id: hotel._id,
    name: hotel.name,
    location: hotel.city || '',
    imageUrl: imageSources[0] || '',
    rating: rating,
    reviewCount: hotel.review_count || 0,
    pricePerNight: hotel.min_price || 0,
    amenities: (hotel.amenities || []).slice(0, 3),
    onSale: !!hotel.is_hot_deal,
    isFavorited: false,
  };
}

/* ── Skeleton Card ── */
function SkeletonCard() {
  return (
    <div
      className="flex flex-col rounded-card bg-surface shadow-card-default overflow-hidden"
      aria-hidden="true"
    >
      <div
        className="w-full animate-pulse bg-gray-200"
        style={{ aspectRatio: '16/9' }}
      />
      <div className="flex flex-col gap-3 p-4">
        <div className="h-4 w-3/4 animate-pulse rounded bg-gray-200" />
        <div className="h-3 w-1/2 animate-pulse rounded bg-gray-200" />
        <div className="h-3 w-2/3 animate-pulse rounded bg-gray-200" />
        <div className="flex gap-2">
          <div className="h-6 w-16 animate-pulse rounded-input bg-gray-200" />
          <div className="h-6 w-16 animate-pulse rounded-input bg-gray-200" />
          <div className="h-6 w-16 animate-pulse rounded-input bg-gray-200" />
        </div>
        <div className="h-4 w-1/3 animate-pulse rounded bg-gray-200 self-end" />
        <div className="h-10 w-full animate-pulse rounded-input bg-gray-200" />
      </div>
    </div>
  );
}

export default function Home() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const [hotels, setHotels] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState(() => readSearchState(searchParams));
  // FIX: Store the full destination object instead of just the label string
  const [activeDestination, setActiveDestination] = useState(DESTINATIONS[0]);
  const [activeFilters, setActiveFilters] = useState([]);
  const [sortValue, setSortValue] = useState('popular');

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

  const hotDeals = hotels.filter((hotel) => hotel.is_hot_deal).slice(0, 6);

  /**
   * FIX: Destination chip filtering now uses the dbValues array to do
   * a case-insensitive exact match against hotel.city.
   * Previously it used `.includes()` on the Vietnamese display label,
   * which never matched the ASCII city values in the DB.
   */
  const filteredHotels = useMemo(() => {
    let result = hotels;

    // Filter by destination chip using DB city values
    if (activeDestination.dbValues.length > 0) {
      const cityLower = activeDestination.dbValues.map((v) => v.toLowerCase());
      result = result.filter((h) =>
        cityLower.includes((h.city || '').toLowerCase())
      );
    }

    // Filter by amenity pills — case-insensitive comparison
    if (activeFilters.length > 0) {
      result = result.filter((h) => {
        const hotelAmenities = (h.amenities || []).map((a) => a.toLowerCase());
        return activeFilters.every((f) => hotelAmenities.includes(f.toLowerCase()));
      });
    }
    return result;
  }, [hotels, activeDestination, activeFilters]);

  // Sort hotels
  const sortedHotels = useMemo(() => {
    const list = [...filteredHotels];
    switch (sortValue) {
      case 'price_asc':
        list.sort((a, b) => (a.min_price || 0) - (b.min_price || 0));
        break;
      case 'price_desc':
        list.sort((a, b) => (b.min_price || 0) - (a.min_price || 0));
        break;
      case 'rating':
        list.sort((a, b) => (b.average_rating || 0) - (a.average_rating || 0));
        break;
      default:
        break;
    }
    return list;
  }, [filteredHotels, sortValue]);

 // Tìm hàm này trong file Home.js của bạn và cập nhật như sau:
const handleHeroSearch = ({ destination, checkIn, checkOut, guests, minPrice, maxPrice }) => {
  const next = {
    ...search,
    location: destination || search.location,
    check_in: checkIn || search.check_in,
    check_out: checkOut || search.check_out,
    min_price: minPrice || '', // Nhận thêm min_price từ HeroSearchBar
    max_price: maxPrice || '', // Nhận thêm max_price từ HeroSearchBar
  };
  setSearch(next);
  setSearchParams(buildSearchParams(next));
  setActiveDestination(DESTINATIONS[0]);
};

  const handleFilterToggle = (filterValue) => {
    setActiveFilters((prev) =>
      prev.includes(filterValue)
        ? prev.filter((f) => f !== filterValue)
        : [...prev, filterValue]
    );
  };

  const handleViewDetail = (hotelId) => {
    const url = searchQuery ? `/hotels/${hotelId}?${searchQuery}` : `/hotels/${hotelId}`;
    navigate(url);
  };

  const sectionTitle =
    activeDestination.dbValues.length > 0
      ? `Khách sạn nổi bật tại ${activeDestination.label}`
      : 'Khách sạn nổi bật';

  return (
    <div className="min-h-screen bg-background font-sans">
      {/* ══════════════════════════════════════════
          HERO SECTION — Photography-first with overlay
          ══════════════════════════════════════════ */}
      <section className="relative overflow-hidden text-white">
        {/* Background hotel photo */}
        <div className="absolute inset-0">
          <img
            src="https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?w=1920&q=80"
            alt=""
            className="h-full w-full object-cover"
            loading="eager"
          />
          {/* Layered gradient overlay for text readability */}
          <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/50 to-black/80" />
          <div className="absolute inset-0 bg-gradient-to-r from-blue-900/40 via-transparent to-blue-900/30" />
        </div>

        {/* Content */}
        <div className="relative px-4 pb-8 pt-4 lg:pb-6 lg:pt-4">
          <div className="mx-auto max-w-[1380px]">
            <div className="mx-auto max-w-4xl text-center">
              {/* Tagline pill 
              <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-5 py-2.5 text-sm font-medium backdrop-blur-md">
                <Sparkles size={16} className="text-yellow-400" />
                <span className="text-white/90">Hơn 51 khách sạn tại 8 thành phố Việt Nam</span>
              </div>
              */} 
              {/* Main headline — emotion-driven, benefit-focused */}
              <h1 className="mx-auto max-w-[600px] text-2x1 font-black leading-tight tracking-tight md:text-4xl lg:text-5xl">
                Kỳ nghỉ trong mơ{' '}
                <br className="hidden sm:block" />
                bắt đầu từ đây.{' '}
                <span
                  className="inline-block bg-clip-text text-transparent pb-2"
                  style={{
                    backgroundImage: 'linear-gradient(135deg, #fbbf24, #f59e0b, #fcd34d)',
                  }}
                >
                  Đặt phòng chỉ 2 phút.
                </span>
              </h1>

              {/* Supporting text — concise, benefit-focused */}
              <p className="mx-auto mt-5 max-w-2xl text-base leading-relaxed text-white/80 md:text-lg">
                So sánh giá, xem phòng trống theo ngày, lọc theo tiện ích — tìm được nơi ở ưng ý nhanh nhất.
              </p>

              {/* Trust stats row */}
              <div className="mt-7 flex flex-wrap items-center justify-center gap-6 text-sm">
                {[
                  { icon: <Hotel size={16} />, text: '51+ khách sạn' },
                  { icon: <MapPin size={16} />, text: '8 thành phố' },
                  { icon: <Star size={16} className="text-yellow-400" />, text: '4.5 ★ trung bình' },
                  { icon: <Zap size={16} className="text-emerald-400" />, text: 'Đặt ngay, xác nhận liền' },
                ].map((stat) => (
                  <div key={stat.text} className="flex items-center gap-2 text-white/80">
                    {stat.icon}
                    <span className="font-medium">{stat.text}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════
          FLOATING SEARCH BAR — overlaps hero/content boundary
          ══════════════════════════════════════════ */}
      <section className="-mt-0 px-4 relative z-0">
        <div className="mx-auto max-w-5xl">
          <HeroSearchBar onSearch={handleHeroSearch} />
        </div>
      </section>

      {/* ══════════════════════════════════════════
          TRUST BADGES — compact horizontal row
          ══════════════════════════════════════════ */}
      <section className="px-4 pt-4 pb-0">
        <div className="mx-auto max-w-[1380px]">
          <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-3">
            {[
              {
                icon: <BadgeCheck size={20} className="text-emerald-500" />,
                text: 'Xác nhận đặt phòng tức thì',
              },
              {
                icon: <ShieldCheck size={20} className="text-primary" />,
                text: 'Kiểm tra tồn phòng realtime',
              },
              {
                icon: <Clock size={20} className="text-amber-500" />,
                text: 'Hỗ trợ khách vãng lai (Guest mode)',
              },
              {
                icon: <Mail size={20} className="text-violet-500" />,
                text: 'Email xác nhận mô phỏng',
              },
            ].map((badge) => (
              <div key={badge.text} className="flex items-center gap-2 text-sm text-text-secondary">
                {badge.icon}
                <span className="font-medium">{badge.text}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════
          HOT DEALS SECTION (if any)
          ══════════════════════════════════════════ */}
      {/*
      {!loading && hotDeals.length > 0 && (
        <section className="px-4 pt-14">
          <div className="mx-auto max-w-[1380px]">
            <div className="mb-6 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-text-primary">🔥 Hot deals hôm nay</h2>
                <p className="mt-1 text-sm text-text-secondary">Ưu đãi nổi bật với mức giá tốt theo dữ liệu hiện tại</p>
              </div>
            </div>
  
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              {hotDeals.map((hotel) => (
                <HotelCardPremium
                  key={hotel._id}
                  {...mapHotelToCardProps(hotel)}
                  onViewDetail={handleViewDetail}
                />
              ))}
            </div>
          </div>
        </section>
      )}
    */}
      {/* ══════════════════════════════════════════
          MAIN LISTING SECTION
          ══════════════════════════════════════════ */}
      <section className="bg-background px-4 py-4 sm:py-12">
        <div className="mx-auto max-w-[1380px]">
          {/* Section header */}
          <div className="3 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-text-primary">{sectionTitle}</h2>
            <span className="flex items-center gap-1 text-sm text-primary">
              {!loading && `${sortedHotels.length} khách sạn`}
            </span>
          </div>

          {/* Destination chips */}
          <div className="mb-4 flex gap-2 overflow-x-auto pb-2" role="tablist" aria-label="Lọc theo điểm đến">
            {DESTINATIONS.map((dest) => {
              const isActive = activeDestination.label === dest.label;
              return (
                <button
                  key={dest.label}
                  role="tab"
                  aria-selected={isActive}
                  aria-label={`Lọc ${dest.label}`}
                  onClick={() => setActiveDestination(dest)}
                  className={cn(
                    'shrink-0 rounded-full px-4 py-2 text-sm font-medium',
                    'transition-colors duration-200',
                    isActive
                      ? 'bg-primary text-white'
                      : 'bg-hover-surface text-primary hover:bg-primary/10'
                  )}
                >
                  {dest.label}
                </button>
              );
            })}
          </div>

          {/* Filter & sort bar */}
          <div className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative">
              <label htmlFor="sort-select" className="sr-only">Sắp xếp</label>
              <select
                id="sort-select"
                value={sortValue}
                onChange={(e) => setSortValue(e.target.value)}
                aria-label="Sắp xếp kết quả"
                className={cn(
                  'appearance-none rounded-input border border-border bg-surface',
                  'py-2 pl-3 pr-9 text-sm text-text-primary outline-none',
                  'focus:border-primary focus:ring-1 focus:ring-primary/20',
                  'cursor-pointer'
                )}
              >
                {SORT_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    Sắp xếp: {opt.label}
                  </option>
                ))}
              </select>
              <ChevronDown
                size={14}
                className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-text-muted"
              />
            </div>

            <div className="flex flex-wrap gap-2">
              {FILTER_OPTIONS.map((filter) => {
                const isActive = activeFilters.includes(filter.value);
                return (
                  <button
                    key={filter.value}
                    onClick={() => handleFilterToggle(filter.value)}
                    aria-label={`Lọc: ${filter.label}`}
                    aria-pressed={isActive}
                    className={cn(
                      'rounded-full px-4 py-2 text-sm font-medium',
                      'transition-colors duration-200',
                      isActive
                        ? 'bg-primary text-white'
                        : 'bg-hover-surface text-primary hover:bg-primary/10'
                    )}
                  >
                    {filter.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Card grid / Skeleton / Empty state */}
          {loading ? (
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {[...Array(6)].map((_, i) => (
                <SkeletonCard key={i} />
              ))}
            </div>
          ) : sortedHotels.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-card border border-dashed border-text-muted/30 bg-surface py-20 text-center">
              <Hotel size={48} className="mb-4 text-text-muted/30" />
              <p className="text-lg font-semibold text-text-secondary">
                Không tìm thấy khách sạn phù hợp
              </p>
              <p className="mt-2 text-sm text-text-muted">
                Hãy thử thay đổi bộ lọc hoặc chọn điểm đến khác.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {sortedHotels.map((hotel) => (
                <HotelCardPremium
                  key={hotel._id}
                  {...mapHotelToCardProps(hotel)}
                  onViewDetail={handleViewDetail}
                />
              ))}
            </div>
          )}

          {!loading && sortedHotels.length > 0 && (
            <div className="mt-6 text-center text-sm text-text-secondary">
              Tìm thấy <span className="font-semibold text-text-primary">{sortedHotels.length}</span> khách sạn phù hợp.
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
