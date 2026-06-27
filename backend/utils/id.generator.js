function generateId(prefix) {
  const rand = Math.random()
    .toString(36)
    .substring(2, 10)
    .toUpperCase();

  return `${prefix}-${rand}`;
}

function resolveFullname(payload = {}) {
  let fullname = payload.fullname || "";

  if (!fullname) {
    fullname = `${payload.first_name || ""} ${payload.last_name || ""}`.trim();
  }

  return normalize("fullname", fullname);
}