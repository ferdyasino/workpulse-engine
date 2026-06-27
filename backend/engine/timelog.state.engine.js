/* =========================
   TIMELOG STATE ENGINE
   COMPATIBLE VERSION
========================= */

/**
 * Build state from timelog records.
 *
 * Accepts:
 * - Array of logs
 * - Single log object
 */
function buildTimeLogState(timeLogs) {

  let logs = [];

  if (Array.isArray(timeLogs)) {
    logs = timeLogs.slice();
  } else if (timeLogs && typeof timeLogs === "object") {
    logs = [timeLogs];
  }

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

    if (!log) {
      return;
    }

    const action = String(
      log.action || ""
    ).trim();

    const timestamp = log.timestamp || null;

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

function getLastOpenBreak(breaks) {

  const list = Array.isArray(breaks)
    ? breaks
    : [];

  for (let i = list.length - 1; i >= 0; i--) {

    const item = list[i];

    if (
      item &&
      item.in &&
      !item.out
    ) {
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

  if (
    state.lunch &&
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

  if (state.time_in) {
    state.status = "WORKING";
    return state;
  }

  state.status = "NOT_STARTED";

  return state;

}