function getCurrentState(workspace_id, email, shift_id) {
  const normalizedEmail = String(email || "").trim().toLowerCase();
  const normalizedShiftId = String(shift_id || "").trim();

  if (!workspace_id) {
    throw new Error("workspace_id is required");
  }

  if (!normalizedEmail) {
    throw new Error("email is required");
  }

  const logs = normalizedShiftId
    ? getShiftTimeLogsByEmail(
        workspace_id,
        normalizedEmail,
        normalizedShiftId
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

function getShiftTimeLogsByEmail(workspace_id, email, shift_id) {
  return getTimeLogsByEmail(workspace_id, email, {
    shift_id: shift_id,
    date: formatDateKey(new Date())
  });
}

function getLatestTodayTimeLogByEmail(workspace_id, email) {
  const logs = getTodayTimeLogsByEmail(workspace_id, email);
  return logs.length ? logs[logs.length - 1] : null;
}

function getLatestShiftTimeLogByEmail(workspace_id, email, shift_id) {
  const logs = getShiftTimeLogsByEmail(workspace_id, email, shift_id);
  return logs.length ? logs[logs.length - 1] : null;
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

