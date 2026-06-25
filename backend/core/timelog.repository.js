/* =========================
   TIMELOG REPOSITORY
========================= */

/* =========================
   WORKSPACE RESOLVER
========================= */
function getTimelogDb(workspace_id) {
  if (!workspace_id) {
    throw new Error("workspace_id is required");
  }

  const workspace = getWorkspace(workspace_id);

  if (!workspace || !workspace.timelog_spreadsheet_id) {
    throw new Error(`TimeLog DB missing for workspace: ${workspace_id}`);
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

  const sheet = db.getSheetByName("TIME_LOGS");

  if (!sheet) {
    throw new Error("TIME_LOGS sheet not found");
  }

  const lastRow = sheet.getLastRow();
  const lastCol = sheet.getLastColumn();

  if (lastCol === 0 || lastRow < 1) {
    throw new Error("TIME_LOGS sheet is not initialized");
  }

  return sheet;
}

/* =========================
   HEADER LOADER
========================= */
function getTimeLogHeaders(sheet) {
  return sheet
    .getRange(1, 1, 1, sheet.getLastColumn())
    .getValues()[0]
    .map(function (h) {
      return String(h).trim();
    });
}

/* =========================
   INSERT SINGLE
========================= */
function insertTimeLog(workspace_id, payload) {
  const db = getTimelogDb(workspace_id);
  const sheet = getTimeLogSheet(db);
  const headers = getTimeLogHeaders(sheet);

  const log = normalizeTimeLog(payload, workspace_id);
  const row = headers.map(function (header) {
    return log[header] !== undefined && log[header] !== null ? log[header] : "";
  });

  sheet.appendRow(row);

  return {
    success: true,
    message: buildActionMessage(log.action),
    log_id: log.log_id,
    workspace_id: workspace_id
  };
}

/* =========================
   INSERT MANY
========================= */
function insertManyTimeLogs(workspace_id, logs) {
  if (!Array.isArray(logs) || logs.length === 0) {
    throw new Error("logs must be a non-empty array");
  }

  const db = getTimelogDb(workspace_id);
  const sheet = getTimeLogSheet(db);
  const headers = getTimeLogHeaders(sheet);

  const rows = logs.map(function (log) {
    const normalized = normalizeTimeLog(log, workspace_id);

    return headers.map(function (header) {
      return normalized[header] !== undefined && normalized[header] !== null
        ? normalized[header]
        : "";
    });
  });

  const startRow = sheet.getLastRow() + 1;
  sheet.getRange(startRow, 1, rows.length, headers.length).setValues(rows);

  return {
    success: true,
    message: "Batch insert completed",
    inserted: rows.length,
    workspace_id: workspace_id
  };
}

/* =========================
   NORMALIZER
========================= */
function normalizeTimeLog(data, workspace_id) {
  const now = new Date();
  const payload = data || {};

  const email = String(payload.email || "").trim().toLowerCase();
  const shift_id = String(payload.shift_id || "").trim();

  return {
    log_id: payload.log_id || generateId("LOG"),
    workspace_id: workspace_id || payload.workspace_id || "",
    user_id: payload.user_id || "",
    email: email,
    action: String(payload.action || "").trim(),

    timestamp: payload.timestamp || now.toISOString(),
    date: payload.date || formatDateKey(now),

    shift_id: shift_id,
    device_info: payload.device_info || "",
    location: payload.location || "",
    remarks: payload.remarks || "",

    created_at: now.toISOString()
  };
}

/* =========================
   BASE FINDER
========================= */
function findTimeLogs(workspace_id, filters) {
  const db = getTimelogDb(workspace_id);
  const sheet = getTimeLogSheet(db);
  const values = sheet.getDataRange().getValues();

  if (values.length < 2) {
    return [];
  }

  const headers = values.shift().map(function (h) {
    return String(h).trim();
  });

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
  if (!workspace_id) throw new Error("workspace_id is required");
  if (!email) throw new Error("email is required");

  return getTimeLogsByDate(workspace_id, email, formatDateKey(new Date()));
}

function getLatestTodayTimeLogByEmail(workspace_id, email) {
  const logs = getTodayTimeLogsByEmail(workspace_id, email);
  return logs.length ? logs[logs.length - 1] : null;
}

function getTimeLogsByDate(workspace_id, email, dateKey) {
  if (!workspace_id) throw new Error("workspace_id is required");
  if (!email) throw new Error("email is required");
  if (!dateKey) throw new Error("date is required");

  return findTimeLogs(workspace_id, {
    email: String(email).trim().toLowerCase(),
    date: String(dateKey).trim()
  });
}

/* =========================
   SHIFT QUERIES
========================= */
function getShiftTimeLogsByEmail(workspace_id, email, shift_id) {
  if (!workspace_id) throw new Error("workspace_id is required");
  if (!email) throw new Error("email is required");
  if (!shift_id) throw new Error("shift_id is required");

  return findTimeLogs(workspace_id, {
    email: String(email).trim().toLowerCase(),
    shift_id: String(shift_id).trim()
  });
}

function getLatestShiftTimeLogByEmail(workspace_id, email, shift_id) {
  const logs = getShiftTimeLogsByEmail(workspace_id, email, shift_id);
  return logs.length ? logs[logs.length - 1] : null;
}

function getTodayShiftTimeLogsByEmail(workspace_id, email, shift_id) {
  if (!workspace_id) throw new Error("workspace_id is required");
  if (!email) throw new Error("email is required");
  if (!shift_id) throw new Error("shift_id is required");

  return findTimeLogs(workspace_id, {
    email: String(email).trim().toLowerCase(),
    shift_id: String(shift_id).trim(),
    date: formatDateKey(new Date())
  });
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
  } else {
    normalized.date = String(normalized.date || "").trim();
  }

  normalized.email = String(normalized.email || "").trim().toLowerCase();
  normalized.shift_id = String(normalized.shift_id || "").trim();
  normalized.action = String(normalized.action || "").trim();
  normalized.workspace_id = String(normalized.workspace_id || "").trim();

  return normalized;
}

function normalizeTimeLogFilters(filters) {
  const normalized = { ...(filters || {}) };

  if (normalized.email !== undefined) {
    normalized.email = String(normalized.email || "").trim().toLowerCase();
  }

  if (normalized.shift_id !== undefined) {
    normalized.shift_id = String(normalized.shift_id || "").trim();
  }

  if (normalized.date !== undefined) {
    normalized.date = String(normalized.date || "").trim();
  }

  if (normalized.action !== undefined) {
    normalized.action = String(normalized.action || "").trim();
  }

  if (normalized.workspace_id !== undefined) {
    normalized.workspace_id = String(normalized.workspace_id || "").trim();
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