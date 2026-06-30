/**
 * =====================================================
 * DATE NORMALIZATION UTIL
 * =====================================================
 * Returns YYYY-MM-DD (Asia/Manila safe)
 * =====================================================
 */
function formatDateKey(date = new Date()) {

  const d = new Date(date);

  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

/**
 * Timelog filter normalizer
 */
function normalizeTimeLogFilters(filters = {}) {
  /** @type {{[key: string]: any}} */
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

function normalizeTimeLog(data, workspace_id) {
  const payload = normalizeTimeLogActionPayload(data || {});
  const now = new Date();

  const rawTimestamp = payload.timestamp || now.toISOString();
  const timestampDate = new Date(rawTimestamp);

  if (isNaN(timestampDate.getTime())) {
    throw new Error("Invalid timelog timestamp");
  }

  const finalTimestamp = timestampDate.toISOString();
  const finalDate =
    normalize("date", payload.date) ||
    formatDateKey(timestampDate);
    
  return {
    log_id: normalize("log_id", payload.log_id || generateId("LOG")),
    workspace_id: normalize("workspace_id", workspace_id || payload.workspace_id),
    user_id: normalize("user_id", payload.user_id),
    email: normalize("email", payload.email),
    action: normalize("action", payload.action),

    timestamp: finalTimestamp,
    date: finalDate,

    shift_id: normalize("shift_id", payload.shift_id),
    device_info: normalize("device_info", payload.device_info),
    location: normalize("location", payload.location),
    remarks: normalize("remarks", payload.remarks),

    created_at: now.toISOString()
  };
}

/* =========================
   FILTER HELPERS
========================= */
function normalizeTimeLogRecord(record) {
  const normalized = { ...(record || {}) };

  if (normalized.date instanceof Date) {
    normalized.date = formatDateKey(normalized.date);
  }

  return normalizeRecord({
    ...normalized,
    log_id: normalized.log_id,
    workspace_id: normalized.workspace_id,
    user_id: normalized.user_id,
    email: normalized.email,
    action: normalized.action,
    timestamp: normalized.timestamp,
    date: normalized.date,
    shift_id: normalized.shift_id,
    device_info: normalized.device_info,
    location: normalized.location,
    remarks: normalized.remarks,
    created_at: normalized.created_at
  });
}
