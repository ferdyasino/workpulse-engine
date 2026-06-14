function loginResolver(workspaceId, email) {
  if (!workspaceId) throw new Error("workspaceId is required");
  if (!email) throw new Error("email is required");

  const normalizedEmail = normalizeEmail(email);

  // =========================
  // 1. LOAD WORKSPACE FIRST
  // =========================
  const workspace = getWorkspace(workspaceId);

  if (!workspace) {
    throw new Error("Invalid workspace");
  }

  const workspaceDb = SpreadsheetApp.openById(
    workspace.workspace_spreadsheet_id || workspaceId
  );

  // =========================
  // 2. FIND USER INSIDE WORKSPACE (PRIMARY SOURCE)
  // =========================
  const workspaceUser = findOne(
    workspaceDb,
    TABLES.USERS,
    { email: normalizedEmail }
  );

  if (!workspaceUser) {
    throw new Error("User not found in workspace");
  }

  if (workspaceUser.status !== "ACTIVE") {
    throw new Error("User is not active");
  }

  // =========================
  // 3. LOAD MASTER CONTEXT (OPTIONAL ENRICHMENT)
  // =========================
  const masterDb = getMasterDatabase();

  const masterUser = findOne(
    masterDb,
    AUTH_TABLES.USERS,
    { email: normalizedEmail }
  );

  // =========================
  // 4. RETURN FULL AUTH CONTEXT
  // =========================
  return {
    success: true,
    user_id: workspaceUser.user_id,
    email: workspaceUser.email,
    name: workspaceUser.name,
    role: workspaceUser.role,
    status: workspaceUser.status,
    workspace_id: workspaceId,
    workspace_url: workspace.workspace_url,
    timelog_spreadsheet_id: workspace.timelog_spreadsheet_id
  };
}