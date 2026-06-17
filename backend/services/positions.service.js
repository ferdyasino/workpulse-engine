const POSITION_TABLE = TABLES.POSITIONS;

/**
 * =====================================================
 * POSITION CREATION
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

  // =========================
  // 2. LOAD EXISTING POSITIONS
  // =========================
  const existingPositions = find(workspace_id, POSITION_TABLE)
    .map(normalizePosition)
    .filter(Boolean);

  // =========================
  // 3. DUPLICATE CHECK
  // =========================
  const existing = existingPositions.find(p =>
    (p.position_name || "").trim().toUpperCase() === positionName &&
    (p.department_id || "") === (payload.department_id || "")
  );

  if (existing) {
    return {
      success: true,
      message: `Position '${positionName}' already exists`,
      data: existing
    };
  }

  // =========================
  // 4. DOMAIN MODEL
  // =========================
  const position = {
    position_id: generateId("POS"),
    position_name: positionName,
    department_id: payload.department_id || "",
    description: payload.description?.trim() || "",
    status: "ACTIVE",
    created_at: new Date().toISOString()
  };

  // =========================
  // 5. PERSIST
  // =========================
  return insert(workspace_id, POSITION_TABLE, position);
}


/**
 * =====================================================
 * GET POSITION BY ID
 * =====================================================
 */
function getPositionById(workspace_id, positionId) {
  const result = find(workspace_id, POSITION_TABLE, { position_id: positionId });
  return result.length ? normalizePosition(result[0]) : null;
}


/**
 * =====================================================
 * GET ALL POSITIONS
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

  if (updates.position_name) {
    updates.position_name = updates.position_name.trim().toUpperCase();

    const existingPositions = find(workspace_id, POSITION_TABLE)
      .map(normalizePosition)
      .filter(Boolean);

    const duplicate = existingPositions.find(p =>
      p.position_id !== positionId &&
      (p.position_name || "").trim().toUpperCase() === updates.position_name &&
      (p.department_id || "") === (updates.department_id || position.department_id)
    );

    if (duplicate) {
      return {
        success: true,
        message: `Position '${updates.position_name}' already exists`,
        data: duplicate
      };
    }
  }

  return update(workspace_id, POSITION_TABLE, positionId, updates);
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

  return remove(workspace_id, POSITION_TABLE, positionId);
}


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