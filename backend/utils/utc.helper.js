/**
 * =====================================================
 * BUILD SHIFT DATETIME CONTEXT
 * =====================================================
 *
 * Creates a complete shift context for a work date.
 *
 * Internally:
 *   ✔ Calculates everything in UTC.
 *
 * Externally:
 *   ✔ Returns local values for reports/UI.
 *
 * Returned Object
 * ----------------
 * {
 *   timezone,
 *   work_date,
 *
 *   shift_start_utc,
 *   shift_end_utc,
 *
 *   shift_start_local,
 *   shift_end_local,
 *
 *   scheduled_minutes,
 *   overnight
 * }
 */
function buildShiftDateContext(work_date, shift, settings) {
  if (!shift) {
    throw new Error("Shift is required.");
  }

  settings = settings || {};

  //--------------------------------------------------
  // UTC WINDOW
  //--------------------------------------------------

  const shiftWindow = buildShiftUTCWindow(work_date, shift, settings);

  //--------------------------------------------------
  // Display timezone
  //--------------------------------------------------

  const timezone = shiftWindow.display_timezone;

  return {
    work_date,

    timezone,

    shift_timezone: shiftWindow.shift_timezone,

    display_timezone: shiftWindow.display_timezone,

    shift_id: shift.shift_id,

    shift_name: shift.shift_name,

    grace_minutes: Number(shift.grace_minutes || 0),

    overnight: shiftWindow.overnight,

    scheduled_minutes: shiftWindow.scheduled_minutes,

    shift_start_utc: shiftWindow.shift_start,

    shift_end_utc: shiftWindow.shift_end,

    shift_start_local: Utilities.formatDate(
      shiftWindow.shift_start,
      timezone,
      "yyyy-MM-dd hh:mm:ss a",
    ),

    shift_end_local: Utilities.formatDate(shiftWindow.shift_end, timezone, "yyyy-MM-dd hh:mm:ss a"),

    shift_range:
      Utilities.formatDate(shiftWindow.shift_start, timezone, "hh:mm a") +
      " - " +
      Utilities.formatDate(shiftWindow.shift_end, timezone, "hh:mm a"),
  };
}
/**
 * =====================================================
 * BUILD DISPLAY ATTENDANCE
 * =====================================================
 *
 * Converts UTC timestamps into
 * employee/shift local time.
 */
function buildDisplayAttendance(attendance, shiftContext) {
  const timezone = shiftContext.timezone;

  function local(value) {
    if (!value) {
      return null;
    }

    return Utilities.formatDate(new Date(value), timezone, "MMM dd, yyyy hh:mm:ss a");
  }

  return {
    //--------------------------------------------------
    // original attendance
    //--------------------------------------------------

    ...attendance,

    //--------------------------------------------------
    // shift information
    //--------------------------------------------------

    shift_name: shiftContext.shift_name,

    shift_range: shiftContext.shift_range,

    scheduled_minutes: shiftContext.scheduled_minutes,

    //--------------------------------------------------
    // display values
    //--------------------------------------------------

    shift_start: shiftContext.shift_start_local,

    shift_end: shiftContext.shift_end_local,

    time_in: local(attendance.time_in),

    time_out: local(attendance.time_out),

    //--------------------------------------------------
    // debug keeps UTC
    //--------------------------------------------------

    debug: {
      shift_start_utc: shiftContext.shift_start_utc,

      shift_end_utc: shiftContext.shift_end_utc,

      shift_start_local: shiftContext.shift_start_local,

      shift_end_local: shiftContext.shift_end_local,

      timezone,

      scheduled_minutes: shiftContext.scheduled_minutes,

      worked_minutes: attendance.worked_minutes,

      late_minutes: attendance.late_minutes,

      undertime_minutes: attendance.undertime_minutes,

      overtime_minutes: attendance.overtime_minutes,
    },
  };
}

/**
 * =====================================================
 * BUILD SHIFT UTC WINDOW
 * =====================================================
 *
 * Converts a shift schedule into absolute UTC timestamps.
 *
 * Example
 * -------
 * Shift:
 *   timezone : America/New_York
 *   start    : 13:00
 *   end      : 20:00
 *   workDate : 2026-07-13
 *
 * Returns
 * -------
 * {
 *   shift_start : Date (UTC)
 *   shift_end   : Date (UTC)
 *   scheduled_minutes
 *   overnight
 * }
 */
function buildShiftUTCWindow(work_date, shift, settings) {
  if (!shift) {
    throw new Error("Shift is required.");
  }

  settings = settings || {};

  //--------------------------------------------------
  // TIMEZONES
  //--------------------------------------------------

  const shiftTimezone = shift.timezone || settings.TIMEZONE || "UTC";

  const displayTimezone = settings.TIMEZONE || shiftTimezone;

  //--------------------------------------------------
  // Parse work date
  //--------------------------------------------------

  const parts = String(work_date).split("-").map(Number);

  if (parts.length !== 3) {
    throw new Error("Invalid work_date.");
  }

  const year = parts[0];
  const month = parts[1];
  const day = parts[2];

  //--------------------------------------------------
  // Parse shift time
  //--------------------------------------------------

  const start = String(shift.start_time).split(":").map(Number);

  const end = String(shift.end_time).split(":").map(Number);

  const startHour = start[0] || 0;
  const startMinute = start[1] || 0;

  const endHour = end[0] || 0;
  const endMinute = end[1] || 0;

  //--------------------------------------------------
  // Local datetime
  //--------------------------------------------------

  const localStart = Utilities.formatString(
    "%04d-%02d-%02d %02d:%02d:00",
    year,
    month,
    day,
    startHour,
    startMinute,
  );

  const localEnd = Utilities.formatString(
    "%04d-%02d-%02d %02d:%02d:00",
    year,
    month,
    day,
    endHour,
    endMinute,
  );

  //--------------------------------------------------
  // Shift timezone -> UTC
  //--------------------------------------------------

  let shiftStart = localTimeToUTC(localStart, shiftTimezone);

  let shiftEnd = localTimeToUTC(localEnd, shiftTimezone);

  //--------------------------------------------------
  // Overnight
  //--------------------------------------------------

  let overnight = false;

  if (shiftEnd <= shiftStart) {
    overnight = true;

    shiftEnd = new Date(shiftEnd.getTime() + 86400000);
  }

  //--------------------------------------------------
  // Duration
  //--------------------------------------------------

  const scheduledMinutes = Math.round((shiftEnd - shiftStart) / 60000);

  return {
    shift_timezone: shiftTimezone,

    display_timezone: displayTimezone,

    overnight,

    shift_start: shiftStart,

    shift_end: shiftEnd,

    scheduled_minutes: scheduledMinutes,
  };
}

/**
 * =====================================================
 * LOCAL TIME -> UTC
 * =====================================================
 *
 * Input
 * -----
 * datetime : "2026-07-13 13:00:00"
 * timezone : "America/New_York"
 *
 * Returns
 * -------
 * Date (UTC)
 */
function localTimeToUTC(datetime, timezone) {
  const guess = new Date(datetime);

  const local = Utilities.formatDate(guess, timezone, "yyyy-MM-dd HH:mm:ss");

  const diff = new Date(local).getTime() - guess.getTime();

  return new Date(guess.getTime() - diff);
}
