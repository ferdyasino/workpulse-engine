const USER_TABLE = TABLES.USERS;

/**
 * Normalize email for consistent duplicate checks
 */
function normalizeEmail(email) {
  if (typeof email !== "string") return "";
  return email.trim().toLowerCase();
}

/**
 * Generate employee number if not provided
 */
function generateEmployeeNo() {
  return generateId("EMP");
}

/**
 * GENERAL USER CREATION (DOMAIN-AWARE + MASTER SYNC SAFE)
 */
function createUser(workspaceId, payload, options = {}) {

  const { skipIfExists = false } = options;

  // =========================
  // 0. ROLE DEFAULT
  // =========================
  const role = payload.role || "EMPLOYEE";

  // =========================
  // 1. VALIDATION
  // =========================
  if (!payload?.email) {
    throw new Error("Email is required");
  }

  const email = normalizeEmail(payload.email);
  if (!email) throw new Error("Invalid email");

  // =========================
  // 2. ROLE RULES
  // =========================
  const requiresFullProfile = role === "EMPLOYEE" || role === "ADMIN";

  if (requiresFullProfile) {
    if (!payload.first_name && !payload.last_name && !payload.fullname) {
      throw new Error(`Full name is required for role: ${role}`);
    }
    if (!payload.department_id) {
      throw new Error(`department_id is required for role: ${role}`);
    }
  }

  if (role === "OWNER") {
    payload.first_name = payload.first_name || "Owner";
    payload.last_name = payload.last_name || "";
  }

  // =========================
  // 3. DUPLICATE CHECK (WORKSPACE)
  // =========================
  const existing = find(workspaceId, USER_TABLE)
    .filter(u => normalizeEmail(u.email) === email);

  if (existing.length > 0) {
    if (skipIfExists) return existing[0];
    throw new Error("User already exists with this email");
  }

  // =========================
  // 4. FULLNAME BUILD
  // =========================
  let fullname = payload.fullname || "";
  if (!fullname) {
    fullname = `${payload.first_name || ""} ${payload.last_name || ""}`.trim();
  }

  // =========================
  // 5. DOMAIN USER OBJECT (WORKSPACE)
  // =========================
  const user = {
    user_id: generateId("USR"),
    employee_no: payload.employee_no || generateEmployeeNo(),
    email,
    fullname,
    first_name: payload.first_name || "",
    last_name: payload.last_name || "",
    department_id: payload.department_id || "",
    shift_id: payload.shift_id || "",
    role,
    status: payload.status || "ACTIVE",
    created_at: new Date().toISOString()
  };

  // =========================
  // 6. PERSIST → WORKSPACE DB
  // =========================
  const result = insert(workspaceId, USER_TABLE, user);

  // =========================
  // 7. SYNC → MASTER DB (NEW)
  // =========================
  try {
    const masterDb = getMasterDatabase();

    insert(masterDb, AUTH_TABLES.USERS, {
      user_id: user.user_id,
      email: user.email,
      fullname: user.fullname,
      role: user.role,
      workspace_id: workspaceId,
      status: user.status,
      created_at: user.created_at,
      updated_at: new Date().toISOString()
    });

  } catch (err) {
    console.error("⚠️ Master sync failed (non-blocking):", err.toString());
  }

  return result;
}

function importUsers(workspaceId, users = [], options = {}) {

  if (!Array.isArray(users) || users.length === 0) {
    throw new Error("users must be a non-empty array");
  }

  const results = [];

  for (const payload of users) {
    try {

      // 👇 IMPORTANT: reuse single source of truth
      const result = createUser(workspaceId, payload, {
        skipIfExists: options.skipIfExists ?? true
      });

      results.push({
        success: true,
        email: payload.email,
        result
      });

    } catch (err) {
      results.push({
        success: false,
        email: payload.email,
        error: err.message
      });
    }
  }

  return {
    success: true,
    imported: results.length,
    results
  };
}