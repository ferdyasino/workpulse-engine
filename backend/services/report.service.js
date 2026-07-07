function enrichReportRows(workspace_id, rows) {
  rows = Array.isArray(rows) ? rows : [];

  return rows.map(function (row) {
    const user = getUserByEmail(workspace_id, row.email) || {};

    const shift =
      getShiftById(workspace_id, row.shift_id || user.shift_id) || {};

    return {
      ...row,

      fullname: user.fullname || "",
      employee_no: user.employee_no || "",
      department_id: user.department_id || "",
      role: user.role || "",

      // @ts-ignore
      shift_name: shift.shift_name || "",
      // @ts-ignore
      shift_start: shift.start_time || "",
      // @ts-ignore
      shift_end: shift.end_time || "",
    };
  });
}
function api_getReports(workspace_id, email, shift_id, role, range) {
  workspace_id = normalize("workspace_id", workspace_id);
  email = normalize("email", email);
  shift_id = normalize("shift_id", shift_id);

  if (!workspace_id) {
    throw new Error("workspace_id is required");
  }

  if (!email) {
    throw new Error("email is required");
  }

  const authUser = findAuthUserByEmail(email);

  if (!authUser) {
    throw new Error("Authentication user not found");
  }

  const isAdmin = ["ADMIN", "OWNER", "HR", "SUPERADMIN"].includes(
    String(role || "").toUpperCase(),
  );

  const settings = getWorkspaceSettings(workspace_id);

  let rows = buildEmployeeReport(
    workspace_id,
    isAdmin ? null : email,
    range,
    settings
  );
  
  // return rows;
  
  rows = enrichReportRows(workspace_id, rows);

  return {
    success: true,
    data: {
      rows,
      kpis: buildReportKPIs(rows),
      total_rows: rows.length,
    },
  };
}

function buildReportKPIs(rows) {
  rows = Array.isArray(rows) ? rows : [];

  const kpi = {
    total_records: rows.length,

    total_worked_minutes: 0,
    total_regular_minutes: 0,
    total_overtime_minutes: 0,

    total_break_minutes: 0,
    total_lunch_minutes: 0,

    total_late_minutes: 0,
    total_undertime_minutes: 0,

    total_present: 0,
    total_absent: 0,
    total_late_count: 0,
    total_workdays: 0,
  };

  const present = new Set();
  const workdays = new Set();

  rows.forEach(function (row) {
    kpi.total_worked_minutes += Number(row.worked_minutes || 0);
    kpi.total_regular_minutes += Number(row.regular_minutes || 0);
    kpi.total_overtime_minutes += Number(row.overtime_minutes || 0);

    kpi.total_break_minutes += Number(row.break_minutes || 0);
    kpi.total_lunch_minutes += Number(row.lunch_minutes || 0);

    kpi.total_late_minutes += Number(row.late_minutes || 0);
    kpi.total_undertime_minutes += Number(row.undertime_minutes || 0);

    const status = String(row.attendance_status || "").toUpperCase();

    const workDate = row.work_date || row.date || "";

    if (workDate) {
      workdays.add(workDate);
    }

    if (status === "ABSENT") {
      kpi.total_absent++;
    } else if (row.user_id && workDate) {
      present.add(row.user_id + "|" + workDate);
    }

    if (row.late_minutes > 0) {
      kpi.total_late_count++;
    }
  });

  kpi.total_present = present.size;
  kpi.total_workdays = workdays.size;

  function hours(minutes) {
    return +(minutes / 60).toFixed(2);
  }

  kpi.total_worked_hours = hours(kpi.total_worked_minutes);
  kpi.total_regular_hours = hours(kpi.total_regular_minutes);
  kpi.total_overtime_hours = hours(kpi.total_overtime_minutes);
  kpi.total_break_hours = hours(kpi.total_break_minutes);
  kpi.total_lunch_hours = hours(kpi.total_lunch_minutes);

  return kpi;
}