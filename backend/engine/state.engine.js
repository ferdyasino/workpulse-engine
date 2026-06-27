/* =========================
   TIMELOG STATE ENGINE
   DYNAMIC BREAK VERSION
========================= */

/**
 * Build state from ordered timelog records
 */
function buildTimeLogState(timeLogs) {
  const logs = Array.isArray(timeLogs) ? timeLogs : [];

  const state = {
    status: "NOT_STARTED",
    time_in: null,
    time_out: null,
    lunch: {
      in: null,
      out: null
    },
    breaks: []
  };

  logs.forEach(function (log) {
    const action = String(log && log.action ? log.action : "").trim();
    const timestamp = log && log.timestamp ? log.timestamp : null;

    switch (action) {
      case "time_in":
        state.time_in = timestamp;
        state.status = "WORKING";
        break;

      case "time_out":
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

      case "break_end": {
        const activeBreak = getLastOpenBreak(state.breaks);
        if (activeBreak) {
          activeBreak.out = timestamp;
        }
        state.status = "WORKING";
        break;
      }

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
   STATE RESOLUTION
========================= */

/**
 * SHIFT-FIRST state resolver
 *
 * If shift_id exists:
 *   - resolve by that shift only
 *
 * If no shift_id:
 *   - fallback to today's logs
 *
 * This lets you support both:
 * - proper shift-based validation
 * - temporary non-shift fallback
 */
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
   INTERNAL HELPERS
========================= */
function getLastOpenBreak(breaks) {
  const list = Array.isArray(breaks) ? breaks : [];

  for (let i = list.length - 1; i >= 0; i--) {
    const item = list[i];
    if (item && item.in && !item.out) {
      return item;
    }
  }

  return null;
}

function finalizeTimeLogState(state) {
  if (state.time_out) {
    state.status = "CLOCKED_OUT";
    return state;
  }

  if (state.lunch && state.lunch.in && !state.lunch.out) {
    state.status = "AT_LUNCH";
    return state;
  }

  const activeBreak = getLastOpenBreak(state.breaks);
  if (activeBreak) {
    state.status = "ON_BREAK";
    return state;
  }

  if (state.time_in) {
    state.status = "WORKING";
    return state;
  }

  state.status = "NOT_STARTED";
  return state;
}