function buildShiftMetrics(state, shift) {

  const result = {
    worked_minutes: 0,
    late_minutes: 0,
    overtime_minutes: 0,
    break_minutes: 0
  };

  if (!state) return result;

  const timeIn = state.time_in
    ? timeToMinutes(state.time_in)
    : null;

  const timeOut = state.time_out
    ? timeToMinutes(state.time_out)
    : null;

  // =====================================================
  // BREAKS (ALWAYS VALID)
  // =====================================================

  if (Array.isArray(state.breaks)) {
    state.breaks.forEach(brk => {

      if (!brk.in || !brk.out) return;

      let inMin = timeToMinutes(brk.in);
      let outMin = timeToMinutes(brk.out);

      if (outMin < inMin) outMin += 24 * 60;

      result.break_minutes += Math.max(0, outMin - inMin);
    });
  }

  // =====================================================
  // WORKED HOURS (ALWAYS VALID)
  // =====================================================

  if (timeIn !== null && timeOut !== null) {
    let inMin = timeIn;
    let outMin = timeOut;

    if (outMin < inMin) outMin += 24 * 60;

    result.worked_minutes = Math.max(
      0,
      outMin - inMin - result.break_minutes
    );
  }

  // =====================================================
  // SHIFT RULES (OPTIONAL)
  // =====================================================

  if (shift && timeIn !== null) {

    let shiftStart = shift.start_time
      ? timeToMinutes(shift.start_time)
      : null;

    let shiftEnd = shift.end_time
      ? timeToMinutes(shift.end_time)
      : null;

    const grace = Number(shift.grace_minutes || 0);

    if (shiftStart !== null) {
      result.late_minutes = Math.max(
        0,
        timeIn - (shiftStart + grace)
      );
    }

    if (shiftEnd !== null && timeOut !== null) {
      result.overtime_minutes = Math.max(
        0,
        timeOut - shiftEnd
      );
    }
  }

  return result;
}

function computeSessionHours(state) {
  let worked_minutes = 0;
  let break_minutes = 0;

  if (!state) {
    return {
      worked_minutes: 0,
      break_minutes: 0,
      worked_hours: 0
    };
  }

  const timeIn = state.time_in ? timeToMinutes(state.time_in) : null;
  const timeOut = state.time_out ? timeToMinutes(state.time_out) : null;

  // if (Array.isArray(state.breaks)) {
  //   state.breaks.forEach(brk => {
  //     if (!brk.in || !brk.out) return;

  //     let a = timeToMinutes(brk.in);
  //     let b = timeToMinutes(brk.out);

  //     if (b < a) b += 24 * 60;

  //     break_minutes += (b - a);
  //   });
  // }

  if (timeIn !== null && timeOut !== null) {
    let out = timeOut;
    let inT = timeIn;

    if (out < inT) out += 24 * 60;

    worked_minutes = Math.max(0, out - inT - break_minutes);
  }

  return {
    worked_minutes,
    break_minutes,
    worked_hours: +(worked_minutes / 60).toFixed(2)
  };
}