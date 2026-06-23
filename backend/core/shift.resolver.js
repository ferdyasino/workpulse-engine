function resolveShiftPolicy(workspaceId) {

  const shifts = getAllShifts(workspaceId);

  if (!Array.isArray(shifts) || shifts.length === 0) {
    throw new Error("No shifts found");
  }

  // priority rule: ACTIVE shift
  const shift = shifts.find(s => s.status === "ACTIVE");

  if (!shift) {
    throw new Error("No active shift found");
  }

  return {
    shift_id: shift.shift_id,
    start: shift.start_time,
    end: shift.end_time,
    graceMinutes: Number(shift.grace_minutes || 10)
  };
}