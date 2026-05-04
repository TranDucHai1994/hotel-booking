/**
 * HotelCardPremium — Photography-first hotel card inspired by Airbnb 2024.
 *
 * Key design decisions:
 * - 16:9 aspect-ratio locks the image height, preventing layout shift
 * - Subtle scale + shadow lift on hover keeps the card feeling lightweight
 * - Price in warm orange (#FF6B2C) draws the eye without being aggressive
 * - Amenity chips use the hover-surface/primary color pair for visual cohesion
 * - Heart toggle uses CSS transitions — no animation library needed
 */

import { useState } from 'react';
import { Heart, MapPin, Star } from 'lucide-react';
import { cn } from '../utils/cn';
import { formatCurrencyVND } from '../utils/format';

/**
 * @typedef {Object} HotelCardPremiumProps
 * @property {string} id
 * @property {string} name
 * @property {string} location
 * @property {string} imageUrl
 * @property {number} rating
 * @property {number} reviewCount
 * @property {number} pricePerNight
 * @property {string[]} amenities
 * @property {boolean} onSale
 * @property {boolean} isFavorited
 * @property {function} [onFavoriteToggle]
 * @property {function} [onViewDetail]
 */

export default function HotelCardPremium({
  id,
  name,
  location,
  imageUrl,
  rating = 0,
  reviewCount = 0,
  pricePerNight,
  amenities = [],
  onSale = false,
  isFavorited: isFavoritedProp = false,
  onFavoriteToggle,
  onViewDetail,
}) {
  const [favorited, setFavorited] = useState(isFavoritedProp);

  const handleFavorite = (e) => {
    e.stopPropagation();
    e.preventDefault();
    const next = !favorited;
    setFavorited(next);
    onFavoriteToggle?.(id, next);
  };

  const handleViewDetail = () => {
    onViewDetail?.(id);
  };

  // Build star array: filled, half, or empty
  const fullStars = Math.floor(rating);
  const hasHalfStar = rating - fullStars >= 0.25 && rating - fullStars < 0.75;
  const emptyStars = 5 - fullStars - (hasHalfStar ? 1 : 0);

  return (
    <article
      className={cn(
        'group flex flex-col rounded-card bg-surface',
        'shadow-card-default transition-all duration-200 ease-out',
        'hover:scale-[1.015] hover:shadow-card-hover',
        'max-w-full cursor-pointer'
      )}
      onClick={handleViewDetail}
      role="button"
      tabIndex={0}
      aria-label={`Xem chi tiết ${name}`}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') handleViewDetail();
      }}
    >
      {/* ── Image Area ── */}
      <div className="relative overflow-hidden rounded-t-card">
        <img
          src={imageUrl}
          alt={name}
          className="w-full object-cover"
          style={{ aspectRatio: '16/9' }}
          loading="lazy"
        />

        {/* Heart button */}
        <button
          onClick={handleFavorite}
          aria-label={favorited ? 'Bỏ yêu thích' : 'Thêm vào yêu thích'}
          className={cn(
            'absolute right-3 top-3 flex h-8 w-8 items-center justify-center',
            'rounded-full bg-white/90 shadow-md backdrop-blur-sm',
            'transition-colors duration-200'
          )}
        >
          <Heart
            size={16}
            className={cn(
              'transition-colors duration-200',
              favorited
                ? 'fill-sale-badge stroke-sale-badge'
                : 'fill-none stroke-text-secondary'
            )}
          />
        </button>

        {/* Sale badge */}
        {onSale && (
          <span className="absolute left-3 top-3 rounded-input bg-sale-badge px-2.5 py-0.5 text-2xs font-semibold text-white">
            SALE
          </span>
        )}
      </div>

      {/* ── Info Area ── */}
      <div className="flex flex-1 flex-col p-4">
        {/* Property name */}
        <h3 className="line-clamp-2 text-[15px] font-semibold leading-snug text-text-primary">
          {name}
        </h3>

        {/* Location row */}
        <div className="mt-1.5 flex items-center gap-1 truncate">
          <MapPin size={12} className="shrink-0 text-text-muted" />
          <span className="truncate text-xs text-text-secondary">{location}</span>
        </div>

        {/* Rating row */}
        <div className="mt-2 flex items-center gap-1.5">
          <div className="flex items-center gap-px" aria-label={`Đánh giá ${rating} trên 5 sao`}>
            {[...Array(fullStars)].map((_, i) => (
              <Star key={`f-${i}`} size={12} className="fill-star stroke-star" />
            ))}
            {hasHalfStar && (
              <span className="relative inline-block h-3 w-3">
                <Star size={12} className="absolute inset-0 fill-none stroke-star" />
                <span className="absolute inset-0 overflow-hidden" style={{ width: '50%' }}>
                  <Star size={12} className="fill-star stroke-star" />
                </span>
              </span>
            )}
            {[...Array(emptyStars)].map((_, i) => (
              <Star key={`e-${i}`} size={12} className="fill-none stroke-text-muted" />
            ))}
          </div>
          <span className="text-xs font-bold text-text-primary">{rating.toFixed(1)}</span>
          <span className="text-xs text-text-muted">({reviewCount})</span>
        </div>

        {/* Amenity chips */}
        {amenities.length > 0 && (
          <div className="mt-3 flex items-center gap-1.5 overflow-hidden">
            {amenities.slice(0, 3).map((amenity) => (
              <span
                key={amenity}
                className="shrink-0 rounded-input bg-hover-surface px-2.5 py-1 text-2xs text-primary"
              >
                {amenity}
              </span>
            ))}
          </div>
        )}

        {/* Price row */}
        <div className="mt-3 flex items-baseline justify-end gap-1">
          <span className="text-xs text-text-muted">Từ</span>
          <span className="text-base font-bold text-price-accent">
            {formatCurrencyVND(pricePerNight)}
          </span>
          <span className="text-xs text-text-muted">/đêm</span>
        </div>

        {/* CTA */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            handleViewDetail();
          }}
          aria-label={`Xem chi tiết ${name}`}
          className={cn(
            'mt-3 w-full rounded-input bg-primary py-2.5 text-sm font-semibold text-white',
            'transition-colors duration-200 hover:bg-primary-600',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50'
          )}
        >
          Xem chi tiết
        </button>
      </div>
    </article>
  );
}
