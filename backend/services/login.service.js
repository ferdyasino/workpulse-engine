function loginResolver(workspaceSlug, email) {

  if (!email) {
    throw new Error("Email is required");
  }

  const normalizedEmail = normalize("email", email);
  const masterDb = getMasterDatabase();

  let workspace = null;
  let workspaceSource = null;

  // =====================================================
  // ROLE NORMALIZER (SINGLE SOURCE OF TRUTH)
  // =====================================================
  function normalizeRole(role) {
    if (!role) return null;

    const r = String(role).toLowerCase();

    if (r === "superadmin") return ROLES.SUPERADMIN;
    if (r === "owner") return ROLES.ADMIN; // OWNER maps to ADMIN
    if (r === "admin") return ROLES.ADMIN;
    if (r === "hr") return ROLES.HR;
    if (r === "user" || r === "employee") return ROLES.USER;

    return null;
  }

  // =====================================================
  // 1. WORKSPACE SLUG
  // =====================================================
  if (workspaceSlug) {

    const ownerBySlug = findOne(
      masterDb,
      AUTH_TABLES.OWNERS,
      { owner_id: workspaceSlug }
    );

    if (ownerBySlug?.workspace_id) {

      const candidateWorkspace =
        getWorkspace(ownerBySlug.workspace_id);

      if (candidateWorkspace) {

        const workspaceDb = SpreadsheetApp.openById(
          candidateWorkspace.workspace_id
        );

        const workspaceUser = findOne(
          workspaceDb,
          TABLES.USERS,
          { email: normalizedEmail }
        );

        if (workspaceUser) {
          workspace = candidateWorkspace;
          workspaceSource = "owners.slug";
        }
      }
    }
  }

  // =====================================================
  // 2. EMAIL → OWNER
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
  // 3. EMAIL → AUTH USER
  // =====================================================
  if (!workspace) {

    const authUserLookup = findOne(
      masterDb,
      AUTH_TABLES.USERS,
      { email: normalizedEmail }
    );

    if (authUserLookup?.workspace_id) {
      workspace = getWorkspace(authUserLookup.workspace_id);
      workspaceSource = "auth_users";
    }
  }

  // =====================================================
  // 4. EMAIL → AUTHORIZED EMAILS (BOOTSTRAP)
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

      const workspaceId = created?.workspace?.workspace_id;

      if (!workspaceId) {
        throw new Error("Workspace creation failed during bootstrap");
      }

      workspace = getWorkspace(workspaceId);
      workspaceSource = "bootstrap";
    }
  }

  // =====================================================
  // 5. WORKSPACE REQUIRED
  // =====================================================
  if (!workspace) {
    throw new Error("Workspace could not be resolved");
  }

  const workspaceDb = SpreadsheetApp.openById(
    workspace.workspace_id
  );

  // =====================================================
  // 6. USER REQUIRED
  // =====================================================
  const workspaceUser = findOne(
    workspaceDb,
    TABLES.USERS,
    { email: normalizedEmail }
  );

  if (!workspaceUser) {
    throw new Error("User not found in resolved workspace");
  }

  const status = normalize("status", workspaceUser.status || "");

  if (status !== "ACTIVE") {
    throw new Error("User is not active");
  }

  const dept = findOne(
    workspaceDb,
    TABLES.DEPARTMENTS,
    { department_id: workspaceUser.department_id }
  );

  const schedRow = findOne(
    workspaceDb,
    TABLES.SHIFTS,
    { shift_id: workspaceUser.shift_id }
  );

  const sched = schedRow
  ? {
      shift_name: schedRow.shift_name,
      start_time: schedRow.start_time,
      end_time: schedRow.end_time,
      grace_minutes: schedRow.grace_minutes
    }
  : "error schedRow";

  const shift_name = schedRow.shift_name || "SHIFT NAME";
  const start_time = schedRow.start_time || "START";
  const end_time = schedRow.end_time || "END";
  const grace_minutes = schedRow.grace_minutes || "GRACE";



  const deptName = dept.department_name || "DEPARTMENT"

  // =====================================================
  // 7. ROLE RESOLUTION (CLEAN + CONSISTENT)
  // =====================================================
  const ownerRecord = findOne(
    masterDb,
    AUTH_TABLES.OWNERS,
    { email: normalizedEmail }
  );

  const authUser = findOne(
    masterDb,
    AUTH_TABLES.USERS,
    { email: normalizedEmail }
  );

  const normalizedAuthRole = normalizeRole(authUser?.role);

  let role = ROLES.USER;

  // 1. SUPERADMIN ALWAYS WINS
  if (normalizedAuthRole === ROLES.SUPERADMIN) {
    role = ROLES.SUPERADMIN;
  }

  // 2. OWNER IMPLIES ADMIN ACCESS
  else if (ownerRecord) {
    role = ROLES.ADMIN;
  }

  // 3. VALID AUTH ROLE
  else if (
    normalizedAuthRole &&
    WORKSPACE_ROLES.includes(normalizedAuthRole)
  ) {
    role = normalizedAuthRole;
  }

  // =====================================================
  // 8. RESPONSE
  // =====================================================
  return {
    success: true,

    // =====================================================
    // MASTER AUTH USER
    // =====================================================
    auth_user_id: authUser?.user_id || "",

    // =====================================================
    // WORKSPACE USER
    // =====================================================
    user_id: workspaceUser.user_id,
    email: workspaceUser.email,
    fullname: workspaceUser.fullname,
    shift_id: workspaceUser.shift_id,

    role,
    status,

    dept_name: dept?.department_name || "DEPARTMENT",

    sched: schedRow
      ? {
          shift_name: schedRow.shift_name,
          start_time: schedRow.start_time,
          end_time: schedRow.end_time,
          grace_minutes: schedRow.grace_minutes
        }
      : null,

    workspace_id: workspace.workspace_id,
    workspace_url: workspace.workspace_url,
    timelog_spreadsheet_id: workspace.timelog_spreadsheet_id,

    meta: {
      resolved_by: workspaceSource,
      bootstrap: workspaceSource === "bootstrap",
      workspace_source: workspaceSource
    }
  };
}