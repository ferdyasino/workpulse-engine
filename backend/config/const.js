/* =========================
   CONSTANTS
========================= */

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

function normalizeRole(input) {
  const raw = String(input || "").trim().toLowerCase();

  switch (raw) {
    case "superadmin":
    case "super_admin":
      return ROLES.SUPERADMIN;

    case "owner":
      return ROLES.ADMIN;

    case "admin":
      return ROLES.ADMIN;

    case "hr":
      return ROLES.HR;

    case "employee":
    case "user":
      return ROLES.USER;

    default:
      return ROLES.USER;
  }
}