// function getCurrentState(workspace_id, email, shift_id, timestamp) {
//   const normalizedWorkspaceId = normalize("workspace_id", workspace_id);

//   const normalizedEmail = normalize("email", email);

//   const normalizedShiftId = normalize("shift_id", shift_id);

//   if (!normalizedWorkspaceId) {
//     throw new Error("workspace_id is required");
//   }

//   if (!normalizedEmail) {
//     throw new Error("email is required");
//   }

//   const targetTime = timestamp || new Date();

//   const logs = normalizedShiftId
//     ? getShiftTimeLogsByEmail(normalizedWorkspaceId, normalizedEmail, normalizedShiftId, targetTime)
//     : getTodayTimeLogsByEmail(normalizedWorkspaceId, normalizedEmail, targetTime);

//   const workDate = normalizedShiftId
//     ? getShiftWorkDate(normalizedWorkspaceId, normalizedEmail, normalizedShiftId, targetTime)
//     : formatDateKey(targetTime);

//   return buildAttendanceSnapshot(
//     logs,
//     normalizedShiftId ? "shift" : "day",
//     normalizedShiftId,
//     workDate,
//     normalizedWorkspaceId
//   );
// }

function getCurrentState(workspace_id, email, shift_id, timestamp, options) {
  options = options || {};

  const normalizedWorkspaceId = normalize("workspace_id", workspace_id);
  const normalizedEmail = normalize("email", email);
  const normalizedShiftId = normalize("shift_id", shift_id);

  if (!normalizedWorkspaceId) {
    throw new Error("workspace_id is required");
  }

  if (!normalizedEmail) {
    throw new Error("email is required");
  }

  const settings = getWorkspaceSettings(normalizedWorkspaceId);

  options.settings = settings;

  options.timezone = normalize("timezone", options.timezone) || settings.TIMEZONE;

  const targetTime = timestamp || new Date();

  const logs = normalizedShiftId
    ? getShiftTimeLogsByEmail(normalizedWorkspaceId, normalizedEmail, normalizedShiftId, targetTime)
    : getTodayTimeLogsByEmail(normalizedWorkspaceId, normalizedEmail, targetTime);

  const workDate = normalizedShiftId
    ? getShiftWorkDate(normalizedWorkspaceId, normalizedEmail, normalizedShiftId, targetTime)
    : formatDateKey(targetTime);

  return buildAttendanceSnapshot(
    logs,
    normalizedShiftId ? "shift" : "day",
    normalizedShiftId,
    workDate,
    normalizedWorkspaceId,
    options,
  );
}

function getTodayTimeLogsByEmail(workspace_id, email, timestamp, shift) {
  const normalizedWorkspaceId = normalize("workspace_id", workspace_id);

  const normalizedEmail = normalize("email", email);

  if (!normalizedWorkspaceId) {
    throw new Error("workspace_id is required");
  }

  if (!normalizedEmail) {
    throw new Error("email is required");
  }

  const workDate = shift
    ? resolveShiftWorkDate(normalizedWorkspaceId, shift, timestamp)
    : formatDateKey(timestamp || new Date());

  return getTimeLogsByDate(normalizedWorkspaceId, normalizedEmail, workDate);
}

function getLatestTodayTimeLogByEmail(workspace_id, email) {
  const logs = getTodayTimeLogsByEmail(workspace_id, email);
  return logs.length ? logs[logs.length - 1] : null;
}

function getTimeLogsByDate(workspace_id, email, dateKey) {
  const normalizedWorkspaceId = normalize("workspace_id", workspace_id);
  const normalizedEmail = normalize("email", email);
  const normalizedDate = normalize("date", dateKey);

  if (!normalizedWorkspaceId) {
    throw new Error("workspace_id is required");
  }
  if (!normalizedEmail) {
    throw new Error("email is required");
  }
  if (!normalizedDate) {
    throw new Error("date is required");
  }

  return findTimeLogs(normalizedWorkspaceId, {
    email: normalizedEmail,
    date: normalizedDate,
  });
}

/* =========================
   TIMELOG QUERIES
========================= */

function getTimeLogsByEmail(workspace_id, email, options) {
  if (!workspace_id) {
    throw new Error("workspace_id is required");
  }

  if (!email) {
    throw new Error("email is required");
  }

  const filters = {
    email: email,
  };

  options = options || {};

  if (options.shift_id) {
    filters.shift_id = normalize("shift_id", options.shift_id);
  }

  if (options.date) {
    filters.date = normalize("date", options.date);
  }

  return findTimeLogs(workspace_id, filters);
}

function getShiftTimeLogsByEmail(workspace_id, email, shift_id, timestamp) {
  return getTimeLogsByEmail(workspace_id, email, {
    shift_id,
    date: getShiftWorkDate(workspace_id, email, shift_id, timestamp),
  });
}

function getLatestShiftTimeLogByEmail(workspace_id, email, shift_id, timestamp) {
  const logs = getShiftTimeLogsByEmail(workspace_id, email, shift_id, timestamp);

  return logs.length ? logs[logs.length - 1] : null;
}

function matchesTimeLogFilters(record, filters) {
  return Object.entries(filters).every(function (entry) {
    const key = entry[0];
    const filterValue = entry[1];

    if (filterValue === undefined || filterValue === null || filterValue === "") {
      return true;
    }

    return String(record[key]) === String(filterValue);
  });
}

function resolveShiftWorkDate(workspace_id, shift, timestamp) {
  return resolveShiftWindow(workspace_id, shift, timestamp).work_date;
}

function getAttendanceStateByWorkDate(workspace_id, email, shift_id, work_date, options) {
  options = options || {};

  if (!workspace_id) {
    throw new Error("workspace_id is required");
  }

  if (!email) {
    throw new Error("email is required");
  }

  if (!shift_id) {
    throw new Error("shift_id is required");
  }

  if (!work_date) {
    throw new Error("work_date is required");
  }

  const settings = getWorkspaceSettings(workspace_id);

  options.settings = settings;

  options.timezone = normalize("timezone", options.timezone) || settings.TIMEZONE || "Asia/Manila";

  const logs = getTimeLogsByEmail(workspace_id, email, {
    shift_id: shift_id,
    date: work_date,
  });

  const workDate = getShiftWorkDate(workspace_id, email, shift_id, work_date);

  return buildAttendanceSnapshot(logs, "shift", shift_id, work_date, workspace_id, options);
}

function buildAttendanceSnapshot(logs, scope, shift, work_date, workspace_id, options) {
  const state = buildTimeLogState(logs);

  return {
    ...state,
    scope,
    work_date,
    raw_logs: logs,
  };
}

function buildAttendanceByWorkDate(workspace_id, email, shift_id, work_date, settings) {
  if (!workspace_id) {
    throw new Error("workspace_id is required");
  }

  if (!email) {
    throw new Error("email is required");
  }

  if (!shift_id) {
    throw new Error("shift_id is required");
  }

  if (!work_date) {
    throw new Error("work_date is required");
  }

  settings = settings || getWorkspaceSettings(workspace_id);

  if (!shouldGenerateAttendance(work_date, settings)) {
    return null;
  }

  const shift = getShiftById(workspace_id, shift_id);

  if (!shift) {
    throw new Error("Shift not found.");
  }

  const logs = getTimeLogsByEmail(workspace_id, email, {
    shift_id,
    date: work_date,
  });

  const timelogState = buildTimeLogState(logs);

  const attendance = buildAttendanceState(shift, timelogState, {
    settings,
    timestamp: work_date,
  });

  attendance.debug = {
    // =====================================================
    // INPUT
    // =====================================================
    workspace_id,
    email,
    shift_id,
    work_date,

    // =====================================================
    // SHIFT
    // =====================================================
    shift: {
      shift_id: shift.shift_id,
      shift_name: shift.shift_name,
      start_time: shift.start_time,
      end_time: shift.end_time,
      timezone: shift.timezone,
      grace_minutes: shift.grace_minutes,
    },

    // =====================================================
    // RAW LOGS
    // =====================================================
    raw_logs: logs,

    // =====================================================
    // TIMELOG STATE
    // =====================================================
    timelog_state: timelogState,

    // =====================================================
    // CALCULATED ATTENDANCE
    // =====================================================
    attendance: {
      attendance_status: attendance.attendance_status,
      worked_minutes: attendance.worked_minutes,
      regular_minutes: attendance.regular_minutes,
      overtime_minutes: attendance.overtime_minutes,
      late_minutes: attendance.late_minutes,
      undertime_minutes: attendance.undertime_minutes,
      break_minutes: attendance.break_minutes,
      lunch_minutes: attendance.lunch_minutes,
      time_in: attendance.time_in,
      time_out: attendance.time_out,
    },
  };

  if (attendance.attendance_status === "PENDING") {
    return null;
  }

  attendance.work_date = work_date;
  attendance.raw_logs = logs;
  attendance.scope = "shift";

  return attendance;
}

function shouldGenerateAttendance(workDate, settings) {
  const date = workDate instanceof Date ? new Date(workDate) : new Date(workDate);

  return !isWeeklyDayOff(date, settings);
}

function isWeeklyDayOff(date, settings) {
  const weeklyDaysOff = String(settings.WEEKLY_DAYS_OFF || "")
    .split(",")
    .map(function (day) {
      return day.trim().toUpperCase();
    })
    .filter(Boolean);

  const dayNames = ["SUNDAY", "MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"];

  return weeklyDaysOff.includes(dayNames[date.getDay()]);
}
