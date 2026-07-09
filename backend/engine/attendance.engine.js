function buildAttendanceState(shift, timelogState, options) {
  options = options || {};

  const settings = options.settings || {};


  const window = resolveAttendanceSchedule(
    shift,
    options.timestamp,
    settings
  );

  // return window;

  const attendance = {
    ...timelogState,

    shift_id: shift ? shift.shift_id : "",
    shift_start: window ? window.shift_start : null,
    shift_end: window ? window.shift_end : null,
    scheduled_minutes: window ? window.scheduled_minutes : 0,

    attendance_sessions: [],

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

  attendance.attendance_sessions = buildAttendanceSessions(
    timelogState.sessions,
    window,
    settings,
  );

  attendance.worked_minutes = calculateWorkedMinutes(
    attendance.attendance_sessions,
  );

  attendance.break_minutes = calculateBreakMinutes(
    timelogState.breaks,
  );

  attendance.lunch_minutes = calculateLunchMinutes(
    timelogState.lunch,
  );

  attendance.late_minutes = calculateLateMinutes(
    attendance.attendance_sessions,
    window,
    settings,
  );

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
    options.timestamp,
  );

  return attendance;
}
function buildAttendanceSessions(sessions, shiftWindow, settings) {
  const list = Array.isArray(sessions) ? sessions : [];

  const allowOvertime = !!settings.OVERTIME_ENABLED;

  return list
    .map(function (session) {
      if (!session || !session.time_in) {
        return null;
      }

      const timeIn = new Date(session.time_in);
      const timeOut = session.time_out ? new Date(session.time_out) : null;

      if (!allowOvertime) {
        if (timeIn < shiftWindow.shift_start) {
          timeIn.setTime(shiftWindow.shift_start.getTime());
        }

        if (timeOut && timeOut > shiftWindow.shift_end) {
          timeOut.setTime(shiftWindow.shift_end.getTime());
        }
      }

      if (timeOut && timeOut <= timeIn) {
        return null;
      }

      return {
        time_in: timeIn,
        time_out: timeOut,
      };
    })
    .filter(Boolean);
}

function calculateWorkedMinutes(sessions) {
  return (sessions || []).reduce(function (total, s) {
    if (!s.time_in || !s.time_out) return total;

    return total + Math.max(0, Math.round((s.time_out - s.time_in) / 60000));
  }, 0);
}

function calculateBreakMinutes(breaks) {
  return (breaks || []).reduce(function (total, b) {
    if (!b.in || !b.out) return total;

    // @ts-ignore
    return total + Math.max(0, Math.round((new Date(b.out) - new Date(b.in)) / 60000));
  }, 0);
}

function calculateLunchMinutes(lunch) {
  if (!lunch || !lunch.in || !lunch.out) return 0;

  // @ts-ignore
  return Math.max(0, Math.round((new Date(lunch.out) - new Date(lunch.in)) / 60000));
}


function calculateLateMinutes(sessions, window, settings) {
  if (!sessions || !sessions.length) {
    return 0;
  }

  const firstSession = sessions[0];

  const grace = Number(settings.LATE_GRACE_MINUTES_DEFAULT || 0);

  const minutesLate = Math.round(
    (firstSession.time_in.getTime() - window.shift_start.getTime()) / 60000
  );

  return Math.max(0, minutesLate - grace);
}

function calculateRegularMinutes(worked, scheduled) {
  return Math.min(Number(worked) || 0, Number(scheduled) || 0);
}

function calculateUndertimeMinutes(worked, scheduled) {
  return Math.max(0, Number(scheduled || 0) - Number(worked || 0));
}

function calculateOvertimeMinutes(worked, scheduled, settings) {
  if (!settings.OVERTIME_ENABLED) {
    return 0;
  }

  worked = Number(worked) || 0;
  scheduled = Number(scheduled) || 0;

  const raw = Math.max(0, worked - scheduled);

  const minimum = Number(settings.MINIMUM_OVERTIME_MINUTES || 0);

  return raw >= minimum ? raw : 0;
}

function determineAttendanceStatus(attendance, window, settings, now) {
  if (!window) {
    return "ABSENT";
  }

  if (typeof now === "string") {
    now = window.shift_end;
  } else if (!(now instanceof Date)) {
    now = new Date();
  }

  if (now < window.shift_start) {
    return "NOT_STARTED";
  }

  if (!attendance.time_in) {
    return "ABSENT";
  }

  if (attendance.late_minutes > 0) {
    return "LATE";
  }

  if (attendance.overtime_minutes > 0) {
    return "OVERTIME";
  }

  if (attendance.undertime_minutes > 0) {
    return "UNDERTIME";
  }

  return "PRESENT";
}

function api_debugAttendanceEngine(
  workspace_id,
  email,
  shift_id,
  start_date,
  end_date,
  timezone,
) {

  if (!workspace_id) {
    throw new Error("workspace_id is required");
  }

  if (!email) {
    throw new Error("email is required");
  }

  if (!shift_id) {
    throw new Error("shift_id is required");
  }

  const settings = getWorkspaceSettings(workspace_id);

  if (timezone) {
    settings.TIMEZONE = timezone;
  }

  if (!start_date) {
    throw new Error("start_date is required");
  }

  const start = new Date(start_date);
  const end = new Date(end_date);

  if (start > end) {
    throw new Error("start_date cannot be after end_date");
  }

  const days = [];

  const summary = {
    total_days: 0,
    present: 0,
    absent: 0,
    late: 0,
    undertime: 0,
    overtime: 0,

    worked_minutes: 0,
    regular_minutes: 0,
    overtime_minutes: 0,
    late_minutes: 0,
    undertime_minutes: 0,
    break_minutes: 0,
    lunch_minutes: 0,
  };

  const cursor = new Date(start);

while (cursor <= end) {
  if (isWeeklyDayOff(cursor, settings)) {
    cursor.setDate(cursor.getDate() + 1);
    continue;
  }

  const workDate = formatDateKey(cursor);

  const attendance = buildAttendanceByWorkDate(
    workspace_id,
    email,
    shift_id,
    workDate,
    settings
  );

  days.push(attendance);

    summary.total_days++;

    summary.worked_minutes += Number(attendance.worked_minutes || 0);
    summary.regular_minutes += Number(attendance.regular_minutes || 0);
    summary.overtime_minutes += Number(attendance.overtime_minutes || 0);
    summary.late_minutes += Number(attendance.late_minutes || 0);
    summary.undertime_minutes += Number(attendance.undertime_minutes || 0);
    summary.break_minutes += Number(attendance.break_minutes || 0);
    summary.lunch_minutes += Number(attendance.lunch_minutes || 0);

    switch (attendance.attendance_status) {
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

    cursor.setDate(cursor.getDate() + 1);
  }


  return JSON.stringify({
    employee: {
      email: email,
      shift_id: shift_id,
    },

    range: {
      start_date,
      end_date,
    },

    timezone: settings.TIMEZONE,

    settings,

    summary,

    days,
  });
}