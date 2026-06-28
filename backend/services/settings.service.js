/**
 * =====================================================
 * SETTINGS SERVICE (SCHEMA-DRIVEN)
 * =====================================================
 */

/**
 * Read workspace settings (structured rows)
 */
function workspaceSettings(workspace_id) {
  const db = getWorkspaceDb(workspace_id);
  const sheet = db.getSheetByName("Settings");

  if (!sheet) {
    throw new Error("Settings sheet not found");
  }

  const rows = sheet.getDataRange().getValues();

  if (!rows || rows.length < 2) return [];

  const headers = rows[0];

  const dataRows = rows.slice(1);

  return dataRows
    .filter(row => row[0]) // key must exist
    .map(row => {
      const obj = {};

      headers.forEach((h, i) => {
        obj[h] = deserializeSettingValue(row[i]);
      });

      return obj;
    });
}

/**
 * Write workspace settings (FULL REPLACE)
 */
function saveWorkspaceSettings(workspace_id, settingsRows) {
  if (!workspace_id) {
    throw new Error("workspace_id is required");
  }

  if (!Array.isArray(settingsRows)) {
    throw new Error("settings must be an array of rows");
  }

  const db = getWorkspaceDb(workspace_id);
  const sheet = db.getSheetByName("Settings");

  if (!sheet) {
    throw new Error("Settings sheet not found");
  }

  const headers = [
    "key",
    "value",
    "type",
    "group",
    "options",
    "label",
    "description",
    "updated_at"
  ];

  const now = new Date();

  const values = settingsRows.map(row => {
    return [
      row.key,
      serializeSettingValue(row.value),
      row.type || "",
      row.group || "",
      row.options || "",
      row.label || "",
      row.description || "",
      row.updated_at || now
    ];
  });

  // overwrite entire sheet
  sheet.clearContents();

  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);

  if (values.length) {
    sheet.getRange(2, 1, values.length, headers.length).setValues(values);
  }

  return workspaceSettings(workspace_id);
}

/**
 * Deserialize values (supports JSON + primitives)
 */
function deserializeSettingValue(value) {
  if (value === null || value === undefined) return "";

  if (typeof value !== "string") return value;

  const trimmed = value.trim();

  if (!trimmed) return "";

  try {
    return JSON.parse(trimmed);
  } catch (_) {
    return value;
  }
}

/**
 * Serialize values for sheet storage
 */
function serializeSettingValue(value) {
  if (value === null || value === undefined) return "";

  if (typeof value === "object") {
    return JSON.stringify(value);
  }

  return value;
}