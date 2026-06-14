/**
 * =====================================================
 * WORKPULSE TIMELOG ENGINE (SYNCED VERSION)
 * =====================================================
 * External DB (per-workspace spreadsheet)
 * Append-only + query layer
 * =====================================================
 */


/* =========================
   SAFE WORKSPACE RESOLVER
   (SYNCED WITH MASTER DB)
========================= */

function getTimelogDb(workspaceId) {

  if (!workspaceId) {
    throw new Error("workspaceId is required");
  }

  const workspace = getWorkspace(workspaceId);

  if (!workspace.timelog_spreadsheet_id) {
    throw new Error(
      `TimeLog DB missing for workspace: ${workspaceId}`
    );
  }

  return SpreadsheetApp.openById(
    workspace.timelog_spreadsheet_id
  );
}


/* =========================
   SCHEMA SAFE LOADER
========================= */

function getTimeLogSheet(db) {

  const sheet = db.getSheetByName("TIME_LOGS");
  
  if (!sheet) {
    throw new Error("TIME_LOGS sheet not found");
  }

  const lastCol = sheet.getLastColumn();
  const lastRow = sheet.getLastRow();

  if (lastCol === 0 || lastRow === 0) {
    throw new Error("TIME_LOGS sheet is empty or uninitialized");
  }

  return sheet;
}


/* =========================
   HEADER CACHE (optional optimization hook)
========================= */

function getTimeLogHeaders(sheet) {
  return sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
}


/* =========================
   INSERT SINGLE TIME LOG
========================= */

function insertTimeLog(workspaceId, payload) {
  
  const db = getTimelogDb(workspaceId);
  const sheet = getTimeLogSheet(db);
  
  const headers = getTimeLogHeaders(sheet);
  
  const log = normalizeTimeLog(payload);
 
  log['workspace_id']=workspaceId;
  
  const row = headers.map(h => log[h] ?? "");

  sheet.appendRow(row);

  return {
    success: true,
    log_id: log.log_id,
    workspaceId
  };
}


/* =========================
   NORMALIZATION LAYER
========================= */

function normalizeTimeLog(data) {

  return {
    log_id: data.log_id || generateId("LOG"),
    user_id: data.user_id,
    workspace_id: data.workspace_id,
    email: data.email || "",
    action: data.action,

    timestamp: data.timestamp || new Date().toISOString(),
    date: data.date || formatDateKey(new Date()),

    shift_id: data.shift_id || "",

    device_info: data.device_info || "",
    location: data.location || "",
    remarks: data.remarks || "",

    created_at: new Date().toISOString()
  };
}


/* =========================
   QUERY ENGINE
========================= */

function findTimeLogs(workspaceId, filters = {}) {

  const db = getTimelogDb(workspaceId);

  const sheet = getTimeLogSheet(db);

  // return console.log("sheet",sheet);

  const values = sheet.getDataRange().getValues();

  const headers = values.shift();

const results = values
  .map(row => {
      const record = rowToObject(headers, row);

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
      return Object.keys(filters).every(key => {
        const filterValue = filters[key];
        if (filterValue === undefined || filterValue === null || filterValue === "") {
          return true;
        }
        return record[key] == filterValue;
      });
    });

  return results;
}


function findOneTimeLog(workspaceId, filters = {}) {

  const results = findTimeLogs(workspaceId, filters);
  return results[0] || null;
}


/* =========================
   BATCH INSERT (OPTIMIZED)
========================= */

function insertManyTimeLogs(workspaceId, logs) {

  if (!Array.isArray(logs) || logs.length === 0) {
    throw new Error("logs must be a non-empty array");
  }

  const db = getTimelogDb(workspaceId);
  const sheet = getTimeLogSheet(db);

  const headers = getTimeLogHeaders(sheet);

  const rows = logs.map(log => {

    const normalized = normalizeTimeLog(log);

    return headers.map(h => normalized[h] ?? "");

  });

  const startRow = sheet.getLastRow() + 1;

  sheet.getRange(
    startRow,
    1,
    rows.length,
    headers.length
  ).setValues(rows);

  return {
    success: true,
    inserted: rows.length,
    workspaceId
  };
}

/**
 * =========================
 * GET LATEST TODAY LOG
 * =========================
 */
function getLatestTodayTimeLogByEmail(workspaceId, email) {

  const logs = getTodayTimeLogsByEmail(
    workspaceId,
    email
  );

  if (!logs.length) {
    return null;
  }

  logs.sort((a, b) => {
    return new Date(b.timestamp) - new Date(a.timestamp);
  });

  return logs[0];
}

/**
 * =========================
 * GET TODAY TIMELOGS BY EMAIL
 * =========================
 */
function getTodayTimeLogsByEmail(workspaceId, email) {

  if (!workspaceId) {
    throw new Error("workspaceId is required");
  }

  if (!email) {
    throw new Error("email is required");
  }

  const today = formatDateKey(new Date());

  return findTimeLogs(workspaceId, {
    email,
    date: today
  });

}