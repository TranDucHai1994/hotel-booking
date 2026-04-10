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

function toBoolean(value) {
  return value === true || value === 1 || value === '1';
}

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
