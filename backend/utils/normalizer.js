/**
 * =====================================================
 * NORMALIZER
 * =====================================================
 */

const NORMALIZERS = {

  email(value) {
    return String(value || "")
      .trim()
      .toLowerCase();
  },

  fullname(value) {
    return String(value || "")
      .trim()
      .replace(/\s+/g, " ");
  },

  role(value) {
    return String(value || "EMPLOYEE")
      .trim()
      .toUpperCase();
  },

  status(value) {
    return String(value || "ACTIVE")
      .trim()
      .toUpperCase();
  },

  shift_name(value) {
    return String(value || "")
      .trim()
      .toUpperCase();
  },

  department_name(value) {
    return String(value || "")
      .trim()
      .replace(/\s+/g, " ");
  }
};

function normalizeRecord(record = {}) {

  const data = { ...record };

  Object.keys(data).forEach(key => {

    const normalizer = NORMALIZERS[key];

    if (typeof normalizer === "function") {
      data[key] = normalizer(data[key]);
    }

  });

  return data;
}