function resolveShiftWindow(workspace_id, shift, timestamp) {
  if (!shift) {
    throw new Error("Shift is required.");
  }

  const settings = getWorkspaceSettings(workspace_id);
  const timezone = settings.TIMEZONE || Session.getScriptTimeZone();

  const reference =
    timestamp instanceof Date ? new Date(timestamp) : new Date(timestamp || new Date());

  const localDate = Utilities.formatDate(reference, timezone, "yyyy-MM-dd");

  const [year, month, day] = localDate.split("-").map(Number);

  const startParts = String(shift.start_time || "00:00")
    .split(":")
    .map(Number);

  const endParts = String(shift.end_time || "00:00")
    .split(":")
    .map(Number);

  const shiftStart = new Date(year, month - 1, day);
  shiftStart.setHours(startParts[0], startParts[1], 0, 0);

  const shiftEnd = new Date(year, month - 1, day);
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
    work_date: Utilities.formatDate(shiftStart, timezone, "yyyy-MM-dd"),
    scheduled_minutes: Math.round((shiftEnd.getTime() - shiftStart.getTime()) / 60000),
  };
}

function resolveAttendanceSchedule(shift, work_date, settings) {
  settings = settings || {};

  const context = buildShiftDateContext(work_date, shift, settings);

  const attendanceStart = new Date(context.shift_start_utc);

  attendanceStart.setMinutes(
    attendanceStart.getMinutes() - Number(settings.ALLOW_EARLY_TIME_IN_MINUTES || 0),
  );

  const attendanceEnd = new Date(context.shift_end_utc);

  attendanceEnd.setMinutes(
    attendanceEnd.getMinutes() + Number(settings.ALLOW_LATE_TIME_OUT_MINUTES || 0),
  );

  return {
    work_date,

    timezone: context.display_timezone,

    shift_timezone: context.shift_timezone,

    shift_start: context.shift_start_utc,

    shift_end: context.shift_end_utc,

    attendance_start: attendanceStart,

    attendance_end: attendanceEnd,

    scheduled_minutes: context.scheduled_minutes,

    overnight: context.overnight,
  };
}
