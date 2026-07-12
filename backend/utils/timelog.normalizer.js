/**
 * =====================================================
 * DATE NORMALIZATION UTIL
 * =====================================================
 * Returns YYYY-MM-DD using shared normalizer.
 * =====================================================
 */
function formatDateKey(date = new Date()) {
  return normalizeDateKey(date);
}


function normalizeTimeLogFilters(filters = {}) {
  const normalized = { ...filters };

  [
    "log_id",
    "workspace_id",
    "user_id",
    "email",
    "action",
    "date",
    "shift_id",
  ].forEach(function (field) {
    if (Object.prototype.hasOwnProperty.call(normalized, field)) {
      normalized[field] = normalize(field, normalized[field]);
    }
  });

  return normalized;
}

/**
 * Normalize incoming timelog payload
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

    remarks: normalize("remarks", payload.remarks),
  };
}

/**
 * Builds a normalized timelog record.
 * Work date is always derived from the timestamp.
 */
function normalizeTimeLog(data, workspace_id) {
  const payload = normalizeTimeLogActionPayload(data || {});
  const now = new Date();

  const rawTimestamp = payload.timestamp || now.toISOString();
  const timestampDate = new Date(rawTimestamp);

  if (isNaN(timestampDate.getTime())) {
    throw new Error("Invalid timelog timestamp");
  }

  const finalTimestamp = timestampDate.toISOString();

  let finalDate = payload.date;

  if (!finalDate) {
    const shift = payload.shift_id
      ? getShiftById(workspace_id || payload.workspace_id, payload.shift_id)
      : null;

    finalDate = shift
      ? resolveShiftWorkDate(shift, timestampDate)
      : formatDateKey(timestampDate);
  }

  return {
    log_id: normalize("log_id", payload.log_id || generateId("LOG")),

    workspace_id: normalize(
      "workspace_id",
      workspace_id || payload.workspace_id
    ),

    user_id: normalize("user_id", payload.user_id),
    email: normalize("email", payload.email),

    action: normalize("action", payload.action),

    timestamp: finalTimestamp,
    date: finalDate,

    shift_id: normalize("shift_id", payload.shift_id),

    device_info: normalize("device_info", payload.device_info),

    location: normalize("location", payload.location),
    location_status: normalize("location_status", payload.location_status),
    location_message: normalize("location_message", payload.location_message),

    remarks: normalize("remarks", payload.remarks),

    created_at: now.toISOString(),
  };
}

/* =====================================================
 * RECORD NORMALIZER
 * ===================================================== */
function normalizeTimeLogRecord(record = {}) {
  const normalized = { ...record };

  // @ts-ignore
  if (normalized.date instanceof Date) {
    // @ts-ignore
    normalized.date = formatDateKey(normalized.date);
  }

  return normalizeRecord({
    ...normalized,

    // @ts-ignore
    log_id: normalized.log_id,
    // @ts-ignore
    workspace_id: normalized.workspace_id,
    // @ts-ignore
    user_id: normalized.user_id,
    // @ts-ignore
    email: normalized.email,

    // @ts-ignore
    action: normalized.action,

    // @ts-ignore
    timestamp: normalized.timestamp,
    // @ts-ignore
    date: normalized.date,

    // @ts-ignore
    shift_id: normalized.shift_id,

    // @ts-ignore
    device_info: normalized.device_info,

    // @ts-ignore
    location: normalized.location,
    // @ts-ignore
    location_status: normalized.location_status,
    // @ts-ignore
    location_message: normalized.location_message,

    // @ts-ignore
    remarks: normalized.remarks,

    // @ts-ignore
    created_at: normalized.created_at,
  });
}