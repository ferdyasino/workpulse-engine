const ALLOWED_PAGES = [
  "home",
  "dashboard",
  "admin",
  "reports",
  "login",
  "settings",
  "debugger",
];

/* =====================================================
   ROUTE NORMALIZATION
===================================================== */

function normalizePage(page) {
  if (!page || typeof page !== "string") return "home";
  return page.toLowerCase().trim();
}

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
    debugger: "frontend/pages/attendance.debug",
  };

  return map[page] || map.home;
}

/* =====================================================
   INVITE FLOW
===================================================== */

function handleInviteFlow(token) {
  return renderPage("frontend/pages/login", {
    inviteToken: token,
  });
}

/* =====================================================
   MAIN ROUTER ENTRY (GET)
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
    page,
  });
}

/* =====================================================
   API GATEWAY (POST)
===================================================== */

  function doPost(e) {
    try {
      const p = e?.parameter || {};

      const action = String(p.action || "")
        .trim()
        .toLowerCase();

      switch (action) {

        case "logingoogle":
          return jsonResponse(
            loginWithGoogle(
              p.workspaceSlug,
              p.credential
            )
          );


        case "timelogs": {

          const payload = {
            user_id: p.user_id,
            email: p.email,
            shift_id: p.shift_id,
            action: p.action_type,

            device_info: p.device_info,

            location: p.location
              ? JSON.parse(p.location)
              : null,

            location_status: p.location_status,
            location_message: p.location_message,

            timestamp: p.timestamp,
          };
          return jsonResponse(result);
        }


        case "getcurrentstate":

          return jsonResponse(
            getCurrentState(
              p.workspace_id,
              p.email,
              p.shift_id,
              p.date,
              p.options
                ? JSON.parse(p.options)
                : null
            )
          );


        default:

          return jsonResponse({
            success:false,
            message:`Invalid action: ${action}`,
          });
      }

    } catch(err){

      return jsonResponse({
        success:false,
        message:err.message || "Server error",
      });

    }
  }

/* =====================================================
   WEB APP ENTRY
===================================================== */

function doGet(e) {
  const template = HtmlService.createTemplateFromFile("frontend/index");

  template.SERVER_DATA = {
    workspaceSlug: e?.parameter?.w || "",
    email: e?.parameter?.email || "",
  };

  return template
    .evaluate()
    .setTitle("Attendance Payroll");
}

/* =====================================================
   HELPERS
===================================================== */

function jsonResponse(obj) {
  return ContentService.createTextOutput(
    JSON.stringify(obj || {}),
  ).setMimeType(ContentService.MimeType.JSON);
}

function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}