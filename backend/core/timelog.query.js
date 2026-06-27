function getCurrentState(
  workspace_id,
  email,
  shift_id,
  timestamp
) {
  const normalizedEmail = String(email || "")
    .trim()
    .toLowerCase();

  const normalizedShiftId = String(shift_id || "")
    .trim();

  if (!workspace_id) {
    throw new Error("workspace_id is required");
  }

  if (!normalizedEmail) {
    throw new Error("email is required");
  }

  const targetTime = timestamp || new Date();

  const logs = normalizedShiftId
    ? getShiftTimeLogsByEmail(
        workspace_id,
        normalizedEmail,
        normalizedShiftId,
        targetTime
      )
    : getTodayTimeLogsByEmail(
        workspace_id,
        normalizedEmail
      );

  const state = buildTimeLogState(logs);

  return {
    ...state,
    scope: normalizedShiftId ? "shift" : "day",
    shift_id: normalizedShiftId,
    work_date: normalizedShiftId
      ? getShiftWorkDate(
          workspace_id,
          normalizedShiftId,
          targetTime
        )
      : formatDateKey(targetTime),
    raw_logs: logs
  };
}


/* =========================
   DAY QUERIES
========================= */
function getTodayTimeLogsByEmail(workspace_id, email) {
  const normalizedWorkspaceId = normalize("workspace_id", workspace_id);
  const normalizedEmail = normalize("email", email);

  if (!normalizedWorkspaceId) throw new Error("workspace_id is required");
  if (!normalizedEmail) throw new Error("email is required");

  return getTimeLogsByDate(
    normalizedWorkspaceId,
    normalizedEmail,
    formatDateKey(new Date())
  );
}

function getLatestTodayTimeLogByEmail(workspace_id, email) {
  const logs = getTodayTimeLogsByEmail(workspace_id, email);
  return logs.length ? logs[logs.length - 1] : null;
}

function getTimeLogsByDate(workspace_id, email, dateKey) {
  const normalizedWorkspaceId = normalize("workspace_id", workspace_id);
  const normalizedEmail = normalize("email", email);
  const normalizedDate = normalize("date", dateKey);

  if (!normalizedWorkspaceId) throw new Error("workspace_id is required");
  if (!normalizedEmail) throw new Error("email is required");
  if (!normalizedDate) throw new Error("date is required");

  return findTimeLogs(normalizedWorkspaceId, {
    email: normalizedEmail,
    date: normalizedDate
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
    email: normalizedEmail
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

function getShiftTimeLogsByEmail(
  workspace_id,
  email,
  shift_id,
  timestamp
) {
  return getTimeLogsByEmail(workspace_id, email, {
    shift_id,
    date: getShiftWorkDate(
      workspace_id,
      shift_id,
      timestamp
    )
  });
}

function getLatestShiftTimeLogByEmail(
  workspace_id,
  email,
  shift_id,
  timestamp
) {
  const logs = getShiftTimeLogsByEmail(
    workspace_id,
    email,
    shift_id,
    timestamp
  );

  return logs.length
    ? logs[logs.length - 1]
    : null;
}

function matchesTimeLogFilters(record, filters) {
  return Object.entries(filters).every(function (entry) {
    const key = entry[0];
    const filterValue = entry[1];

    if (
      filterValue === undefined ||
      filterValue === null ||
      filterValue === ""
    ) {
      return true;
    }

    return String(record[key]) === String(filterValue);
  });
}

/* =========================
   SHIFT SESSION DATE
========================= */

function resolveShiftWorkDate(shift, timestamp) {

  if (!shift) {
    throw new Error("Shift is required.");
  }

  const date =
    timestamp instanceof Date
      ? new Date(timestamp)
      : new Date(timestamp || new Date());

  if (!isOvernightShift(shift)) {
    return formatDateKey(date);
  }

  const nowMinutes =
    date.getHours() * 60 +
    date.getMinutes();

  const endMinutes =
    timeToMinutes(shift.end_time);

  if (nowMinutes < endMinutes) {
    date.setDate(date.getDate() - 1);
  }

  return formatDateKey(date);
}

