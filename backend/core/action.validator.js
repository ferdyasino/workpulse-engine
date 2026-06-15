function validateTimeAction(workspaceId, email, action) {

  const shift = resolveShiftPolicy(workspaceId);
  const state = getCurrentState(workspaceId, email);

  const now = new Date();

  // =========================
  // RULE 1: TIME OUT requires TIME IN
  // =========================
  if (action === "time_out" && !state.time_in) {
    return {
      ok: false,
      message: "Cannot time out without time in"
    };
  }

  // =========================
  // RULE 2: NO DOUBLE TIME IN
  // =========================
  if (action === "time_in" && state.time_in) {
    return {
      ok: false,
      message: "Already timed in"
    };
  }

  // =========================
  // RULE 3: SHIFT WINDOW CHECK (TIME IN ONLY)
  // =========================
  if (action === "time_in") {

    const [h, m] = shift.start.split(":").map(Number);

    const shiftStart = new Date(now);
    shiftStart.setHours(h, m, 0, 0);

    const graceEnd = new Date(shiftStart);
    graceEnd.setMinutes(graceEnd.getMinutes() + shift.graceMinutes);

    if (now > graceEnd) {
      return {
        ok: false,
        message: "Outside shift grace period"
      };
    }
  }

  return { ok: true };
}