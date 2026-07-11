const ALLOWED_PAGES = [
  "home",
  "dashboard",
  "admin",
  "reports",
  "login",
  "settings",
  "debugger"
];

/* =====================================================
   ROUTE NORMALIZATION
===================================================== */

function normalizePage(page) {
  if (!page || typeof page !== "string") return "home";
  return page.toLowerCase().trim();
}

console.log("router loaded");

console.log(typeof getUsers);

function isAllowedPage(page) {
  return ALLOWED_PAGES.includes(page);
}

/* =====================================================
   PAGE ROUTING
===================================================== */

function getPagePath(page) {

  const map = {
    home: "frontend/pages/home",
    dashboard: "frontend/pages/dashboard",
    admin: "frontend/pages/adminDashboard",
    reports: "frontend/pages/reports",
    login: "frontend/pages/login",
    settings: "frontend/pages/settings",
    debugger: "frontend/pages/attendance.debug"
  };

  return map[page] || map.home;
}

/* =====================================================
   INVITE FLOW
===================================================== */

function handleInviteFlow(token) {
  return renderPage("frontend/pages/login", {
    inviteToken: token
  });
}

/* =====================================================
   MAIN ROUTER ENTRY (GET)
   - used by WebApp URL
===================================================== */

function routeRequest(e) {

  const params = e?.parameter || {};

  const page = normalizePage(params.page);
  const token = params.token;

  if (!isAllowedPage(page)) {
    return renderError("Page not found");
  }

  if (token) {
    return handleInviteFlow(token);
  }

  return renderPage(getPagePath(page), {
    page
  });
}

/* =====================================================
   API GATEWAY (POST)
===================================================== */

function doPost(e) {

  try {

    const p = e?.parameter || {};
    const action = String(p.action || "").toLowerCase();

    if (!action) {
      return jsonResponse({
        success: false,
        message: "Missing action"
      });
    }

    switch (action) {

      // -------------------------------------------------
      // AUTH
      // -------------------------------------------------
      case "authentication":
        return jsonResponse(auth(p.email, p.sid));

      case "createpassword":
        return jsonResponse(createPassword(p.email, p.password));

      // -------------------------------------------------
      // SYSTEM INIT
      // -------------------------------------------------
      case "initsystem":
        return jsonResponse(initSystem(p.email, p.sheetUrl, p.name));

      // -------------------------------------------------
      // ATTENDANCE
      // -------------------------------------------------
      case "logattendance":
        return jsonResponse(
          logAttendanceByEmail(
            p.sheetUrl,
            p.email,
            p.actiontype,
            p.date || null,
            p.time || null
          )
        );

      // -------------------------------------------------
      // EMPLOYEES
      // -------------------------------------------------
      case "employees":
        return jsonResponse(employeeManagement(p.email, p.sheetUrl));

      // -------------------------------------------------
      // DEFAULT
      // -------------------------------------------------
      default:
        return jsonResponse({
          success: false,
          message: "Invalid action"
        });
    }

  } catch (err) {

    return jsonResponse({
      success: false,
      message: err?.message || "Server error"
    });
  }
}

function doGet(e) {

  const template =
    HtmlService.createTemplateFromFile("frontend/index");

  template.SERVER_DATA = {
    workspaceSlug: e?.parameter?.w || "",
    email: e?.parameter?.email || ""
  };

  return template
    .evaluate()
    .setTitle("Attendance Payroll");
}

function jsonResponse(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj || {}))
    .setMimeType(ContentService.MimeType.JSON);
}

function include(filename) {
  return HtmlService
    .createHtmlOutputFromFile(filename)
    .getContent();
}