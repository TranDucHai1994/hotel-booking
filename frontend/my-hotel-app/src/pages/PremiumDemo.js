/**
 * Demo page showcasing HeroSearchBar, HotelCardPremium, and HotelListingSection
 * with realistic Vietnamese hotel data. Import this into App.js as a route to preview.
 */

import { useState, useCallback } from 'react';
import HeroSearchBar from '../components/HeroSearchBar';
import HotelListingSection from '../components/HotelListingSection';

const SAMPLE_HOTELS = [
  {
    id: '1',
    name: 'Vinpearl Resort & Spa Phú Quốc',
    location: 'Phú Quốc, Kiên Giang',
    imageUrl: 'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=640&q=80',
    rating: 4.8,
    reviewCount: 324,
    pricePerNight: 2850000,
    amenities: ['Hồ bơi', 'Spa', 'Sát biển'],
    onSale: true,
    isFavorited: false,
  },
  {
    id: '2',
    name: 'Mường Thanh Luxury Đà Nẵng',
    location: 'Đà Nẵng',
    imageUrl: 'https://images.unsplash.com/photo-1582719508461-905c673771fd?w=640&q=80',
    rating: 4.5,
    reviewCount: 189,
    pricePerNight: 1450000,
    amenities: ['WiFi', 'Bữa sáng', 'Gym'],
    onSale: false,
    isFavorited: true,
  },
  {
    id: '3',
    name: 'Ana Mandara Villas Đà Lạt Resort & Spa',
    location: 'Đà Lạt, Lâm Đồng',
    imageUrl: 'https://images.unsplash.com/photo-1551882547-ff40c63fe5fa?w=640&q=80',
    rating: 4.6,
    reviewCount: 215,
    pricePerNight: 3200000,
    amenities: ['Spa', 'Nhà hàng', 'Golf'],
    onSale: true,
    isFavorited: false,
  },
  {
    id: '4',
    name: 'Hotel Nikko Saigon',
    location: 'Quận 1, TP. Hồ Chí Minh',
    imageUrl: 'https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?w=640&q=80',
    rating: 4.3,
    reviewCount: 412,
    pricePerNight: 1980000,
    amenities: ['Hồ bơi', 'Gym', 'Bar'],
    onSale: false,
    isFavorited: false,
  },
  {
    id: '5',
    name: 'Victoria Cần Thơ Resort',
    location: 'Cần Thơ',
    imageUrl: 'https://images.unsplash.com/photo-1571003123894-1f0594d2b5d9?w=640&q=80',
    rating: 4.4,
    reviewCount: 156,
    pricePerNight: 1650000,
    amenities: ['Hồ bơi', 'Spa', 'Nhà hàng'],
    onSale: false,
    isFavorited: true,
  },
  {
    id: '6',
    name: 'InterContinental Phú Quốc Long Beach Resort',
    location: 'Phú Quốc, Kiên Giang',
    imageUrl: 'https://images.unsplash.com/photo-1564501049412-61c2a3083791?w=640&q=80',
    rating: 4.9,
    reviewCount: 538,
    pricePerNight: 4500000,
    amenities: ['Sát biển', 'Spa', 'Bữa sáng'],
    onSale: true,
    isFavorited: false,
  },
];

export default function PremiumDemo() {
  const [activeDestination, setActiveDestination] = useState('Tất cả');
  const [isLoading, setIsLoading] = useState(false);

  const handleSearch = useCallback((params) => {
    console.log('Search:', params);
    setIsLoading(true);
    setTimeout(() => setIsLoading(false), 1500);
  }, []);

  return (
    <div className="min-h-screen bg-background font-sans">
      {/* ── Hero section ── */}
      <section className="relative bg-text-primary px-4 pb-24 pt-20">
        <div className="absolute inset-0 bg-gradient-to-br from-black/60 to-black/30" />
        <div className="relative mx-auto max-w-4xl text-center">
          <h1 className="text-2xl font-bold text-white sm:text-4xl">
            Khám phá khách sạn tuyệt vời
            <span className="block text-primary-100 mt-2 text-lg sm:text-xl font-normal">
              Cần Thơ · Phú Quốc · Đà Lạt · Đà Nẵng · Sài Gòn
            </span>
          </h1>
        </div>
        <div className="relative mx-auto mt-10 max-w-4xl">
          <HeroSearchBar onSearch={handleSearch} />
        </div>
      </section>

      {/* ── Listing section ── */}
      <HotelListingSection
        hotels={SAMPLE_HOTELS}
        isLoading={isLoading}
        activeDestination={activeDestination}
        onDestinationChange={setActiveDestination}
        onSortChange={(v) => console.log('Sort:', v)}
        onFilterChange={(f) => console.log('Filters:', f)}
        onLoadMore={() => console.log('Load more')}
        hasMore={true}
      />
    </div>
  );
}
