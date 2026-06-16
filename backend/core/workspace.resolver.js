/**
 * =====================================================
 * WORKSPACE RESOLVER (FINAL SYNCED VERSION)
 * =====================================================
 */

/**
 * Ensure Owners sheet exists AND schema is correct
 * (MASTER DB is source of truth)
 */
function ensureOwnersSheet() {
  const db = getMasterDatabase();
  const table = AUTH_TABLES.OWNERS;

  let sheet = db.getSheetByName(table.sheet);

  if (!sheet) {
    sheet = db.insertSheet(table.sheet);
  }

  const expected = AUTH_SCHEMA.OWNERS;

  const current =
    sheet.getLastRow() > 0 && sheet.getLastColumn() > 0
      ? sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0]
      : [];

  const isValidSchema =
    Array.isArray(current) &&
    current.length === expected.length &&
    current.every((v, i) => v === expected[i]);

  if (!isValidSchema) {
    sheet.clear();

    sheet
      .getRange(1, 1, 1, expected.length)
      .setValues([expected]);

    sheet.setFrozenRows(1);
  }

  return sheet;
}


/**
 * SAFE HEADER FETCH (never breaks on empty sheet)
 */
function safeGetHeaders(db, sheetName) {
  const sheet = db.getSheetByName(sheetName);
  if (!sheet) return [];

  const lastCol = sheet.getLastColumn();
  if (lastCol < 1) return [];

  return sheet.getRange(1, 1, 1, lastCol).getValues()[0] || [];
}


/**
 * =========================
 * READ OPERATIONS
 * =========================
 */

function getWorkspace(workspace_id) {
  if (!workspace_id) throw new Error("workspace_id is required");

  ensureOwnersSheet();

  const db = getMasterDatabase();

  const result = findRowByValue(
    db,
    AUTH_TABLES.OWNERS.sheet,
    "workspace_id",
    workspace_id
  );

  if (!result) {
    throw new Error(`Workspace not found: ${workspace_id}`);
  }

  const headers = safeGetHeaders(db, AUTH_TABLES.OWNERS.sheet);
  return rowToObject(headers, result.data);
}


function getWorkspaceDb(workspace_id) {
  if (!workspace_id) throw new Error("workspace_id is required");
  return SpreadsheetApp.openById(workspace_id);
}


function getTimelogDb(workspace_id) {
  const workspace = getWorkspace(workspace_id);

  if (!workspace.timelog_spreadsheet_id) {
    throw new Error(`Missing timelog DB: ${workspace_id}`);
  }

  return SpreadsheetApp.openById(workspace.timelog_spreadsheet_id);
}


function getWorkspaceByEmail(email) {
  if (!email) return null;

  const normalized = email.trim().toLowerCase();

  ensureOwnersSheet();

  const db = getMasterDatabase();

  const result = findRowByValue(
    db,
    AUTH_TABLES.OWNERS.sheet,
    "email",
    normalized
  );

  if (!result) return null;

  const headers = safeGetHeaders(db, AUTH_TABLES.OWNERS.sheet);
  return rowToObject(headers, result.data);
}


function workspaceExists(workspace_id) {
  if (!workspace_id) return false;

  ensureOwnersSheet();

  const db = getMasterDatabase();

  return !!findRowByValue(
    db,
    AUTH_TABLES.OWNERS.sheet,
    "workspace_id",
    workspace_id
  );
}


/**
 * =========================
 * UPSERT OWNER
 * =========================
 */
function registerOwnerWorkspace(
  ownerKey,
  workspace_id,
  workspaceUrl,
  timelogId,
  timelogUrl
) {
  if (!ownerKey) throw new Error("ownerKey is required");

  ensureOwnersSheet();

  const db = getMasterDatabase();
  const table = AUTH_TABLES.OWNERS;

  let existing = getOwnerById(ownerKey);

  if (!existing && ownerKey.includes("@")) {
    existing = getWorkspaceByEmail(ownerKey);
  }

  const now = new Date().toISOString();

  if (existing) {
    console.info(`🔄 Updating owner: ${ownerKey}`);

    return update(db, table, existing.owner_id, {
      email: existing.email || ownerKey,
      workspace_id: workspace_id,
      workspace_spreadsheet_id: workspace_id,
      workspace_url: workspaceUrl,
      timelog_spreadsheet_id: timelogId,
      timelog_url: timelogUrl,
      status: "ACTIVE",
      updated_at: now
    });
  }

  console.info(`📝 Creating owner: ${ownerKey}`);

  return insert(db, table, {
    owner_id: ownerKey,
    email: ownerKey,
    fullname: "",
    workspace_id: workspace_id,
    workspace_spreadsheet_id: workspace_id,
    workspace_url: workspaceUrl,
    timelog_spreadsheet_id: timelogId,
    timelog_url: timelogUrl,
    status: "ACTIVE",
    created_at: now,
    updated_at: now
  });
}


/**
 * =========================
 * WORKSPACE CREATION
 * =========================
 */
function createWorkspace(email) {
  if (!email) throw new Error("email is required");

  const normalizedEmail = email.trim().toLowerCase();

  ensureOwnersSheet();

  // 1. duplicate check
  const existing = getWorkspaceByEmail(normalizedEmail);

  if (existing?.workspace_id && existing?.workspace_spreadsheet_id) {
    console.info(`✅ Workspace exists: ${normalizedEmail}`);

    return {
      success: true,
      alreadyExists: true,
      workspace: existing
    };
  }

  // 2. authorization
  const owner = getAuthorizedOwnerByEmail(normalizedEmail);
  if (!owner) {
    throw new Error(`Email not authorized: ${normalizedEmail}`);
  }

  const workspaceName = owner.fullname || "Unnamed Workspace";
  const createdAt = new Date().toISOString();

  console.info(`🚀 Creating workspace: ${normalizedEmail}`);

  try {
    // 3. create spreadsheets
    const ss = SpreadsheetApp.create(workspaceName);
    const timelogSS = SpreadsheetApp.create(`${workspaceName} - TimeLogs`);

    const workspace_id = ss.getId();
    const timelogId = timelogSS.getId();

    // 4. setup workspace sheets
    const SHEETS = {
      Settings: SCHEMA.SETTINGS,
      Users: SCHEMA.USERS,
      Departments: SCHEMA.DEPARTMENTS,
      Shifts: SCHEMA.SHIFTS,
      "Attendance Index": SCHEMA.ATTENDANCE_INDEX,
      Reports: null,
      "Audit Logs": null
    };

    const base = ss.getSheets()[0];

    Object.entries(SHEETS).forEach(([name, schema], i) => {
      const sheet = i === 0 ? base : ss.insertSheet();
      sheet.setName(name);
      sheet.setFrozenRows(1);

      if (schema?.length) {
        sheet.getRange(1, 1, 1, schema.length).setValues([schema]);
      }
    });

    // 5. settings
    const settings = ss.getSheetByName("Settings");
    settings.clear();

    settings.getRange(1, 1, 1, 2).setValues([["key", "value"]]);

    settings.getRange(2, 1, 5, 2).setValues([
      ["WORKSPACE_ID", workspace_id],
      ["OWNER_EMAIL", normalizedEmail],
      ["OWNER_NAME", owner.fullname || ""],
      ["CREATED_AT", createdAt],
      ["TIMEZONE", Session.getScriptTimeZone()]
    ]);

    // 6. timelog
    const logSheet = timelogSS.getSheets()[0];
    logSheet.setName(EXTERNAL_TABLES.TIME_LOGS.sheet);
    logSheet.clear();

    logSheet.getRange(1, 1, 1, EXTERNAL_SCHEMA.TIME_LOGS.length)
      .setValues([EXTERNAL_SCHEMA.TIME_LOGS]);

    // 7. seed
    const seedResult = seedWorkspace(workspace_id, {
      email: normalizedEmail,
      fullname: owner.fullname || ""
    });

    // 8. register owner
    registerOwnerWorkspace(
      normalizedEmail,
      workspace_id,
      ss.getUrl(),
      timelogId,
      timelogSS.getUrl()
    );

    console.info(`✅ Workspace created: ${workspace_id}`);

    return {
      success: true,
      workspace: { workspace_id, url: ss.getUrl(), name: workspaceName },
      timelogs: { timelogId, url: timelogSS.getUrl() },
      seeded: seedResult.seeded
    };

  } catch (err) {
    console.error(`❌ createWorkspace failed:`, err);
    throw err;
  }
}