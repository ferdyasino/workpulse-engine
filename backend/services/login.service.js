function loginResolver(workspaceId, email) {
  if (!workspaceId) throw new Error("workspaceId is required");
  if (!email) throw new Error("email is required");

  // =========================
  // NORMALIZE INPUT
  // =========================
  const normalizedEmail = normalize("email", email);

  // =========================
  // 1. LOAD WORKSPACE
  // =========================
  const workspace = getWorkspace(workspaceId);

  if (!workspace) {
    throw new Error("Invalid workspace");
  }

  const workspaceDb = SpreadsheetApp.openById(
    workspace.workspace_spreadsheet_id || workspaceId
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
    workspace_id: workspaceId,
    workspace_url: workspace.workspace_url,
    timelog_spreadsheet_id: workspace.timelog_spreadsheet_id
  };
}