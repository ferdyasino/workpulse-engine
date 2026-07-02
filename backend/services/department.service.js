const DEPT_TABLE = TABLES.DEPARTMENTS;

/**
 * =====================================================
 * CREATE DEPARTMENT
 * =====================================================
 */
function createDepartment(workspace_id, payload, options = {}) {
  const { skipIfExists = false } = options;

  if (!payload?.department_name?.trim()) {
    throw new Error("department_name is required");
  }

  const departmentName = normalize("department_name", payload.department_name);

  if (departmentName.length < 2) {
    throw new Error("department_name must be at least 2 characters");
  }

  const existing = find(workspace_id, DEPT_TABLE).find(
    (d) =>
      normalize("department_name", d.department_name).toLowerCase() ===
      departmentName.toLowerCase(),
  );

  if (existing) {
    if (skipIfExists) {
      return {
        success: true,
        data: existing,
        message: "Department already exists",
      };
    }

    return {
      success: false,
      message: `Department "${payload.department_name}" already exists`,
    };
  }

  const department = {
    department_id: generateId("DEP"),
    department_name: departmentName,
    description: normalize("description", payload.description),
    supervisor_name: normalize("supervisor_name", payload.supervisor_name),
    created_at: new Date().toISOString(),
  };

  const result = insert(workspace_id, DEPT_TABLE, department);

  return {
    success: true,
    data: result,
  };
}

/**
 * =====================================================
 * GET BY ID
 * =====================================================
 */
function getDepartmentById(workspace_id, departmentId) {
  return findOne(workspace_id, DEPT_TABLE, {
    department_id: departmentId,
  });
}

/**
 * =====================================================
 * GET ALL
 * =====================================================
 */
function getAllDepartments(workspace_id) {
  return find(workspace_id, DEPT_TABLE);
}

/**
 * =====================================================
 * UPDATE DEPARTMENT
 * =====================================================
 */
function updateDepartment(workspace_id, departmentId, updates) {
  const dept = getDepartmentById(workspace_id, departmentId);
  if (!dept) throw new Error("Department not found");

  const safeUpdates = { ...updates };

  if (safeUpdates.department_name !== undefined) {
    const departmentName = normalize("department_name", safeUpdates.department_name);

    if (departmentName.length < 2) {
      throw new Error("department_name must be at least 2 characters");
    }

    const duplicate = find(workspace_id, DEPT_TABLE).find(
      (d) =>
        d.department_id !== departmentId &&
        normalize("department_name", d.department_name).toLowerCase() ===
          departmentName.toLowerCase(),
    );

    if (duplicate) {
      return {
        success: false,
        message: "Department name already exists",
        data: duplicate,
      };
    }

    safeUpdates.department_name = departmentName;
  }

  if (safeUpdates.description !== undefined) {
    safeUpdates.description = normalize("description", safeUpdates.description);
  }

  if (safeUpdates.supervisor_name !== undefined) {
    safeUpdates.supervisor_name = normalize("supervisor_name", safeUpdates.supervisor_name);
  }

  const updated = update(workspace_id, DEPT_TABLE, departmentId, safeUpdates);

  return {
    success: true,
    data: updated,
  };
}

/**
 * =====================================================
 * DELETE DEPARTMENT
 * =====================================================
 */
function deleteDepartment(workspace_id, departmentId) {
  const dept = getDepartmentById(workspace_id, departmentId);
  if (!dept) throw new Error("Department not found");

  const usersInDept = find(workspace_id, TABLES.USERS).filter(
    (u) => u.department_id === departmentId,
  );

  if (usersInDept.length > 0) {
    throw new Error("Cannot delete department: users are assigned to it");
  }

  const result = remove(workspace_id, DEPT_TABLE, departmentId);

  return {
    success: true,
    data: result,
  };
}
