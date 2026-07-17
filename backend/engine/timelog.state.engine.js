/* =========================
   TIMELOG STATE ENGINE
   MULTI-SESSION VERSION
========================= */

function buildTimeLogState(timeLogs) {
  const logs = Array.isArray(timeLogs) ? timeLogs.slice() : timeLogs ? [timeLogs] : [];

  logs.sort(function (a, b) {
    return new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();
  });

  const state = {
    status: "NOT_STARTED",

    /**
     * Legacy fields.
     * These represent the first time in
     * and the most recent time out.
     */
    time_in: null,
    time_out: null,

    lunch: {
      in: null,
      out: null,
    },

    breaks: [],

    /**
     * Multi-session support.
     */
    sessions: [],

    /**
     * Derived state.
     */
    active_session: null,
    active_break: null,
    active_lunch: false,
    completed_lunch: false,
    is_clocked_in: false,
  };

  logs.forEach(function (log) {
    if (!log) return;

    const action = String(log.action || "")
      .trim()
      .toLowerCase();

    const timestamp = log.timestamp || null;

    switch (action) {
      case "time_in":
        state.sessions.push({
          time_in: timestamp,
          time_out: null,
        });

        if (!state.time_in) {
          state.time_in = timestamp;
        }

        break;

      case "time_out": {
        const session = getLastOpenSession(state.sessions);

        if (session) {
          session.time_out = timestamp;
        }

        state.time_out = timestamp;
        break;
      }

      case "break_start":
        state.breaks.push({
          in: timestamp,
          out: null,
        });

        break;

      case "break_end": {
        const activeBreak = getLastOpenBreak(state.breaks);

        if (activeBreak) {
          activeBreak.out = timestamp;
        }

        break;
      }

      case "lunch_start":
        state.lunch.in = timestamp;
        state.lunch.out = null;
        break;

      case "lunch_end":
        if (state.lunch.in) {
          state.lunch.out = timestamp;
        }

        break;
    }
  });

  return finalizeTimeLogState(state);
}

/* =========================
   SESSION HELPERS
========================= */

function getLastOpenSession(sessions) {
  const list = Array.isArray(sessions) ? sessions : [];

  for (let i = list.length - 1; i >= 0; i--) {
    const session = list[i];

    if (session && session.time_in && !session.time_out) {
      return session;
    }
  }

  return null;
}

/* =========================
   BREAK HELPERS
========================= */

function getLastOpenBreak(breaks) {
  const list = Array.isArray(breaks) ? breaks : [];

  for (let i = list.length - 1; i >= 0; i--) {
    const brk = list[i];

    if (brk && brk.in && !brk.out) {
      return brk;
    }
  }

  return null;
}

/* =========================
   FINALIZE STATE
========================= */

function finalizeTimeLogState(state) {
  state.active_session = getLastOpenSession(state.sessions);

  state.active_break = getLastOpenBreak(state.breaks);

  state.active_lunch = !!(state.lunch && state.lunch.in && !state.lunch.out);

  state.completed_lunch = !!(state.lunch && state.lunch.in && state.lunch.out);

  state.is_clocked_in = !!state.active_session;

  if (state.active_lunch) {
    state.status = "AT_LUNCH";
    return state;
  }

  if (state.active_break) {
    state.status = "ON_BREAK";
    return state;
  }

  if (state.active_session) {
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
