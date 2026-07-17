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
 * MASTER AUTH USER HELPERS
 * =====================================================
 */

function getMasterUsers() {
  return find(getMasterDatabase(), AUTH_TABLES.USERS);
}

function findAuthUserByEmail(email) {
  const normalizedEmail = normalize("email", email);
  if (!normalizedEmail) return null;

  return findOne(getMasterDatabase(), AUTH_TABLES.USERS, {
    email: normalizedEmail,
  });
}

function getUserByEmail(workspace_id, email, options = {}) {
  const normalizedEmail = normalize("email", email);
  if (!normalizedEmail) return null;

  const { source = "workspace" } = options;

  // =========================
  // WORKSPACE SOURCE (DEFAULT)
  // =========================
  if (source === "workspace") {
    const users = find(workspace_id, TABLES.USERS);

    return users.find((u) => normalize("email", u.email) === normalizedEmail) || null;
  }

  // =========================
  // MASTER AUTH SOURCE
  // =========================
  if (source === "auth") {
    return findAuthUserByEmail(normalizedEmail);
  }

  // =========================
  // FALLBACK: workspace → auth
  // =========================
  return (
    getUserByEmail(workspace_id, normalizedEmail, { source: "workspace" }) ||
    findAuthUserByEmail(normalizedEmail)
  );
}

function getUserById(workspace_id, user_id) {
  const users = find(workspace_id, TABLES.USERS);
  return users.find((u) => u.user_id === user_id) || null;
}

function findAuthUserByGoogleSub(googleSub) {
  if (!googleSub) return null;

  return findOne(getMasterDatabase(), AUTH_TABLES.USERS, {
    google_sub: String(googleSub).trim(),
  });
}

/**
 * Link verified Google identity to an existing AUTH user.
 * This does NOT create a new user. It only binds Google identity
 * to an already existing auth user record.
 */
function linkGoogleAccountToAuthUser(userId, googleProfile = {}) {
  if (!userId) throw new Error("userId is required");

  const authUser = findOne(getMasterDatabase(), AUTH_TABLES.USERS, {
    user_id: userId,
  });

  if (!authUser) {
    throw new Error("Auth user not found");
  }

  const googleSub = String(googleProfile.sub || "").trim();
  const googleEmail = normalize("email", googleProfile.email || "");

  if (!googleSub) {
    throw new Error("googleProfile.sub is required");
  }

  // Prevent linking one Google account to multiple users
  const existingByGoogleSub = findAuthUserByGoogleSub(googleSub);
  if (existingByGoogleSub && existingByGoogleSub.user_id !== userId) {
    throw new Error("This Google account is already linked to another user");
  }

  let authProvider = authUser.auth_provider || AUTH_PROVIDERS.PASSWORD;

  if (authProvider === AUTH_PROVIDERS.PASSWORD) {
    authProvider = AUTH_PROVIDERS.BOTH;
  } else if (authProvider === AUTH_PROVIDERS.GOOGLE) {
    authProvider = AUTH_PROVIDERS.GOOGLE;
  } else {
    authProvider = AUTH_PROVIDERS.BOTH;
  }

  update(getMasterDatabase(), AUTH_TABLES.USERS, userId, {
    google_sub: googleSub,
    google_email: googleEmail || authUser.google_email || "",
    auth_provider: authProvider,
    updated_at: new Date().toISOString(),
  });

  return {
    success: true,
    user_id: userId,
    google_sub: googleSub,
    google_email: googleEmail,
  };
}

/**
 * Update last login timestamp for AUTH user.
 * Call this after successful login completion.
 */
function touchAuthUserLastLogin(userId) {
  if (!userId) throw new Error("userId is required");

  return update(getMasterDatabase(), AUTH_TABLES.USERS, userId, {
    last_login_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });
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
  const fullname = resolveFullname(payload);

  // =========================
  // ROLE RULES
  // =========================
  const requiresFullProfile = role === "EMPLOYEE" || role === "ADMIN";

  if (requiresFullProfile && !fullname) {
    throw new Error(`Full name is required for role: ${role}`);
  }

  if (role === "OWNER" && !fullname) {
    throw new Error("Full name is required for role: OWNER");
  }

  // =========================
  // VALIDATE RELATIONS (SAFE GUARDS)
  // =========================
  if (payload.department_id) {
    const dept = findOne(workspace_id, TABLES.DEPARTMENTS, {
      department_id: payload.department_id,
    });

    if (!dept) throw new Error("Invalid department_id");
  }

  if (payload.position_id) {
    const pos = findOne(workspace_id, TABLES.POSITIONS, {
      position_id: payload.position_id,
    });

    if (!pos) throw new Error("Invalid position_id");
  }

  if (payload.shift_id) {
    const shift = findOne(workspace_id, TABLES.SHIFTS, {
      shift_id: payload.shift_id,
    });

    if (!shift) throw new Error("Invalid shift_id");
  }

  // =========================
  // DUPLICATE CHECK
  // =========================
  const existing = find(workspace_id, USER_TABLE).filter(
    (user) => normalize("email", user.email) === email,
  );

  if (existing.length > 0) {
    if (skipIfExists) return existing[0];
    throw new Error("User already exists with this email");
  }

  // =========================
  // DOMAIN USER OBJECT
  // =========================
  const user = {
    user_id: payload.user_id || generateId("USR"),
    employee_no: payload.employee_no || generateEmployeeNo(),
    email,
    fullname,
    department_id: payload.department_id || "",
    position_id: payload.position_id || "",
    shift_id: payload.shift_id || "",
    role,
    status: normalize("status", payload.status),
    created_at: payload.created_at || new Date().toISOString(),
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

      auth_provider: payload.auth_provider || AUTH_PROVIDERS.PASSWORD,
      google_sub: payload.google_sub || "",
      google_email: payload.google_email || "",
      last_login_at: "",

      status: user.status,
      created_at: user.created_at,
      updated_at: new Date().toISOString(),
    });
  } catch (err) {
    console.error("⚠️ Master sync failed (non-blocking):", err.toString());
  }

  return result;
}

function updateUser(workspace_id, userId, updates = {}) {
  if (!userId) throw new Error("userId is required");

  const existing = findOne(workspace_id, USER_TABLE, {
    user_id: userId,
  });

  if (!existing) throw new Error("User not found");

  // =========================
  // EMAIL CHECK
  // =========================
  if (updates.email) {
    const email = normalize("email", updates.email);

    const duplicate = find(workspace_id, USER_TABLE).find(
      (u) => u.user_id !== userId && normalize("email", u.email) === email,
    );

    if (duplicate) {
      throw new Error("User already exists with this email");
    }

    updates.email = email;
  }

  // =========================
  // RELATION VALIDATION
  // =========================
  if (updates.department_id !== undefined && updates.department_id) {
    const dept = findOne(workspace_id, TABLES.DEPARTMENTS, {
      department_id: updates.department_id,
    });
    if (!dept) throw new Error("Invalid department_id");
  }

  if (updates.position_id !== undefined && updates.position_id) {
    const pos = findOne(workspace_id, TABLES.POSITIONS, {
      position_id: updates.position_id,
    });
    if (!pos) throw new Error("Invalid position_id");
  }

  if (updates.shift_id !== undefined && updates.shift_id) {
    const shift = findOne(workspace_id, TABLES.SHIFTS, {
      shift_id: updates.shift_id,
    });
    if (!shift) throw new Error("Invalid shift_id");
  }

  // =========================
  // FULLNAME NORMALIZATION
  // Supports either:
  // - updates.fullname
  // - updates.first_name + updates.last_name
  // =========================
  const hasSplitNameInput = updates.first_name !== undefined || updates.last_name !== undefined;

  if (hasSplitNameInput && updates.fullname === undefined) {
    updates.fullname = resolveFullname(updates);
  }

  if (updates.fullname !== undefined) {
    updates.fullname = normalize("fullname", updates.fullname);
  }

  if (updates.role) updates.role = normalize("role", updates.role);
  if (updates.status) updates.status = normalize("status", updates.status);

  // =========================
  // INPUT-ONLY FIELDS
  // Never persist split-name convenience fields
  // =========================
  delete updates.first_name;
  delete updates.last_name;

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
      updated_at: new Date().toISOString(),
    });
  } catch (err) {
    console.error("⚠️ Master sync update failed:", err.toString());
  }

  return {
    success: true,
    user_id: userId,
  };
}

/**
 * =====================================================
 * BULK IMPORT
 * =====================================================
 */
function importUsers(workspace_id, users = [], options = {}) {
  if (!Array.isArray(users) || users.length === 0) {
    throw new Error("users must be a non-empty array");
  }

  const results = [];

  for (const payload of users) {
    try {
      const result = createUser(workspace_id, payload, {
        skipIfExists: options.skipIfExists ?? true,
      });

      results.push({
        success: true,
        email: payload.email,
        result,
      });
    } catch (err) {
      results.push({
        success: false,
        email: payload.email,
        error: err.message,
      });
    }
  }

  return {
    success: true,
    imported: results.length,
    results,
  };
}

function deactivateUser(workspace_id, userId) {
  const status = normalize("status", "INACTIVE");

  // 1. Workspace DB update
  const workspaceOk = update(workspace_id, TABLES.USERS, userId, { status });

  if (!workspaceOk) {
    throw new Error("User not found in workspace");
  }

  // 2. Master DB sync
  try {
    const masterOk = update(getMasterDatabase(), AUTH_TABLES.USERS, userId, {
      status,
      updated_at: new Date().toISOString(),
    });

    if (!masterOk) {
      console.warn("Master user not found during deactivation");
    }
  } catch (err) {
    console.error("⚠️ Master sync failed (non-blocking):", err.toString());
  }

  return {
    success: true,
    user_id: userId,
    status,
  };
}

function deleteUser(workspace_id, userId) {
  if (!userId) {
    throw new Error("userId is required");
  }

  // =========================
  // 1. CHECK LOCAL EXISTENCE
  // =========================
  const existing = findOne(workspace_id, TABLES.USERS, { user_id: userId });

  if (!existing) {
    throw new Error("User not found in workspace");
  }

  // =========================
  // 2. HARD DELETE LOCAL WORKSPACE
  // =========================
  const workspaceOk = remove(workspace_id, TABLES.USERS, userId);

  if (!workspaceOk) {
    throw new Error("Failed to delete user from workspace");
  }

  // =========================
  // 3. SOFT DELETE IN MASTER (AUTH TABLE)
  // =========================
  try {
    const status = normalize("status", "INACTIVE");

    const masterOk = update(getMasterDatabase(), AUTH_TABLES.USERS, userId, {
      status,
      updated_at: new Date().toISOString(),
    });

    if (!masterOk) {
      console.warn("Master user not found during soft delete sync");
    }
  } catch (err) {
    console.error("⚠️ Master sync failed (non-blocking):", err.toString());
  }

  return {
    success: true,
    user_id: userId,
    workspace_deleted: true,
    master_status: "INACTIVE",
  };
}

function createOwnerUser(workspace_id, ownerMeta = {}) {
  if (!workspace_id) {
    throw new Error("workspace_id is required");
  }

  if (!ownerMeta.email) {
    throw new Error("owner email is required");
  }

  const masterDb = getMasterDatabase();

  const email = normalize("email", ownerMeta.email);
  const fullname = resolveFullname(ownerMeta);
  const now = new Date().toISOString();

  if (!email) {
    throw new Error("owner email is required");
  }

  if (!fullname) {
    throw new Error("Owner full name is required");
  }

  // =====================================================
  // 1. CHECK IF OWNER ALREADY EXISTS IN MASTER OWNERS
  // =====================================================
  const existingOwner = findOne(masterDb, AUTH_TABLES.OWNERS, { email });

  const owner_id = existingOwner?.owner_id || generateId("OWN");

  // =====================================================
  // 2. RESOLVE WORKSPACE DB
  // =====================================================
  // @ts-ignore
  const workspaceDb = SpreadsheetApp.openById(workspace_id);

  // =====================================================
  // 3. RESOLVE DEFAULT RELATIONS (SAFE FALLBACKS)
  // =====================================================
  const defaultDept = findOne(workspaceDb, TABLES.DEPARTMENTS, {})?.department_id || "";

  const defaultShift = findOne(workspaceDb, TABLES.SHIFTS, {})?.shift_id || "";

  const defaultPosition = findOne(workspaceDb, TABLES.POSITIONS, {})?.position_id || "";

  // =====================================================
  // 4. ENSURE WORKSPACE USER EXISTS
  // SOURCE OF TRUTH FOR APP USER RECORD
  // =====================================================
  const existingWorkspaceUser = findOne(workspaceDb, TABLES.USERS, {
    email,
  });

  const workspaceUserPayload = {
    user_id: owner_id,
    employee_no: owner_id,
    email,
    fullname,
    role: "OWNER",
    department_id: defaultDept,
    shift_id: defaultShift,
    position_id: defaultPosition,
    status: "ACTIVE",
    created_at: existingWorkspaceUser?.created_at || now,
  };

  if (!existingWorkspaceUser) {
    insert(workspaceDb, TABLES.USERS, workspaceUserPayload);
  } else {
    update(workspaceDb, TABLES.USERS, existingWorkspaceUser.user_id, {
      email,
      fullname,
      role: "OWNER",
      department_id: existingWorkspaceUser.department_id || defaultDept,
      shift_id: existingWorkspaceUser.shift_id || defaultShift,
      position_id: existingWorkspaceUser.position_id || defaultPosition,
      status: "ACTIVE",
    });
  }

  // =====================================================
  // 5. UPSERT MASTER OWNER RECORD
  // =====================================================
  const ownerRecord = {
    owner_id,
    email,
    fullname,
    workspace_id,
    workspace_url: workspaceDb.getUrl(),
    timelog_spreadsheet_id: ownerMeta.timelogId || "",
    timelog_url: ownerMeta.timelogUrl || "",
    status: "ACTIVE",
    created_at: existingOwner?.created_at || now,
    updated_at: now,
  };

  if (existingOwner) {
    update(masterDb, AUTH_TABLES.OWNERS, owner_id, ownerRecord);
  } else {
    insert(masterDb, AUTH_TABLES.OWNERS, ownerRecord);
  }

  // =====================================================
  // 6. UPSERT MASTER AUTH USER RECORD
  // Keep auth user in sync with owner identity
  // =====================================================
  const existingAuthUser = findOne(masterDb, AUTH_TABLES.USERS, {
    email,
  });

  const authUserRecord = {
    user_id: owner_id,
    email,
    fullname,
    role: "OWNER",
    workspace_id,

    auth_provider: existingAuthUser?.auth_provider || AUTH_PROVIDERS.PASSWORD,
    google_sub: existingAuthUser?.google_sub || ownerMeta.google_sub || "",
    google_email: existingAuthUser?.google_email || ownerMeta.google_email || "",
    last_login_at: existingAuthUser?.last_login_at || "",

    status: "ACTIVE",
    created_at: existingAuthUser?.created_at || now,
    updated_at: now,
  };

  if (existingAuthUser) {
    update(masterDb, AUTH_TABLES.USERS, existingAuthUser.user_id, authUserRecord);
  } else {
    insert(masterDb, AUTH_TABLES.USERS, authUserRecord);
  }

  return {
    success: true,
    owner_id,
    user_id: owner_id,
    workspace_id,
    email,
    fullname,
    role: "OWNER",
    status: "ACTIVE",
  };
}
