function toSafeString(value) {
  return value === null || value === undefined ? "" : String(value);
}

function normalizeTrimmedString(value) {
  return toSafeString(value).trim();
}

function normalizeSingleLineText(value) {
  return normalizeTrimmedString(value).replace(/\s+/g, " ");
}

function normalizeUpperString(value, fallback = "") {
  const v = normalizeTrimmedString(value);
  return (v || fallback).toUpperCase();
}

function normalizeLowerString(value, fallback = "") {
  const v = normalizeTrimmedString(value);
  return (v || fallback).toLowerCase();
}

function normalizeNullableString(value) {
  return normalizeTrimmedString(value) || "";
}

function normalizeInteger(value, fallback = 0) {
  if (value === null || value === undefined || value === "") {
    return fallback;
  }

  const num = Number(value);
  return Number.isFinite(num) ? Math.trunc(num) : fallback;
}

// function normalizeNullableInteger(value) {
//   if (value === null || value === undefined || value === "") {
//     return null;
//   }

//   const num = Number(value);
//   return Number.isFinite(num) ? Math.trunc(num) : null;
// }

function normalizeNonNegativeInteger(value, fallback = 0) {
  if (value === null || value === undefined || value === "") {
    return fallback;
  }

  const num = Number(value);

  if (!Number.isFinite(num)) {
    return fallback;
  }

  return Math.max(0, Math.trunc(num));
}

function normalizeNullableNonNegativeInteger(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const num = Number(value);

  if (!Number.isFinite(num)) {
    return null;
  }

  return Math.max(0, Math.trunc(num));
}

function normalizeFloat(value, fallback = 0) {
  if (value === null || value === undefined || value === "") {
    return fallback;
  }

  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

function normalizeNullableFloat(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

function normalizeBoolean(value, fallback = false) {
  if (typeof value === "boolean") {
    return value;
  }

  if (value === null || value === undefined || value === "") {
    return fallback;
  }

  const v = String(value).trim().toLowerCase();

  if (["true", "1", "yes", "y", "on"].includes(v)) return true;
  if (["false", "0", "no", "n", "off"].includes(v)) return false;

  return fallback;
}

function normalizeNullableBoolean(value) {
  if (typeof value === "boolean") {
    return value;
  }

  if (value === null || value === undefined || value === "") {
    return null;
  }

  const v = String(value).trim().toLowerCase();

  if (["true", "1", "yes", "y", "on"].includes(v)) return true;
  if (["false", "0", "no", "n", "off"].includes(v)) return false;

  return null;
}

/**
 * Returns ISO string if valid date-like input, else "".
 */
function normalizeIsoDateTime(value) {
  if (!value) {
    return "";
  }

  if (value instanceof Date) {
    return isNaN(value.getTime()) ? "" : value.toISOString();
  }

  const d = new Date(value);
  return isNaN(d.getTime()) ? "" : d.toISOString();
}

/**
 * Returns yyyy-MM-dd if valid date-like input, else "".
 * Uses local date parts from Date object.
 */
function normalizeDateKey(value) {
  if (!value) return "";

  const d = value instanceof Date ? value : new Date(value);

  if (isNaN(d.getTime())) return "";

  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

/**
 * Returns HH:mm if input looks like a valid time-ish string.
 * If not parseable, returns trimmed original string.
 */
function normalizeTimeString(value) {
  const raw = normalizeTrimmedString(value);

  if (!raw) {
    return "";
  }

  const match = raw.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);

  if (!match) {
    return raw;
  }

  const hh = Number(match[1]);
  const mm = Number(match[2]);

  if (!Number.isFinite(hh) || !Number.isFinite(mm)) {
    return raw;
  }

  if (hh < 0 || hh > 23 || mm < 0 || mm > 59) {
    return raw;
  }

  return String(hh).padStart(2, "0") + ":" + String(mm).padStart(2, "0");
}

/**
 * Generic ID normalizer
 * - trim only
 * - preserve case
 */
function normalizeId(value) {
  return normalizeTrimmedString(value);
}

/* =====================================================
 * DOMAIN ENUM NORMALIZERS
 * ===================================================== */

function normalizeRole(input) {
  const raw = String(input || "")
    .trim()
    .toLowerCase();

  switch (raw) {
    case "superadmin":
    case "super_admin":
      return ROLES.SUPERADMIN;

    case "owner":
      return ROLES.ADMIN;

    case "admin":
      return ROLES.ADMIN;

    case "hr":
      return ROLES.HR;

    case "employee":
    case "user":
      return ROLES.USER;

    default:
      return ROLES.USER;
  }
}

function normalizeStatus(value) {
  return normalizeUpperString(value || "ACTIVE", "ACTIVE");
}

function normalizeTimeLogAction(value) {
  return normalizeLowerString(value);
}

function normalizeLocationStatus(value) {
  return normalizeUpperString(value || "UNAVAILABLE", "UNAVAILABLE");
}

function normalizeAttendanceStatus(value) {
  return normalizeUpperString(value || "NOT_STARTED", "NOT_STARTED");
}

/* =====================================================
 * SHARED NORMALIZERS MAP
 * ===================================================== */

const NORMALIZERS = {
  /* ---------------------------------
   * CORE IDENTITY / USER / WORKSPACE
  --------------------------------- */
  user_id(value) {
    return normalizeId(value);
  },

  employee_id(value) {
    return normalizeId(value);
  },

  workspace_id(value) {
    return normalizeId(value);
  },

  workspace_slug(value) {
    return normalizeLowerString(value);
  },

  owner_id(value) {
    return normalizeId(value);
  },

  email(value) {
    return normalizeLowerString(value);
  },

  fullname(value) {
    return normalizeSingleLineText(value);
  },

  full_name(value) {
    return normalizeSingleLineText(value);
  },

  name(value) {
    return normalizeSingleLineText(value);
  },

  first_name(value) {
    return normalizeSingleLineText(value);
  },

  middle_name(value) {
    return normalizeSingleLineText(value);
  },

  last_name(value) {
    return normalizeSingleLineText(value);
  },

  role(value) {
    return normalizeRole(value);
  },

  status(value) {
    return normalizeStatus(value);
  },

  /* ---------------------------------
   * DEPARTMENT / ORG
  --------------------------------- */
  department_id(value) {
    return normalizeId(value);
  },

  department_name(value) {
    return normalizeSingleLineText(value);
  },

  dept_id(value) {
    return normalizeId(value);
  },

  dept_name(value) {
    return normalizeSingleLineText(value);
  },

  /* ---------------------------------
   * SHIFT
  --------------------------------- */
  shift_id(value) {
    return normalizeId(value);
  },

  shift_name(value) {
    return normalizeUpperString(value);
  },

  start_time(value) {
    return normalizeTimeString(value);
  },

  end_time(value) {
    return normalizeTimeString(value);
  },

  grace(value) {
    return normalizeNonNegativeInteger(value, 0);
  },

  grace_minutes(value) {
    return normalizeNonNegativeInteger(value, 0);
  },

  /* ---------------------------------
   * TIMELOG / ATTENDANCE
  --------------------------------- */
  log_id(value) {
    return normalizeId(value);
  },

  action(value) {
    return normalizeTimeLogAction(value);
  },

  timestamp(value) {
    return normalizeIsoDateTime(value);
  },

  date(value) {
    if (value instanceof Date) {
      return normalizeDateKey(value);
    }

    const raw = normalizeTrimmedString(value);

    if (!raw) {
      return "";
    }

    if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
      return raw;
    }

    return normalizeDateKey(raw);
  },

  device_info(value) {
    return normalizeNullableString(value);
  },

  location(value) {
    return normalizeNullableString(value);
  },

  location_status(value) {
    return normalizeLocationStatus(value);
  },

  location_message(value) {
    return normalizeNullableString(value);
  },

  attendance_status(value) {
    return normalizeAttendanceStatus(value);
  },

  remarks(value) {
    return normalizeSingleLineText(value);
  },

  notes(value) {
    return normalizeSingleLineText(value);
  },

  /* ---------------------------------
   * BREAK / LUNCH / ATTENDANCE POLICY
  --------------------------------- */
  break_enabled(value) {
    return normalizeBoolean(value, true);
  },

  max_breaks(value) {
    return normalizeNullableNonNegativeInteger(value);
  },

  max_breaks_per_shift(value) {
    return normalizeNullableNonNegativeInteger(value);
  },

  break_minutes(value) {
    return normalizeNullableNonNegativeInteger(value);
  },

  break_duration_minutes(value) {
    return normalizeNullableNonNegativeInteger(value);
  },

  lunch_enabled(value) {
    return normalizeBoolean(value, true);
  },

  lunch_minutes(value) {
    return normalizeNullableNonNegativeInteger(value);
  },

  lunch_duration_minutes(value) {
    return normalizeNullableNonNegativeInteger(value);
  },

  allow_time_in(value) {
    return normalizeBoolean(value, true);
  },

  allow_time_out(value) {
    return normalizeBoolean(value, true);
  },

  allow_break(value) {
    return normalizeBoolean(value, true);
  },

  allow_lunch(value) {
    return normalizeBoolean(value, true);
  },

  require_time_in_for_break(value) {
    return normalizeBoolean(value, true);
  },

  require_time_in_for_lunch(value) {
    return normalizeBoolean(value, true);
  },

  allow_time_out_during_break(value) {
    return normalizeBoolean(value, false);
  },

  allow_time_out_during_lunch(value) {
    return normalizeBoolean(value, false);
  },

  allow_break_during_lunch(value) {
    return normalizeBoolean(value, false);
  },

  allow_lunch_during_break(value) {
    return normalizeBoolean(value, false);
  },

  /* ---------------------------------
   * PAYROLL / HOURS / MINUTES
  --------------------------------- */
  hourly_rate(value) {
    return normalizeNullableFloat(value);
  },

  daily_rate(value) {
    return normalizeNullableFloat(value);
  },

  monthly_rate(value) {
    return normalizeNullableFloat(value);
  },

  regular_hours(value) {
    return normalizeNullableFloat(value);
  },

  overtime_hours(value) {
    return normalizeNullableFloat(value);
  },

  late_minutes(value) {
    return normalizeNonNegativeInteger(value, 0);
  },

  undertime_minutes(value) {
    return normalizeNonNegativeInteger(value, 0);
  },

  overtime_minutes(value) {
    return normalizeNonNegativeInteger(value, 0);
  },

  /* ---------------------------------
   * GENERIC METADATA
  --------------------------------- */
  created_at(value) {
    return normalizeIsoDateTime(value);
  },

  updated_at(value) {
    return normalizeIsoDateTime(value);
  },

  created_by(value) {
    return normalizeId(value);
  },

  updated_by(value) {
    return normalizeId(value);
  },
};
