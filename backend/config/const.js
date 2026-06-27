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