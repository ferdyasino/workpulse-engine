/* =========================
   SAFE TIME LOG ACTION ENTRY
========================= */
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
      message: `${payload.action} validated for shift ${payload.shift_id}`
    };

  } catch (err) {
    return {
      success: false,
      message: err.message || "Validation failed"
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
    "break_1_start",
    "break_1_end",
    "break_2_start",
    "break_2_end",
    "break_3_start",
    "break_3_end",
    "lunch_start",
    "lunch_end"
  ];
}


/* =========================
   ACTION VALIDATOR
========================= */
function validateTimeLogAction(workspace_id, payload) {

  const email = String(payload.email || "").trim().toLowerCase();
  const action = String(payload.action || "").trim();

  if (!email) throw new Error("email is required");
  if (!action) throw new Error("action is required");

  const allowed = getAllowedTimeLogActions();

  if (!allowed.includes(action)) {
    throw new Error(`Invalid action: ${action}`);
  }

  // SHIFT-BASED STATE (not session-based)
  const state = getCurrentState(workspace_id, email, payload.shift_id);

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

    case "break_1_start":
    case "break_2_start":
    case "break_3_start":
      assertCanStartBreak(state, action);
      break;

    case "break_1_end":
    case "break_2_end":
    case "break_3_end":
      assertCanEndBreak(state, action);
      break;

    default:
      throw new Error(`Unsupported action: ${action}`);
  }

  return true;
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

  if (state.lunch?.in && !state.lunch?.out) {
    throw new Error("Lunch already in progress.");
  }

  // ❗ NEW RULE: cannot start lunch if a break is active
  const activeBreak = (state.breaks || []).find(b => b && !b.out);

  if (activeBreak) {
    const idx = (state.breaks || []).indexOf(activeBreak) + 1;
    throw new Error(`End Break ${idx} before starting lunch.`);
  }

  return true;
}


function assertCanEndLunch(state) {

  if (!state.lunch?.in) {
    throw new Error("Cannot end lunch because it was not started.");
  }

  if (state.lunch?.out) {
    throw new Error("Lunch already completed for this shift.");
  }

  return true;
}


/* =========================
   BREAK HELPERS
========================= */
function extractBreakNumber(action) {
  const match = String(action).match(/^break_(\d+)_(start|end)$/);
  return match ? Number(match[1]) : null;
}

function getBreakStateMap(state) {
  const breaks = Array.isArray(state.breaks) ? state.breaks : [];

  return {
    1: breaks[0] || null,
    2: breaks[1] || null,
    3: breaks[2] || null
  };
}

function getActiveBreak(state) {
  return (state.breaks || []).find(b => b && !b.out) || null;
}


/* =========================
   BREAK RULES (STRICT ORDER + SAFE STATE)
========================= */

function assertCanStartBreak(state, action) {

  if (!state.time_in) {
    throw new Error("You must time in first.");
  }

  if (state.time_out) {
    throw new Error("Cannot start a break after time out.");
  }

  const breakNumber = extractBreakNumber(action);
  const map = getBreakStateMap(state);

  const activeBreak = getActiveBreak(state);

  if (activeBreak) {
    const idx = (state.breaks || []).indexOf(activeBreak) + 1;
    throw new Error(`Finish Break ${idx} before starting a new break.`);
  }

  if (breakNumber === 1) {
    if (map[1]) throw new Error("Break 1 already completed for this shift.");
  }

  if (breakNumber === 2) {
    if (!map[1]?.out) {
      throw new Error("You must complete Break 1 before starting Break 2.");
    }
    if (map[2]) throw new Error("Break 2 already completed for this shift.");
  }

  if (breakNumber === 3) {
    if (!map[2]?.out) {
      throw new Error("You must complete Break 2 before starting Break 3.");
    }
    if (map[3]) throw new Error("Break 3 already completed for this shift.");
  }

  return true;
}


function assertCanEndBreak(state, action) {

  const breakNumber = extractBreakNumber(action);

  const activeBreak = getActiveBreak(state);

  if (!activeBreak) {
    throw new Error("No active break to end.");
  }

  const activeIndex = (state.breaks || []).indexOf(activeBreak) + 1;

  if (activeIndex !== breakNumber) {
    throw new Error(`You must end Break ${activeIndex} first.`);
  }

  return true;
}