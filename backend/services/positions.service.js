const POSITION_TABLE = TABLES.POSITIONS;

/**
 * =====================================================
 * CREATE POSITION
 * =====================================================
 */
function createPosition(workspace_id, payload) {
  if (!payload?.position_name?.trim()) {
    throw new Error("position_name is required");
  }

  const positionName = normalize("position_name", payload.position_name);
  const departmentIds = normalize("department_ids", payload.department_ids);

  const existing = find(workspace_id, POSITION_TABLE).find(
    (p) => normalize("position_name", p.position_name).toLowerCase() === positionName.toLowerCase(),
  );

  if (existing) {
    return {
      success: false,
      message: `Position '${positionName}' already exists.`,
      data: existing,
    };
  }

  const position = {
    position_id: generateId("POS"),
    position_name: positionName,
    department_ids: departmentIds,
    description: normalize("description", payload.description),
    status: "ACTIVE",
    created_at: new Date().toISOString(),
  };

  const result = insert(workspace_id, POSITION_TABLE, position);

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
function getPositionById(workspace_id, positionId) {
  return findOne(workspace_id, POSITION_TABLE, {
    position_id: positionId,
  });
}

/**
 * =====================================================
 * GET ALL
 * =====================================================
 */
function getAllPositions(workspace_id) {
  return find(workspace_id, POSITION_TABLE).map(normalizePositionRecord);
}

/**
 * =====================================================
 * UPDATE POSITION
 * =====================================================
 */
function updatePosition(workspace_id, positionId, updates) {
  const position = getPositionById(workspace_id, positionId);

  if (!position) {
    throw new Error("Position not found");
  }

  const safeUpdates = { ...updates };

  const nextPositionName =
    safeUpdates.position_name !== undefined
      ? normalize("position_name", safeUpdates.position_name)
      : normalize("position_name", position.position_name);

  const duplicate = find(workspace_id, POSITION_TABLE).find(
    (p) =>
      p.position_id !== positionId &&
      normalize("position_name", p.position_name).toLowerCase() === nextPositionName.toLowerCase(),
  );

  if (duplicate) {
    return {
      success: false,
      message: `Position '${nextPositionName}' already exists.`,
      data: duplicate,
    };
  }

  if (safeUpdates.position_name !== undefined) {
    if (!String(safeUpdates.position_name).trim()) {
      throw new Error("position_name is required");
    }

    safeUpdates.position_name = normalize("position_name", safeUpdates.position_name);
  }

  if (safeUpdates.department_ids !== undefined) {
    safeUpdates.department_ids = normalize("department_ids", safeUpdates.department_ids);
  }

  if (safeUpdates.description !== undefined) {
    safeUpdates.description = normalize("description", safeUpdates.description);
  }

  // Remove legacy field if still passed
  delete safeUpdates.department_id;

  const updated = update(workspace_id, POSITION_TABLE, positionId, safeUpdates);

  return {
    success: true,
    data: updated,
  };
}

/**
 * =====================================================
 * DELETE POSITION
 * =====================================================
 */
function deletePosition(workspace_id, positionId) {
  const position = getPositionById(workspace_id, positionId);

  if (!position) {
    throw new Error("Position not found");
  }

  const usersUsingPosition = find(workspace_id, TABLES.USERS).filter(
    (u) => u.position_id === positionId,
  );

  if (usersUsingPosition.length > 0) {
    throw new Error("Cannot delete position: users are assigned to it");
  }

  const result = remove(workspace_id, POSITION_TABLE, positionId);

  return {
    success: true,
    data: result,
  };
}
