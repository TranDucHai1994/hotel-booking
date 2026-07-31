/**
 * sql.js
 * Chứa các hàm tiện ích hỗ trợ định dạng dữ liệu và tạo chuỗi truy vấn SQL an toàn.
 */
/**
 * Sinh chuỗi placeholder cho mệnh đề SQL "IN (...)" cùng object tham số tương ứng,
 * dùng để truyền mảng giá trị vào câu query một cách an toàn (chống SQL Injection)
 * thay vì nối chuỗi trực tiếp giá trị vào câu SQL.
 * Lưu ý: nếu values rỗng, clause trả về là 'NULL' để câu WHERE ... IN (NULL) luôn false,
 * tránh lỗi cú pháp SQL khi mảng đầu vào không có phần tử nào.
 *
 * Ví dụ:
 *   buildInClause([12, 15], 'roomId')
 *   // => { clause: '@roomId0, @roomId1', params: { roomId0: 12, roomId1: 15 } }
 *   // Dùng trong query: `SELECT * FROM Rooms WHERE id IN (${clause})`, params
 *
 *   buildInClause([], 'roomId')
 *   // => { clause: 'NULL', params: {} }
 */
function buildInClause(values = [], prefix = 'item') {
  const params = {};
  const placeholders = values.map((value, index) => {
    const key = `${prefix}${index}`;
    params[key] = value;
    return `@${key}`;
  });

  return {
    clause: placeholders.length > 0 ? placeholders.join(', ') : 'NULL',
    params,
  };
}

/**
 * Parse một giá trị (thường là chuỗi JSON lưu trong DB, ví dụ cột amenities/images)
 * thành mảng JavaScript. Luôn trả về mảng, không bao giờ throw lỗi.
 * Lưu ý: nếu value đã là mảng thì trả về nguyên vẹn; nếu parse JSON lỗi hoặc
 * kết quả parse không phải mảng thì trả về mảng rỗng thay vì ném exception.
 *
 * Ví dụ:
 *   parseJsonArray('["wifi","pool"]') // => ['wifi', 'pool']
 *   parseJsonArray(['wifi', 'pool'])  // => ['wifi', 'pool']
 *   parseJsonArray(null)              // => []
 *   parseJsonArray('not-json')        // => []
 */
function parseJsonArray(value) {
  if (Array.isArray(value)) {
    return value;
  }

  if (!value) {
    return [];
  }

  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * Chuẩn hóa một giá trị thành mảng chuỗi không rỗng, đã trim khoảng trắng.
 * Hỗ trợ 2 dạng đầu vào: mảng có sẵn, hoặc chuỗi phân tách bởi dấu phẩy (CSV).
 * Lưu ý: các phần tử rỗng sau khi trim sẽ bị loại bỏ khỏi kết quả.
 *
 * Ví dụ:
 *   normalizeStringArray('wifi, pool, ,spa')  // => ['wifi', 'pool', 'spa']
 *   normalizeStringArray(['wifi', ' pool '])  // => ['wifi', 'pool']
 *   normalizeStringArray(undefined)           // => []
 */
function normalizeStringArray(value) {
  if (Array.isArray(value)) {
    return value.map((item) => String(item || '').trim()).filter(Boolean);
  }

  if (typeof value === 'string') {
    return value
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
  }

  return [];
}

/**
 * Chuyển giá trị lấy từ DB (bit/số/chuỗi) sang boolean.
 * Lưu ý: chỉ coi true khi value là true, 1, hoặc '1'; mọi giá trị khác (kể cả '0', null) đều là false.
 *
 * Ví dụ:
 *   toBoolean(1)      // => true   (bit column trả về 1 khi lưu true)
 *   toBoolean('1')    // => true
 *   toBoolean(0)      // => false
 *   toBoolean(null)   // => false
 */
function toBoolean(value) {
  return value === true || value === 1 || value === '1';
}

/**
 * Chuyển giá trị bất kỳ sang số hợp lệ, trả về fallback nếu không parse được.
 * Lưu ý: dùng Number.isFinite để loại cả NaN và Infinity, không chỉ NaN.
 *
 * Ví dụ:
 *   toNumber('150000')       // => 150000
 *   toNumber(null, 2)        // => 2 (fallback)
 *   toNumber('abc', 0)       // => 0 (fallback vì parse ra NaN)
 */
function toNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

module.exports = {
  buildInClause,
  normalizeStringArray,
  parseJsonArray,
  toBoolean,
  toNumber,
};
