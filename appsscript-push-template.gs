// Use this instead of appsscript-template.gs if your org restricts Apps
// Script web apps to "Anyone within [domain]" (no public/anonymous access) -
// that setting only blocks INBOUND requests to the script's own URL, not
// OUTBOUND requests the script makes itself. So instead of the dashboard's
// backend pulling from this sheet, this script pushes the sheet's data TO
// the backend directly, whenever you run it.
//
// Paste into Extensions > Apps Script on the sheet, fill in the two
// constants below, save, then reload the sheet - a "Dashboard" menu will
// appear with a "Sync now" item.

// ==== EDIT THESE ====
var BACKEND_URL = 'https://be-unavailability-backend.onrender.com/api/data/push'; // use /api/fillrate/push for the Fill Rate sheet
var PUSH_TOKEN = 'change-me-to-something-random'; // must exactly match APPSSCRIPT_PUSH_TOKEN set on the backend
var SHEET_NAME = ''; // leave blank to use the sheet's first tab, or set an exact tab name
// =====================

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Dashboard')
    .addItem('Sync now', 'pushToDashboard')
    .addToUi();
}

function pushToDashboard() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = SHEET_NAME ? ss.getSheetByName(SHEET_NAME) : ss.getSheets()[0];
  var values = sheet.getDataRange().getValues();
  if (values.length < 2) {
    SpreadsheetApp.getUi().alert('That sheet has no data rows.');
    return;
  }
  var headers = values[0];
  var rows = values.slice(1).map(function (row) {
    var obj = {};
    headers.forEach(function (h, i) { obj[h] = row[i]; });
    return obj;
  });

  var payload = {
    rows: rows,
    source: 'Apps Script push (' + sheet.getName() + ', ' + new Date().toISOString() + ')'
  };

  var response = UrlFetchApp.fetch(BACKEND_URL, {
    method: 'post',
    contentType: 'application/json',
    headers: { Authorization: 'Bearer ' + PUSH_TOKEN },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  });

  var code = response.getResponseCode();
  if (code >= 200 && code < 300) {
    SpreadsheetApp.getUi().alert('Synced ' + rows.length + ' rows to the dashboard.');
  } else {
    SpreadsheetApp.getUi().alert('Sync failed (' + code + '): ' + response.getContentText());
  }
}

// Optional: call this once (Run > setupDailyTrigger) to sync automatically
// every day instead of clicking the menu each time.
function setupDailyTrigger() {
  ScriptApp.newTrigger('pushToDashboard').timeBased().everyDays(1).atHour(6).create();
}
