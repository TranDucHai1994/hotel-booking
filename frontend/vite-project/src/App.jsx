import { useState } from 'react'
import './App.css'

function App() {
  const [price, setPrice] = useState("");

  return (
    <div className="page-container">
      {/* Thanh tìm kiếm tổng thể */}
      <div className="search-wrapper">
        
        {/* 1. Điểm đến */}
        <div className="search-section">
          <div className="icon-container">📍</div>
          <div className="info-box">
            <span className="label">ĐIỂM ĐẾN</span>
            <input type="text" placeholder="Bạn muốn đi đâu?" className="input-field" />
          </div>
        </div>

        {/* 2. Nhận phòng */}
        <div className="search-section">
          <div className="icon-container">📅</div>
          <div className="info-box">
            <span className="label">NHẬN PHÒNG</span>
            <input type="text" placeholder="mm/dd/yyyy" className="input-field" />
          </div>
        </div>

        {/* 3. Trả phòng */}
        <div className="search-section">
          <div className="icon-container">📅</div>
          <div className="info-box">
            <span className="label">TRẢ PHÒNG</span>
            <input type="text" placeholder="mm/dd/yyyy" className="input-field" />
          </div>
        </div>

        {/* 4. Số khách */}
        <div className="search-section">
          <div className="icon-container">👥</div>
          <div className="info-box">
            <span className="label">SỐ KHÁCH</span>
            <input type="number" defaultValue="1" className="input-field guest-input" />
          </div>
        </div>

        {/* 5. MỤC MỚI: GIÁ PHÒNG */}
        <div className="search-section no-line">
          <div className="icon-container">💰</div>
          <div className="info-box">
            <span className="label">GIÁ PHÒNG</span>
            <select 
              value={price} 
              onChange={(e) => setPrice(e.target.value)} 
              className="input-field select-field"
            >
              <option value="">Chọn giá</option>
              <option value="1">Dưới 1 triệu</option>
              <option value="2">1 - 3 triệu</option>
              <option value="3">Trên 3 triệu</option>
            </select>
          </div>
        </div>

        {/* Nút Tìm kiếm */}
        <button className="btn-search-main">
          <span className="search-icon-svg">🔍</span>
          Tìm kiếm
        </button>

      </div>
    </div>
  )
}

export default App