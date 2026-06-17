const USER_TABLE = TABLES.USERS;

/**
 * Generate employee number if not provided
 */
function generateEmployeeNo() {
  return generateId("EMP");
}

function getUsers(workspace_id) {
  return find(workspace_id, USER_TABLE);
}

/**
 * =====================================================
 * GENERAL USER CREATION
 * =====================================================
 */
function createUser(workspace_id, payload, options = {}) {

  const { skipIfExists = false } = options;

  // =========================
  // VALIDATION
  // =========================

  const email = normalize("email", payload.email);

  if (!email) {
    throw new Error("Email is required");
  }

  const role = normalize("role", payload.role);

  // =========================
  // ROLE RULES
  // =========================

  const requiresFullProfile =
    role === "EMPLOYEE" ||
    role === "ADMIN";

  if (requiresFullProfile) {
    if (
      !payload.first_name &&
      !payload.last_name &&
      !payload.fullname
    ) {
      throw new Error(`Full name is required for role: ${role}`);
    }
  }

  if (role === "OWNER") {
    payload.first_name = payload.first_name || "Owner";
    payload.last_name = payload.last_name || "";
  }

  // =========================
  // VALIDATE RELATIONS (SAFE GUARDS)
  // =========================

  if (payload.department_id) {
    const dept = findOne(workspace_id, TABLES.DEPARTMENTS, {
      department_id: payload.department_id
    });

    if (!dept) throw new Error("Invalid department_id");
  }

  if (payload.position_id) {
    const pos = findOne(workspace_id, TABLES.POSITIONS, {
      position_id: payload.position_id
    });

    if (!pos) throw new Error("Invalid position_id");
  }

  if (payload.shift_id) {
    const shift = findOne(workspace_id, TABLES.SHIFTS, {
      shift_id: payload.shift_id
    });

    if (!shift) throw new Error("Invalid shift_id");
  }

  // =========================
  // DUPLICATE CHECK
  // =========================

  const existing = find(workspace_id, USER_TABLE)
    .filter(user =>
      normalize("email", user.email) === email
    );

  if (existing.length > 0) {
    if (skipIfExists) return existing[0];

    throw new Error("User already exists with this email");
  }

  // =========================
  // FULLNAME BUILD
  // =========================

  let fullname = payload.fullname || "";

  if (!fullname) {
    fullname =
      `${payload.first_name || ""} ${payload.last_name || ""}`.trim();
  }

  fullname = normalize("fullname", fullname);

  // =========================
  // DOMAIN USER OBJECT
  // =========================

  const user = {
    user_id: generateId("USR"),
    employee_no: payload.employee_no || generateEmployeeNo(),

    email,
    fullname,

    first_name: payload.first_name || "",
    last_name: payload.last_name || "",

    department_id: payload.department_id || "",
    position_id: payload.position_id || "",
    shift_id: payload.shift_id || "",

    role,
    status: normalize("status", payload.status),

    created_at: new Date().toISOString()
  };

  // =========================
  // SAVE WORKSPACE USER
  // =========================

  const result = insert(workspace_id, USER_TABLE, user);

  // =========================
  // MASTER SYNC
  // =========================

  try {
    const masterDb = getMasterDatabase();

    insert(masterDb, AUTH_TABLES.USERS, {
      user_id: user.user_id,
      email: user.email,
      fullname: user.fullname,
      role: user.role,
      workspace_id,
      status: user.status,
      created_at: user.created_at,
      updated_at: new Date().toISOString()
    });

  } catch (err) {
    console.error("⚠️ Master sync failed (non-blocking):", err.toString());
  }

  return result;
}

function updateUser(workspace_id, userId, updates = {}) {

  if (!userId) throw new Error("userId is required");

  const existing = findOne(workspace_id, USER_TABLE, {
    user_id: userId
  });

  if (!existing) throw new Error("User not found");

  // =========================
  // EMAIL CHECK
  // =========================
  if (updates.email) {
    const email = normalize("email", updates.email);

    const duplicate = find(workspace_id, USER_TABLE)
      .find(u =>
        u.user_id !== userId &&
        normalize("email", u.email) === email
      );

    if (duplicate) {
      throw new Error("User already exists with this email");
    }

    updates.email = email;
  }

  // =========================
  // RELATION VALIDATION (SAFE EXTENSION)
  // =========================

  if (updates.department_id !== undefined) {
    if (updates.department_id) {
      const dept = findOne(workspace_id, TABLES.DEPARTMENTS, {
        department_id: updates.department_id
      });
      if (!dept) throw new Error("Invalid department_id");
    }
  }

  if (updates.position_id !== undefined) {
    if (updates.position_id) {
      const pos = findOne(workspace_id, TABLES.POSITIONS, {
        position_id: updates.position_id
      });
      if (!pos) throw new Error("Invalid position_id");
    }
  }

  if (updates.shift_id !== undefined) {
    if (updates.shift_id) {
      const shift = findOne(workspace_id, TABLES.SHIFTS, {
        shift_id: updates.shift_id
      });
      if (!shift) throw new Error("Invalid shift_id");
    }
  }

  // =========================
  // FULLNAME REBUILD
  // =========================

  if (updates.first_name !== undefined || updates.last_name !== undefined) {
    const firstName = updates.first_name ?? existing.first_name ?? "";
    const lastName = updates.last_name ?? existing.last_name ?? "";

    updates.fullname = normalize(
      "fullname",
      `${firstName} ${lastName}`.trim()
    );
  }

  if (updates.fullname) {
    updates.fullname = normalize("fullname", updates.fullname);
  }

  if (updates.role) updates.role = normalize("role", updates.role);
  if (updates.status) updates.status = normalize("status", updates.status);

  const success = update(workspace_id, USER_TABLE, userId, updates);

  if (!success) throw new Error("Failed to update user");

  // =========================
  // MASTER SYNC
  // =========================

  try {
    update(getMasterDatabase(), AUTH_TABLES.USERS, userId, {
      email: updates.email ?? existing.email,
      fullname: updates.fullname ?? existing.fullname,
      role: updates.role ?? existing.role,
      status: updates.status ?? existing.status,
      updated_at: new Date().toISOString()
    });
  } catch (err) {
    console.error("⚠️ Master sync update failed:", err.toString());
  }

  return {
    success: true,
    user_id: userId
  };
}

/**
 * =====================================================
 * BULK IMPORT
 * =====================================================
 */
function importUsers(
  workspace_id,
  users = [],
  options = {}
) {

  if (!Array.isArray(users) || users.length === 0) {
    throw new Error(
      "users must be a non-empty array"
    );
  }

  const results = [];

  for (const payload of users) {

    try {

      const result = createUser(
        workspace_id,
        payload,
        {
          skipIfExists:
            options.skipIfExists ?? true
        }
      );

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

function deactivateUser(workspace_id, userId) {

  const status = normalize("status", "INACTIVE");

  // 1. Workspace DB update
  const workspaceOk = update(
    workspace_id,
    TABLES.USERS,
    userId,
    { status }
  );

  if (!workspaceOk) {
    throw new Error("User not found in workspace");
  }

  // 2. Master DB sync
  try {

    const masterOk = update(
      getMasterDatabase(),
      AUTH_TABLES.USERS,
      userId,
      {
        status,
        updated_at: new Date().toISOString()
      }
    );

    if (!masterOk) {
      console.warn("Master user not found during deactivation");
    }

  } catch (err) {
    console.error(
      "⚠️ Master sync failed (non-blocking):",
      err.toString()
    );
  }

  return {
    success: true,
    user_id: userId,
    status
  };
}

function deleteUser(workspace_id, userId) {

  if (!userId) {
    throw new Error("userId is required");
  }

  // =========================
  // 1. CHECK LOCAL EXISTENCE
  // =========================
  const existing = findOne(
    workspace_id,
    TABLES.USERS,
    { user_id: userId }
  );

  if (!existing) {
    throw new Error("User not found in workspace");
  }

  // =========================
  // 2. HARD DELETE LOCAL WORKSPACE
  // =========================
  const workspaceOk = remove(
    workspace_id,
    TABLES.USERS,
    userId
  );

  if (!workspaceOk) {
    throw new Error("Failed to delete user from workspace");
  }

  // =========================
  // 3. SOFT DELETE IN MASTER (AUTH TABLE)
  // =========================
  try {

    const status = normalize("status", "INACTIVE");

    const masterOk = update(
      getMasterDatabase(),
      AUTH_TABLES.USERS,
      userId,
      {
        status,
        updated_at: new Date().toISOString()
      }
    );

    if (!masterOk) {
      console.warn("Master user not found during soft delete sync");
    }

  } catch (err) {
    console.error(
      "⚠️ Master sync failed (non-blocking):",
      err.toString()
    );
  }

  return {
    success: true,
    user_id: userId,
    workspace_deleted: true,
    master_status: "INACTIVE"
  };
}