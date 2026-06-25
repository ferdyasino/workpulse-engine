/**
 * =====================================================
 * NORMALIZER
 * SHARED SYSTEM NORMALIZATION LAYER
 * DROP-IN REPLACEMENT
 * =====================================================
 *
 * PURPOSE
 * - single reusable normalizer for backend records/payloads
 * - safe for employees, shifts, timelogs, departments, settings
 * - unknown fields pass through unchanged
 *
 * IMPORTANT
 * - normalizeRecord(record) only normalizes fields that exist
 *   in NORMALIZERS map
 * - normalize(field, value) can be used directly by validators
 * - keep this file side-effect free
 * =====================================================
 */

/* =====================================================
 * BASE HELPERS
 * ===================================================== */

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

function normalizeNullableInteger(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const num = Number(value);
  return Number.isFinite(num) ? Math.trunc(num) : null;
}

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
  if (!value) {
    return "";
  }

  const d = value instanceof Date ? value : new Date(value);

  if (isNaN(d.getTime())) {
    return "";
  }

  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");

  return `${yyyy}-${mm}-${dd}`;
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

function normalizeRole(value) {
  return normalizeUpperString(value || "EMPLOYEE", "EMPLOYEE");
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
  }
};

/* =====================================================
 * PUBLIC API
 * ===================================================== */

/**
 * Normalize a full record by applying field-specific
 * normalizers only to known keys.
 *
 * Unknown keys are preserved as-is.
 */
function normalizeRecord(record = {}) {
  const data = { ...record };

  Object.keys(data).forEach(function (key) {
    const normalizer = NORMALIZERS[key];

    if (typeof normalizer === "function") {
      data[key] = normalizer(data[key]);
    }
  });

  return data;
}

/**
 * Normalize a single field value using shared rules.
 * If no normalizer exists for the field, value is returned unchanged.
 */
function normalize(field, value) {
  const normalizer = NORMALIZERS[field];

  return typeof normalizer === "function"
    ? normalizer(value)
    : value;
}

/* =====================================================
 * DOMAIN CONVENIENCE NORMALIZERS
 * ===================================================== */

/**
 * Timelog action payload normalizer
 * Used by validators and submit/insert flow.
 */
function normalizeTimeLogActionPayload(payload = {}) {
  return {
    ...payload,
    log_id: normalize("log_id", payload.log_id),
    workspace_id: normalize("workspace_id", payload.workspace_id),
    user_id: normalize("user_id", payload.user_id),
    email: normalize("email", payload.email),
    action: normalize("action", payload.action),
    timestamp: normalize("timestamp", payload.timestamp),
    date: normalize("date", payload.date),
    shift_id: normalize("shift_id", payload.shift_id),
    device_info: normalize("device_info", payload.device_info),
    location: normalize("location", payload.location),
    location_status: normalize("location_status", payload.location_status),
    location_message: normalize("location_message", payload.location_message),
    remarks: normalize("remarks", payload.remarks)
  };
}

/**
 * Full timelog row normalizer
 * Good for repository insert/read logic.
 */
function normalizeTimeLogRecord(record = {}) {
  return normalizeRecord({
    ...record,
    log_id: record.log_id,
    workspace_id: record.workspace_id,
    user_id: record.user_id,
    email: record.email,
    action: record.action,
    timestamp: record.timestamp,
    date: record.date,
    shift_id: record.shift_id,
    device_info: record.device_info,
    location: record.location,
    remarks: record.remarks,
    created_at: record.created_at
  });
}

/**
 * Timelog filter normalizer
 */
function normalizeTimeLogFilters(filters = {}) {
  const normalized = { ...filters };

  if (Object.prototype.hasOwnProperty.call(normalized, "log_id")) {
    normalized.log_id = normalize("log_id", normalized.log_id);
  }

  if (Object.prototype.hasOwnProperty.call(normalized, "workspace_id")) {
    normalized.workspace_id = normalize("workspace_id", normalized.workspace_id);
  }

  if (Object.prototype.hasOwnProperty.call(normalized, "user_id")) {
    normalized.user_id = normalize("user_id", normalized.user_id);
  }

  if (Object.prototype.hasOwnProperty.call(normalized, "email")) {
    normalized.email = normalize("email", normalized.email);
  }

  if (Object.prototype.hasOwnProperty.call(normalized, "action")) {
    normalized.action = normalize("action", normalized.action);
  }

  if (Object.prototype.hasOwnProperty.call(normalized, "date")) {
    normalized.date = normalize("date", normalized.date);
  }

  if (Object.prototype.hasOwnProperty.call(normalized, "shift_id")) {
    normalized.shift_id = normalize("shift_id", normalized.shift_id);
  }

  return normalized;
}

/**
 * Shift attendance / policy settings normalizer
 */
function normalizeShiftPolicyRecord(record = {}) {
  return normalizeRecord({
    ...record,
    shift_id: record.shift_id,
    shift_name: record.shift_name,

    break_enabled: record.break_enabled,
    max_breaks: record.max_breaks,
    max_breaks_per_shift: record.max_breaks_per_shift,
    break_minutes: record.break_minutes,
    break_duration_minutes: record.break_duration_minutes,

    lunch_enabled: record.lunch_enabled,
    lunch_minutes: record.lunch_minutes,
    lunch_duration_minutes: record.lunch_duration_minutes,

    allow_time_in: record.allow_time_in,
    allow_time_out: record.allow_time_out,
    allow_break: record.allow_break,
    allow_lunch: record.allow_lunch,
    require_time_in_for_break: record.require_time_in_for_break,
    require_time_in_for_lunch: record.require_time_in_for_lunch,
    allow_time_out_during_break: record.allow_time_out_during_break,
    allow_time_out_during_lunch: record.allow_time_out_during_lunch,
    allow_break_during_lunch: record.allow_break_during_lunch,
    allow_lunch_during_break: record.allow_lunch_during_break
  });
}

/**
 * Shift row normalizer
 */
function normalizeShiftRecord(record = {}) {
  return normalizeRecord({
    ...record,
    shift_id: record.shift_id,
    shift_name: record.shift_name,
    start_time: record.start_time,
    end_time: record.end_time,
    grace: record.grace,
    grace_minutes: record.grace_minutes,

    break_enabled: record.break_enabled,
    max_breaks: record.max_breaks,
    max_breaks_per_shift: record.max_breaks_per_shift,
    break_minutes: record.break_minutes,

    lunch_enabled: record.lunch_enabled,
    lunch_minutes: record.lunch_minutes
  });
}

/**
 * Employee / user record normalizer
 */
function normalizeEmployeeRecord(record = {}) {
  const fullname =
    record.fullname ||
    record.full_name ||
    record.name ||
    [
      record.first_name,
      record.middle_name,
      record.last_name
    ]
      .filter(Boolean)
      .join(" ");

  return normalizeRecord({
    ...record,
    user_id: record.user_id,
    employee_id: record.employee_id,
    email: record.email,
    fullname: fullname,
    role: record.role,
    status: record.status,
    department_id: record.department_id || record.dept_id,
    department_name: record.department_name || record.dept_name,
    shift_id: record.shift_id,
    shift_name: record.shift_name
  });
}

/**
 * Department row normalizer
 */
function normalizeDepartmentRecord(record = {}) {
  return normalizeRecord({
    ...record,
    department_id: record.department_id || record.dept_id,
    department_name: record.department_name || record.dept_name,
    status: record.status
  });
}

/**
 * Workspace row normalizer
 */
function normalizeWorkspaceRecord(record = {}) {
  return normalizeRecord({
    ...record,
    workspace_id: record.workspace_id,
    workspace_slug: record.workspace_slug,
    name: record.name,
    status: record.status,
    owner_id: record.owner_id
  });
}