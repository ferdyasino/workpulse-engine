/* =========================
   STATE ENGINE (FIXED BREAK LOGIC)
========================= */
function buildTimeLogState(timeLogs) {

  const state = {
    status: "NOT_STARTED",
    time_in: null,
    time_out: null,
    lunch: {},
    breaks: []
  };

  for (const log of timeLogs) {

    switch (log.action) {

      case "time_in":
        state.time_in = log.timestamp;
        state.status = "WORKING";
        break;

      case "time_out":
        state.time_out = log.timestamp;
        state.status = "CLOCKED_OUT";
        break;

      case "break_1_start":
      case "break_2_start":
      case "break_3_start":
        state.breaks.push({ in: log.timestamp, out: null });
        state.status = "ON BREAK";
        break;

      case "break_1_end":
      case "break_2_end":
      case "break_3_end":
        const lastBreak = state.breaks.findLast(b => !b.out);
        if (lastBreak) lastBreak.out = log.timestamp;
        state.status = "WORKING";
        break;

      case "lunch_start":
        state.lunch.in = log.timestamp;
        state.status = "AT LUNCH";
        break;

      case "lunch_end":
        state.lunch.out = log.timestamp;
        state.status = "WORKING";
        break;
    }
  }

  return state;
}

function getCurrentState(workspaceId, email) {

  const logs = getTodayTimeLogsByEmail(workspaceId, email);

  const state = buildTimeLogState(logs);

  return {
    ...state,
    raw_logs: logs
  };
}