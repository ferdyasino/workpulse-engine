/**
 * =====================================================
 * REPORT SERVICE
 * =====================================================
 */

function api_getReports(workspace_id, email, shift_id, role, start_date, end_date, timezone) {
  if (!workspace_id) {
    throw new Error("workspace_id is required");
  }

  const settings = getWorkspaceSettings(workspace_id);

  // Apply requested/report timezone
  settings.TIMEZONE = timezone || settings.TIMEZONE || "America/New_York";

  const isAdmin = ["ADMIN", "OWNER", "HR", "SUPERADMIN"].includes(String(role || "").toUpperCase());

  let users = [];

  if (isAdmin && !email) {
    users = getUsers(workspace_id);
  } else {
    const user = getUserByEmail(workspace_id, email);

    if (!user) {
      throw new Error("User not found");
    }

    users = [user];
  }

  let rows = [];

  users.forEach(function (user) {
    if (!user || !user.shift_id) {
      return;
    }

    if (shift_id && user.shift_id !== shift_id) {
      return;
    }

    rows = rows.concat(
      buildEmployeeAttendanceReport(workspace_id, user, start_date, end_date, settings),
    );
  });

  return JSON.stringify({
    success: true,
    role,
    timezone: settings.TIMEZONE,
    rows,
    summary: buildReportSummary(rows),
  });
}

/**
 * =====================================================
 * BUILD EMPLOYEE REPORT
 * =====================================================
 */

function buildEmployeeAttendanceReport(workspace_id, user, start_date, end_date, settings) {
  const rows = [];

  const timezone = settings.TIMEZONE || "America/New_York";

  // Parse using workspace timezone
  const start = new Date(start_date + "T00:00:00");
  const end = new Date(end_date + "T00:00:00");

  const cursor = new Date(start);

  const shift = getShiftById(workspace_id, user.shift_id);

  while (cursor <= end) {
    if (isWeeklyDayOff(cursor, settings)) {
      cursor.setDate(cursor.getDate() + 1);
      continue;
    }

    const workDate = Utilities.formatDate(cursor, timezone, "yyyy-MM-dd");

    /*
     * SINGLE SOURCE OF TRUTH
     */
    const attendance = buildAttendanceByWorkDate(
      workspace_id,
      user.email,
      user.shift_id,
      workDate,
      settings,
    );

    if (attendance) {
      rows.push({
        ...attendance,

        user_id: user.user_id,

        fullname: user.fullname,

        email: user.email,

        shift_id: user.shift_id,

        shift_name: shift?.shift_name || "",

        date: workDate,

        status: attendance.attendance_status,
      });
    }

    cursor.setDate(cursor.getDate() + 1);
  }

  return rows;
}

/**
 * =====================================================
 * REPORT SUMMARY
 * =====================================================
 */

function buildReportSummary(rows) {
  const summary = {
    worked_minutes: 0,
    regular_minutes: 0,
    overtime_minutes: 0,
    break_minutes: 0,
    lunch_minutes: 0,
    late_minutes: 0,
    undertime_minutes: 0,

    present: 0,
    absent: 0,
    late: 0,
    undertime: 0,
    overtime: 0,
    workdays: 0,
  };

  rows.forEach(function (row) {
    summary.workdays++;

    summary.worked_minutes += Number(row.worked_minutes || 0);

    summary.regular_minutes += Number(row.regular_minutes || 0);

    summary.overtime_minutes += Number(row.overtime_minutes || 0);

    summary.break_minutes += Number(row.break_minutes || 0);

    summary.lunch_minutes += Number(row.lunch_minutes || 0);

    summary.late_minutes += Number(row.late_minutes || 0);

    summary.undertime_minutes += Number(row.undertime_minutes || 0);

    switch (row.attendance_status) {
      case "PRESENT":
        summary.present++;
        break;

      case "LATE":
        summary.present++;
        summary.late++;
        break;

      case "UNDERTIME":
        summary.present++;
        summary.undertime++;
        break;

      case "OVERTIME":
        summary.present++;
        summary.overtime++;
        break;

      case "ABSENT":
        summary.absent++;
        break;
    }
  });

  return summary;
}
