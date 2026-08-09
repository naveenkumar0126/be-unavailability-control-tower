// Paste this into Extensions > Apps Script on the Google Sheet you want the
// dashboard to read. Change SECRET_TOKEN to any random string first - that's
// what goes in the dashboard's "Secret token" field alongside the deployed
// Web App URL. Keep both private; anyone with them can read this sheet.

const SECRET_TOKEN = 'change-me-to-something-random';

function doGet(e) {
  var token = e.parameter.token;
  if (token !== SECRET_TOKEN) {
    return jsonOutput({ error: 'unauthorized' });
  }

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var action = e.parameter.action;

  if (action === 'tabs') {
    var names = ss.getSheets().map(function (s) { return s.getName(); });
    return jsonOutput(names);
  }

  if (action === 'data') {
    var sheetName = e.parameter.sheet;
    var sheet = sheetName ? ss.getSheetByName(sheetName) : ss.getSheets()[0];
    if (!sheet) {
      return jsonOutput({ error: 'Sheet "' + sheetName + '" not found' });
    }
    var values = sheet.getDataRange().getValues();
    if (values.length === 0) {
      return jsonOutput([]);
    }
    var headers = values[0];
    var rows = values.slice(1).map(function (row) {
      var obj = {};
      headers.forEach(function (h, i) { obj[h] = row[i]; });
      return obj;
    });
    return jsonOutput(rows);
  }

  return jsonOutput({ error: 'Unknown action. Use ?action=tabs or ?action=data' });
}

function jsonOutput(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
