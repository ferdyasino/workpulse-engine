function buildActionMessage(action) {
  if (!action) {
    return "Action recorded successfully";
  }

  const parts = String(action).split("_");
  const base = parts[0];
  const second = parts[1];

  let label = "";
  let verb = "recorded";

  switch (base) {
    case "time":
      label = second === "in" ? "Time In" : second === "out" ? "Time Out" : "Time";
      break;

    case "break":
      label = "Break";
      break;

    case "lunch":
      label = "Lunch";
      break;

    default:
      label = base.charAt(0).toUpperCase() + base.slice(1);
      break;
  }

  if (base === "time") {
    verb = second === "in" ? "clocked in" : second === "out" ? "clocked out" : "recorded";
  } else {
    const last = parts[parts.length - 1];

    if (last === "start") {
      verb = "started";
    } else if (last === "end") {
      verb = "ended";
    } else {
      verb = "recorded";
    }
  }

  return `${label} ${verb} successfully`;
}
