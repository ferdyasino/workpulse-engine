/**
 * =====================================================
 * WORKPULSE TIMELOG ENGINE (PRODUCTION SAFE VERSION)
 * =====================================================
 * External DB (per-workspace spreadsheet)
 * Append-only + query layer
 * =====================================================
 */


/* =========================
   SAFE WORKSPACE RESOLVER
========================= */

function getTimelogDb(workspace_id) {

  if (!workspace_id) {
    throw new Error("workspace_id is required");
  }

  const workspace = getWorkspace(workspace_id);

  if (!workspace || !workspace.timelog_spreadsheet_id) {
    throw new Error(
      `TimeLog DB missing for workspace: ${workspace_id}`
    );
  }

  return SpreadsheetApp.openById(workspace.timelog_spreadsheet_id);
}


/* =========================
   SCHEMA SAFE LOADER
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

  // allow header-only sheet (FIXED)
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
    .map(h => String(h).trim());
}


/* =========================
   INSERT SINGLE TIME LOG
========================= */

function insertTimeLog(workspace_id, payload) {

  const db = getTimelogDb(workspace_id);
  const sheet = getTimeLogSheet(db);
  const headers = getTimeLogHeaders(sheet);

  const log = normalizeTimeLog(payload, workspace_id);

  const row = headers.map(h => log[h] ?? "");

  sheet.appendRow(row);

  const action = payload.action;

  return {
    success: true,
    message: buildActionMessage(action),
    log_id: log.log_id,
    workspace_id
  };
}


/* =========================
   NORMALIZATION LAYER (FIXED)
========================= */

function normalizeTimeLog(data, workspace_id) {

  const now = new Date();

  return {
    log_id: data.log_id || generateId("LOG"),
    workspace_id: workspace_id || data.workspace_id,
    user_id: data.user_id || "",
    email: data.email || "",
    action: data.action || "",

    timestamp: data.timestamp || now.toISOString(),
    date: data.date || formatDateKey(now),

    shift_id: data.shift_id || "",
    device_info: data.device_info || "",
    location: data.location || "",
    remarks: data.remarks || "",

    created_at: now.toISOString()
  };
}


/* =========================
   QUERY ENGINE (FIXED + SAFE)
========================= */

function findTimeLogs(workspace_id, filters = {}) {

  const db = getTimelogDb(workspace_id);
  const sheet = getTimeLogSheet(db);

  const values = sheet.getDataRange().getValues();

  if (values.length < 2) return [];

  const headers = values.shift().map(h => String(h).trim());

  const results = values
    .map(row => rowToObject(headers, row))
    .map(record => {

      // FIX: normalize date safely
      if (record.date instanceof Date) {
        record.date = Utilities.formatDate(
          record.date,
          Session.getScriptTimeZone(),
          "yyyy-MM-dd"
        );
      }

      return record;
    })
    .filter(record => {

      return Object.entries(filters).every(([key, filterValue]) => {

        if (filterValue === undefined || filterValue === null || filterValue === "") {
          return true;
        }

        return String(record[key]) === String(filterValue);
      });
    });

  return results;
}


/* =========================
   SINGLE QUERY
========================= */

function findOneTimeLog(workspace_id, filters = {}) {
  return findTimeLogs(workspace_id, filters)[0] || null;
}


/* =========================
   BATCH INSERT (OPTIMIZED)
========================= */

function insertManyTimeLogs(workspace_id, logs) {

  if (!Array.isArray(logs) || logs.length === 0) {
    throw new Error("logs must be a non-empty array");
  }

  const db = getTimelogDb(workspace_id);
  const sheet = getTimeLogSheet(db);
  const headers = getTimeLogHeaders(sheet);

  const rows = logs.map(log => {
    const normalized = normalizeTimeLog(log, workspace_id);
    return headers.map(h => normalized[h] ?? "");
  });

  const startRow = sheet.getLastRow() + 1;

  sheet.getRange(startRow, 1, rows.length, headers.length).setValues(rows);

  return {
    success: true,
    message: "Batch insert completed",
    inserted: rows.length,
    workspace_id
  };
}


/* =========================
   TODAY HELPERS
========================= */

function getLatestTodayTimeLogByEmail(workspace_id, email) {

  const logs = getTodayTimeLogsByEmail(workspace_id, email);

  if (!logs.length) return null;

  logs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

  return logs[0];
}


/* =========================
   TODAY QUERY
========================= */

function getTodayTimeLogsByEmail(workspace_id, email) {

  if (!workspace_id) throw new Error("workspace_id is required");
  if (!email) throw new Error("email is required");

  const today = formatDateKey(new Date());

  return findTimeLogs(workspace_id, {
    email,
    date: today
  });
}