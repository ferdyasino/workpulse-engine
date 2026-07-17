/**
 * =====================================================
 * DEFAULT WORKSPACE SEED (BOOTSTRAP v2)
 * =====================================================
 * - Departments
 * - Shifts
 * - Positions
 * - Owner
 * - Settings (Period + Break + Attendance rules)
 * =====================================================
 */

function seedWorkspace(workspace_id, ownerMeta = {}) {
  if (!workspace_id) throw new Error("workspace_id is required");

  console.info(`🌱 Seeding workspace: ${workspace_id}`);

  const result = {};

  // =========================
  // 1. DEPARTMENTS
  // =========================
  result.departments = seedDepartments(workspace_id);
  const defaultDeptId = result.departments?.[0]?.department_id || null;

  // =========================
  // 2. SHIFTS
  // =========================
  result.shifts = seedShifts(workspace_id);

  // =========================
  // 3. POSITIONS
  // =========================
  result.positions = seedPositions(workspace_id, defaultDeptId);

  // =========================
  // 4. OWNER USER
  // =========================
  result.owner = seedOwnerUser(workspace_id, ownerMeta);

  // =========================
  // 5. SETTINGS (UNIFIED SEED)
  // =========================
  result.settings = seedWorkspaceSettings(workspace_id);

  console.info(`✅ Seeding completed: ${workspace_id}`);

  return {
    success: true,
    workspace_id,
    seeded: result,
  };
}

/* =====================================================
   CORE SEED HELPERS
===================================================== */

function seedOwnerUser(workspace_id, ownerMeta) {
  return {
    seeded: true,
    owner: createOwnerUser(workspace_id, ownerMeta),
  };
}

function seedDepartments(workspace_id) {
  const departments = [
    { department_name: "Operations", description: "Core operations team" },
    { department_name: "HR", description: "Human Resources" },
    { department_name: "IT", description: "Information Technology" },
  ];

  return departments.map((dep) => createDepartment(workspace_id, dep, { skipIfExists: true }));
}

function seedShifts(workspace_id) {
  const shifts = [
    { shift_name: "MORNING", start_time: "06:00", end_time: "14:00", grace_minutes: 10 },
    { shift_name: "MID", start_time: "14:00", end_time: "22:00", grace_minutes: 10 },
    { shift_name: "NIGHT", start_time: "22:00", end_time: "06:00", grace_minutes: 10 },
  ];

  return shifts.map((shift) => createShift(workspace_id, shift));
}

function seedPositions(workspace_id, defaultDeptId = null) {
  const positions = [
    { position_name: "ADMIN", department_id: defaultDeptId, description: "System Administrator" },
    { position_name: "MANAGER", department_id: defaultDeptId, description: "Team Manager" },
    { position_name: "EMPLOYEE", department_id: defaultDeptId, description: "General Staff" },
  ];

  return positions.map((pos) => createPosition(workspace_id, pos));
}

/* =====================================================
   SETTINGS SEED (NEW UNIFIED SYSTEM)
===================================================== */

function seedWorkspaceSettings(workspace_id) {
  const db = getWorkspaceDb(workspace_id);
  const sheet = db.getSheetByName("Settings");

  if (!sheet) throw new Error("Settings sheet not found");

  const defaults = [
    // =====================
    // WORKSPACE META
    // =====================
    ["WORKSPACE_TIMEZONE", "Asia/Manila"],

    // =====================
    // PERIOD SETTINGS
    // =====================
    ["PERIOD_TYPE_DEFAULT", "DAILY"],
    ["PERIOD_TYPE_DAILY", "ENABLED"],
    ["PERIOD_TYPE_WEEKLY", "ENABLED"],
    ["PERIOD_TYPE_BI_WEEKLY", "ENABLED"],
    ["PERIOD_TYPE_MONTHLY", "ENABLED"],

    // =====================
    // ATTENDANCE RULES
    // =====================
    ["LATE_GRACE_MINUTES_DEFAULT", "10"],
    ["REQUIRE_TIME_OUT", "true"],

    // =====================
    // BREAK POLICY (NEW)
    // =====================
    ["BREAK_POLICY_ENABLED", "true"],
    ["BREAK_MAX_PER_DAY", "3"],
    ["BREAK_MINUTES_PER_DAY", "60"],
    ["BREAK_MIN_DURATION_MINUTES", "5"],
    ["BREAK_ALLOW_MULTIPLE_BREAKS", "true"],
    ["BREAK_AUTO_DEDUCT_ENABLED", "false"],
    ["BREAK_AUTO_DEDUCT_MINUTES", "0"],
  ];

  const existingRows = sheet.getDataRange().getValues();
  const existingKeys = new Set(existingRows.map((r) => r[0]));

  const newRows = defaults.filter(([key]) => !existingKeys.has(key));

  if (newRows.length > 0) {
    sheet.getRange(sheet.getLastRow() + 1, 1, newRows.length, 2).setValues(newRows);
  }

  return {
    seeded: true,
    inserted: newRows.length,
    total: defaults.length,
  };
}
