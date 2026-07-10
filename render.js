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