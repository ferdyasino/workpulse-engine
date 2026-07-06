// /* =========================
//    WORKSPACE RESOLVER
// ========================= */
// function getTimelogDb(workspace_id) {
//   const normalizedWorkspaceId = normalize("workspace_id", workspace_id);

//   if (!normalizedWorkspaceId) {
//     throw new Error("workspace_id is required");
//   }

//   const workspace = getWorkspace(normalizedWorkspaceId);

//   if (!workspace || !workspace.timelog_spreadsheet_id) {
//     throw new Error(`TimeLog DB missing for workspace: ${normalizedWorkspaceId}`);
//   }

//   return SpreadsheetApp.openById(workspace.timelog_spreadsheet_id);
// }

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
    throw new Error(`TIME_LOGS sheet missing required headers: ${missing.join(", ")}`);
  }

  return true;
}

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

  // =====================================================
  // RESOLVE WORK DATE FROM SHIFT (BACKEND SOURCE OF TRUTH)
  // =====================================================
  // log.date = getShiftWorkDate(
  //   normalizedWorkspaceId,
  //   log.shift_id,
  //   log.timestamp
  // );

  assertInsertableTimeLog(log);

  const row = buildTimeLogRow(headers, log);
  sheet.appendRow(row);

  return {
    success: true,
    message: buildActionMessage(log.action),

    log_id: log.log_id,

    workspace_id: normalizedWorkspaceId,

    timestamp: log.timestamp,

    shift_id: log.shift_id,

    work_date: log.date,
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

    normalized.date = getShiftWorkDate(
      normalizedWorkspaceId,
      normalized.shift_id,
      normalized.timestamp,
    );

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
    workspace_id: normalizedWorkspaceId,
  };
}

/* =========================
   INSERT HELPERS
========================= */
function buildTimeLogRow(headers, log) {
  return headers.map(function (header) {
    return log[header] !== undefined && log[header] !== null ? log[header] : "";
  });
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

  const records = values.map(function (row) {
    return normalizeTimeLogRecord(rowToObject(headers, row));
  });

  const filtered = records.filter(function (record) {
    return matchesTimeLogFilters(record, normalizedFilters);
  });

  filtered.sort(function (a, b) {
    const aTime = new Date(a.timestamp).getTime();
    const bTime = new Date(b.timestamp).getTime();

    return aTime - bTime;
  });

  return filtered;
}

/* =========================
   FIND ONE
========================= */
function findOneTimeLog(workspace_id, filters) {
  return findTimeLogs(workspace_id, filters || {})[0] || null;
}
