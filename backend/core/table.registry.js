const DB_CONFIG = {
  AUTH_SPREADSHEET_ID: "1YQJGlNZamkMwO-04VyoqDHa0GL8Ip_-C93LJWDl13aU",
};

const AUTH_PROVIDERS = {
  PASSWORD: "password",
  GOOGLE: "google",
  BOTH: "both",
};

const AUTH_SCHEMA = {
  OWNERS: [
    "owner_id",
    "email",
    "fullname",
    "workspace_id",
    "workspace_url",
    "timelog_spreadsheet_id",
    "timelog_url",
    "status",
    "created_at",
    "updated_at",
  ],

  USERS: [
    "user_id",
    "email",
    "fullname",
    "role",
    "workspace_id",
    "auth_provider",
    "google_sub",
    "google_email",
    "last_login_at",
    "status",
    "created_at",
    "updated_at",
  ],

  AUTHORIZED_EMAILS: ["email", "fullname", "role", "created_at"],
};

const SCHEMA = {
  USERS: [
    "user_id",
    "employee_no",
    "email",
    "fullname",
    "role",
    "department_id",
    "shift_id",
    "position_id",
    "status",
    "created_at",
  ],

  DEPARTMENTS: ["department_id", "department_name", "description", "supervisor_name", "created_at"],

  SHIFTS: [
    "shift_id",
    "shift_name",
    "start_time",
    "end_time",
    "grace_minutes",
    "timezone",
    "status",
    "created_at",
    "break_limit_minutes",
    "lunch_duration_minutes",
    "overtime_threshold_minutes",
    "overtime_multiplier",
    "night_diff_start",
    "night_diff_end",
    "night_diff_multiplier",
    "rounding_rule",
  ],

  POSITIONS: ["position_id", "position_name", "department_ids", "description", "created_at"],

  ATTENDANCE_INDEX: [
    "attendance_id",
    "date",
    "user_id",
    "shift_id",
    "time_in",
    "time_out",
    "worked_minutes",
    "status",
    "created_at",
    "updated_at",
  ],

  REPORT_INDEX: [
    "report_id",
    "workspace_id",
    "user_id",
    "email",
    "date",
    "shift_id",
    "worked_minutes",
    "late_minutes",
    "overtime_minutes",
    "break_minutes",
    "status",
    "created_at",
  ],

  SETTINGS: ["key", "value", "type", "group", "options", "label", "description", "updated_at"],
};

const EXTERNAL_SCHEMA = {
  TIME_LOGS: [
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

    "location_status",
    "location_message",

    "source",
    "remarks",
    "created_at",

    "computed_worked_minutes",
    "computed_late_minutes",
    "computed_overtime_minutes",
    "computed_break_minutes",
  ],
};

const AUTH_TABLES = {
  AUTHORIZED_EMAILS: {
    sheet: "Authorized_Emails",
    pk: "email",
    schema: AUTH_SCHEMA.AUTHORIZED_EMAILS,
    mode: "READ_ONLY",
  },

  OWNERS: {
    sheet: "Owners",
    pk: "owner_id",
    schema: AUTH_SCHEMA.OWNERS,
    mode: "WRITE_ON_INIT",
  },

  USERS: {
    sheet: "Users",
    pk: "user_id",
    schema: AUTH_SCHEMA.USERS,
    mode: "WRITE_ON_INIT",
  },
};

/**
 * =====================================================
 * TABLE REGISTRY (WORKSPACE DB)
 * =====================================================
 */
const TABLES = {
  SETTINGS: {
    sheet: "Settings",
    pk: "key",
    schema: SCHEMA.SETTINGS,
  },

  USERS: {
    sheet: "Users",
    pk: "user_id",
    schema: SCHEMA.USERS,
  },

  DEPARTMENTS: {
    sheet: "Departments",
    pk: "department_id",
    schema: SCHEMA.DEPARTMENTS,
  },

  SHIFTS: {
    sheet: "Shifts",
    pk: "shift_id",
    schema: SCHEMA.SHIFTS,
  },

  POSITIONS: {
    sheet: "Positions",
    pk: "position_id",
    schema: SCHEMA.POSITIONS,
  },

  ATTENDANCE_INDEX: {
    sheet: "Attendance Index",
    pk: "attendance_id",
    schema: SCHEMA.ATTENDANCE_INDEX,
  },

  REPORT_INDEX: {
    sheet: "Report Index",
    pk: "report_id",
    schema: SCHEMA.REPORT_INDEX,
  },
};

/**
 * =====================================================
 * EXTERNAL TABLES (TIMELOG DB)
 * =====================================================
 */
const EXTERNAL_TABLES = {
  TIME_LOGS: {
    sheet: "TIME_LOGS",
    pk: "log_id",
    schema: EXTERNAL_SCHEMA.TIME_LOGS,
  },
};
