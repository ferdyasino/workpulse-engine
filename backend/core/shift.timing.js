
function resolveShiftWindow(shift, timestamp) {
  if (!shift) {
    throw new Error("Shift is required.");
  }

  const reference =
    timestamp instanceof Date ? new Date(timestamp) : new Date(timestamp || new Date());

  const shiftStart = new Date(reference);

  const shiftEnd = new Date(reference);

  const startParts = String(shift.start_time || "00:00")
    .split(":")
    .map(Number);

  const endParts = String(shift.end_time || "00:00")
    .split(":")
    .map(Number);

  shiftStart.setHours(startParts[0], startParts[1], 0, 0);

  shiftEnd.setHours(endParts[0], endParts[1], 0, 0);

  if (isOvernightShift(shift)) {
    if (shiftEnd <= shiftStart) {
      shiftEnd.setDate(shiftEnd.getDate() + 1);
    }

    if (reference < shiftEnd) {
      const yesterdayStart = new Date(shiftStart);

      yesterdayStart.setDate(yesterdayStart.getDate() - 1);

      const yesterdayEnd = new Date(shiftEnd);

      yesterdayEnd.setDate(yesterdayEnd.getDate() - 1);

      if (reference >= yesterdayStart && reference <= yesterdayEnd) {
        shiftStart.setDate(shiftStart.getDate() - 1);

        shiftEnd.setDate(shiftEnd.getDate() - 1);
      }
    }
  }

  return {
    shift_start: shiftStart,

    shift_end: shiftEnd,

    work_date: formatDateKey(shiftStart),

    scheduled_minutes: Math.round((shiftEnd.getTime() - shiftStart.getTime()) / 60000),
  };
}

function buildShiftTimingState(shift, timestamp) {
  if (!shift) {
    return null;
  }

  const now = timestamp instanceof Date ? new Date(timestamp) : new Date(timestamp || new Date());

  const window = resolveShiftWindow(shift, now);

  const beforeShift = now < window.shift_start;

  const afterShift = now > window.shift_end;

  const duringShift = !beforeShift && !afterShift;

  return {
    before_shift: beforeShift,

    during_shift: duringShift,

    after_shift: afterShift,

    early_minutes: beforeShift
      ? Math.round((window.shift_start.getTime() - now.getTime()) / 60000)
      : 0,

    overtime_minutes: afterShift
      ? Math.round((now.getTime() - window.shift_end.getTime()) / 60000)
      : 0,

    shift_start: window.shift_start,

    shift_end: window.shift_end,

    scheduled_minutes: window.scheduled_minutes,
  };
}

function resolveShiftWorkDate(shift, timestamp) {
  return resolveShiftWindow(shift, timestamp).work_date;
}

function resolveShiftWindowByWorkDate(shift, workDate) {
  if (!shift) {
    throw new Error("Shift is required.");
  }

  const normalizedWorkDate = formatDateKey(workDate);

  const shiftStart = new Date(normalizedWorkDate);
  const shiftEnd = new Date(normalizedWorkDate);

  const [startHour, startMinute] = String(shift.start_time || "00:00")
    .split(":")
    .map(Number);

  const [endHour, endMinute] = String(shift.end_time || "00:00")
    .split(":")
    .map(Number);

  shiftStart.setHours(startHour, startMinute, 0, 0);
  shiftEnd.setHours(endHour, endMinute, 0, 0);

  if (isOvernightShift(shift) && shiftEnd <= shiftStart) {
    shiftEnd.setDate(shiftEnd.getDate() + 1);
  }

  return {
    shift_start: shiftStart,
    shift_end: shiftEnd,
    work_date: normalizedWorkDate,
    scheduled_minutes: Math.round(
      (shiftEnd.getTime() - shiftStart.getTime()) / 60000
    ),
  };
}
