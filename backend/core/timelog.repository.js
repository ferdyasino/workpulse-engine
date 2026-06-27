/* =========================
   TIMELOG REPOSITORY
   DROP-IN REPLACEMENT
========================= */

/* =========================
   CONSTANTS
========================= */
const TIMELOG_SHEET_NAME = "TIME_LOGS";

function getRequiredTimeLogHeaders() {
  return [
    "log_id",
    "workspace_id",
    "user_id",
    "email",
    "action",
    "timestamp",
    "date",
    "shift_id",
    "device_info",
    "location",
    "remarks",
    "created_at"
  ];
}

/* =========================
   WORKSPACE RESOLVER
========================= */
function getTimelogDb(workspace_id) {
  const normalizedWorkspaceId = normalize("workspace_id", workspace_id);

  if (!normalizedWorkspaceId) {
    throw new Error("workspace_id is required");
  }

  const workspace = getWorkspace(normalizedWorkspaceId);

  if (!workspace || !workspace.timelog_spreadsheet_id) {
    throw new Error(`TimeLog DB missing for workspace: ${normalizedWorkspaceId}`);
  }

  return SpreadsheetApp.openById(workspace.timelog_spreadsheet_id);
}

/* =========================
   SHEET LOADER
========================= */
function getTimeLogSheet(db) {
  if (!db) {
    throw new Error("Invalid spreadsheet instance");
  }

  const sheet = db.getSheetByName(TIMELOG_SHEET_NAME);

  if (!sheet) {
    throw new Error(`${TIMELOG_SHEET_NAME} sheet not found`);
  }

  const lastCol = sheet.getLastColumn();

  if (lastCol === 0) {
    throw new Error(`${TIMELOG_SHEET_NAME} sheet is not initialized`);
  }

  return sheet;
}

/* =========================
   HEADER LOADER
========================= */
function getTimeLogHeaders(sheet) {
  if (!sheet) {
    throw new Error("sheet is required");
  }

  const lastCol = sheet.getLastColumn();

  if (lastCol < 1) {
    throw new Error(`${TIMELOG_SHEET_NAME} sheet has no headers`);
  }

  return sheet
    .getRange(1, 1, 1, lastCol)
    .getValues()[0]
    .map(function (header) {
      return String(header || "").trim();
    });
}

function assertTimeLogHeaders(headers) {
  const list = Array.isArray(headers) ? headers : [];
  const required = getRequiredTimeLogHeaders();

  const missing = required.filter(function (key) {
    return !list.includes(key);
  });

  if (missing.length) {
    throw new Error(
      `TIME_LOGS sheet missing required headers: ${missing.join(", ")}`
    );
  }

  return true;
}

/* =========================
   INSERT SINGLE
========================= */
function insertTimeLog(workspace_id, payload) {
  const normalizedWorkspaceId = normalize("workspace_id", workspace_id);

  if (!normalizedWorkspaceId) {
    throw new Error("workspace_id is required");
  }

  if (!payload) {
    throw new Error("payload is required");
  }

  const db = getTimelogDb(normalizedWorkspaceId);
  const sheet = getTimeLogSheet(db);
  const headers = getTimeLogHeaders(sheet);

  assertTimeLogHeaders(headers);

  const log = normalizeTimeLog(payload, normalizedWorkspaceId);
  assertInsertableTimeLog(log);

  const row = buildTimeLogRow(headers, log);
  sheet.appendRow(row);

  return {
    success: true,
    message: buildActionMessage(log.action),
    log_id: log.log_id,
    workspace_id: normalizedWorkspaceId
  };
}

/* =========================
   INSERT MANY
========================= */
function insertManyTimeLogs(workspace_id, logs) {
  const normalizedWorkspaceId = normalize("workspace_id", workspace_id);

  if (!normalizedWorkspaceId) {
    throw new Error("workspace_id is required");
  }

  if (!Array.isArray(logs) || logs.length === 0) {
    throw new Error("logs must be a non-empty array");
  }

  const db = getTimelogDb(normalizedWorkspaceId);
  const sheet = getTimeLogSheet(db);
  const headers = getTimeLogHeaders(sheet);

  assertTimeLogHeaders(headers);

  const normalizedLogs = logs.map(function (log) {
    const normalized = normalizeTimeLog(log, normalizedWorkspaceId);
    assertInsertableTimeLog(normalized);
    return normalized;
  });

  const rows = normalizedLogs.map(function (log) {
    return buildTimeLogRow(headers, log);
  });

  const startRow = sheet.getLastRow() + 1;
  sheet.getRange(startRow, 1, rows.length, headers.length).setValues(rows);

  return {
    success: true,
    message: "Batch insert completed",
    inserted: rows.length,
    workspace_id: normalizedWorkspaceId
  };
}

/* =========================
   INSERT HELPERS
========================= */
function buildTimeLogRow(headers, log) {
  return headers.map(function (header) {
    return log[header] !== undefined && log[header] !== null
      ? log[header]
      : "";
  });
}

function assertInsertableTimeLog(log) {
  if (!log) {
    throw new Error("Invalid timelog payload");
  }

  if (!log.workspace_id) {
    throw new Error("workspace_id is required");
  }

  if (!log.email) {
    throw new Error("email is required");
  }

  if (!log.action) {
    throw new Error("action is required");
  }

  if (!log.timestamp) {
    throw new Error("timestamp is required");
  }

  if (!log.date) {
    throw new Error("date is required");
  }

  return true;
}

/* =========================
   NORMALIZER
========================= */
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
    normalize("date", finalTimestamp);

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
   BASE FINDER
========================= */
function findTimeLogs(workspace_id, filters) {
  const normalizedWorkspaceId = normalize("workspace_id", workspace_id);

  if (!normalizedWorkspaceId) {
    throw new Error("workspace_id is required");
  }

  const db = getTimelogDb(normalizedWorkspaceId);
  const sheet = getTimeLogSheet(db);
  const values = sheet.getDataRange().getValues();

  if (values.length < 2) {
    return [];
  }

  const headers = values.shift().map(function (header) {
    return String(header || "").trim();
  });

  assertTimeLogHeaders(headers);

  const normalizedFilters = normalizeTimeLogFilters(filters || {});

  return values
    .map(function (row) {
      return rowToObject(headers, row);
    })
    .map(normalizeTimeLogRecord)
    .filter(function (record) {
      return matchesTimeLogFilters(record, normalizedFilters);
    })
    .sort(function (a, b) {
      return new Date(a.timestamp) - new Date(b.timestamp);
    });
}

/* =========================
   FIND ONE
========================= */
function findOneTimeLog(workspace_id, filters) {
  return findTimeLogs(workspace_id, filters || {})[0] || null;
}

/* =========================
   DAY QUERIES
========================= */
function getTodayTimeLogsByEmail(workspace_id, email) {
  const normalizedWorkspaceId = normalize("workspace_id", workspace_id);
  const normalizedEmail = normalize("email", email);

  if (!normalizedWorkspaceId) throw new Error("workspace_id is required");
  if (!normalizedEmail) throw new Error("email is required");

  return getTimeLogsByDate(
    normalizedWorkspaceId,
    normalizedEmail,
    formatDateKey(new Date())
  );
}

function getLatestTodayTimeLogByEmail(workspace_id, email) {
  const logs = getTodayTimeLogsByEmail(workspace_id, email);
  return logs.length ? logs[logs.length - 1] : null;
}

function getTimeLogsByDate(workspace_id, email, dateKey) {
  const normalizedWorkspaceId = normalize("workspace_id", workspace_id);
  const normalizedEmail = normalize("email", email);
  const normalizedDate = normalize("date", dateKey);

  if (!normalizedWorkspaceId) throw new Error("workspace_id is required");
  if (!normalizedEmail) throw new Error("email is required");
  if (!normalizedDate) throw new Error("date is required");

  return findTimeLogs(normalizedWorkspaceId, {
    email: normalizedEmail,
    date: normalizedDate
  });
}

/* =========================
   TIMELOG QUERIES
========================= */

function getTimeLogsByEmail(workspace_id, email, options) {
  const normalizedWorkspaceId = normalize("workspace_id", workspace_id);
  const normalizedEmail = normalize("email", email);

  if (!normalizedWorkspaceId) {
    throw new Error("workspace_id is required");
  }

  if (!normalizedEmail) {
    throw new Error("email is required");
  }

  const filters = {
    email: normalizedEmail
  };

  options = options || {};

  if (options.shift_id) {
    filters.shift_id = normalize("shift_id", options.shift_id);
  }

  if (options.date) {
    filters.date = normalize("date", options.date);
  }

  return findTimeLogs(normalizedWorkspaceId, filters);
}

function getTodayTimeLogsByEmail(workspace_id, email) {
  return getTimeLogsByEmail(workspace_id, email, {
    date: formatDateKey(new Date())
  });
}

function getShiftTimeLogsByEmail(workspace_id, email, shift_id) {
  return getTimeLogsByEmail(workspace_id, email, {
    shift_id: shift_id,
    date: formatDateKey(new Date())
  });
}

function getLatestTodayTimeLogByEmail(workspace_id, email) {
  const logs = getTodayTimeLogsByEmail(workspace_id, email);
  return logs.length ? logs[logs.length - 1] : null;
}

function getLatestShiftTimeLogByEmail(workspace_id, email, shift_id) {
  const logs = getShiftTimeLogsByEmail(workspace_id, email, shift_id);
  return logs.length ? logs[logs.length - 1] : null;
}

/* =========================
   FILTER HELPERS
========================= */
function normalizeTimeLogRecord(record) {
  const normalized = { ...(record || {}) };

  if (normalized.date instanceof Date) {
    normalized.date = Utilities.formatDate(
      normalized.date,
      Session.getScriptTimeZone(),
      "yyyy-MM-dd"
    );
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

function normalizeTimeLogFilters(filters) {
  const normalized = { ...(filters || {}) };

  if (normalized.log_id !== undefined) {
    normalized.log_id = normalize("log_id", normalized.log_id);
  }

  if (normalized.workspace_id !== undefined) {
    normalized.workspace_id = normalize("workspace_id", normalized.workspace_id);
  }

  if (normalized.user_id !== undefined) {
    normalized.user_id = normalize("user_id", normalized.user_id);
  }

  if (normalized.email !== undefined) {
    normalized.email = normalize("email", normalized.email);
  }

  if (normalized.action !== undefined) {
    normalized.action = normalize("action", normalized.action);
  }

  if (normalized.shift_id !== undefined) {
    normalized.shift_id = normalize("shift_id", normalized.shift_id);
  }

  if (normalized.date !== undefined) {
    normalized.date = normalize("date", normalized.date);
  }

  return normalized;
}

function matchesTimeLogFilters(record, filters) {
  return Object.entries(filters).every(function (entry) {
    const key = entry[0];
    const filterValue = entry[1];

    if (
      filterValue === undefined ||
      filterValue === null ||
      filterValue === ""
    ) {
      return true;
    }

    return String(record[key]) === String(filterValue);
  });
}