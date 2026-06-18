const SHIFT_TABLE = TABLES.SHIFTS;

/**
 * =====================================================
 * NORMALIZER
 * =====================================================
 */
function normalizeShift(row) {
  if (!row) return null;

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

/**
 * =====================================================
 * CREATE SHIFT (SAFE + CONSISTENT)
 * =====================================================
 */
function createShift(workspace_id, payload) {

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
  // 2. LOAD EXISTING
  // =========================
  const existingShifts = find(workspace_id, SHIFT_TABLE)
    .map(normalizeShift)
    .filter(Boolean);

  // =========================
  // 3. DUPLICATE NAME CHECK
  // =========================
  const existingShift = existingShifts.find(s =>
    (s.shift_name || "").trim().toUpperCase() === shiftName
  );

  if (existingShift) {
    return {
      success: false,
      message: `Shift '${shiftName}' already exists`,
      data: existingShift
    };
  }

  // =========================
  // 4. OVERLAP CHECK
  // =========================
  const hasOverlap = existingShifts.some(s =>
    isTimeOverlap(startTime, endTime, s.start_time, s.end_time)
  );

  if (hasOverlap) {
    return {
      success: false,
      message: "Shift overlaps with an existing shift"
    };
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

  // =========================
  // 6. PERSIST
  // =========================
  const result = insert(workspace_id, SHIFT_TABLE, shift);

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
function getShiftById(workspace_id, shiftId) {
  const result = find(workspace_id, SHIFT_TABLE, {
    shift_id: shiftId
  });

  return result.length ? normalizeShift(result[0]) : null;
}

/**
 * =====================================================
 * GET ALL
 * =====================================================
 */
function getAllShifts(workspace_id) {
  try {
    const db = resolveDb(workspace_id);
    const sheet = db.getSheetByName(SHIFT_TABLE.sheet);

    if (!sheet) {
      throw new Error(`Shift sheet "${SHIFT_TABLE.sheet}" not found`);
    }

    const data = sheet.getDataRange().getDisplayValues();

    if (data.length <= 1) return [];

    const headers = data[0];
    const rows = data.slice(1);

    return rows.map(row => {
      const obj = {};
      headers.forEach((h, i) => {
        let val = row[i];
        if (val === "") val = null;
        obj[h] = val;
      });

      return normalizeShift(obj);
    }).filter(Boolean);

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
  if (safeUpdates.shift_name) {

    const newName = safeUpdates.shift_name.trim().toUpperCase();

    const existingShifts = find(workspace_id, SHIFT_TABLE)
      .map(normalizeShift)
      .filter(Boolean);

    const duplicate = existingShifts.find(s =>
      s.shift_id !== shiftId &&
      (s.shift_name || "").trim().toUpperCase() === newName
    );

    if (duplicate) {
      return {
        success: false,
        message: `Shift '${newName}' already exists`,
        data: duplicate
      };
    }

    safeUpdates.shift_name = newName;
  }

  // =========================
  // TIME VALIDATION
  // =========================
  const start = safeUpdates.start_time || shift.start_time;
  const end = safeUpdates.end_time || shift.end_time;

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

  // =========================
  // PERSIST
  // =========================
  const updated = update(workspace_id, SHIFT_TABLE, shiftId, safeUpdates);

  return {
    success: true,
    data: updated
  };
}

/**
 * =====================================================
 * DEACTIVATE SHIFT
 * =====================================================
 */
function deactivateShift(workspace_id, shiftId) {

  const shift = getShiftById(workspace_id, shiftId);
  if (!shift) throw new Error("Shift not found");

  const result = update(workspace_id, SHIFT_TABLE, shiftId, {
    status: "INACTIVE"
  });

  return {
    success: true,
    data: result
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

  const normalize = (start, end) => {
    if (end < start) {
      return [start, end + 1440]; // overnight shift
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