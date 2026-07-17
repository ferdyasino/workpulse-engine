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

    sheet.getRange(1, 1, 1, expected.length).setValues([expected]);

    sheet.setFrozenRows(1);
  }

  return sheet;
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

  const result = findRowByValue(db, AUTH_TABLES.OWNERS.sheet, "workspace_id", workspace_id);

  if (!result) {
    throw new Error(`Workspace not found: ${workspace_id}`);
  }

  const headers = safeGetHeaders(db, AUTH_TABLES.OWNERS.sheet);
  return rowToObject(headers, result.data);
}

function workspaceExists(workspace_id) {
  if (!workspace_id) return false;

  ensureOwnersSheet();

  const db = getMasterDatabase();

  return !!findRowByValue(db, AUTH_TABLES.OWNERS.sheet, "workspace_id", workspace_id);
}

function getWorkspaceDb(workspace_id) {
  if (!workspace_id) throw new Error("workspace_id is required");
  // @ts-ignore
  return SpreadsheetApp.openById(workspace_id);
}

function registerOwnerWorkspace(ownerKey, workspace_id, workspaceUrl, timelogId, timelogUrl) {
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
      workspace_url: workspaceUrl,
      timelog_spreadsheet_id: timelogId,
      timelog_url: timelogUrl,
      status: "ACTIVE",
      updated_at: now,
    });
  }

  console.info(`📝 Creating owner: ${ownerKey}`);

  return insert(db, table, {
    owner_id: ownerKey,
    email: ownerKey,
    fullname: "",
    workspace_id: workspace_id,
    workspace_url: workspaceUrl,
    timelog_spreadsheet_id: timelogId,
    timelog_url: timelogUrl,
    status: "ACTIVE",
    created_at: now,
    updated_at: now,
  });
}

function getTimelogDb(workspace_id) {
  const workspace = getWorkspace(workspace_id);

  if (!workspace.timelog_spreadsheet_id) {
    throw new Error(`Missing timelog DB: ${workspace_id}`);
  }

  // @ts-ignore
  return SpreadsheetApp.openById(workspace.timelog_spreadsheet_id);
}

function getWorkspaceByEmail(email) {
  if (!email) return null;

  const normalized = email.trim().toLowerCase();

  ensureOwnersSheet();

  const db = getMasterDatabase();

  const result = findRowByValue(db, AUTH_TABLES.OWNERS.sheet, "email", normalized);

  if (!result) return null;

  const headers = safeGetHeaders(db, AUTH_TABLES.OWNERS.sheet);
  return rowToObject(headers, result.data);
}
