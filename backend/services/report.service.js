function enrichReportRows(workspace_id, rows, settings) {
  rows = Array.isArray(rows) ? rows : [];

  return rows.map(function (row) {
    const user = getUserByEmail(workspace_id, row.email) || {};

    const shift =
      getShiftById(workspace_id, row.shift_id || user.shift_id) || {};

    const metrics = calculateAttendanceMetrics(row, shift, settings);

    return {
      ...row,

      ...metrics,

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


/**
 * Calculate attendance payroll metrics
 */
function calculateAttendanceMetrics(row, shift, settings) {

  let worked_minutes = 0;
  let break_minutes = 0;
  let lunch_minutes = 0;


  /*
   * Calculate worked time
   */
  if (row.time_in && row.time_out) {

    const start = new Date(row.time_in);
    const end = new Date(row.time_out);

    worked_minutes = Math.max(
      0,
      Math.floor((end.getTime() - start.getTime()) / 60000)
    );

  } 
  else if (Array.isArray(row.sessions)) {

    row.sessions.forEach(function(session){

      if(session.time_in && session.time_out){

        const start = new Date(session.time_in);
        const end = new Date(session.time_out);

        worked_minutes += Math.max(
          0,
          Math.floor((end.getTime() - start.getTime()) / 60000)
        );

      }

    });

  }


  /*
   * Break calculation
   */
  if(Array.isArray(row.breaks)){

    row.breaks.forEach(function(br){

      if(br.break_minutes){
        break_minutes += Number(br.break_minutes);
      }

      else if(br.start && br.end){

        break_minutes += Math.max(
          0,
          Math.floor(
            (new Date(br.end).getTime() - new Date(br.start).getTime())
            /60000
          )
        );

      }

    });

  }


  /*
   * Lunch calculation
   */
  if(row.lunch){

    if(row.lunch.duration){
      lunch_minutes = Number(row.lunch.duration);
    }

    else if(row.lunch.time_in && row.lunch.time_out){

      lunch_minutes = Math.max(
        0,
        Math.floor(
          (
            new Date(row.lunch.time_out).getTime()
            -
            new Date(row.lunch.time_in).getTime()
          )
          /60000
        )
      );

    }

  }


  /*
   * Shift configuration
   */
  const regular_minutes =
    Number(settings?.regular_minutes) ||
    480;


  const overtime_minutes =
    Math.max(
      worked_minutes - regular_minutes,
      0
    );


  /*
   * Late calculation
   */
  let late_minutes = 0;

  if(row.time_in && shift.start_time){

    const actualIn = new Date(row.time_in);


    const shiftParts =
      String(shift.start_time)
      .split(":")
      .map(Number);


    const expected = new Date(actualIn);

    expected.setHours(
      shiftParts[0],
      shiftParts[1] || 0,
      0,
      0
    );


    if(actualIn > expected){

      late_minutes = Math.floor(
        (actualIn.getTime() - expected.getTime()) / 60000
      );

    }

  }


  /*
   * Undertime
   */
  const undertime_minutes =
    Math.max(
      regular_minutes - worked_minutes,
      0
    );


  /*
   * Attendance status
   */
  let attendance_status = "ABSENT";


  if(row.time_in || worked_minutes > 0){

    attendance_status = "PRESENT";

  }
  else if(row.status){

    attendance_status =
      String(row.status).toUpperCase();

  }


  return {

    worked_minutes,

    regular_minutes:
      Math.min(
        worked_minutes,
        regular_minutes
      ),

    overtime_minutes,

    break_minutes,

    lunch_minutes,

    late_minutes,

    undertime_minutes,

    attendance_status,

  };

}

function api_getReports(workspace_id, email, shift_id, role, range) {
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
  
  rows = enrichReportRows(
    workspace_id,
    rows,
    settings
  );

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

  const status = String(
    row.attendance_status || row.status || ""
  ).toUpperCase();

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