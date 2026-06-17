function loginResolver(workspaceSlug, email) {
  if (!email) throw new Error("email is required");

  const normalizedEmail = normalize("email", email);
  const masterDb = getMasterDatabase();

  let workspace = null;
  let workspaceSource = null;

  // =====================================================
  // 1. SLUG → OWNER → WORKSPACE
  // =====================================================
  if (workspaceSlug) {
    const ownerBySlug = findOne(
      masterDb,
      AUTH_TABLES.OWNERS,
      { owner_id: workspaceSlug }
    );

    if (ownerBySlug?.workspace_id) {
      workspace = getWorkspace(ownerBySlug.workspace_id);
      workspaceSource = "owners.slug";
    }
  }

  // =====================================================
  // 2. EMAIL → OWNERS
  // =====================================================
  if (!workspace) {
    const ownerByEmail = findOne(
      masterDb,
      AUTH_TABLES.OWNERS,
      { email: normalizedEmail }
    );

    if (ownerByEmail?.workspace_id) {
      workspace = getWorkspace(ownerByEmail.workspace_id);
      workspaceSource = "owners.email";
    }
  }

  // =====================================================
  // 3. EMAIL → AUTH USERS (EMPLOYEE PATH)
  // =====================================================
  if (!workspace) {
    const authUser = findOne(
      masterDb,
      AUTH_TABLES.USERS,
      { email: normalizedEmail }
    );

    if (authUser?.workspace_id) {
      workspace = getWorkspace(authUser.workspace_id);
      workspaceSource = "auth_users";
    }
  }

  // =====================================================
  // 4. EMAIL → AUTHORIZED EMAILS (BOOTSTRAP OWNER)
  // =====================================================
  if (!workspace) {
    const authorized = findOne(
      masterDb,
      AUTH_TABLES.AUTHORIZED_EMAILS,
      { email: normalizedEmail }
    );

    if (authorized) {
      console.info("🚀 Bootstrapping workspace for:", normalizedEmail);

      const created = createWorkspace(normalizedEmail);

      const workspaceId =
        created?.workspace?.workspace_id;

      if (!workspaceId) {
        throw new Error("Workspace creation failed during bootstrap");
      }

      workspace = getWorkspace(workspaceId);
      workspaceSource = "bootstrap";

      // IMPORTANT: continue flow (do NOT return early)
    }
  }

  // =====================================================
  // 5. HARD FAIL SAFETY
  // =====================================================
  if (!workspace) {
    throw new Error("Workspace could not be resolved");
  }

  // =====================================================
  // 6. OPEN WORKSPACE DB
  // =====================================================
  const workspaceDb = SpreadsheetApp.openById(
    workspace.workspace_id
  );

  // =====================================================
  // 7. FIND USER IN WORKSPACE (SOURCE OF TRUTH)
  // =====================================================
  const workspaceUser = findOne(
    workspaceDb,
    TABLES.USERS,
    { email: normalizedEmail }
  );

  if (!workspaceUser) {
    throw new Error("User not found in workspace");
  }

  const status = normalize("status", workspaceUser.status || "");
  if (status !== "ACTIVE") {
    throw new Error("User is not active");
  }

  // =====================================================
  // 8. ROLE RESOLUTION
  // =====================================================
  const ownerRecord = findOne(masterDb, AUTH_TABLES.OWNERS, {
    email: normalizedEmail
  });

  const authUser = findOne(masterDb, AUTH_TABLES.USERS, {
    email: normalizedEmail
  });

  let role = workspaceUser.role;

  if (ownerRecord) role = "OWNER";
  else if (authUser?.role) role = authUser.role;

  // =====================================================
  // 9. RESPONSE
  // =====================================================
  return {
    success: true,

    user_id: workspaceUser.user_id,
    email: workspaceUser.email,
    fullname: workspaceUser.fullname,
    role,
    status,

    workspace_id: workspace.workspace_id,
    workspace_url: workspace.workspace_url,
    timelog_spreadsheet_id: workspace.timelog_spreadsheet_id,

    meta: {
      resolved_by: workspaceSlug
        ? "owner_id"
        : workspaceSource,

      bootstrap: workspaceSource === "bootstrap",
      workspace_source: workspaceSource
    }
  };
}