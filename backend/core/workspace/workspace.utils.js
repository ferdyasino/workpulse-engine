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

function ensureWorkspaceSchema(dbRef) {
  const db = resolveDb(dbRef);

  Object.values(TABLES).forEach(table => {
    let sheet = db.getSheetByName(table.sheet);

    if (!sheet) {
      sheet = db.insertSheet(table.sheet);

      if (table.schema?.length) {
        sheet.getRange(1, 1, 1, table.schema.length)
          .setValues([table.schema]);
      }
    }
  });
}
