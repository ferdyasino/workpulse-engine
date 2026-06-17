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
