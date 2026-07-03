const SHIFT_TABLE = TABLES.SHIFTS;

/**
 * =====================================================
 * SHIFT MAPPER
 * =====================================================
 */
function mapShift(row) {
  if (!row) return null;

  return {
    shift_id: row.shift_id || "",
    shift_name: row.shift_name || "",
    start_time: row.start_time || "",
    end_time: row.end_time || "",
    grace_minutes: Number(row.grace_minutes ?? 10),
    status: row.status || "ACTIVE",
    created_at: row.created_at || "",
  };
}

/**
 * =====================================================
 * CREATE SHIFT
 * =====================================================
 */
function createShift(workspace_id, payload) {
  if (!payload?.shift_name?.trim()) {
    throw new Error("shift_name is required");
  }

  if (!payload?.start_time || !payload?.end_time) {
    throw new Error("start_time and end_time are required");
  }

  const shiftName = normalize("shift_name", payload.shift_name);
  const startTime = String(payload.start_time).trim();
  const endTime = String(payload.end_time).trim();

  if (startTime === endTime) {
    throw new Error("Shift start_time and end_time cannot be the same");
  }

  const existingShifts = find(workspace_id, SHIFT_TABLE).map(mapShift);

  const existingShift = existingShifts.find(
    (s) => normalize("shift_name", s.shift_name) === shiftName,
  );

  if (existingShift) {
    return {
      success: false,
      message: `Shift '${shiftName}' already exists`,
      data: existingShift,
    };
  }

  // const hasOverlap = existingShifts.some(s =>
  //   isTimeOverlap(startTime, endTime, s.start_time, s.end_time)
  // );

  // if (hasOverlap) {
  //   return {
  //     success: false,
  //     message: "Shift overlaps with an existing shift"
  //   };
  // }

  const shift = {
    shift_id: generateId("SHIFT"),
    shift_name: shiftName,
    start_time: startTime,
    end_time: endTime,
    grace_minutes: Number(payload.grace_minutes ?? 10),
    status: "ACTIVE",
    created_at: new Date().toISOString(),
  };

  insert(workspace_id, SHIFT_TABLE, shift);

  return {
    success: true,
    data: mapShift(shift),
  };
}

/**
 * =====================================================
 * GET SHIFT BY ID
 * =====================================================
 */
function getShiftById(workspace_id, shiftId) {
  const row = findOne(workspace_id, SHIFT_TABLE, { shift_id: shiftId });
  return row ? mapShift(row) : null;
}

/**
 * =====================================================
 * GET ALL SHIFTS
 * =====================================================
 */
function getAllShifts(workspace_id) {
  try {
    return find(workspace_id, SHIFT_TABLE).map(mapShift);
  } catch (error) {
    console.error("getAllShifts error:", error);
    return [];
  }
}

/**
 * =====================================================
 * UPDATE SHIFT
 * =====================================================
 */
function updateShift(workspace_id, shiftId, updates) {
  const shift = getShiftById(workspace_id, shiftId);
  if (!shift) throw new Error("Shift not found");

  const safeUpdates = { ...updates };

  // =========================
  // NAME VALIDATION
  // =========================
  if (safeUpdates.shift_name !== undefined) {
    const newName = normalize("shift_name", safeUpdates.shift_name);

    if (!newName) {
      throw new Error("shift_name is required");
    }

    const existingShifts = find(workspace_id, SHIFT_TABLE).map(mapShift);

    const duplicate = existingShifts.find(
      (s) => s.shift_id !== shiftId && normalize("shift_name", s.shift_name) === newName,
    );

    if (duplicate) {
      return {
        success: false,
        message: `Shift '${newName}' already exists`,
        data: duplicate,
      };
    }

    safeUpdates.shift_name = newName;
  }

  // =========================
  // TIME VALIDATION
  // =========================
  const start =
    safeUpdates.start_time !== undefined ? String(safeUpdates.start_time).trim() : shift.start_time;

  const end =
    safeUpdates.end_time !== undefined ? String(safeUpdates.end_time).trim() : shift.end_time;

  if (!start || !end) {
    throw new Error("start_time and end_time are required");
  }

  if (start === end) {
    throw new Error("Invalid shift time range: start and end cannot be equal");
  }

  const toMinutes = (t) => {
    const [h, m] = String(t).split(":").map(Number);
    return h * 60 + m;
  };

  const s = toMinutes(start);
  const e = toMinutes(end);

  if (Number.isNaN(s) || Number.isNaN(e) || s < 0 || s > 1439 || e < 0 || e > 1439) {
    throw new Error("Invalid time format (expected HH:mm)");
  }

  // =========================
  // OVERLAP VALIDATION
  // =========================
  const otherShifts = find(workspace_id, SHIFT_TABLE)
    .map(mapShift)
    .filter((s) => s.shift_id !== shiftId);

  // const hasOverlap = otherShifts.some(s =>
  //   isTimeOverlap(start, end, s.start_time, s.end_time)
  // );

  // if (hasOverlap) {
  //   return {
  //     success: false,
  //     message: "Shift overlaps with an existing shift"
  //   };
  // }

  if (safeUpdates.start_time !== undefined) {
    safeUpdates.start_time = start;
  }

  if (safeUpdates.end_time !== undefined) {
    safeUpdates.end_time = end;
  }

  if (safeUpdates.grace_minutes !== undefined) {
    safeUpdates.grace_minutes = Number(safeUpdates.grace_minutes ?? 10);
  }

  update(workspace_id, SHIFT_TABLE, shiftId, safeUpdates);

  return {
    success: true,
    data: getShiftById(workspace_id, shiftId),
  };
}

function deleteShift(workspace_id, shiftId) {
  const shift = getShiftById(workspace_id, shiftId);
  if (!shift) throw new Error("Shift not found");
}

/**
 * =====================================================
 * DEACTIVATE SHIFT
 * =====================================================
 */
function deactivateShift(workspace_id, shiftId) {
  const shift = getShiftById(workspace_id, shiftId);
  if (!shift) throw new Error("Shift not found");

  update(workspace_id, SHIFT_TABLE, shiftId, {
    status: "INACTIVE",
  });

  return {
    success: true,
    data: getShiftById(workspace_id, shiftId),
  };
}

/**
 * =====================================================
 * OVERLAP UTILITY
 * =====================================================
 */
function isTimeOverlap(startA, endA, startB, endB) {
  const toMinutes = (t) => {
    const [h, m] = String(t).split(":").map(Number);
    return h * 60 + m;
  };

  const normalizeRange = (start, end) => {
    if (end < start) {
      return [start, end + 1440];
    }
    return [start, end];
  };

  const aStart = toMinutes(startA);
  const aEnd = toMinutes(endA);
  const bStart = toMinutes(startB);
  const bEnd = toMinutes(endB);

  const [aS, aE] = normalizeRange(aStart, aEnd);
  const [bS, bE] = normalizeRange(bStart, bEnd);

  return aS < bE && bS < aE;
}
