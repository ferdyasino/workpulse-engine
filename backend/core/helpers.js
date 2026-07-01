/**
 * =====================================================
 * CORE HELPERS
 * =====================================================
 */
function getMasterDatabase() {
  if (!DB_CONFIG.AUTH_SPREADSHEET_ID) {
    throw new Error("Master AUTH_SPREADSHEET_ID not configured");
  }

  // @ts-ignore
  return SpreadsheetApp.openById(DB_CONFIG.AUTH_SPREADSHEET_ID);
}

/**
 * Resolve spreadsheet (string ID or Spreadsheet object)
 */
function resolveDb(dbRef) {
  if (typeof dbRef === "string") {
    // @ts-ignore
    return SpreadsheetApp.openById(dbRef);
  }

  return dbRef;
}

/**
 * Check if sheet exists
 */
function sheetExists(dbRef, sheetName) {
  const db = resolveDb(dbRef);
  return !!db.getSheetByName(sheetName);
}

/**
 * Get headers - supports both sheet object and (db, sheetName)
 */
function getHeaders(arg1, arg2) {
  let sheet;

  if (arg2) {
    const db = resolveDb(arg1);
    sheet = db.getSheetByName(arg2);
  } else {
    sheet = arg1;
  }

  if (!sheet) {
    throw new Error("getHeaders: sheet not found or invalid reference");
  }

  const lastColumn = sheet.getLastColumn();

  if (lastColumn === 0) {
    throw new Error(`getHeaders: sheet "${sheet.getName()}" has no headers`);
  }

  const headers = sheet.getRange(1, 1, 1, lastColumn).getValues()[0];

  if (!headers || headers.length === 0) {
    throw new Error(`getHeaders: empty header row in "${sheet.getName()}"`);
  }

  return headers;
}

/**
 * Convert row array to object using headers
 */
function rowToObject(headers, row) {
  if (!headers || !row) {
    return null;
  }

  const obj = {};

  headers.forEach((h, i) => {
    obj[h] = row[i];
  });

  return obj;
}

/**
 * Find row by column value (used heavily in workspace.resolver)
 */
function findRowByValue(dbRef, sheetName, columnName, value) {
  const db = resolveDb(dbRef);
  const sheet = db.getSheetByName(sheetName);

  if (!sheet) {
    return null;
  }

  const values = sheet.getDataRange().getValues();

  if (values.length < 2) {
    return null;
  }

  const headers = values[0];
  const colIndex = headers.indexOf(columnName);

  if (colIndex === -1) {
    throw new Error(`Column ${columnName} not found`);
  }

  for (let i = 1; i < values.length; i++) {
    if (values[i][colIndex] === value) {
      return {
        rowIndex: i + 1,
        data: values[i],
        headers,
      };
    }
  }

  return null;
}

/**
 * =====================================================
 * MASTER HELPERS
 * =====================================================
 */
function getAuthorizedOwnerByEmail(email) {
  const db = getMasterDatabase();

  if (!sheetExists(db, AUTH_TABLES.AUTHORIZED_EMAILS.sheet)) {
    return null;
  }

  return findOne(db, AUTH_TABLES.AUTHORIZED_EMAILS, { email });
}

function getAuthorizedOwnerById(ownerId) {
  const db = getMasterDatabase();

  if (!sheetExists(db, AUTH_TABLES.OWNERS.sheet)) {
    return null;
  }

  return findOne(db, AUTH_TABLES.OWNERS, { owner_id: ownerId });
}

function getOwnerById(ownerId) {
  const db = getMasterDatabase();

  if (!sheetExists(db, AUTH_TABLES.OWNERS.sheet)) {
    return null;
  }

  return findOne(db, AUTH_TABLES.OWNERS, { owner_id: ownerId });
}

function sanitizeTimeLogActionSuccessMessage(action, message) {
  const clean = String(message || "")
    .replace(/^Error:\s*/i, "")
    .trim();

  if (clean) {
    return clean;
  }

  switch (String(action || "").trim()) {
    case "time_in":
      return "Time in logged successfully.";

    case "time_out":
      return "Time out logged successfully.";

    case "break_start":
      return "Break started successfully.";

    case "break_end":
      return "Break ended successfully.";

    case "lunch_start":
      return "Lunch started successfully.";

    case "lunch_end":
      return "Lunch ended successfully.";

    default:
      return "Timelog action saved successfully.";
  }
}

function getWorkspaceSettings(workspace_id) {
  const db = getWorkspaceDb(workspace_id);
  const sheet = db.getSheetByName("Settings");

  if (!sheet) throw new Error("Settings sheet not found");

  const rows = sheet.getDataRange().getValues();

  const settings = {};

  rows.forEach(([key, value]) => {
    if (key) settings[key] = value;
  });

  return settings;
}

function isOvernightShift(shift) {
  if (!shift) return false;

  return timeToMinutes(shift.end_time) <= timeToMinutes(shift.start_time);
}

function timeToMinutes(time) {
  if (time == null) return null;

  const str = String(time).trim();

  if (!str.includes(":")) {
    const h = Number(str);
    return Number.isFinite(h) ? h * 60 : null;
  }

  const parts = str.split(":");

  const h = Number(parts[0]);
  const m = Number(parts[1] || 0);

  if (!Number.isFinite(h) || !Number.isFinite(m)) return null;

  return h * 60 + m;
}

function getShiftWorkDate(workspace_id, email, shift_id, timestamp) {
  const shift = getShiftById(workspace_id, shift_id);

  if (!shift) {
    throw new Error("Shift not found.");
  }

  const latestLogs = getTimeLogsByEmail(workspace_id, email, {
    shift_id,
  });

  if (latestLogs.length) {
    const state = buildTimeLogState(latestLogs);

    if (state.is_clocked_in) {
      const latest = latestLogs[latestLogs.length - 1];

      if (latest && latest.date) {
        return latest.date;
      }
    }
  }

  return resolveShiftWorkDate(shift, timestamp || new Date());
}
