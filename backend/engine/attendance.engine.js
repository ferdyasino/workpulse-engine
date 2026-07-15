function buildAttendanceState(shift, timelogState, options) {
  options = options || {};

  const settings = options.settings || {};

  const window = shift
    ? resolveAttendanceSchedule(
        shift,
        options.timestamp,
        settings
      )
    : null;

  const attendance = {
    ...timelogState,

    shift_id: shift ? shift.shift_id : "",
    shift_start: window ? window.shift_start : null,
    shift_end: window ? window.shift_end : null,
    scheduled_minutes: window ? window.scheduled_minutes : 0,

    attendance_sessions: [],

    worked_minutes: 0,
    regular_minutes: 0,
    overtime_minutes: 0,
    break_minutes: 0,
    lunch_minutes: 0,
    late_minutes: 0,
    undertime_minutes: 0,

    attendance_status: "ABSENT",
  };

  if (!shift || !window) {
    return attendance;
  }

  attendance.attendance_sessions = buildAttendanceSessions(
    timelogState.sessions,
    window,
    settings
  );

  attendance.worked_minutes =
      calculateWorkedMinutes(
          attendance.attendance_sessions,
          window,
          new Date()
  );

  attendance.break_minutes = calculateBreakMinutes(
    timelogState.breaks
  );

  attendance.lunch_minutes = calculateLunchMinutes(
    timelogState.lunch
  );

  attendance.late_minutes = calculateLateMinutes(
    attendance.attendance_sessions,
    window,
    settings
  );

  const now = new Date();
  const shiftFinished = now >= window.shift_end;

  if (shiftFinished) {
    attendance.regular_minutes = calculateRegularMinutes(
      attendance.worked_minutes,
      attendance.scheduled_minutes
    );

    attendance.overtime_minutes = calculateOvertimeMinutes(
      attendance.worked_minutes,
      attendance.scheduled_minutes,
      settings
    );

    attendance.undertime_minutes =
        calculateUndertimeMinutes(
            attendance.worked_minutes,
            attendance.scheduled_minutes,
            window,
            new Date()
    );
  } else {
  
    attendance.regular_minutes = Math.min(
      attendance.worked_minutes,
      attendance.scheduled_minutes
    );

    attendance.overtime_minutes = 0;

    
    attendance.undertime_minutes = 0;
  }

  attendance.attendance_status = determineAttendanceStatus(
    attendance,
    window,
    settings,
    now
  );

  return attendance;
}
function buildAttendanceSessions(
  sessions,
  shiftWindow,
  settings
) {

  const list = Array.isArray(sessions)
    ? sessions
    : [];

  const allowOvertime =
    !!settings.OVERTIME_ENABLED;

  return list
    .map(function(session){

      if (!session || !session.time_in) {
        return null;
      }

      const timeIn = new Date(session.time_in);

      const timeOut = session.time_out
        ? new Date(session.time_out)
        : null;

      if (!allowOvertime) {

        if (timeIn < shiftWindow.shift_start) {
          timeIn.setTime(
            shiftWindow.shift_start.getTime()
          );
        }

        if (
          timeOut &&
          timeOut > shiftWindow.shift_end
        ) {
          timeOut.setTime(
            shiftWindow.shift_end.getTime()
          );
        }

      }

      if (
        timeOut &&
        timeOut <= timeIn
      ) {
        return null;
      }

      return {

        time_in: new Date(timeIn.getTime()),

        time_out: timeOut
          ? new Date(timeOut.getTime())
          : null,

      };

    })
    .filter(Boolean);

}

function calculateWorkedMinutes(
  sessions,
  window,
  now
) {

  now = now
    ? new Date(now)
    : new Date();

  return (sessions || []).reduce(function(
    total,
    session
  ){

    if (!session.time_in) {
      return total;
    }

    const start =
      new Date(session.time_in);

    let end;

    if (session.time_out) {

      end = new Date(session.time_out);

    } else {

      end =
        window &&
        now > window.shift_end
          ? new Date(window.shift_end)
          : now;

    }

    if (end <= start) {
      return total;
    }

    return total +
      Math.round(
        (end - start) / 60000
      );

  },0);

}

function calculateBreakMinutes(breaks) {
  return (breaks || []).reduce(function (total, b) {
    if (!b.in || !b.out) return total;

    return total + Math.max(0, Math.round((new Date(b.out).getTime() - new Date(b.in).getTime()) / 60000));
  }, 0);
}

function calculateLunchMinutes(lunch) {
  if (!lunch || !lunch.in || !lunch.out) return 0;

  return Math.max(0, Math.round((new Date(lunch.out).getTime() - new Date(lunch.in).getTime()) / 60000));
}


function calculateLateMinutes(
  sessions,
  window,
  settings
){

  if (
    !sessions ||
    !sessions.length ||
    !window
  ) {
    return 0;
  }

  const grace =
    Number(
      settings.LATE_GRACE_MINUTES_DEFAULT || 0
    );

  const firstIn =
    new Date(sessions[0].time_in);

  const shiftStart =
    new Date(window.shift_start);

  const diff =
    Math.floor(
      (firstIn.getTime() -
       shiftStart.getTime()) / 60000
    );

  return Math.max(
    0,
    diff - grace
  );

}

function calculateRegularMinutes(worked, scheduled) {
  return Math.min(Number(worked) || 0, Number(scheduled) || 0);
}

function calculateUndertimeMinutes(
  worked,
  scheduled,
  window,
  now
){

  now = now
    ? new Date(now)
    : new Date();

  if (
    window &&
    now < window.shift_end
  ) {
    return 0;
  }

  return Math.max(
    0,
    Number(scheduled) -
      Number(worked)
  );

}

function calculateOvertimeMinutes(worked, scheduled, settings) {
  if (!settings.OVERTIME_ENABLED) {
    return 0;
  }

  worked = Number(worked) || 0;
  scheduled = Number(scheduled) || 0;

  const raw = Math.max(0, worked - scheduled);

  const minimum = Number(settings.MINIMUM_OVERTIME_MINUTES || 0);

  return raw >= minimum ? raw : 0;
}

function determineAttendanceStatus(attendance, window, settings, now) {
  if (!window) {
    return "ABSENT";
  }

  const today = formatDateKey(new Date());
  const workDate = formatDateKey(window.shift_start);

  if (workDate < today) {
  
    now = new Date(window.shift_end);
  } else if (workDate === today) {
    
    now = new Date();
  } else {

    return "PENDING";
  }

  const grace = Number(settings.LATE_GRACE_MINUTES_DEFAULT || 0);

  const absentTime = new Date(window.shift_start);
  absentTime.setMinutes(absentTime.getMinutes() + grace);


  if (!attendance.time_in) {
    return now < absentTime ? "PENDING" : "ABSENT";
  }


  if (now < window.shift_end) {
    if (!attendance.time_in) {
      return now < absentTime ? "PENDING" : "ABSENT";
    }

    return "PRESENT";
  }

  if (attendance.late_minutes > 0) {
    return "LATE";
  }

  if (attendance.overtime_minutes > 0) {
    return "OVERTIME";
  }

  if (attendance.undertime_minutes > 0) {
    return "UNDERTIME";
  }

  return "PRESENT";
}

// function api_debugAttendanceEngine(
//   workspace_id,
//   email,
//   shift_id,
//   start_date,
//   end_date,
//   timezone,
// ) {
//   if (!workspace_id) {
//     throw new Error("workspace_id is required");
//   }

//   if (!email) {
//     throw new Error("email is required");
//   }

//   if (!shift_id) {
//     throw new Error("shift_id is required");
//   }

//   const settings = getWorkspaceSettings(workspace_id);

//   if (timezone) {
//     settings.TIMEZONE = timezone;
//   }

//   if (!start_date) {
//     throw new Error("start_date is required");
//   }

//   const start = new Date(start_date);
//   const end = new Date(end_date);

//   if (start > end) {
//     throw new Error("start_date cannot be after end_date");
//   }

//   const days = [];

//   const summary = {
//     total_days: 0,

//     present: 0,
//     absent: 0,
//     late: 0,
//     undertime: 0,
//     overtime: 0,
//     worked_minutes: 0,
//     regular_minutes: 0,
//     overtime_minutes: 0,
//     late_minutes: 0,
//     undertime_minutes: 0,
//     break_minutes: 0,
//     lunch_minutes: 0,
//   };

//   const cursor = new Date(start);

//   while (cursor <= end) {
//     if (isWeeklyDayOff(cursor, settings)) {
//       cursor.setDate(cursor.getDate() + 1);
//       continue;
//     }

//     const workDate = formatDateKey(cursor);

//     const attendance = buildAttendanceByWorkDate(
//       workspace_id,
//       email,
//       shift_id,
//       workDate,
//       settings
//     );

//     if (!attendance) {
//       cursor.setDate(cursor.getDate() + 1);
//       continue;
//     }

//     days.push(attendance);

//     summary.total_days++;

//     summary.worked_minutes += Number(attendance.worked_minutes || 0);
//     summary.regular_minutes += Number(attendance.regular_minutes || 0);
//     summary.overtime_minutes += Number(attendance.overtime_minutes || 0);
//     summary.late_minutes += Number(attendance.late_minutes || 0);
//     summary.undertime_minutes += Number(attendance.undertime_minutes || 0);
//     summary.break_minutes += Number(attendance.break_minutes || 0);
//     summary.lunch_minutes += Number(attendance.lunch_minutes || 0);

//     switch (attendance.attendance_status) {
//       case "PRESENT":
//         summary.present++;
//         break;

//       case "LATE":
//         summary.present++;
//         summary.late++;
//         break;

//       case "UNDERTIME":
//         summary.present++;
//         summary.undertime++;
//         break;

//       case "OVERTIME":
//         summary.present++;
//         summary.overtime++;
//         break;

//       case "ABSENT":
//         summary.absent++;
//         break;
//     }

//     cursor.setDate(cursor.getDate() + 1);
//   }

//   return JSON.stringify({
//     employee: {
//       email,
//       shift_id,
//     },

//     range: {
//       start_date,
//       end_date,
//     },

//     timezone: settings.TIMEZONE,

//     settings,

//     summary,

//     days,
//   });
// }