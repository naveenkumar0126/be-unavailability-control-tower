// For the TAG & Reason sheet specifically - it has ONE TAB PER DAY (e.g.
// "6th_july", "3rd aug"), and a new tab gets added over time as PMs fill it
// in each Monday. Unlike appsscript-push-template.gs (which pushes a single
// tab), this loops over every tab in the spreadsheet and pushes each one as
// its own call, since the backend keys tagged data by the date in each
// tab's name.
//
// Same outbound-push trick as the other template: works even when your org
// blocks inbound requests to the script's own URL (Workspace admin's
// "Anyone within [domain]" restriction on Apps Script web apps only blocks
// INBOUND calls, not the script calling out on your own authority).
//
// Paste into Extensions > Apps Script on the TAG & Reason sheet, fill in the
// constants below, save, then reload the sheet - a "Dashboard" menu will
// appear with a "Sync all days now" item.
//
// Re-running this is always safe: a day that's already loaded on the backend
// just gets replaced with this run's data, not duplicated. So a daily
// trigger can just re-push everything each time without any "what's new"
// bookkeeping in the script.

// ==== EDIT THESE ====
var BACKEND_URL = 'https://be-unavailability-backend.onrender.com/api/tags/push';
var PUSH_TOKEN = 'change-me-to-something-random'; // must exactly match APPSSCRIPT_PUSH_TOKEN set on the backend
var SKIP_SHEET_NAMES = []; // exact tab names to never sync (e.g. a notes/instructions tab) - case-sensitive
// =====================

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Dashboard')
    .addItem('Sync all days now', 'pushAllDaysToDashboard')
    .addToUi();
}

function pushAllDaysToDashboard() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheets = ss.getSheets();
  var synced = [];
  var skipped = [];
  var failed = [];

  for (var i = 0; i < sheets.length; i++) {
    var sheet = sheets[i];
    var name = sheet.getName();
    if (SKIP_SHEET_NAMES.indexOf(name) !== -1) continue;

    var values = sheet.getDataRange().getValues();
    if (values.length < 2) {
      skipped.push(name + ' (no data rows)');
      continue;
    }

    var headers = values[0];
    var data = values.slice(1);

    var payload = {
      headers: headers,
      data: data,
      sheet_name: name,
      source: 'Apps Script push (' + name + ', ' + new Date().toISOString() + ')'
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
      synced.push(name);
    } else {
      failed.push(name + ' (' + code + ': ' + response.getContentText().slice(0, 150) + ')');
    }
  }

  var message = 'Synced ' + synced.length + ' day(s): ' + (synced.join(', ') || '(none)');
  if (skipped.length) {
    message += '\n\nSkipped (empty): ' + skipped.join(', ');
  }
  if (failed.length) {
    message += '\n\nFAILED ' + failed.length + ' sheet(s) - check tab names look like a date (e.g. "6th_july"):\n' + failed.join('\n');
  }
  SpreadsheetApp.getUi().alert(message);
}

// Optional: call this once (Run > setupDailyTrigger) to sync automatically
// every day instead of clicking the menu each time.
function setupDailyTrigger() {
  ScriptApp.newTrigger('pushAllDaysToDashboard').timeBased().everyDays(1).atHour(6).create();
}
