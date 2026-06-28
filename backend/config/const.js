function specificPatch(){
    patchWorkspace();
}

const ROLES = {
  SUPERADMIN: "superadmin",
  ADMIN: "admin",
  HR: "hr",
  USER: "user"
};

const WORKSPACE_ROLES = [
  ROLES.ADMIN,
  ROLES.HR,
  ROLES.USER
];

const TIMELOG_SHEET_NAME = "TIME_LOGS";

/* =====================================================
   SETTINGS KEYS
===================================================== */

const SETTINGS_KEYS = {

  // ===================================================
  // WORKSPACE
  // ===================================================

  TIMEZONE: "WORKSPACE_TIMEZONE",

  COMPANY_NAME: "COMPANY_NAME",
  COMPANY_ADDRESS: "COMPANY_ADDRESS",
  COMPANY_CONTACT: "COMPANY_CONTACT",

  // ===================================================
  // PAYROLL PERIOD
  // ===================================================

  PERIOD_TYPE_DEFAULT: "PERIOD_TYPE_DEFAULT",

  PERIOD_TYPE_DAILY: "PERIOD_TYPE_DAILY",
  PERIOD_TYPE_WEEKLY: "PERIOD_TYPE_WEEKLY",
  PERIOD_TYPE_BI_WEEKLY: "PERIOD_TYPE_BI_WEEKLY",
  PERIOD_TYPE_MONTHLY: "PERIOD_TYPE_MONTHLY",

  PAYROLL_START_DAY: "PAYROLL_START_DAY",

  // ===================================================
  // ATTENDANCE
  // ===================================================

  LATE_GRACE_MINUTES_DEFAULT:
    "LATE_GRACE_MINUTES_DEFAULT",

  REQUIRE_TIME_OUT:
    "REQUIRE_TIME_OUT",

  AUTO_CLOCK_OUT_ENABLED:
    "AUTO_CLOCK_OUT_ENABLED",

  AUTO_CLOCK_OUT_TIME:
    "AUTO_CLOCK_OUT_TIME",

  ALLOW_EARLY_TIME_IN:
    "ALLOW_EARLY_TIME_IN",

  EARLY_TIME_IN_MINUTES:
    "EARLY_TIME_IN_MINUTES",

  // ===================================================
  // BREAKS
  // ===================================================

  BREAK_POLICY_ENABLED:
    "BREAK_POLICY_ENABLED",

  BREAK_MAX_PER_DAY:
    "BREAK_MAX_PER_DAY",

  BREAK_MINUTES_PER_DAY:
    "BREAK_MINUTES_PER_DAY",

  BREAK_MIN_DURATION_MINUTES:
    "BREAK_MIN_DURATION_MINUTES",

  BREAK_ALLOW_MULTIPLE_BREAKS:
    "BREAK_ALLOW_MULTIPLE_BREAKS",

  BREAK_AUTO_DEDUCT_ENABLED:
    "BREAK_AUTO_DEDUCT_ENABLED",

  BREAK_AUTO_DEDUCT_MINUTES:
    "BREAK_AUTO_DEDUCT_MINUTES",

  // ===================================================
  // LUNCH
  // ===================================================

  LUNCH_REQUIRED:
    "LUNCH_REQUIRED",

  LUNCH_DURATION_MINUTES:
    "LUNCH_DURATION_MINUTES",

  LUNCH_AUTO_DEDUCT_ENABLED:
    "LUNCH_AUTO_DEDUCT_ENABLED",

  // ===================================================
  // OVERTIME
  // ===================================================

  OVERTIME_ENABLED:
    "OVERTIME_ENABLED",

  OVERTIME_REQUIRE_APPROVAL:
    "OVERTIME_REQUIRE_APPROVAL",

  OVERTIME_MINIMUM_MINUTES:
    "OVERTIME_MINIMUM_MINUTES",

  OVERTIME_ROUNDING_MINUTES:
    "OVERTIME_ROUNDING_MINUTES",

  // ===================================================
  // DEPARTMENT POLICIES
  // ===================================================

  DEPARTMENT_ALLOW_OVERTIME:
    "DEPARTMENT_ALLOW_OVERTIME",

  DEPARTMENT_ALLOW_BREAK:
    "DEPARTMENT_ALLOW_BREAK",

  DEPARTMENT_REQUIRE_SHIFT:
    "DEPARTMENT_REQUIRE_SHIFT",

  // ===================================================
  // SHIFT POLICIES
  // ===================================================

  SHIFT_ENFORCEMENT_ENABLED:
    "SHIFT_ENFORCEMENT_ENABLED",

  SHIFT_ALLOW_CROSS_DAY:
    "SHIFT_ALLOW_CROSS_DAY",

  SHIFT_ALLOW_MANUAL_OVERRIDE:
    "SHIFT_ALLOW_MANUAL_OVERRIDE",

  // ===================================================
  // PAYROLL
  // ===================================================

  PAYROLL_ROUNDING_RULE:
    "PAYROLL_ROUNDING_RULE",

  PAYROLL_CURRENCY:
    "PAYROLL_CURRENCY",

  PAYROLL_DECIMAL_PLACES:
    "PAYROLL_DECIMAL_PLACES",

  NIGHT_DIFFERENTIAL_ENABLED:
    "NIGHT_DIFFERENTIAL_ENABLED",

  HOLIDAY_PAY_ENABLED:
    "HOLIDAY_PAY_ENABLED",

  REST_DAY_PAY_ENABLED:
    "REST_DAY_PAY_ENABLED",

  // ===================================================
  // REPORTS
  // ===================================================

  REPORT_DEFAULT_RANGE:
    "REPORT_DEFAULT_RANGE",

  REPORT_INCLUDE_ABSENT:
    "REPORT_INCLUDE_ABSENT",

  REPORT_SHOW_PAYROLL:
    "REPORT_SHOW_PAYROLL",

  // ===================================================
  // SECURITY
  // ===================================================

  ALLOW_LOCATION_TRACKING:
    "ALLOW_LOCATION_TRACKING",

  ALLOW_DEVICE_TRACKING:
    "ALLOW_DEVICE_TRACKING",

  REQUIRE_GPS:
    "REQUIRE_GPS",

  REQUIRE_PHOTO:
    "REQUIRE_PHOTO"
};

/* =====================================================
   TIMELOG HEADERS
===================================================== */

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
    "created_at"
  ];
}