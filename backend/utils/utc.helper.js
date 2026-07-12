/**
 * =====================================================
 * UTC / TIMEZONE HELPERS
 * =====================================================
 */

/**
 * Returns the effective timezone.
 */
function getTimezone(shift, settings) {
  return (
    shift?.timezone ||
    settings?.TIMEZONE ||
    Session.getScriptTimeZone()
  );
}

/**
 * Returns current UTC Date.
 */
function nowUtc() {
  return new Date();
}

/**
 * Returns current time represented in a timezone.
 */
function nowInTimezone(timezone) {
  return utcToTimezone(
    nowUtc(),
    timezone
  );
}

/**
 * Converts a local date/time inside an IANA timezone
 * into a UTC Date object.
 *
 * Example:
 *
 * work_date = "2026-07-01"
 * time      = "10:00"
 * timezone  = "America/New_York"
 *
 * =>
 * Date("2026-07-01T14:00:00.000Z")
 */
function zonedDateTimeToUtc(
  workDate,
  time,
  timezone
) {

  timezone =
    timezone ||
    Session.getScriptTimeZone();

  const parts = String(workDate)
    .split("-")
    .map(Number);

  if (parts.length !== 3) {
    throw new Error(
      "Invalid work date: " + workDate
    );
  }

  const clock = String(time)
    .split(":")
    .map(Number);

  const year = parts[0];
  const month = parts[1];
  const day = parts[2];

  const hour = clock[0] || 0;
  const minute = clock[1] || 0;

  const utcGuess = new Date(
    Date.UTC(
      year,
      month - 1,
      day,
      hour,
      minute,
      0,
      0
    )
  );

  const offset =
    getTimezoneOffsetMinutes(
      utcGuess,
      timezone
    );

  return new Date(
    utcGuess.getTime() -
      offset * 60000
  );
}

/**
 * Returns timezone offset in minutes.
 *
 * Examples
 *
 * America/New_York
 *   Summer = -240
 *   Winter = -300
 *
 * Asia/Manila
 *   = +480
 */
function getTimezoneOffsetMinutes(
  date,
  timezone
) {

  const utcString = Utilities.formatDate(
    date,
    "UTC",
    "yyyy/MM/dd HH:mm:ss"
  );

  const tzString = Utilities.formatDate(
    date,
    timezone,
    "yyyy/MM/dd HH:mm:ss"
  );

  const utcDate = new Date(utcString);
  const tzDate = new Date(tzString);

  return Math.round(
    (tzDate.getTime() -
      utcDate.getTime()) /
      60000
  );
}

/**
 * Converts UTC Date into a Date object
 * representing the supplied timezone.
 */
function utcToTimezone(
  date,
  timezone
) {

  return new Date(
    Utilities.formatDate(
      new Date(date),
      timezone,
      "yyyy/MM/dd HH:mm:ss"
    )
  );
}

/**
 * Formats a UTC Date using a timezone.
 */
function formatDateInTimezone(
  date,
  timezone,
  pattern
) {

  return Utilities.formatDate(
    new Date(date),
    timezone,
    pattern || "yyyy-MM-dd"
  );
}

/**
 * Formats only the time portion.
 */
function formatTimeInTimezone(
  date,
  timezone,
  pattern
) {

  return Utilities.formatDate(
    new Date(date),
    timezone,
    pattern || "HH:mm"
  );
}

/**
 * Returns yyyy-MM-dd in a timezone.
 */
function workDateInTimezone(
  date,
  timezone
) {

  return formatDateInTimezone(
    date,
    timezone,
    "yyyy-MM-dd"
  );
}

/**
 * Returns HH:mm in a timezone.
 */
function workTimeInTimezone(
  date,
  timezone
) {

  return formatTimeInTimezone(
    date,
    timezone,
    "HH:mm"
  );
}

function nextWorkDate(workDate) {
  const parts = String(workDate).split("-").map(Number);

  const date = new Date(
    Date.UTC(
      parts[0],
      parts[1] - 1,
      parts[2]
    )
  );

  date.setUTCDate(date.getUTCDate() + 1);

  return Utilities.formatDate(
    date,
    "UTC",
    "yyyy-MM-dd"
  );
}