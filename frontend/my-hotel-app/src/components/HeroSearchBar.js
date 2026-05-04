
import React, { useState } from 'react';
import { MapPin, Calendar, Users, Search, Banknote } from 'lucide-react'; // Thêm Banknote icon

const HeroSearchBar = ({ onSearch }) => {
  const [destination, setDestination] = useState('');
  const [checkIn, setCheckIn] = useState('');
  const [checkOut, setCheckOut] = useState('');
  const [guests, setGuests] = useState(1);
  const [priceRange, setPriceRange] = useState(''); // State cho giá phòng

  const handleSearchClick = () => {
    let minPrice = '';
    let maxPrice = '';
    
    if (priceRange) {
      const parts = priceRange.split('-');
      minPrice = parts[0];
      maxPrice = parts[1] || '';
    }

    onSearch({
      destination,
      checkIn,
      checkOut,
      guests,
      minPrice,
      maxPrice
    });
  };

  return (
    <div className="flex flex-col md:flex-row items-center bg-white p-0 rounded-xl shadow-lg border border-gray-100 w-full max-w-5xl mx-auto">
      
      {/* 1. Điểm đến */}
      <div className="flex items-center px-4 py-2 border-b md:border-b-0 md:border-r border-gray-100 flex-1 w-full">
        <div className="p-2 bg-blue-50 rounded-lg mr-3 text-blue-600">
          <MapPin size={20} />
        </div>
        <div className="flex flex-col w-full">
          <span className="text-[10px] font-bold text-gray-400 uppercase">Điểm đến</span>
          <input
            type="text"
            placeholder="Bạn muốn đi đâu?"
            className="text-sm font-semibold text-gray-700 outline-none bg-transparent"
            value={destination}
            onChange={(e) => setDestination(e.target.value)}
          />
        </div>
      </div>

      {/* 2. Nhận phòng */}
      <div className="flex items-center px-4 py-2 border-b md:border-b-0 md:border-r border-gray-100 flex-1 w-full">
        <div className="p-2 bg-blue-50 rounded-lg mr-3 text-blue-600">
          <Calendar size={20} />
        </div>
        <div className="flex flex-col w-full">
          <span className="text-[10px] font-bold text-gray-400 uppercase">Nhận phòng</span>
          <input
            type="date"
            className="text-sm font-semibold text-gray-700 outline-none bg-transparent"
            value={checkIn}
            onChange={(e) => setCheckIn(e.target.value)}
          />
        </div>
      </div>

      {/* 3. Trả phòng */}
      <div className="flex items-center px-4 py-2 border-b md:border-b-0 md:border-r border-gray-100 flex-1 w-full">
        <div className="p-2 bg-blue-50 rounded-lg mr-3 text-blue-600">
          <Calendar size={20} />
        </div>
        <div className="flex flex-col w-full">
          <span className="text-[10px] font-bold text-gray-400 uppercase">Trả phòng</span>
          <input
            type="date"
            className="text-sm font-semibold text-gray-700 outline-none bg-transparent"
            value={checkOut}
            onChange={(e) => setCheckOut(e.target.value)}
          />
        </div>
      </div>

      {/* 4. Số khách */}
      <div className="flex items-center px-4 py-2 border-b md:border-b-0 md:border-r border-gray-100 w-full md:w-32">
        <div className="p-2 bg-blue-50 rounded-lg mr-3 text-blue-600">
          <Users size={20} />
        </div>
        <div className="flex flex-col">
          <span className="text-[10px] font-bold text-gray-400 uppercase">Khách</span>
          <input
            type="number"
            min="1"
            className="text-sm font-semibold text-gray-700 outline-none bg-transparent w-full"
            value={guests}
            onChange={(e) => setGuests(e.target.value)}
          />
        </div>
      </div>

      {/* 5. GIÁ PHÒNG - MỤC MỚI THÊM VÀO */}
      <div className="flex items-center px-4 py-2 border-b md:border-b-0 md:border-r border-gray-100 flex-1 w-full">
        <div className="p-2 bg-blue-50 rounded-lg mr-3 text-blue-600">
          <Banknote size={20} />
        </div>
        <div className="flex flex-col w-full">
          <span className="text-[10px] font-bold text-gray-400 uppercase">Giá phòng</span>
          <select
            className="text-sm font-semibold text-gray-700 outline-none bg-transparent cursor-pointer"
            value={priceRange}
            onChange={(e) => setPriceRange(e.target.value)}
          >
            <option value="">Tất cả giá</option>
            <option value="0-1000000">Dưới 1 triệu</option>
            <option value="1000000-3000000">1 - 3 triệu</option>
            <option value="3000000-5000000">3 - 5 triệu</option>
            <option value="5000000">Trên 5 triệu</option>
          </select>
        </div>
      </div>

      {/* Nút Tìm kiếm */}
      <div className="p-2 w-full md:w-auto">
        <button
          onClick={handleSearchClick}
          className="w-full md:w-auto flex flex-row items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-xl font-bold transition-all shadow-lg shadow-blue-200 whitespace-nowrap"
        >
          <Search size={18} />
          <span>Tìm kiếm</span>
        </button>
      </div>

    </div>
  );
};

export default HeroSearchBar;