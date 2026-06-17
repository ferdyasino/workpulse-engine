const DEPT_TABLE = TABLES.DEPARTMENTS;

/**
 * =====================================================
 * NORMALIZER (single source of truth)
 * =====================================================
 */
function normalizeDeptName(name) {
  if (typeof name !== "string") return "";
  return name.trim().toLowerCase();
}

/**
 * Safe row sanitizer (DO NOT mutate DB row)
 */
function sanitizeDepartment(row) {
  if (!row) return null;

  return {
    department_id: row.department_id,
    department_name: normalizeDeptName(row.department_name),
    description: row.description || "",
    created_at: row.created_at
  };
}

/**
 * =====================================================
 * CREATE DEPARTMENT (IDEMPOTENT SAFE)
 * =====================================================
 */
function createDepartment(workspace_id, payload, options = {}) {
  const { skipIfExists = false } = options;

  // =========================
  // 1. VALIDATION
  // =========================
  if (!payload?.department_name?.trim()) {
    throw new Error("department_name is required");
  }

  const name = normalizeDeptName(payload.department_name);

  if (name.length < 2) {
    throw new Error("department_name must be at least 2 characters");
  }

  // =========================
  // 2. DUPLICATE CHECK
  // =========================
  const existing = find(workspace_id, DEPT_TABLE)
    .map(sanitizeDepartment)
    .filter(d => d?.department_name === name);

  if (existing.length > 0) {
    if (skipIfExists) {
      return {
        success: true,
        data: existing[0],
        message: "Department already exists"
      };
    }

    return {
      success: false,
      message: `Department "${payload.department_name}" already exists`
    };
  }

  // =========================
  // 3. DOMAIN MODEL
  // =========================
  const department = {
    department_id: generateId("DEP"),
    department_name: name,
    description: payload.description?.trim() || "",
    created_at: new Date().toISOString()
  };

  // =========================
  // 4. PERSIST
  // =========================
  const result = insert(workspace_id, DEPT_TABLE, department);

  return {
    success: true,
    data: result
  };
}

/**
 * =====================================================
 * GET BY ID
 * =====================================================
 */
function getDepartmentById(workspace_id, departmentId) {
  const result = find(workspace_id, DEPT_TABLE, {
    department_id: departmentId
  });

  return result.length ? sanitizeDepartment(result[0]) : null;
}

/**
 * =====================================================
 * GET ALL
 * =====================================================
 */
function getAllDepartments(workspace_id) {
  return find(workspace_id, DEPT_TABLE)
    .map(sanitizeDepartment)
    .filter(Boolean);
}

/**
 * =====================================================
 * UPDATE
 * =====================================================
 */
function updateDepartment(workspace_id, departmentId, updates) {
  const dept = getDepartmentById(workspace_id, departmentId);
  if (!dept) throw new Error("Department not found");

  const safeUpdates = { ...updates };

  // normalize name if provided
  if (safeUpdates.department_name !== undefined) {
    const name = normalizeDeptName(safeUpdates.department_name);

    if (name.length < 2) {
      throw new Error("department_name must be at least 2 characters");
    }

    // duplicate check (safe)
    const existing = find(workspace_id, DEPT_TABLE)
      .map(sanitizeDepartment)
      .filter(d =>
        d.department_id !== departmentId &&
        d.department_name === name
      );

    if (existing.length > 0) {
      return {
        success: false,
        message: "Department name already exists",
        data: existing[0]
      };
    }

    safeUpdates.department_name = name;
  }

  const updated = update(workspace_id, DEPT_TABLE, departmentId, safeUpdates);

  return {
    success: true,
    data: updated
  };
}

/**
 * =====================================================
 * DELETE (SAFE GUARD)
 * =====================================================
 */
function deleteDepartment(workspace_id, departmentId) {
  const dept = getDepartmentById(workspace_id, departmentId);
  if (!dept) throw new Error("Department not found");

  // prevent deletion if users exist
  const usersInDept = find(workspace_id, TABLES.USERS)
    .filter(u => u.department_id === departmentId);

  if (usersInDept.length > 0) {
    throw new Error(
      "Cannot delete department: users are assigned to it"
    );
  }

  const result = remove(workspace_id, DEPT_TABLE, departmentId);

  return {
    success: true,
    data: result
  };
}