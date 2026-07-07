function buildEmployeeReport(workspace_id, email, range, settings) {
  workspace_id = normalize("workspace_id", workspace_id);
  email = normalize("email", email);

  if (!workspace_id) {
    throw new Error("workspace_id is required");
  }

  range = range || "today";

  const reportRange = resolveReportRange(range, settings);

  // -----------------------------------------
  // Employees
  // -----------------------------------------

  let users;

  if (email) {
    const user = getUserByEmail(workspace_id, email);

    users = user ? [user] : [];
  } else {
    users = getUsers(workspace_id);
  }

  const rows = [];

  users.forEach(function (user) {

    eachDate(reportRange.startDate, reportRange.endDate, function (workDate) {

      const attendance = getAttendanceStateByWorkDate(
        workspace_id,
        user.email,
        user.shift_id,
        workDate,
      );

      rows.push({
        user_id: user.user_id,
        employee_no: user.employee_no,
        fullname: user.fullname,
        email: user.email,
        department_id: user.department_id,

        work_date: workDate,

        shift_id: user.shift_id,

        // @ts-ignore
        ...attendance
      });

    });
  });

  return rows;
}

function resolveReportRange(range, settings) {
  settings = settings || {};

  const today = new Date();

  const start = new Date(today);
  const end = new Date(today);

  start.setHours(0, 0, 0, 0);
  end.setHours(23, 59, 59, 999);

  const weekdayMap = {
    SUNDAY: 0,
    MONDAY: 1,
    TUESDAY: 2,
    WEDNESDAY: 3,
    THURSDAY: 4,
    FRIDAY: 5,
    SATURDAY: 6,
  };

  const weekStart = weekdayMap[
    String(settings.WEEKLY_START_DAY || "MONDAY").toUpperCase()
  ];

  function moveToWeekStart(date) {
    const current = date.getDay();

    let diff = current - weekStart;

    if (diff < 0) {
      diff += 7;
    }

    date.setDate(date.getDate() - diff);
  }

  switch (range) {
    case "today":
      break;

    case "yesterday":
      start.setDate(start.getDate() - 1);
      end.setDate(end.getDate() - 1);
      break;

    case "this_week":
      moveToWeekStart(start);
      end.setTime(Date.now());
      break;

    case "last_week":
      moveToWeekStart(start);

      start.setDate(start.getDate() - 7);

      end.setTime(start.getTime());
      end.setDate(start.getDate() + 6);
      end.setHours(23, 59, 59, 999);
      break;

    case "this_month":
      start.setDate(1);
      end.setTime(Date.now());
      break;

    case "last_month":
      start.setMonth(start.getMonth() - 1, 1);

      end.setTime(start.getTime());
      end.setMonth(start.getMonth() + 1, 0);
      end.setHours(23, 59, 59, 999);
      break;

    default:
      throw new Error("Unknown report range");
  }

  return {
    startDate: formatDateKey(start),
    endDate: formatDateKey(end),
  };
}

function eachDate(startDate, endDate, callback) {
  const current = new Date(startDate);

  const end = new Date(endDate);

  while (current <= end) {
    callback(formatDateKey(current));

    current.setDate(current.getDate() + 1); 
  }
}
