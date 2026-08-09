// Use this instead of appsscript-template.gs if your org restricts Apps
// Script web apps to "Anyone within [domain]" (no public/anonymous access) -
// that setting only blocks INBOUND requests to the script's own URL, not
// OUTBOUND requests the script makes itself. So instead of the dashboard's
// backend pulling from this sheet, this script pushes the sheet's data TO
// the backend directly, whenever you run it.
//
// Sends the payload as {headers, data} (values only, column names sent once
// - not repeated on every row) and gzipped, since UrlFetchApp caps POST
// bodies at ~50MB and a large sheet (six figures of rows) can blow past
// that even before compression.
//
// Paste into Extensions > Apps Script on the sheet, fill in the constants
// below, save, then reload the sheet - a "Dashboard" menu will appear with
// a "Sync now" item.

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
  var data = values.slice(1);

  var payload = {
    headers: headers,
    data: data,
    source: 'Apps Script push (' + sheet.getName() + ', ' + new Date().toISOString() + ')'
  };

  var jsonString = JSON.stringify(payload);
  var compressed = Utilities.gzip(Utilities.newBlob(jsonString, 'application/json'));

  var response = UrlFetchApp.fetch(BACKEND_URL, {
    method: 'post',
    contentType: 'application/json',
    headers: {
      Authorization: 'Bearer ' + PUSH_TOKEN,
      'Content-Encoding': 'gzip'
    },
    payload: compressed.getBytes(),
    muteHttpExceptions: true
  });

  var code = response.getResponseCode();
  if (code >= 200 && code < 300) {
    var kb = Math.round(compressed.getBytes().length / 1024);
    SpreadsheetApp.getUi().alert('Synced ' + data.length + ' rows to the dashboard (' + kb + ' KB compressed).');
  } else {
    SpreadsheetApp.getUi().alert('Sync failed (' + code + '): ' + response.getContentText());
  }
}

// Optional: call this once (Run > setupDailyTrigger) to sync automatically
// every day instead of clicking the menu each time.
function setupDailyTrigger() {
  ScriptApp.newTrigger('pushToDashboard').timeBased().everyDays(1).atHour(6).create();
}
