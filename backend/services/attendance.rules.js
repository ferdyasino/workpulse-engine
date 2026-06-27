function recordTimeLogAction(workspace_id, payload) {
  try {
    const normalizedWorkspaceId = normalize("workspace_id", workspace_id);

    if (!normalizedWorkspaceId) {
      return { success: false, message: "workspace_id is required" };
    }

    if (!payload) {
      return { success: false, message: "payload is required" };
    }

    const normalized = normalizeTimeLogActionPayload(payload);

    validateTimeLogAction(normalizedWorkspaceId, normalized);

    return {
      success: true,
      message: `${normalized.action} validated`
    };
  } catch (err) {
    return {
      success: false,
      message: sanitizeRuleError(err)
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
  const normalizedWorkspaceId = normalize("workspace_id", workspace_id);
  const normalized = normalizeTimeLogActionPayload(payload);

  const email = normalized.email;
  const action = normalized.action;
  const shift_id = normalized.shift_id;

  if (!normalizedWorkspaceId) {
    throw new Error("workspace_id is required");
  }

  if (!email) {
    throw new Error("email is required");
  }

  if (!action) {
    throw new Error("action is required");
  }

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
  const state = getCurrentState(normalizedWorkspaceId, email, shift_id);

  /**
   * Policy hook:
   * today this can return defaults
   * later this can load from shift/workspace settings
   */
  const policy = getEffectiveAttendancePolicy(normalizedWorkspaceId, normalized, state);

  switch (action) {
    case "time_in":
      assertCanTimeIn(state, policy, normalized);
      break;

    case "time_out":
      assertCanTimeOut(state, policy, normalized);
      break;

    case "lunch_start":
      assertCanStartLunch(state, policy, normalized);
      break;

    case "lunch_end":
      assertCanEndLunch(state, policy, normalized);
      break;

    case "break_start":
      assertCanStartBreak(state, policy, normalized);
      break;

    case "break_end":
      assertCanEndBreak(state, policy, normalized);
      break;

    default:
      throw new Error(`Unsupported action: ${action}`);
  }

  return true;
}

/* =========================
   ERROR SANITIZER
========================= */
function sanitizeRuleError(err) {
  if (!err) return "Validation failed";

  const message =
    typeof err === "string"
      ? err
      : err && err.message
        ? String(err.message)
        : "Validation failed";

  return message.replace(/^Error:\s*/i, "").trim() || "Validation failed";
}

/* =========================
   STATE HELPERS
========================= */
function getActiveBreak(state) {
  if (!state) return null;

  if (state.active_break) {
    return state.active_break;
  }

  return (state.breaks || []).find(function (b) {
    return b && b.in && !b.out;
  }) || null;
}

function getCompletedBreakCount(state) {
  if (!state) return 0;

  if (typeof state.break_count === "number") {
    return state.break_count;
  }

  return (state.breaks || []).filter(function (b) {
    return b && b.in;
  }).length;
}

function hasActiveLunch(state) {
  if (!state) return false;

  if (typeof state.active_lunch === "boolean") {
    return state.active_lunch;
  }

  return !!(state.lunch && state.lunch.in && !state.lunch.out);
}

function hasCompletedLunch(state) {
  return !!(
    state &&
    state.lunch &&
    state.lunch.in &&
    state.lunch.out
  );
}

/* =========================
   POLICY RESOLUTION
========================= */

/**
 * Resolve the effective attendance policy for this action.
 *
 * CURRENT BEHAVIOR
 * - returns safe defaults
 * - optionally reads break limit from shift/workspace hook
 *
 * FUTURE
 * - replace with actual shift/workspace policy resolver
 */
function getEffectiveAttendancePolicy(workspace_id, payload, state) {
  const maxBreaks = getWorkspaceBreakLimit(workspace_id, payload, state);

  return {
    allow_time_in: true,
    allow_time_out: true,
    allow_break: true,
    allow_lunch: true,

    require_time_in_for_break: true,
    require_time_in_for_lunch: true,

    allow_time_out_during_break: false,
    allow_time_out_during_lunch: false,
    allow_break_during_lunch: false,
    allow_lunch_during_break: false,

    /**
     * null = unlimited
     * number = enforced limit
     */
    max_breaks:
      maxBreaks === null || maxBreaks === undefined
        ? null
        : Number(maxBreaks)
  };
}

/**
 * Placeholder for future workspace / shift setting.
 * For now returns null = unlimited breaks.
 *
 * Later this can resolve from:
 * - shift settings
 * - workspace settings
 * - policy sheet
 */
function getWorkspaceBreakLimit(workspace_id, payload, state) {
  return null;
}

/* =========================
   TIME IN RULE
========================= */
function assertCanTimeIn(state, policy, payload) {
  if (!policy.allow_time_in) {
    throw new Error("Time in is disabled for this shift.");
  }

  if (state.time_in) {
    throw new Error("You already timed in for this shift.");
  }

  return true;
}

/* =========================
   TIME OUT RULE
========================= */
function assertCanTimeOut(state, policy, payload) {
  if (!policy.allow_time_out) {
    throw new Error("Time out is disabled for this shift.");
  }

  if (!state.time_in) {
    throw new Error("You must time in first before timing out.");
  }

  if (state.time_out) {
    throw new Error("You already timed out for this shift.");
  }

  const activeBreak = getActiveBreak(state);
  if (activeBreak && !policy.allow_time_out_during_break) {
    throw new Error("You are currently on break. End break before timing out.");
  }

  if (hasActiveLunch(state) && !policy.allow_time_out_during_lunch) {
    throw new Error("You are currently on lunch. End lunch before timing out.");
  }

  return true;
}

/* =========================
   LUNCH RULES
========================= */
function assertCanStartLunch(state, policy, payload) {
  if (!policy.allow_lunch) {
    throw new Error("Lunch is disabled for this shift.");
  }

  if (policy.require_time_in_for_lunch && !state.time_in) {
    throw new Error("You must time in first.");
  }

  if (state.time_out) {
    throw new Error("Cannot start lunch after time out.");
  }

  if (hasActiveLunch(state)) {
    throw new Error("Lunch already in progress.");
  }

  if (hasCompletedLunch(state)) {
    throw new Error("Lunch already completed for this shift.");
  }

  const activeBreak = getActiveBreak(state);
  if (activeBreak && !policy.allow_lunch_during_break) {
    throw new Error("End break before starting lunch.");
  }

  return true;
}

function assertCanEndLunch(state, policy, payload) {
  if (!policy.allow_lunch) {
    throw new Error("Lunch is disabled for this shift.");
  }

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
function assertCanStartBreak(state, policy, payload) {
  if (!policy.allow_break) {
    throw new Error("Break is disabled for this shift.");
  }

  if (policy.require_time_in_for_break && !state.time_in) {
    throw new Error("You must time in first.");
  }

  if (state.time_out) {
    throw new Error("Cannot start a break after time out.");
  }

  if (hasActiveLunch(state) && !policy.allow_break_during_lunch) {
    throw new Error("You are currently on lunch. End lunch before starting a break.");
  }

  const activeBreak = getActiveBreak(state);
  if (activeBreak) {
    throw new Error("A break is already in progress.");
  }

  const maxBreaks = policy.max_breaks;

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

function assertCanEndBreak(state, policy, payload) {
  if (!policy.allow_break) {
    throw new Error("Break is disabled for this shift.");
  }

  const activeBreak = getActiveBreak(state);

  if (!activeBreak) {
    throw new Error("No active break to end.");
  }

  return true;
}