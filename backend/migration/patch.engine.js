
function patchWorkspace(email, options) {
  options = Object.assign({
    patchWorkspace: true,
    patchTimelog: true
  }, options || {});

  if (!email || email === "*" || String(email).toLowerCase() === "all") {
    return patchAllWorkspaces(options);
  }

  return patchSingleWorkspace(email, options);
}

/**
 * =====================================================
 * PATCH ALL WORKSPACES
 * =====================================================
 */
function patchAllWorkspaces(options) {
  ensureOwnersSheet();

  const db = getMasterDatabase();
  const sheet = db.getSheetByName(AUTH_TABLES.OWNERS.sheet);

  const headers = safeGetHeaders(db, AUTH_TABLES.OWNERS.sheet);

  if (sheet.getLastRow() <= 1) {
    return {
      total: 0,
      success: 0,
      failed: 0
    };
  }

  const rows = sheet
    .getRange(
      2,
      1,
      sheet.getLastRow() - 1,
      headers.length
    )
    .getValues();

  let success = 0;
  let failed = 0;

  rows.forEach(row => {
    const owner = rowToObject(headers, row);

    if (!owner.email) {
      return;
    }

    try {
      patchSingleWorkspace(owner.email, options);
      success++;

    } catch (err) {

      failed++;

      Logger.log(
        `[FAILED] ${owner.email}\n${err.message}`
      );
    }
  });

  Logger.log(
    `Workspace Patch Complete\n` +
    `Total   : ${rows.length}\n` +
    `Success : ${success}\n` +
    `Failed  : ${failed}`
  );

  return {
    total: rows.length,
    success,
    failed
  };
}

/**
 * =====================================================
 * PATCH SINGLE WORKSPACE
 * =====================================================
 */
function patchSingleWorkspace(email, options) {

  const owner = getWorkspaceByEmail(email);

  if (!owner) {
    throw new Error(`Owner not found: ${email}`);
  }

  if (
    options.patchWorkspace &&
    owner.workspace_id
  ) {
    patchDatabase(
      SpreadsheetApp.openById(owner.workspace_id),
      TABLES
    );
  }

  if (
    options.patchTimelog &&
    owner.timelog_spreadsheet_id
  ) {
    patchDatabase(
      SpreadsheetApp.openById(owner.timelog_spreadsheet_id),
      EXTERNAL_TABLES
    );
  }

  SpreadsheetApp.flush();

  Logger.log(
    `[SUCCESS] ${owner.email}`
  );

  return true;
}

/**
 * =====================================================
 * PATCH DATABASE
 * =====================================================
 */
function patchDatabase(db, registry) {

  Object.values(registry)
    .forEach(table => patchTable(db, table));

}

/**
 * =====================================================
 * PATCH TABLE
 * =====================================================
 */
function patchTable(db, table) {

  let sheet = db.getSheetByName(table.sheet);

  if (!sheet) {
    sheet = db.insertSheet(table.sheet);
  }

  const expected = table.schema;

  const lastRow = sheet.getLastRow();
  const lastCol = sheet.getLastColumn();

  if (lastRow === 0 || lastCol === 0) {

    sheet
      .getRange(1, 1, 1, expected.length)
      .setValues([expected]);

    sheet.setFrozenRows(1);

    Logger.log(`[CREATE] ${table.sheet}`);

    return;
  }

  const values = sheet
    .getRange(1, 1, lastRow, lastCol)
    .getValues();

  const current = values[0];

  const identical =
    current.length === expected.length &&
    current.every((v, i) => v === expected[i]);

  if (identical) {
    return;
  }

  const map = {};

  current.forEach((header, index) => {
    map[header] = index;
  });

  const migrated = values
    .slice(1)
    .map(row =>
      expected.map(header =>
        map.hasOwnProperty(header)
          ? row[map[header]]
          : ""
      )
    );

  sheet.clearContents();

  sheet
    .getRange(1, 1, 1, expected.length)
    .setValues([expected]);

  if (migrated.length) {

    sheet
      .getRange(
        2,
        1,
        migrated.length,
        expected.length
      )
      .setValues(migrated);

  }

  sheet.setFrozenRows(1);

  Logger.log(
    `[PATCH] ${table.sheet} (${current.length} → ${expected.length})`
  );
}