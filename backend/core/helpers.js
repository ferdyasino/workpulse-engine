/**
 * =====================================================
 * CORE HELPERS
 * =====================================================
 */
function getMasterDatabase() {
  if (!DB_CONFIG.AUTH_SPREADSHEET_ID) {
    throw new Error("Master AUTH_SPREADSHEET_ID not configured");
  }

  return SpreadsheetApp.openById(DB_CONFIG.AUTH_SPREADSHEET_ID);
}

/**
 * Resolve spreadsheet (string ID or Spreadsheet object)
 */
function resolveDb(dbRef) {
  if (typeof dbRef === "string") {
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

  const headers = sheet
    .getRange(1, 1, 1, lastColumn)
    .getValues()[0];

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
        headers
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

  return findOne(
    db,
    AUTH_TABLES.AUTHORIZED_EMAILS,
    { email }
  );
}

function getAuthorizedOwnerById(ownerId) {

  const db = getMasterDatabase();

  if (!sheetExists(db, AUTH_TABLES.OWNERS.sheet)) {
    return null;
  }

  return findOne(
    db,
    AUTH_TABLES.OWNERS,
    { owner_id: ownerId }
  );
}

function getOwnerById(ownerId) {

  const db = getMasterDatabase();

  if (!sheetExists(db, AUTH_TABLES.OWNERS.sheet)) {
    return null;
  }

  return findOne(
    db,
    AUTH_TABLES.OWNERS,
    { owner_id: ownerId }
  );
}