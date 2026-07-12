function resolveShiftWindow(shift, timestamp) {
  if (!shift) {
    throw new Error("Shift is required.");
  }

  const timezone =
    shift.timezone ||
    Session.getScriptTimeZone();

  const referenceUtc =
    timestamp instanceof Date
      ? new Date(timestamp)
      : new Date(timestamp || new Date());

  // Current calendar date in the shift timezone
  let workDate = workDateInTimezone(
    referenceUtc,
    timezone
  );

  let shiftStart = zonedDateTimeToUtc(
    workDate,
    shift.start_time,
    timezone
  );

  let shiftEnd = zonedDateTimeToUtc(
    workDate,
    shift.end_time,
    timezone
  );

  if (isOvernightShift(shift) && shiftEnd <= shiftStart) {
    shiftEnd = new Date(
      shiftEnd.getTime() + 86400000
    );
  }

  // Overnight adjustment
  if (isOvernightShift(shift) && referenceUtc < shiftEnd) {
    const yesterday = new Date(
      shiftStart.getTime() - 86400000
    );

    const yesterdayDate = workDateInTimezone(
      yesterday,
      timezone
    );

    const previousStart = zonedDateTimeToUtc(
      yesterdayDate,
      shift.start_time,
      timezone
    );

    let previousEnd = zonedDateTimeToUtc(
      yesterdayDate,
      shift.end_time,
      timezone
    );

    if (previousEnd <= previousStart) {
      previousEnd = new Date(
        previousEnd.getTime() + 86400000
      );
    }

    if (
      referenceUtc >= previousStart &&
      referenceUtc <= previousEnd
    ) {
      shiftStart = previousStart;
      shiftEnd = previousEnd;
      workDate = yesterdayDate;
    }
  }

  return {
    timezone,

    shift_start: shiftStart,
    shift_end: shiftEnd,

    work_date: workDate,

    scheduled_minutes: Math.round(
      (shiftEnd.getTime() - shiftStart.getTime()) / 60000
    ),
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

function resolveAttendanceWindow(shift, value, settings) {
  if (!shift) {
    throw new Error("Shift is required.");
  }

  settings = settings || {};

  const shiftWindow =
    typeof value === "string"
      ? resolveShiftWindowByWorkDate(shift, value)
      : resolveShiftWindow(shift, value);

  const before = Number(
    settings.ALLOW_EARLY_TIME_IN_MINUTES || 0
  );

  const after = Number(
    settings.ALLOW_LATE_TIME_OUT_MINUTES || 0
  );

  const attendanceStart = new Date(shiftWindow.shift_start);
  attendanceStart.setMinutes(
    attendanceStart.getMinutes() - before
  );

  const attendanceEnd = new Date(shiftWindow.shift_end);
  attendanceEnd.setMinutes(
    attendanceEnd.getMinutes() + after
  );

  return {
    shift_start: shiftWindow.shift_start,
    shift_end: shiftWindow.shift_end,

    attendance_start: attendanceStart,
    attendance_end: attendanceEnd,

    work_date: shiftWindow.work_date,
    scheduled_minutes: shiftWindow.scheduled_minutes,
  };
}

function resolveAttendanceSchedule(
  shift,
  work_date,
  settings
) {

  if (!shift) {
    throw new Error("Shift is required.");
  }

  settings = settings || {};

  const timezone = getTimezone(
    shift,
    settings
  );

  const shiftStart = zonedDateTimeToUtc(
    work_date,
    shift.start_time,
    timezone
  );

  let shiftEnd = zonedDateTimeToUtc(
    work_date,
    shift.end_time,
    timezone
  );

  // Overnight shift
  if (
    isOvernightShift(shift) &&
    shiftEnd <= shiftStart
  ) {
    shiftEnd.setUTCDate(
      shiftEnd.getUTCDate() + 1
    );
  }

  const attendanceStart = new Date(
    shiftStart.getTime()
  );

  attendanceStart.setUTCMinutes(
    attendanceStart.getUTCMinutes() -
      Number(
        settings.ALLOW_EARLY_TIME_IN_MINUTES || 0
      )
  );

  const attendanceEnd = new Date(
    shiftEnd.getTime()
  );

  attendanceEnd.setUTCMinutes(
    attendanceEnd.getUTCMinutes() +
      Number(
        settings.ALLOW_LATE_TIME_OUT_MINUTES || 0
      )
  );

  return {

    timezone,

    work_date,

    shift_start: shiftStart,

    shift_end: shiftEnd,

    attendance_start: attendanceStart,

    attendance_end: attendanceEnd,

    scheduled_minutes: Math.round(
      (shiftEnd.getTime() -
        shiftStart.getTime()) /
        60000
    ),

  };
}