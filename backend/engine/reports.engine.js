function buildEmployeeReport(workspace_id, email) {
  const normalizedWorkspaceId = normalize("workspace_id", workspace_id);

  const normalizedEmail = normalize("email", email);

  if (!normalizedWorkspaceId) {
    throw new Error("workspace_id is required");
  }

  // --------------------------------------------------
  // Get logs
  // If email is provided -> single employee
  // Otherwise -> all employees (Admin)
  // --------------------------------------------------

  const logs = normalizedEmail
    ? getTimeLogsByEmail(normalizedWorkspaceId, normalizedEmail)
    : findTimeLogs(normalizedWorkspaceId, {});

  if (!logs.length) {
    return [];
  }

  // --------------------------------------------------
  // Group by Employee + Shift + Work Date
  // --------------------------------------------------

  const groups = {};

  logs.forEach(function (log) {
    const key = [log.user_id || "", log.shift_id || "", log.date || ""].join(
      "|",
    );

    if (!groups[key]) {
      groups[key] = [];
    }

    groups[key].push(log);
  });

  // --------------------------------------------------
  // Build Daily Report
  // --------------------------------------------------

  return Object.values(groups).map(function (sessionLogs) {
    sessionLogs.sort(function (a, b) {
      return new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();
    });

    const first = sessionLogs[0];

    const state = buildTimeLogState(sessionLogs);

    const shift = getShiftById(normalizedWorkspaceId, first.shift_id);

    const attendance = shift
      ? calculateShiftAttendance(shift, state)
      : {
          scheduled_minutes: 0,

          worked_minutes: 0,
          worked_hours: 0,

          paid_minutes: 0,
          paid_hours: 0,

          regular_minutes: 0,
          regular_hours: 0,

          overtime_minutes: 0,
          overtime_hours: 0,

          break_minutes: 0,
          lunch_minutes: 0,

          late_minutes: 0,
          undertime_minutes: 0,
        };

    return {
      // ------------------------------------
      // Identity
      // ------------------------------------

      user_id: first.user_id,
      email: first.email,

      date: first.date,
      shift_id: first.shift_id,

      // ------------------------------------
      // Attendance State
      // ------------------------------------

      status: state.status,

      time_in: state.time_in,
      time_out: state.time_out,

      breaks: state.breaks,
      lunch: state.lunch,
      state: state,

      // ------------------------------------
      // Calculated Metrics
      // ------------------------------------

      scheduled_minutes: attendance.scheduled_minutes,

      worked_minutes: attendance.worked_minutes,
      worked_hours: attendance.worked_hours,

      paid_minutes: attendance.paid_minutes,
      paid_hours: attendance.paid_hours,

      regular_minutes: attendance.regular_minutes,
      regular_hours: attendance.regular_hours,

      overtime_minutes: attendance.overtime_minutes,
      overtime_hours: attendance.overtime_hours,

      break_minutes: attendance.break_minutes,

      lunch_minutes: attendance.lunch_minutes,

      late_minutes: attendance.late_minutes,

      undertime_minutes: attendance.undertime_minutes,
    };
  });
}
