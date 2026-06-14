const SHIFT_TABLE = TABLES.SHIFTS;

/**
 * SHIFT CREATION - With overlap protection
 */
function createShift(workspaceId, payload) {

  // =========================
  // 1. VALIDATION
  // =========================
  if (!payload?.shift_name?.trim()) {
    throw new Error("shift_name is required");
  }

  if (!payload?.start_time || !payload?.end_time) {
    throw new Error("start_time and end_time are required");
  }

  const shiftName = payload.shift_name.trim().toUpperCase();
  const startTime = payload.start_time;
  const endTime = payload.end_time;

  if (startTime === endTime) {
    throw new Error("Shift start_time and end_time cannot be the same");
  }

  // =========================
  // 2. LOAD EXISTING SHIFTS
  // =========================
  const existingShifts = find(workspaceId, SHIFT_TABLE)
    .map(normalizeShift)
    .filter(Boolean);

// =========================
// 3. SHIFT NAME DUPLICATION CHECK
// =========================
const existingShift = existingShifts.find(s =>
  (s.shift_name || "").trim().toUpperCase() === shiftName
);

if (existingShift) {
  return {
    success: true,
    message: `Shift '${shiftName}' already exists`,
    data: existingShift
  };
}

  // =========================
  // 4. OVERLAP CHECK
  // =========================
  const hasOverlap = existingShifts.some(s =>
    isTimeOverlap(
      startTime,
      endTime,
      s.start_time,
      s.end_time
    )
  );

  if (hasOverlap) {
    throw new Error("Shift overlaps with an existing shift");
  }

  // =========================
  // 5. DOMAIN MODEL
  // =========================
  const shift = {
    shift_id: generateId("SHIFT"),
    shift_name: shiftName,
    start_time: startTime,
    end_time: endTime,
    grace_minutes: Number(payload.grace_minutes ?? 10),
    status: "ACTIVE",
    created_at: new Date().toISOString()
  };

  return insert(workspaceId, SHIFT_TABLE);
}

/**
 * GET SHIFT BY ID
 */
function getShiftById(workspaceId, shiftId) {
  const result = find(workspaceId, SHIFT_TABLE, { shift_id: shiftId });
  return result.length ? normalizeShift(result[0]) : null;
}

/**
 * GET ALL SHIFTS
 */
function getAllShifts(workspaceId) {
  return find(workspaceId, SHIFT_TABLE)
    .map(normalizeShift)
    .filter(Boolean);
}

/**
 * UPDATE SHIFT
 */
function updateShift(workspaceId, shiftId, updates) {

  if (updates.shift_name) {

    const newName = updates.shift_name.trim().toUpperCase();

    const existingShifts = find(workspaceId, SHIFT_TABLE)
      .map(normalizeShift)
      .filter(Boolean);

    const duplicateShift = existingShifts.find(s =>
      s.shift_id !== shiftId &&
      (s.shift_name || "").trim().toUpperCase() === newName
    );

    if (duplicateShift) {
      return {
        success: true,
        message: `Shift '${newName}' already exists`,
        data: duplicateShift
      };
    }

    updates.shift_name = newName;
  }

  const shift = getShiftById(workspaceId, shiftId);
  if (!shift) throw new Error("Shift not found");

  // =========================
  // TIME VALIDATION (INLINE)
  // =========================
  const start = updates.start_time || shift.start_time;
  const end = updates.end_time || shift.end_time;

  if (start === end) {
    throw new Error("Invalid shift time range: start and end cannot be equal");
  }

  const toMinutes = (t) => {
    const [h, m] = String(t).split(":").map(Number);
    return h * 60 + m;
  };

  const s = toMinutes(start);
  const e = toMinutes(end);

  if (s < 0 || s > 1439 || e < 0 || e > 1439) {
    throw new Error("Invalid time format (expected HH:mm)");
  }

  return update(workspaceId, SHIFT_TABLE, shiftId, updates);
}

/**
 * DEACTIVATE SHIFT
 */
function deactivateShift(workspaceId, shiftId) {
  const shift = getShiftById(workspaceId, shiftId);
  if (!shift) throw new Error("Shift not found");

  return update(workspaceId, SHIFT_TABLE, shiftId, { status: "INACTIVE" });
}

/* ====================== TIME UTILITIES ====================== */

/**
 * IMPROVED OVERLAP CHECK - Handles overnight shifts
 */
function isTimeOverlap(startA, endA, startB, endB) {

  const toMinutes = (t) => {
    const [h, m] = String(t).split(":").map(Number);
    return h * 60 + m;
  };

  const normalize = (start, end) => {
    if (end < start) {
      // overnight shift
      return [start, end + 1440];
    }
    return [start, end];
  };

  const aStart = toMinutes(startA);
  const aEnd = toMinutes(endA);
  const bStart = toMinutes(startB);
  const bEnd = toMinutes(endB);

  const [aS, aE] = normalize(aStart, aEnd);
  const [bS, bE] = normalize(bStart, bEnd);

  return (aS < bE && bS < aE);
}

/**
 * DOMAIN SANITIZER
 */
function normalizeShift(row) {
  if (!row || !row.start_time || !row.end_time) return null;

  return {
    shift_id: row.shift_id,
    shift_name: row.shift_name,
    start_time: row.start_time,
    end_time: row.end_time,
    grace_minutes: Number(row.grace_minutes || 10),
    status: row.status || "ACTIVE",
    created_at: row.created_at
  };
}