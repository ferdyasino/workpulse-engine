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