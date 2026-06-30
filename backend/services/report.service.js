
function enrichReportRows(
  workspace_id,
  email,
  reportRows = []
) {

  return reportRows.map(function (row) {

    const user = getUserByEmail(
      workspace_id,
      row.email
    ) || {};

    const shift = Object.assign(
      {
        shift_name: "",
        start_time: "",
        end_time: ""
      },
      getShiftById(
        workspace_id,
        row.shift_id || user.shift_id
      )
    );

    return {

      ...row,

      // -------------------------------------------------
      // USER
      // -------------------------------------------------

      fullname: user.fullname || "",
      employee_no: user.employee_no || "",
      department_id: user.department_id || "",
      role: user.role || "",

      // -------------------------------------------------
      // SHIFT
      // -------------------------------------------------

      shift_name: shift.shift_name || "",
      shift_start: shift.start_time || "",
      shift_end: shift.end_time || ""

    };

  });

}

// =====================================================
// REPORT API
// =====================================================

function api_getReports(
  workspace_id,
  email,
  shift_id,
  role
) {

  const normalizedWorkspaceId = normalize(
    "workspace_id",
    workspace_id
  );

  const normalizedEmail = normalize(
    "email",
    email
  );

  const normalizedShiftId = normalize(
    "shift_id",
    shift_id
  );

  if (!normalizedWorkspaceId) {
    throw new Error("workspace_id is required");
  }

  if (!normalizedEmail) {
    throw new Error("email is required");
  }

  const normalizedRole = String(
    role || ""
  ).toUpperCase();


  // -------------------------------------------------
  // Validate authenticated user
  // -------------------------------------------------

  const authUser = findAuthUserByEmail(
    normalizedEmail
  );

  if (!authUser) {
    throw new Error(
      "Authentication user not found"
    );
  }

  if (!normalizedShiftId) {
        throw new Error(
      "Shift_id required"
    );
  }

  const shift = getShiftById(
    normalizedWorkspaceId,
    normalizedShiftId
  );

  if (!shift) {
    throw new Error("Shift not found");
  }

    const isAdmin =
    normalizedRole === "ADMIN" ||
    normalizedRole === "OWNER" ||
    normalizedRole === "HR" ||
    normalizedRole === "SUPERADMIN";


  // -------------------------------------------------
  // Build report
  // -------------------------------------------------

  let rows = buildEmployeeReport(
    normalizedWorkspaceId,
    (isAdmin)?null:normalizedEmail
  );

  // -------------------------------------------------
  // Enrich report rows
  // -------------------------------------------------

  rows = enrichReportRows(
    normalizedWorkspaceId,
    (isAdmin)?null:normalizedEmail,
    rows
  );

  // -------------------------------------------------
  // Build KPIs
  // -------------------------------------------------

  const kpis = buildReportKPIs(rows, shift);

  // -------------------------------------------------
  // Response
  // -------------------------------------------------

  return {
    success: true,
    data: {
      rows: rows,
      kpis: kpis,
      total_rows: rows.length
    }
  };

}


function buildReportKPIs(rows = [], shift) {

  const kpi = {

    total_worked_minutes: 0,
    total_paid_minutes: 0,

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

    total_records: rows.length

  };

  const presentSet = new Set();
  const workdaySet = new Set();

  rows.forEach(function (row) {

    //---------------------------------------
    // Totals
    //---------------------------------------

    kpi.total_worked_minutes += Number(row.worked_minutes || 0);
    kpi.total_paid_minutes += Number(row.paid_minutes || 0);

    kpi.total_regular_minutes += Number(row.regular_minutes || 0);
    kpi.total_overtime_minutes += Number(row.overtime_minutes || 0);

    kpi.total_break_minutes += Number(row.break_minutes || 0);
    kpi.total_lunch_minutes += Number(row.lunch_minutes || 0);

    kpi.total_late_minutes += Number(row.late_minutes || 0);
    kpi.total_undertime_minutes += Number(row.undertime_minutes || 0);

    //---------------------------------------
    // Attendance counts
    //---------------------------------------

    const status = String(
      row.status || ""
    ).toUpperCase();

    const workDate =
      row.work_date ||
      row.date ||
      "";

    if (workDate) {
      workdaySet.add(workDate);
    }

    if (status === "ABSENT") {

      kpi.total_absent++;

    } else if (row.user_id && workDate) {

      presentSet.add(
        row.user_id + "_" + workDate
      );

    }

    if (Number(row.late_minutes || 0) > 0) {
      kpi.total_late_count++;
    }

  });

  //---------------------------------------
  // Counts
  //---------------------------------------

  kpi.total_present = presentSet.size;
  kpi.total_workdays = workdaySet.size;

  //---------------------------------------
  // Hours
  //---------------------------------------

  function minutesToHours(minutes) {
    return +(minutes / 60).toFixed(2);
  }

  kpi.total_worked_hours =
    minutesToHours(kpi.total_worked_minutes);

  kpi.total_paid_hours =
    minutesToHours(kpi.total_paid_minutes);

  kpi.total_regular_hours =
    minutesToHours(kpi.total_regular_minutes);

  kpi.total_overtime_hours =
    minutesToHours(kpi.total_overtime_minutes);

  kpi.total_break_hours =
    minutesToHours(kpi.total_break_minutes);

  kpi.total_lunch_hours =
    minutesToHours(kpi.total_lunch_minutes);

  return kpi;

}
function calculateShiftAttendance(shift, state) {

  if (!shift) {
    throw new Error("Shift is required.");
  }

  state = state || {};

  const result = {
    scheduled_minutes: 0,

    worked_minutes: 0,
    paid_minutes: 0,

    break_minutes: 0,
    lunch_minutes: 0,

    regular_minutes: 0,
    overtime_minutes: 0,

    late_minutes: 0,
    undertime_minutes: 0,

    worked_hours: 0,
    paid_hours: 0,
    regular_hours: 0,
    overtime_hours: 0
  };

  if (!state.time_in || !state.time_out) {
    return result;
  }

  const timeIn = new Date(state.time_in);
  const timeOut = new Date(state.time_out);

  if (
    isNaN(timeIn.getTime()) ||
    isNaN(timeOut.getTime())
  ) {
    return result;
  }

  // --------------------------------------------------
  // Shift Window
  // --------------------------------------------------

  const shiftStart = new Date(timeIn);
  const shiftEnd = new Date(timeIn);

  const startParts = String(
    shift.start_time || "00:00"
  )
    .split(":")
    .map(Number);

  const endParts = String(
    shift.end_time || "00:00"
  )
    .split(":")
    .map(Number);

  shiftStart.setHours(
    startParts[0],
    startParts[1],
    0,
    0
  );

  shiftEnd.setHours(
    endParts[0],
    endParts[1],
    0,
    0
  );

  // Overnight shift
  if (shiftEnd <= shiftStart) {

    shiftEnd.setDate(
      shiftEnd.getDate() + 1
    );

    if (timeOut <= timeIn) {
      timeOut.setDate(
        timeOut.getDate() + 1
      );
    }

  }

  result.scheduled_minutes = Math.round(
    (shiftEnd.getTime() - shiftStart.getTime()) / 60000
  );

  // --------------------------------------------------
  // Late / Undertime
  // --------------------------------------------------

  result.late_minutes = Math.max(
    0,
    Math.round(
      (timeIn.getTime() - shiftStart.getTime()) / 60000
    )
  );

  result.undertime_minutes = Math.max(
    0,
    Math.round(
      (shiftEnd.getTime() - timeOut.getTime()) / 60000
    )
  );

  // --------------------------------------------------
  // Breaks
  // --------------------------------------------------

  (state.breaks || []).forEach(function (item) {

    if (!item?.in || !item?.out) {
      return;
    }

    const breakIn = new Date(item.in);
    const breakOut = new Date(item.out);

    if (
      isNaN(breakIn.getTime()) ||
      isNaN(breakOut.getTime())
    ) {
      return;
    }

    result.break_minutes += Math.max(
      0,
      Math.round(
        (breakOut.getTime() - breakIn.getTime()) / 60000
      )
    );

  });

  // --------------------------------------------------
  // Lunch
  // --------------------------------------------------

  if (
    state.lunch?.in &&
    state.lunch?.out
  ) {

    const lunchIn = new Date(state.lunch.in);
    const lunchOut = new Date(state.lunch.out);

    if (
      !isNaN(lunchIn.getTime()) &&
      !isNaN(lunchOut.getTime())
    ) {

      result.lunch_minutes = Math.max(
        0,
        Math.round(
          (lunchOut.getTime() - lunchIn.getTime()) / 60000
        )
      );

    }

  }

  // --------------------------------------------------
  // Worked / Paid
  // --------------------------------------------------

  result.worked_minutes = Math.max(
    0,
    Math.round(
      (timeOut.getTime() - timeIn.getTime()) / 60000
    )
  );

  result.paid_minutes = Math.max(
    0,
    result.worked_minutes -
      result.break_minutes -
      result.lunch_minutes
  );

  // --------------------------------------------------
  // Regular / OT
  // --------------------------------------------------

  result.regular_minutes = Math.min(
    result.paid_minutes,
    result.scheduled_minutes
  );

  result.overtime_minutes = Math.max(
    0,
    result.paid_minutes -
      result.scheduled_minutes
  );

  // --------------------------------------------------
  // Hours
  // --------------------------------------------------

  result.worked_hours =
    +(result.worked_minutes / 60).toFixed(2);

  result.paid_hours =
    +(result.paid_minutes / 60).toFixed(2);

  result.regular_hours =
    +(result.regular_minutes / 60).toFixed(2);

  result.overtime_hours =
    +(result.overtime_minutes / 60).toFixed(2);

  return result;

}