// =====================================================
// REPORT ENRICHMENT
// =====================================================

function enrichReportRows(workspace_id, email, reportRows = []) {

  return reportRows.map(function (row) {

    const user =
      getUserByEmail(
        workspace_id,
        email
      ) || {};

    const shift =
      getShiftById(
        workspace_id,
        user.shift_id
      ) || {};

    return {

      ...row,

      // USER
      fullname: user.fullname || "",
      employee_no: user.employee_no || "",
      department_id: user.department_id || "",

      // SHIFT
      shift_name: shift.shift_name || "",
      shift_start: shift.start_time || "",
      shift_end: shift.end_time || ""

    };

  });

}

// =====================================================
// REPORT API
// =====================================================

function api_getReports(workspace_id, email) {

    if (!workspace_id) {
      throw new Error("workspace_id is required");
    }

    if (!email) {
      throw new Error("email is required");
    }

    // -------------------------------------------------
    // Validate authenticated user
    // -------------------------------------------------

    const authUser = findAuthUserByEmail(email);

    if (!authUser) {
      throw new Error("Authentication user not found");
    }

    // -------------------------------------------------
    // Generate report
    // -------------------------------------------------

    const rawRows = buildEmployeeReport(
      workspace_id,
      email
    );

    const rows = enrichReportRows(
      workspace_id,
      email,
      rawRows
    );

    return {
      success: true,
      data: {
        rows: rows,
        kpis: buildReportKPIs(rows)
      }
    };
}

// =====================================================
// KPI BUILDER
// =====================================================

function buildReportKPIs(rows = []) {

  const kpi = {

    total_worked_minutes: 0,
    total_overtime_minutes: 0,
    total_late_minutes: 0,
    total_break_minutes: 0,

    total_present: 0,
    total_absent: 0,
    total_late_count: 0,
    total_workdays: 0,

    total_records: rows.length

  };

  const presentSet = new Set();
  const workdaySet = new Set();

  rows.forEach(function (row) {

    const worked = Number(row.worked_minutes || 0);
    const overtime = Number(row.overtime_minutes || 0);
    const late = Number(row.late_minutes || 0);
    const breaks = Number(row.break_minutes || 0);

    const status = String(
      row.status || ""
    ).toUpperCase();

    const date = row.date || "";

    kpi.total_worked_minutes += worked;
    kpi.total_overtime_minutes += overtime;
    kpi.total_late_minutes += late;
    kpi.total_break_minutes += breaks;

    if (date) {
      workdaySet.add(date);
    }

    if (status === "ABSENT") {
      kpi.total_absent++;
    } else if (row.user_id && date) {
      presentSet.add(
        row.user_id + "_" + date
      );
    }

    if (late > 0) {
      kpi.total_late_count++;
    }

  });

  kpi.total_present = presentSet.size;
  kpi.total_workdays = workdaySet.size;

  kpi.total_worked_hours =
    +(kpi.total_worked_minutes / 60).toFixed(2);

  kpi.total_overtime_hours =
    +(kpi.total_overtime_minutes / 60).toFixed(2);

  kpi.total_break_hours =
    +(kpi.total_break_minutes / 60).toFixed(2);

  return kpi;

}