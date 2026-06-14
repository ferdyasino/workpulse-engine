function doGet() {
  return HtmlService
    .createTemplateFromFile('frontend/index')
    .evaluate()
    .setTitle('Attendance Payroll');
}

function jsonResponse(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj || {}))
    .setMimeType(ContentService.MimeType.JSON);
}