/**
 * =====================================================
 * ATTENDANCE ENGINE (v2)
 * =====================================================
 * Converts timelog state + shift into attendance state
 * =====================================================
 */
function buildAttendanceState(shift, timelogState, options) {
  options = options || {};

  const settings = options.settings;
  const window = shift ? resolveShiftWindow(shift, options.timestamp) : null;

  const attendance = {
    // --------------------------------------------------
    // Timelog (raw)
    // --------------------------------------------------
    ...timelogState,

    // --------------------------------------------------
    // Shift
    // --------------------------------------------------
    shift_id: shift ? shift.shift_id : "",
    shift_start: window ? window.shift_start : null,
    shift_end: window ? window.shift_end : null,
    scheduled_minutes: window ? window.scheduled_minutes : 0,

    // --------------------------------------------------
    // Computed sessions
    // --------------------------------------------------
    attendance_sessions: [],

    // --------------------------------------------------
    // Metrics
    // --------------------------------------------------
    worked_minutes: 0,
    regular_minutes: 0,
    overtime_minutes: 0,
    break_minutes: 0,
    lunch_minutes: 0,
    late_minutes: 0,
    undertime_minutes: 0,

    attendance_status: "ABSENT",
  };

  if (!shift || !window) {
    return attendance;
  }

  // --------------------------------------------------
  // Normalize sessions
  // --------------------------------------------------
  attendance.attendance_sessions = buildAttendanceSessions(timelogState.sessions, window, settings);

  // --------------------------------------------------
  // Core calculations
  // --------------------------------------------------
  attendance.worked_minutes = calculateWorkedMinutes(attendance.attendance_sessions);

  attendance.break_minutes = calculateBreakMinutes(timelogState.breaks);

  attendance.lunch_minutes = calculateLunchMinutes(timelogState.lunch);

  attendance.late_minutes = calculateLateMinutes(attendance.attendance_sessions, window, settings);

  attendance.overtime_minutes = calculateOvertimeMinutes(
    attendance.worked_minutes,
    attendance.scheduled_minutes,
    settings,
  );

  attendance.regular_minutes = calculateRegularMinutes(
    attendance.worked_minutes,
    attendance.scheduled_minutes,
  );

  attendance.undertime_minutes = calculateUndertimeMinutes(
    attendance.worked_minutes,
    attendance.scheduled_minutes,
  );

  attendance.attendance_status = determineAttendanceStatus(
    attendance,
    window,
    settings,
    options.timestamp || new Date(),
  );

  return attendance;
}

/* =====================================================
   SESSION NORMALIZATION
===================================================== */
function buildAttendanceSessions(sessions, shiftWindow, settings) {
  const list = Array.isArray(sessions) ? sessions : [];

  const allowOvertime = !!settings.OVERTIME_ENABLED;

  console.log("override settings", settings);

  return list
    .map(function (session) {
      if (!session || !session.time_in) return null;

      const inTime = new Date(session.time_in);
      let outTime = session.time_out ? new Date(session.time_out) : null;

      // clamp to shift if overtime disabled
      if (!allowOvertime) {
        if (inTime < shiftWindow.shift_start) {
          inTime.setTime(shiftWindow.shift_start.getTime());
        }

        if (outTime && outTime > shiftWindow.shift_end) {
          outTime.setTime(shiftWindow.shift_end.getTime());
        }
      }

      if (outTime && outTime <= inTime) return null;

      return {
        time_in: inTime,
        time_out: outTime,
      };
    })
    .filter(Boolean);
}

/* =====================================================
   WORKED TIME
===================================================== */
function calculateWorkedMinutes(sessions) {
  return (sessions || []).reduce(function (total, s) {
    if (!s.time_in || !s.time_out) return total;

    return total + Math.max(0, Math.round((s.time_out - s.time_in) / 60000));
  }, 0);
}

/* =====================================================
   BREAK TIME
===================================================== */
function calculateBreakMinutes(breaks) {
  return (breaks || []).reduce(function (total, b) {
    if (!b.in || !b.out) return total;

    // @ts-ignore
    return total + Math.max(0, Math.round((new Date(b.out) - new Date(b.in)) / 60000));
  }, 0);
}

/* =====================================================
   LUNCH TIME
===================================================== */
function calculateLunchMinutes(lunch) {
  if (!lunch || !lunch.in || !lunch.out) return 0;

  // @ts-ignore
  return Math.max(0, Math.round((new Date(lunch.out) - new Date(lunch.in)) / 60000));
}

/* =====================================================
   LATE (GRACE-AWARE)
===================================================== */
function calculateLateMinutes(sessions, window, settings) {
  if (!sessions.length) return 0;

  const first = sessions[0];
  const grace = Number(settings.LATE_GRACE_MINUTES_DEFAULT || 0); 

  const diff = Math.round((first.time_in - window.shift_start) / 60000);

  return Math.max(0, diff - grace);
}

/* =====================================================
   REGULAR TIME
===================================================== */
function calculateRegularMinutes(worked, scheduled) {
  return Math.min(Number(worked) || 0, Number(scheduled) || 0);
}

/* =====================================================
   UNDERTIME
===================================================== */
function calculateUndertimeMinutes(worked, scheduled) {
  return Math.max(0, Number(scheduled || 0) - Number(worked || 0));
}

/* =====================================================
   OVERTIME (RULE-AWARE)
===================================================== */
function calculateOvertimeMinutes(worked, scheduled, settings) {
  if (!settings.allow_overtime) return 0;

  const raw = Math.max(0, worked - scheduled);

  const min = Number(settings.MINIMUM_OVERTIME_MINUTES || 0);

  return raw < min ? 0 : raw;
}

function determineAttendanceStatus(attendance, window, settings, now) {
  now = now || new Date();

  // Shift hasn't started yet.
  if (now < window.shift_start) {
    return "NOT_STARTED";
  }

  // No login after shift start.
  if (!attendance.time_in) {
    return "ABSENT";
  }

  // Logged in late.
  if (attendance.late_minutes > 0) {
    return "LATE";
  }

  // Worked beyond schedule.
  if (attendance.overtime_minutes > 0) {
    return "OVERTIME";
  }

  // Left before completing scheduled work.
  if (attendance.undertime_minutes > 0) {
    return "UNDERTIME";
  }

  return "PRESENT";
}
