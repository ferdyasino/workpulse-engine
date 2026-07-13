/**
 * =====================================================
 * REPORT SERVICE
 * =====================================================
 */

function api_getReports(
  workspace_id,
  email,
  shift_id,
  role,
  start_date,
  end_date
) {

  if (!workspace_id) {
    throw new Error("workspace_id is required");
  }

  const settings = getWorkspaceSettings(workspace_id);
  const allUsers = getUsers(workspace_id);
const allShifts = getAllShifts(workspace_id);


  const isAdmin = [
    "ADMIN",
    "OWNER",
    "HR",
    "SUPERADMIN",
  ].includes(
    String(role || "").toUpperCase()
  );


  let users = [];


  if (isAdmin && !email) {

    users = allUsers;

  } else {

    const user = allUsers.find(function(u) {
      return u.email === email;
    });

    if (!user) {
      throw new Error("User not found");
    }

    users = [user];
  }


  let rows = [];


  users.forEach(function(user){

    if (!user || !user.shift_id) {
      return;
    }


    if (
      shift_id &&
      user.shift_id !== shift_id
    ) {
      return;
    }


    rows = rows.concat(
      buildEmployeeAttendanceReport(
        workspace_id,
        user,
        start_date,
        end_date,
        settings,
        allUsers,
        allShifts
      )
    );

  });


  return JSON.stringify({
    role,
    success:true,

    rows,

    summary:
      buildReportSummary(rows),
  });
}


/**
 * =====================================================
 * BUILD EMPLOYEE REPORT
 * =====================================================
 */

function buildEmployeeAttendanceReport(
  workspace_id,
  user,
  start_date,
  end_date,
  settings,
  users,
  shifts
) {
  const rows = [];

  const shift = getShiftById(
    workspace_id,
    user.shift_id
  );

  let workDate = String(start_date);

  while (workDate <= end_date) {

    if (isWeeklyDayOff(workDate, settings)) {
      workDate = nextWorkDate(workDate);
      continue;
    }

    const departmentWindow =
      resolveDepartmentAttendanceWindow(
        users,
        shifts,
        user,
        workDate,
        settings
      );

    const attendance = buildAttendanceByWorkDate(
      workspace_id,
      user.email,
      user.shift_id,
      workDate,
      settings,
      departmentWindow
    );

    if (attendance) {
      rows.push({
        ...attendance,

        user_id: user.user_id,
        fullname: user.fullname,
        email: user.email,

        shift_id: user.shift_id,
        shift_name: shift
          ? shift.shift_name
          : "",

        date: workDate,
        deptWindow: departmentWindow,

        status: attendance.attendance_status,
      });
    }

    workDate = nextWorkDate(workDate);
  }

  return rows;
}

/**
 * =====================================================
 * REPORT SUMMARY
 * =====================================================
 */

function buildReportSummary(rows){

  const summary = {

    worked_minutes:0,

    regular_minutes:0,

    overtime_minutes:0,

    break_minutes:0,

    lunch_minutes:0,

    late_minutes:0,

    undertime_minutes:0,


    present:0,

    absent:0,

    late:0,

    undertime:0,

    overtime:0,

    workdays:0,

  };


  rows.forEach(function(row){


    summary.workdays++;


    summary.worked_minutes +=
      Number(row.worked_minutes || 0);


    summary.regular_minutes +=
      Number(row.regular_minutes || 0);


    summary.overtime_minutes +=
      Number(row.overtime_minutes || 0);


    summary.break_minutes +=
      Number(row.break_minutes || 0);


    summary.lunch_minutes +=
      Number(row.lunch_minutes || 0);


    summary.late_minutes +=
      Number(row.late_minutes || 0);


    summary.undertime_minutes +=
      Number(row.undertime_minutes || 0);



    switch(row.attendance_status){

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

/**
 * =====================================================
 * RESOLVE DEPARTMENT ATTENDANCE WINDOW
 * =====================================================
 */
function resolveDepartmentAttendanceWindow(
  users,
  shifts,
  currentUser,
  workDate,
  settings
) {

  const departmentUsers = users.filter(function(user) {
    return (
      user &&
      user.department_id === currentUser.department_id &&
      String(user.status || "").toUpperCase() === "ACTIVE"
    );
  });

  let earliestStartUtc = null;
  let latestEndUtc = null;

  departmentUsers.forEach(function(user) {

    const shift = shifts.find(function(s) {
      return s.shift_id === user.shift_id;
    });

    if (!shift) {
      return;
    }

    const timezone = getTimezone(
      shift,
      settings
    );

    const startUtc = zonedDateTimeToUtc(
      workDate,
      shift.start_time,
      timezone
    );

    const endWorkDate = isOvernightShift(shift)
      ? nextWorkDate(workDate)
      : workDate;

    const endUtc = zonedDateTimeToUtc(
      endWorkDate,
      shift.end_time,
      timezone
    );

    if (
      !earliestStartUtc ||
      startUtc.getTime() < earliestStartUtc.getTime()
    ) {
      earliestStartUtc = startUtc;
    }

    if (
      !latestEndUtc ||
      endUtc.getTime() > latestEndUtc.getTime()
    ) {
      latestEndUtc = endUtc;
    }

  });

  return {
    department_id: currentUser.department_id,

    earliest_start_utc: earliestStartUtc,
    latest_end_utc: latestEndUtc,

    earliest_start: earliestStartUtc
      ? formatTimeInTimezone(
          earliestStartUtc,
          settings.TIMEZONE
        )
      : null,

    latest_end: latestEndUtc
      ? formatTimeInTimezone(
          latestEndUtc,
          settings.TIMEZONE
        )
      : null
  };
}