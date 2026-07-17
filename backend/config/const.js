function specificPatch(email) {
  patchWorkspace(email);
}

const ROLES = {
  SUPERADMIN: "superadmin",
  ADMIN: "admin",
  HR: "hr",
  USER: "user",
};

const WORKSPACE_ROLES = [ROLES.ADMIN, ROLES.HR, ROLES.USER];

const TIMELOG_SHEET_NAME = "TIME_LOGS";

/* =====================================================
   SETTINGS KEYS
===================================================== */

const SETTINGS_KEYS = {
  // =========================
  // ATTENDANCE
  // =========================
  OVERTIME_ENABLED: "OVERTIME_ENABLED",
  LATE_GRACE_MINUTES: "LATE_GRACE_MINUTES",
  BREAK_MINUTES_PER_DAY: "BREAK_MINUTES_PER_DAY",
  BREAK_MAX_PER_DAY: "BREAK_MAX_PER_DAY",
  MINIMUM_OVERTIME_MINUTES: "MINIMUM_OVERTIME_MINUTES",

  // =========================
  // PAYROLL
  // =========================
  PERIOD_TYPE: "PERIOD_TYPE",
  BIWEEKLY_CUTOFF_DAY_1: "BIWEEKLY_CUTOFF_DAY_1",
  BIWEEKLY_PAY_DAY_1: "BIWEEKLY_PAY_DAY_1",
  MONTHLY_CUTOFF_DAY: "MONTHLY_CUTOFF_DAY",
  MONTHLY_PAY_DAY: "MONTHLY_PAY_DAY",
  BIWEEKLY_CUTOFF_DAY_2: "BIWEEKLY_CUTOFF_DAY_2",
  BIWEEKLY_PAY_DAY_2: "BIWEEKLY_PAY_DAY_2",
  WEEKLY_DAYS_OFF: "WEEKLY_DAYS_OFF",
  WEEKLY_PAY_DAY: "WEEKLY_PAY_DAY",
  WEEKLY_START_DAY: "WEEKLY_START_DAY",

  // =========================
  // SYSTEM
  // =========================
  COMPANY_NAME: "COMPANY_NAME",
  OWNER_NAME: "OWNER_NAME",
  TIMEZONE: "TIMEZONE",
};

function getRequiredTimeLogHeaders() {
  return [
    "log_id",
    "workspace_id",
    "user_id",
    "email",
    "action",
    "timestamp",
    "date",
    "shift_id",
    "device_info",
    "location",
    "remarks",
    "created_at",
  ];
}
