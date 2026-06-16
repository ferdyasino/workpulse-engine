function loginResolver(workspace_id, email) {
  if (!workspace_id) throw new Error("workspace_id is required");
  if (!email) throw new Error("email is required");

  // =========================
  // NORMALIZE INPUT
  // =========================
  const normalizedEmail = normalize("email", email);

  // =========================
  // 1. LOAD WORKSPACE
  // =========================
  const workspace = getWorkspace(workspace_id);

  if (!workspace) {
    throw new Error("Invalid workspace");
  }

  const workspaceDb = SpreadsheetApp.openById(
    workspace.workspace_spreadsheet_id || workspace_id
  );

  // =========================
  // 2. FIND USER (WORKSPACE DB)
  // =========================
  const workspaceUser = findOne(
    workspaceDb,
    TABLES.USERS,
    { email: normalizedEmail }
  );

  if (!workspaceUser) {
    throw new Error("User not found in workspace");
  }

  // =========================
  // STATUS CHECK (NORMALIZED)
  // =========================
  const status = normalize("status", workspaceUser.status);

  if (status !== "ACTIVE") {
    throw new Error("User is not active");
  }

  // =========================
  // 3. MASTER CONTEXT (OPTIONAL)
  // =========================
  const masterDb = getMasterDatabase();

  const masterUser = findOne(
    masterDb,
    AUTH_TABLES.USERS,
    { email: normalizedEmail }
  );

  // =========================
  // 4. RETURN AUTH CONTEXT
  // =========================
  return {
    success: true,
    user_id: workspaceUser.user_id,
    email: workspaceUser.email,
    fullname: workspaceUser.fullname,
    role: workspaceUser.role,
    status,
    workspace_id: workspace_id,
    workspace_url: workspace.workspace_url,
    timelog_spreadsheet_id: workspace.timelog_spreadsheet_id
  };
}