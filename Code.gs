// Google Apps Script backend for Camp Attendance
// Bind this to the "Prezenta Tabara 2026" spreadsheet
// Deploy as Web App: Execute as Me, Access: Anyone

var SPREADSHEET_ID = SpreadsheetApp.getActiveSpreadsheet().getId();
var TIMEZONE = "Europe/Bucharest";

// Columns: A=ID, B=Prenume, C=Nume, D=Echipa, E=Varsta, F=Sex, G=Localitate, H-L=days
var DAYS_MAP = {
  1: { col: 8,  name: "Luni" },    // Monday → column H
  2: { col: 9,  name: "Marti" },   // Tuesday → column I
  3: { col: 10, name: "Miercuri" },// Wednesday → column J
  4: { col: 11, name: "Joi" },     // Thursday → column K
  5: { col: 12, name: "Vineri" }   // Friday → column L
};

function doPost(e) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
  } catch (err) {
    return jsonResponse({ status: "error", message: "Server ocupat, incearca din nou." });
  }

  try {
    // Parse ID from request
    var id = null;
    if (e.postData && e.postData.contents) {
      try {
        var body = JSON.parse(e.postData.contents);
        id = String(body.id);
      } catch (parseErr) {
        // Try URL parameter fallback
      }
    }
    if (!id && e.parameter && e.parameter.id) {
      id = String(e.parameter.id);
    }
    if (!id) {
      return jsonResponse({ status: "error", message: "ID lipsa." });
    }

    // Determine day
    var dayOverride = (e.parameter && e.parameter.day) ? e.parameter.day : null;
    var dayInfo = getDayInfo(dayOverride);

    if (!dayInfo) {
      return jsonResponse({ status: "weekend", message: "Sistemul functioneaza doar Luni-Vineri." });
    }

    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var prezenta = ss.getSheetByName("Prezenta");
    var log = ss.getSheetByName("Log");
    var now = Utilities.formatDate(new Date(), TIMEZONE, "HH:mm");
    var timestamp = Utilities.formatDate(new Date(), TIMEZONE, "yyyy-MM-dd HH:mm:ss");

    // Find ID in Prezenta column A, name = Prenume (B) + Nume (C)
    var dataRange = prezenta.getRange("A2:C" + prezenta.getLastRow());
    var data = dataRange.getValues();
    var rowIndex = -1;
    var name = "";

    for (var i = 0; i < data.length; i++) {
      if (String(data[i][0]) === id) {
        rowIndex = i + 2; // +2 because data starts at row 2
        var prenume = data[i][1] || "";
        var nume = data[i][2] || "";
        name = (prenume + " " + nume).trim();
        break;
      }
    }

    if (rowIndex === -1) {
      // Unknown ID
      log.appendRow([timestamp, id, "", dayInfo.name, "ID_NECUNOSCUT"]);
      return jsonResponse({ status: "unknown_id", id: id });
    }

    // Check if already scanned today
    var cell = prezenta.getRange(rowIndex, dayInfo.col);
    var existingValue = cell.getValue();

    if (existingValue !== "" && existingValue !== null) {
      // Duplicate
      log.appendRow([timestamp, id, name, dayInfo.name, "DUPLICAT"]);
      return jsonResponse({ status: "duplicate", name: name, time: String(existingValue), day: dayInfo.name });
    }

    // Mark attendance
    cell.setValue(now);
    log.appendRow([timestamp, id, name, dayInfo.name, "OK"]);

    return jsonResponse({ status: "ok", name: name, time: now, day: dayInfo.name, id: id });

  } finally {
    lock.releaseLock();
  }
}

function doGet(e) {
  var action = (e.parameter && e.parameter.action) ? e.parameter.action : "ping";

  if (action === "ping") {
    return jsonResponse({ status: "ok" });
  }

  var ss = SpreadsheetApp.getActiveSpreadsheet();

  if (action === "log") {
    var logSheet = ss.getSheetByName("Log");
    var lastRow = logSheet.getLastRow();
    if (lastRow < 2) {
      return jsonResponse({ log: [] });
    }
    var data = logSheet.getRange(2, 1, lastRow - 1, 5).getValues();
    var rows = [];
    for (var i = data.length - 1; i >= 0; i--) {
      rows.push({
        timestamp: String(data[i][0]),
        id: String(data[i][1]),
        name: data[i][2],
        day: data[i][3],
        status: data[i][4]
      });
    }
    return jsonResponse({ log: rows });
  }

  if (action === "attendance") {
    var prezenta = ss.getSheetByName("Prezenta");
    var lastRow = prezenta.getLastRow();
    if (lastRow < 2) {
      return jsonResponse({ attendance: [], counts: {} });
    }
    var data = prezenta.getRange(2, 1, lastRow - 1, 12).getValues();
    var rows = [];
    var counts = { Luni: 0, Marti: 0, Miercuri: 0, Joi: 0, Vineri: 0 };

    for (var i = 0; i < data.length; i++) {
      var row = {
        id: String(data[i][0]),
        prenume: data[i][1] || "",
        nume: data[i][2] || "",
        echipa: data[i][3] || "",
        varsta: data[i][4] !== "" ? data[i][4] : "",
        sex: data[i][5] || "",
        localitate: data[i][6] || "",
        luni: String(data[i][7] || ""),
        marti: String(data[i][8] || ""),
        miercuri: String(data[i][9] || ""),
        joi: String(data[i][10] || ""),
        vineri: String(data[i][11] || "")
      };
      rows.push(row);
      if (row.luni) counts.Luni++;
      if (row.marti) counts.Marti++;
      if (row.miercuri) counts.Miercuri++;
      if (row.joi) counts.Joi++;
      if (row.vineri) counts.Vineri++;
    }
    return jsonResponse({ attendance: rows, counts: counts, total: data.length });
  }

  return jsonResponse({ status: "error", message: "Actiune necunoscuta: " + action });
}

function getDayInfo(override) {
  if (override) {
    // Allow testing with ?day=Luni etc.
    for (var key in DAYS_MAP) {
      if (DAYS_MAP[key].name.toLowerCase() === override.toLowerCase()) {
        return DAYS_MAP[key];
      }
    }
    return null;
  }
  var now = new Date();
  var dayOfWeek = parseInt(Utilities.formatDate(now, TIMEZONE, "u")); // 1=Monday, 7=Sunday
  return DAYS_MAP[dayOfWeek] || null;
}

function jsonResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
