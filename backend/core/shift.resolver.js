function resolveShiftPolicy(workspaceId) {

  const shift = getActiveShift(workspaceId);

  if (!shift) {
    throw new Error("No active shift found");
  }

  return {
    shift_id: shift.shift_id,
    start: shift.start_time,
    end: shift.end_time,
    graceMinutes: shift.grace_minutes || 10
  };
}