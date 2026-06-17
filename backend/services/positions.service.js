const POSITION_TABLE = TABLES.POSITIONS;

/**
 * =====================================================
 * NORMALIZER
 * =====================================================
 */
function normalizePosition(row) {
  if (!row) return null;

  return {
    position_id: row.position_id,
    position_name: row.position_name,
    department_id: row.department_id || "",
    description: row.description || "",
    status: row.status || "ACTIVE",
    created_at: row.created_at
  };
}

/**
 * =====================================================
 * CREATE POSITION (SAFE + CONSISTENT)
 * =====================================================
 */
function createPosition(workspace_id, payload) {

  // =========================
  // 1. VALIDATION
  // =========================
  if (!payload?.position_name?.trim()) {
    throw new Error("position_name is required");
  }

  const positionName = payload.position_name.trim().toUpperCase();
  const departmentId = payload.department_id || "";

  // =========================
  // 2. LOAD EXISTING
  // =========================
  const existingPositions = find(workspace_id, POSITION_TABLE)
    .map(normalizePosition)
    .filter(Boolean);

  // =========================
  // 3. DUPLICATE CHECK
  // =========================
  const existing = existingPositions.find(p =>
    (p.position_name || "").trim().toUpperCase() === positionName &&
    (p.department_id || "") === departmentId
  );

  if (existing) {
    return {
      success: false,
      message: `Position '${positionName}' already exists in this department`,
      data: existing
    };
  }

  // =========================
  // 4. DOMAIN MODEL
  // =========================
  const position = {
    position_id: generateId("POS"),
    position_name: positionName,
    department_id: departmentId,
    description: payload.description?.trim() || "",
    status: "ACTIVE",
    created_at: new Date().toISOString()
  };

  // =========================
  // 5. PERSIST
  // =========================
  const result = insert(workspace_id, POSITION_TABLE, position);

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
function getPositionById(workspace_id, positionId) {
  const result = find(workspace_id, POSITION_TABLE, {
    position_id: positionId
  });

  return result.length ? normalizePosition(result[0]) : null;
}

/**
 * =====================================================
 * GET ALL
 * =====================================================
 */
function getAllPositions(workspace_id) {
  return find(workspace_id, POSITION_TABLE)
    .map(normalizePosition)
    .filter(Boolean);
}

/**
 * =====================================================
 * UPDATE POSITION
 * =====================================================
 */
function updatePosition(workspace_id, positionId, updates) {

  const position = getPositionById(workspace_id, positionId);
  if (!position) throw new Error("Position not found");

  const safeUpdates = { ...updates };

  // =========================
  // NAME VALIDATION
  // =========================
  if (safeUpdates.position_name) {

    const newName = safeUpdates.position_name.trim().toUpperCase();
    const departmentId =
      safeUpdates.department_id || position.department_id;

    const existingPositions = find(workspace_id, POSITION_TABLE)
      .map(normalizePosition)
      .filter(Boolean);

    const duplicate = existingPositions.find(p =>
      p.position_id !== positionId &&
      (p.position_name || "").trim().toUpperCase() === newName &&
      (p.department_id || "") === departmentId
    );

    if (duplicate) {
      return {
        success: false,
        message: `Position '${newName}' already exists in this department`,
        data: duplicate
      };
    }

    safeUpdates.position_name = newName;
  }

  // =========================
  // PERSIST
  // =========================
  const updated = update(
    workspace_id,
    POSITION_TABLE,
    positionId,
    safeUpdates
  );

  return {
    success: true,
    data: updated
  };
}

/**
 * =====================================================
 * DELETE POSITION (SAFE GUARD)
 * =====================================================
 */
function deletePosition(workspace_id, positionId) {

  const position = getPositionById(workspace_id, positionId);
  if (!position) throw new Error("Position not found");

  // prevent deletion if users are assigned
  const usersUsingPosition = find(workspace_id, TABLES.USERS)
    .filter(u => u.position_id === positionId);

  if (usersUsingPosition.length > 0) {
    throw new Error("Cannot delete position: users are assigned to it");
  }

  const result = remove(workspace_id, POSITION_TABLE, positionId);

  return {
    success: true,
    data: result
  };
}