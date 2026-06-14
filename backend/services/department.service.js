const DEPT_TABLE = TABLES.DEPARTMENTS;

/**
 * Normalize department name (single source of truth)
 */
function normalizeDeptName(name) {
  if (typeof name !== "string") return "";
  return name.trim().toLowerCase();
}

/**
 * Safely sanitize department row from spreadsheet
 */
function sanitizeDepartment(row) {
  if (!row) return null;
  return {
    ...row,
    department_name: normalizeDeptName(row.department_name)
  };
}

/**
 * CREATE DEPARTMENT - IDEMPOTENT + SAFE
 */
function createDepartment(workspaceId, payload, options = {}) {

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
  // 2. DUPLICATE CHECK (Normalized)
  // =========================
  const existing = find(workspaceId, DEPT_TABLE)
    .map(sanitizeDepartment)
    .filter(d => d.department_name === name);

  if (existing.length > 0) {
    if (skipIfExists) {
      return existing[0];
    }
    throw new Error(`Department "${payload.department_name}" already exists`);
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
  return insert(workspaceId, DEPT_TABLE, department);
}

/**
 * GET DEPARTMENT BY ID
 */
function getDepartmentById(workspaceId, departmentId) {
  const result = find(workspaceId, DEPT_TABLE, { department_id: departmentId });
  return result.length ? result[0] : null;
}

/**
 * GET ALL DEPARTMENTS (Sanitized)
 */
function getAllDepartments(workspaceId) {
  return find(workspaceId, DEPT_TABLE)
    .map(sanitizeDepartment)
    .filter(Boolean);
}

/**
 * UPDATE DEPARTMENT
 */
function updateDepartment(workspaceId, departmentId, updates) {

  const dept = getDepartmentById(workspaceId, departmentId);
  if (!dept) throw new Error("Department not found");

  const safeUpdates = { ...updates };

  // Normalize department name if being updated
  if (safeUpdates.department_name !== undefined) {
    const name = normalizeDeptName(safeUpdates.department_name);

    if (name.length < 2) {
      throw new Error("department_name must be at least 2 characters");
    }

    safeUpdates.department_name = name;
  }

  return update(workspaceId, DEPT_TABLE, departmentId, safeUpdates);
}

/**
 * DELETE DEPARTMENT - With safety check
 */
function deleteDepartment(workspaceId, departmentId) {

  const dept = getDepartmentById(workspaceId, departmentId);
  if (!dept) throw new Error("Department not found");

  // Prevent deletion if users are assigned
  const usersInDept = find(workspaceId, TABLES.USERS)
    .filter(u => u.department_id === departmentId);

  if (usersInDept.length > 0) {
    throw new Error("Cannot delete department: Active users are assigned to it");
  }

  return remove(workspaceId, DEPT_TABLE, departmentId);
}