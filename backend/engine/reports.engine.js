function buildEmployeeReport(workspace_id, email) {

  const logs = getTimeLogsByEmail(workspace_id, email);

  if (!logs || !logs.length) {
    return [];
  }

  // 1. group into sessions (required)
  const sessions = {};

  logs.forEach(log => {

    const key =
      normalize("date", log.date) +
      "_" +
      normalize("shift_id", log.shift_id);

    if (!sessions[key]) {
      sessions[key] = [];
    }

    sessions[key].push(log);
  });

  // 2. build state per session
  return Object.values(sessions).map(sessionLogs => {

    const state = buildTimeLogState(sessionLogs);

    const hours = computeSessionHours(sessionLogs);

    const first = sessionLogs[0];

    return {
      user_id: first.user_id,
      email: first.email,
      date: first.date,
      shift_id: first.shift_id,

      status: state.status,

      time_in: state.time_in,
      time_out: state.time_out,

      worked_minutes: hours.worked_minutes,
      worked_hours: hours.worked_hours,
      break_minutes: hours.break_minutes
    };
  });
}