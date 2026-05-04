/**
 * HotelListingSection — Full listing grid with destination chips, filter/sort bar,
 * card grid, skeleton loader, and "load more" button.
 *
 * Key design decisions:
 * - Destination chips scroll horizontally on overflow so the bar never wraps
 * - Filter pills mirror the chip visual language for consistency
 * - 6-card skeleton grid uses pulse animation for perceived performance
 * - Load-more button is outlined to keep the page feeling light
 * - 3→2→1 column breakpoints balance density and breathing room
 */

import { useState } from 'react';
import { ChevronDown, ArrowRight } from 'lucide-react';
import HotelCardPremium from './HotelCardPremium';
import { cn } from '../utils/cn';

const DESTINATIONS = ['Tất cả', 'Cần Thơ', 'Phú Quốc', 'Đà Lạt', 'Đà Nẵng', 'Sài Gòn'];
const FILTER_OPTIONS = [
  { value: 'pool', label: 'Có hồ bơi' },
  { value: 'breakfast', label: 'Bữa sáng' },
  { value: 'free_cancel', label: 'Miễn phí huỷ' },
  { value: 'pets', label: 'Thú cưng' },
];
const SORT_OPTIONS = [
  { value: 'popular', label: 'Phổ biến nhất' },
  { value: 'price_asc', label: 'Giá tăng dần' },
  { value: 'price_desc', label: 'Giá giảm dần' },
  { value: 'rating', label: 'Đánh giá cao nhất' },
];

/**
 * @typedef {Object} HotelListingSectionProps
 * @property {Array} hotels - array of HotelCardPremium props
 * @property {boolean} isLoading
 * @property {string} activeDestination
 * @property {function} onDestinationChange
 * @property {function} onSortChange
 * @property {function} onFilterChange
 * @property {function} [onLoadMore]
 * @property {boolean} [hasMore]
 */

export default function HotelListingSection({
  hotels = [],
  isLoading = false,
  activeDestination = 'Tất cả',
  onDestinationChange,
  onSortChange,
  onFilterChange,
  onLoadMore,
  hasMore = false,
}) {
  const [activeFilters, setActiveFilters] = useState([]);
  const [sortValue, setSortValue] = useState('popular');

  const handleFilterToggle = (filterValue) => {
    const next = activeFilters.includes(filterValue)
      ? activeFilters.filter((f) => f !== filterValue)
      : [...activeFilters, filterValue];
    setActiveFilters(next);
    onFilterChange?.(next);
  };

  const handleSortChange = (e) => {
    const value = e.target.value;
    setSortValue(value);
    onSortChange?.(value);
  };

  const sectionTitle =
    activeDestination && activeDestination !== 'Tất cả'
      ? `Khách sạn nổi bật tại ${activeDestination}`
      : 'Khách sạn nổi bật';

  return (
    <section className="bg-background px-4 py-12 sm:py-16">
      <div className="mx-auto max-w-[1380px]">
        {/* ── Section header ── */}
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-text-primary">{sectionTitle}</h2>
          <a
            href="#all"
            className="flex items-center gap-1 text-sm text-primary transition-colors hover:text-primary-700"
            aria-label="Xem tất cả khách sạn"
          >
            Xem tất cả
            <ArrowRight size={14} />
          </a>
        </div>

        {/* ── Destination chips (horizontal scroll) ── */}
        <div className="mb-6 flex gap-2 overflow-x-auto pb-2 scrollbar-hide" role="tablist" aria-label="Lọc theo điểm đến">
          {DESTINATIONS.map((dest) => {
            const isActive = activeDestination === dest;
            return (
              <button
                key={dest}
                role="tab"
                aria-selected={isActive}
                aria-label={`Lọc ${dest}`}
                onClick={() => onDestinationChange?.(dest)}
                className={cn(
                  'shrink-0 rounded-full px-4 py-2 text-sm font-medium',
                  'transition-colors duration-200',
                  isActive
                    ? 'bg-primary text-white'
                    : 'bg-hover-surface text-primary hover:bg-primary/10'
                )}
              >
                {dest}
              </button>
            );
          })}
        </div>

        {/* ── Filter & sort bar ── */}
        <div className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          {/* Sort dropdown */}
          <div className="relative">
            <label htmlFor="sort-select" className="sr-only">Sắp xếp</label>
            <select
              id="sort-select"
              value={sortValue}
              onChange={handleSortChange}
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

          {/* Filter pills */}
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

        {/* ── Card grid / Skeleton ── */}
        {isLoading ? (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {[...Array(6)].map((_, i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        ) : hotels.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-card border border-dashed border-text-muted/30 bg-surface py-20 text-center">
            <p className="text-lg font-semibold text-text-secondary">
              Không tìm thấy khách sạn phù hợp
            </p>
            <p className="mt-2 text-sm text-text-muted">
              Hãy thử thay đổi bộ lọc hoặc chọn điểm đến khác.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {hotels.map((hotel) => (
              <HotelCardPremium key={hotel.id} {...hotel} />
            ))}
          </div>
        )}

        {/* ── Load more ── */}
        {!isLoading && hasMore && hotels.length > 0 && (
          <div className="mt-10 flex justify-center">
            <button
              onClick={onLoadMore}
              aria-label="Tải thêm khách sạn"
              className={cn(
                'rounded-input border border-primary px-8 py-2.5',
                'text-sm font-semibold text-primary',
                'transition-colors duration-200 hover:bg-hover-surface',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50'
              )}
            >
              Xem thêm
            </button>
          </div>
        )}
      </div>
    </section>
  );
}

/* ── Skeleton Card ── */
function SkeletonCard() {
  return (
    <div
      className="flex flex-col rounded-card bg-surface shadow-card-default overflow-hidden"
      aria-hidden="true"
    >
      {/* Image placeholder */}
      <div
        className="w-full animate-pulse bg-gray-200"
        style={{ aspectRatio: '16/9' }}
      />
      {/* Content placeholder */}
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
