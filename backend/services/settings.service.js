/**
 * =====================================================
 * SETTINGS SERVICE
 * =====================================================
 */

/**
 * Read workspace settings
 */
function workspaceSettings(workspace_id) {

  workspace_id = normalize("workspace_id", workspace_id);

  if (!workspace_id) {
    throw new Error("workspace_id is required");
  }

  const db = getWorkspaceDb(workspace_id);
  const sheet = db.getSheetByName("Settings");

  if (!sheet) {
    throw new Error("Settings sheet not found");
  }

  const values = sheet.getDataRange().getValues();

  if (values.length <= 1) {
    return [];
  }

  const headers = values.shift();

  return values
    .filter(row => normalizeId(row[0]))
    .map(row => {

      const record = {};

      headers.forEach((header, index) => {
        record[header] = deserializeSettingValue(row[index]);
      });

      return normalizeSettingRecord(record);
    });
}

/**
 * Save workspace settings
 */
function saveWorkspaceSettings(workspace_id, settingsRows) {

  workspace_id = normalize("workspace_id", workspace_id);

  if (!workspace_id) {
    throw new Error("workspace_id is required");
  }

  if (!Array.isArray(settingsRows)) {
    throw new Error("settingsRows must be an array");
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

  const values = settingsRows
    .map(normalizeSettingRecord)
    .map(setting => {

      let value;

      switch (setting.type) {

        case "boolean":
          value = setting.value ? "ENABLED" : "DISABLED";
          break;

        case "number":
          value = setting.value;
          break;

        default:
          value = serializeSettingValue(setting.value);
      }

      return [
        setting.key,
        value,
        setting.type,
        setting.group,
        setting.options.join("|"),
        setting.label,
        setting.description,
        setting.updated_at || now
      ];
    });

  sheet.clearContents();

  sheet
    .getRange(1, 1, 1, headers.length)
    .setValues([headers]);

  if (values.length) {
    sheet
      .getRange(2, 1, values.length, headers.length)
      .setValues(values);
  }

  return workspaceSettings(workspace_id);
}

/**
 * Deserialize sheet value
 */
function deserializeSettingValue(value) {

  if (value === null || value === undefined) {
    return "";
  }

  if (typeof value !== "string") {
    return value;
  }

  const trimmed = value.trim();

  if (!trimmed) {
    return "";
  }

  try {
    return JSON.parse(trimmed);
  }
  catch (_) {
    return trimmed;
  }
}

/**
 * Serialize sheet value
 */
function serializeSettingValue(value) {

  if (value === null || value === undefined) {
    return "";
  }

  if (typeof value === "object") {
    return JSON.stringify(value);
  }

  return String(value);
}