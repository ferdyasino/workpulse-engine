function getCurrentState(workspace_id, email, shift_id, timestamp) {
  const normalizedWorkspaceId = normalize("workspace_id", workspace_id);

  const normalizedEmail = normalize("email", email);

  const normalizedShiftId = normalize("shift_id", shift_id);

  if (!normalizedWorkspaceId) {
    throw new Error("workspace_id is required");
  }

  if (!normalizedEmail) {
    throw new Error("email is required");
  }

  const targetTime = timestamp || new Date();

  const logs = normalizedShiftId
    ? getShiftTimeLogsByEmail(normalizedWorkspaceId, normalizedEmail, normalizedShiftId, targetTime)
    : getTodayTimeLogsByEmail(normalizedWorkspaceId, normalizedEmail, targetTime);

  const workDate = normalizedShiftId
    ? getShiftWorkDate(normalizedWorkspaceId, normalizedEmail, normalizedShiftId, targetTime)
    : formatDateKey(targetTime);

  return buildAttendanceState(
    logs,
    normalizedShiftId ? "shift" : "day",
    normalizedShiftId,
    workDate,
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
    ? resolveShiftWorkDate(shift, timestamp)
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
  const normalizedWorkspaceId = normalize("workspace_id", workspace_id);
  const normalizedEmail = normalize("email", email);

  if (!normalizedWorkspaceId) {
    throw new Error("workspace_id is required");
  }

  if (!normalizedEmail) {
    throw new Error("email is required");
  }

  const filters = {
    email: normalizedEmail,
  };

  options = options || {};

  if (options.shift_id) {
    filters.shift_id = normalize("shift_id", options.shift_id);
  }

  if (options.date) {
    filters.date = normalize("date", options.date);
  }

  return findTimeLogs(normalizedWorkspaceId, filters);
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

function resolveShiftWorkDate(shift, timestamp) {
  return resolveShiftWindow(shift, timestamp).work_date;
}

function getAttendanceStateByWorkDate(workspace_id, email, shift_id, work_date) {
  const normalizedWorkspaceId = normalize("workspace_id", workspace_id);

  const normalizedEmail = normalize("email", email);

  const normalizedShiftId = normalize("shift_id", shift_id);

  const normalizedWorkDate = normalize("date", work_date);

  if (!normalizedWorkspaceId) {
    throw new Error("workspace_id is required");
  }

  if (!normalizedEmail) {
    throw new Error("email is required");
  }

  if (!normalizedShiftId) {
    throw new Error("shift_id is required");
  }

  if (!normalizedWorkDate) {
    throw new Error("work_date is required");
  }

  const logs = getTimeLogsByEmail(normalizedWorkspaceId, normalizedEmail, {
    shift_id: normalizedShiftId,
    date: normalizedWorkDate,
  });

  return buildAttendanceState(logs, "shift", normalizedShiftId, normalizedWorkDate);
}

/* =========================
   STATE RESPONSE
========================= */

function buildAttendanceState(logs, scope, shift_id, work_date) {
  const state = buildTimeLogState(logs);

  return {
    ...state,
    scope,
    shift_id: shift_id || "",
    work_date,
    raw_logs: logs,
  };
}
