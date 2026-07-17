/* =========================
   RECORD ACTION
========================= */

function recordTimeLogAction(workspace_id, payload) {
  try {
    const normalizedWorkspaceId = normalize("workspace_id", workspace_id);

    if (!normalizedWorkspaceId) {
      return {
        success: false,
        message: "workspace_id is required",
      };
    }

    if (!payload) {
      return {
        success: false,
        message: "payload is required",
      };
    }

    const normalized = normalizeTimeLog(payload, normalizedWorkspaceId);

    validateTimeLogAction(normalizedWorkspaceId, normalized);

    return {
      success: true,
      message: normalized.action + " validated",
    };
  } catch (err) {
    return {
      success: false,
      message: sanitizeRuleError(err),
    };
  }
}

/* =========================
   VALID ACTIONS
========================= */

function getAllowedTimeLogActions() {
  return ["time_in", "time_out", "break_start", "break_end", "lunch_start", "lunch_end"];
}

/* =========================
   VALIDATION
========================= */

function validateTimeLogAction(workspace_id, payload) {
  const normalizedWorkspaceId = normalize("workspace_id", workspace_id);

  const normalized = normalizeTimeLog(payload, normalizedWorkspaceId);

  if (!normalizedWorkspaceId) {
    throw new Error("workspace_id is required");
  }

  if (!normalized.email) {
    throw new Error("email is required");
  }

  if (!normalized.action) {
    throw new Error("action is required");
  }

  if (!getAllowedTimeLogActions().includes(normalized.action)) {
    throw new Error("Invalid action: " + normalized.action);
  }

  const state = getCurrentState(
    normalizedWorkspaceId,
    normalized.email,
    normalized.shift_id,
    normalized.date,
  );

  switch (normalized.action) {
    case "time_in":
      assertCanTimeIn(state);
      break;

    case "time_out":
      assertCanTimeOut(state);
      break;

    case "break_start":
      assertCanStartBreak(state);
      break;

    case "break_end":
      assertCanEndBreak(state);
      break;

    case "lunch_start":
      assertCanStartLunch(state);
      break;

    case "lunch_end":
      assertCanEndLunch(state);
      break;

    default:
      throw new Error("Unsupported action.");
  }

  return true;
}

/* =========================
   ERROR
========================= */

function sanitizeRuleError(err) {
  if (!err) {
    return "Validation failed";
  }

  const message = typeof err === "string" ? err : err.message || "Validation failed";

  return String(message)
    .replace(/^Error:\s*/i, "")
    .trim();
}

/* =========================
   TIME IN
========================= */

function assertCanTimeIn(state) {
  switch (state.status) {
    case "NOT_STARTED":
    case "CLOCKED_OUT":
      return true;

    case "WORKING":
      throw new Error("You are already timed in.");

    case "ON_BREAK":
      throw new Error("End your break before timing in again.");

    case "AT_LUNCH":
      throw new Error("End your lunch before timing in again.");

    default:
      throw new Error("Invalid attendance state.");
  }
}

/* =========================
   TIME OUT
========================= */

function assertCanTimeOut(state) {
  switch (state.status) {
    case "WORKING":
      return true;

    case "ON_BREAK":
      throw new Error("End your break before timing out.");

    case "AT_LUNCH":
      throw new Error("End your lunch before timing out.");

    case "CLOCKED_OUT":
      throw new Error("You are already timed out.");

    default:
      throw new Error("You must time in first.");
  }
}

/* =========================
   BREAK START
========================= */

function assertCanStartBreak(state) {
  switch (state.status) {
    case "WORKING":
      if (state.active_break) {
        throw new Error("A break is already in progress.");
      }

      return true;

    case "ON_BREAK":
      throw new Error("A break is already in progress.");

    case "AT_LUNCH":
      throw new Error("End your lunch before starting a break.");

    case "CLOCKED_OUT":
    case "NOT_STARTED":
      throw new Error("You must time in first.");
  }
}

/* =========================
   BREAK END
========================= */

function assertCanEndBreak(state) {
  if (!state.active_break) {
    throw new Error("No active break to end.");
  }

  return true;
}

/* =========================
   LUNCH START
========================= */

function assertCanStartLunch(state) {
  switch (state.status) {
    case "WORKING":
      if (state.completed_lunch) {
        throw new Error("Lunch has already been completed.");
      }

      return true;

    case "AT_LUNCH":
      throw new Error("Lunch is already in progress.");

    case "ON_BREAK":
      throw new Error("End your break before starting lunch.");

    case "CLOCKED_OUT":
    case "NOT_STARTED":
      throw new Error("You must time in first.");
  }
}

/* =========================
   LUNCH END
========================= */

function assertCanEndLunch(state) {
  if (!state.active_lunch) {
    throw new Error("No active lunch to end.");
  }

  return true;
}
