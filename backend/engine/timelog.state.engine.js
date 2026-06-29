/* =========================
   TIMELOG STATE ENGINE
   MULTI-SESSION VERSION
========================= */

function buildTimeLogState(timeLogs) {

  const logs = Array.isArray(timeLogs)
    ? timeLogs.slice()
    : timeLogs
      ? [timeLogs]
      : [];

  // ensure chronological order
  logs.sort(function (a, b) {
    return new Date(a.timestamp) - new Date(b.timestamp);
  });

  const state = {
    status: "NOT_STARTED",

    // backward compatibility
    time_in: null,
    time_out: null,

    lunch: {
      in: null,
      out: null
    },

    breaks: [],

    // NEW
    sessions: []
  };

  logs.forEach(function (log) {

    if (!log) return;

    const action = String(log.action || "").trim();
    const timestamp = log.timestamp || null;

    switch (action) {

      case "time_in":

        state.sessions.push({
          time_in: timestamp,
          time_out: null
        });

        // preserve legacy fields
        if (!state.time_in) {
          state.time_in = timestamp;
        }

        state.status = "WORKING";
        break;

      case "time_out":

        const openSession = getLastOpenSession(
          state.sessions
        );

        if (openSession) {
          openSession.time_out = timestamp;
        }

        state.time_out = timestamp;
        state.status = "CLOCKED_OUT";
        break;

      case "break_start":

        state.breaks.push({
          in: timestamp,
          out: null
        });

        state.status = "ON_BREAK";
        break;

      case "break_end":

        const activeBreak =
          getLastOpenBreak(state.breaks);

        if (activeBreak) {
          activeBreak.out = timestamp;
        }

        state.status = "WORKING";
        break;

      case "lunch_start":

        state.lunch.in = timestamp;
        state.status = "AT_LUNCH";
        break;

      case "lunch_end":

        state.lunch.out = timestamp;
        state.status = "WORKING";
        break;
    }

  });

  return finalizeTimeLogState(state);
}

/* =========================
   HELPERS
========================= */

function getLastOpenSession(sessions) {

  const list = Array.isArray(sessions)
    ? sessions
    : [];

  for (let i = list.length - 1; i >= 0; i--) {

    if (
      list[i].time_in &&
      !list[i].time_out
    ) {
      return list[i];
    }

  }

  return null;
}

function getLastOpenBreak(breaks) {

  const list = Array.isArray(breaks)
    ? breaks
    : [];

  for (let i = list.length - 1; i >= 0; i--) {

    if (
      list[i].in &&
      !list[i].out
    ) {
      return list[i];
    }

  }

  return null;
}

function finalizeTimeLogState(state) {

  if (
    state.lunch.in &&
    !state.lunch.out
  ) {
    state.status = "AT_LUNCH";
    return state;
  }

  if (getLastOpenBreak(state.breaks)) {
    state.status = "ON_BREAK";
    return state;
  }

  const openSession =
    getLastOpenSession(state.sessions);

  if (openSession) {
    state.status = "WORKING";
    return state;
  }

  if (state.sessions.length) {
    state.status = "CLOCKED_OUT";
    return state;
  }

  state.status = "NOT_STARTED";

  return state;
}