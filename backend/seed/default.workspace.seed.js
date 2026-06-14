/**
 * =====================================================
 * DEFAULT WORKSPACE SEED (BOOTSTRAP)
 * =====================================================
 * Run this after workspace creation to populate initial data
 */

function seedWorkspace(workspaceId, ownerMeta = {}) {

  if (!workspaceId) throw new Error("workspaceId is required");

  const result = {};

  console.info(`🌱 Seeding default data for workspace: ${workspaceId}`);

  // =========================
  // 1. DEPARTMENTS
  // =========================
  result.departments = seedDepartments(workspaceId);

  const defaultDeptId = result.departments[0]?.department_id;

  // =========================
  // 2. SHIFTS
  // =========================
  result.shifts = seedShifts(workspaceId);

  const defaultShiftId = result.shifts[0]?.shift_id;

  // =========================
  // 3. OWNER USER (Using Service Layer)
  // =========================
  result.owner = createOwnerUser(workspaceId, {
    email: ownerMeta.email,
    fullname: ownerMeta.fullname || ownerMeta.first_name + " " + (ownerMeta.last_name || ""),
    first_name: ownerMeta.first_name || "Owner",
    last_name: ownerMeta.last_name || "",
    department_id: defaultDeptId,
    shift_id: defaultShiftId,
    employee_no: "OWNER-001"
  });

  // =========================
  // 4. PERIOD TYPES / SETTINGS
  // =========================
  result.periodTypes = seedPeriodTypes(workspaceId);

  console.info(`✅ Seeding completed for workspace: ${workspaceId}`);

  return {
    success: true,
    workspaceId,
    seeded: result
  };
}

/* ====================== SEED HELPERS ====================== */

function seedDepartments(workspaceId) {
  const departments = [
    { department_name: "Operations", description: "Core operations team" },
    { department_name: "HR",         description: "Human Resources" },
    { department_name: "IT",         description: "Information Technology" }
  ];

  return departments.map(dep => 
    createDepartment(workspaceId, dep, { skipIfExists: true })
  );
}

function seedShifts(workspaceId) {
  const shifts = [
    { shift_name: "MORNING", start_time: "06:00", end_time: "14:00", grace_minutes: 10 },
    { shift_name: "MID",     start_time: "14:00", end_time: "22:00", grace_minutes: 10 },
    { shift_name: "NIGHT",   start_time: "22:00", end_time: "06:00", grace_minutes: 10 }
  ];

  return shifts.map(shift => 
    createShift(workspaceId, shift)   // createShift already has overlap check
  );
}

/**
 * Add default configuration to Settings sheet
 */
function seedPeriodTypes(workspaceId) {
  const db = getWorkspaceDb(workspaceId);
  const sheet = db.getSheetByName("Settings");

  if (!sheet) throw new Error("Settings sheet not found");

  const periodTypes = [
    ["PERIOD_TYPE_DEFAULT", "DAILY"],
    ["PERIOD_TYPE_DAILY", "ENABLED"],
    ["PERIOD_TYPE_WEEKLY", "ENABLED"],
    ["PERIOD_TYPE_BI_WEEKLY", "ENABLED"],
    ["PERIOD_TYPE_MONTHLY", "ENABLED"]
  ];

  // Append only if not already present
  const existing = sheet.getDataRange().getValues();
  const keys = existing.map(row => row[0]);

  const newRows = periodTypes.filter(([key]) => !keys.includes(key));

  if (newRows.length > 0) {
    sheet.getRange(sheet.getLastRow() + 1, 1, newRows.length, 2)
         .setValues(newRows);
  }

  return periodTypes;
}