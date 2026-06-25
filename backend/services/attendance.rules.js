function recordTimeLogAction(workspace_id, payload) {
  try {
    if (!workspace_id) {
      return { success: false, message: "workspace_id is required" };
    }

    if (!payload) {
      return { success: false, message: "payload is required" };
    }

    validateTimeLogAction(workspace_id, payload);

    return {
      success: true,
      message: `${payload.action} validated`
    };
  } catch (err) {
    return {
      success: false,
      message: err && err.message ? err.message : "Validation failed"
    };
  }
}

/* =========================
   VALID ACTIONS
========================= */
function getAllowedTimeLogActions() {
  return [
    "time_in",
    "time_out",
    "break_start",
    "break_end",
    "lunch_start",
    "lunch_end"
  ];
}

/* =========================
   VALIDATION ENTRY
========================= */
function validateTimeLogAction(workspace_id, payload) {
  const normalized = normalizeTimeLogActionPayload(payload);

  const email = normalized.email;
  const action = normalized.action;
  const shift_id = normalized.shift_id;

  if (!email) throw new Error("email is required");
  if (!action) throw new Error("action is required");

  const allowed = getAllowedTimeLogActions();

  if (!allowed.includes(action)) {
    throw new Error(`Invalid action: ${action}`);
  }

  /**
   * IMPORTANT:
   * validation state is SHIFT-FIRST.
   * If shift_id exists -> use that shift session.
   * If no shift_id -> fallback to today's logs for that employee.
   */
  const state = getCurrentState(workspace_id, email, shift_id);

  switch (action) {
    case "time_in":
      assertCanTimeIn(state);
      break;

    case "time_out":
      assertCanTimeOut(state);
      break;

    case "lunch_start":
      assertCanStartLunch(state);
      break;

    case "lunch_end":
      assertCanEndLunch(state);
      break;

    case "break_start":
      assertCanStartBreak(state, workspace_id, normalized);
      break;

    case "break_end":
      assertCanEndBreak(state);
      break;

    default:
      throw new Error(`Unsupported action: ${action}`);
  }

  return true;
}

/* =========================
   PAYLOAD NORMALIZER
========================= */
function normalizeTimeLogActionPayload(payload) {
  payload = payload || {};

  return {
    ...payload,
    email: String(payload.email || "").trim().toLowerCase(),
    action: String(payload.action || "").trim(),
    shift_id: String(payload.shift_id || "").trim()
  };
}

/* =========================
   STATE HELPERS
========================= */
function getActiveBreak(state) {
  return (state.breaks || []).find(function (b) {
    return b && b.in && !b.out;
  }) || null;
}

function getCompletedBreakCount(state) {
  return (state.breaks || []).filter(function (b) {
    return b && b.in;
  }).length;
}

function hasActiveLunch(state) {
  return !!(state.lunch && state.lunch.in && !state.lunch.out);
}

/**
 * Placeholder for future workspace setting.
 * For now returns null = unlimited breaks.
 * Later you can wire this to workspace settings / shift settings.
 */
function getWorkspaceBreakLimit(workspace_id, payload) {
  return null;
}

/* =========================
   TIME IN RULE
========================= */
function assertCanTimeIn(state) {
  if (state.time_in) {
    throw new Error("You already timed in for this shift.");
  }

  return true;
}

/* =========================
   TIME OUT RULE
========================= */
function assertCanTimeOut(state) {
  if (!state.time_in) {
    throw new Error("You must time in first before timing out.");
  }

  if (state.time_out) {
    throw new Error("You already timed out for this shift.");
  }

  const activeBreak = getActiveBreak(state);
  if (activeBreak) {
    throw new Error("You are currently on break. End break before timing out.");
  }

  if (hasActiveLunch(state)) {
    throw new Error("You are currently on lunch. End lunch before timing out.");
  }

  return true;
}

/* =========================
   LUNCH RULES
========================= */
function assertCanStartLunch(state) {
  if (!state.time_in) {
    throw new Error("You must time in first.");
  }

  if (state.time_out) {
    throw new Error("Cannot start lunch after time out.");
  }

  if (hasActiveLunch(state)) {
    throw new Error("Lunch already in progress.");
  }

  const activeBreak = getActiveBreak(state);
  if (activeBreak) {
    throw new Error("End break before starting lunch.");
  }

  return true;
}

function assertCanEndLunch(state) {
  if (!state.lunch || !state.lunch.in) {
    throw new Error("Cannot end lunch because it was not started.");
  }

  if (state.lunch.out) {
    throw new Error("Lunch already completed for this shift.");
  }

  return true;
}

/* =========================
   BREAK RULES
========================= */
function assertCanStartBreak(state, workspace_id, payload) {
  if (!state.time_in) {
    throw new Error("You must time in first.");
  }

  if (state.time_out) {
    throw new Error("Cannot start a break after time out.");
  }

  if (hasActiveLunch(state)) {
    throw new Error("You are currently on lunch. End lunch before starting a break.");
  }

  const activeBreak = getActiveBreak(state);
  if (activeBreak) {
    throw new Error("A break is already in progress.");
  }

  const maxBreaks = getWorkspaceBreakLimit(workspace_id, payload);

  if (
    maxBreaks !== null &&
    maxBreaks !== undefined &&
    Number(maxBreaks) >= 0 &&
    getCompletedBreakCount(state) >= Number(maxBreaks)
  ) {
    throw new Error(`Maximum of ${maxBreaks} breaks reached for this shift.`);
  }

  return true;
}

function assertCanEndBreak(state) {
  const activeBreak = getActiveBreak(state);

  if (!activeBreak) {
    throw new Error("No active break to end.");
  }

  return true;
}