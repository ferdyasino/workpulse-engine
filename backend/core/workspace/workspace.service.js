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