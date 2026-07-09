const SPREADSHEET_ID = "1voXmpkEP9IWwU3OPWjYzK-gXRI6chlp-kQ7fReloNfE";
const SHEET_NAME = "工作表1";

const HEADERS = [
  "收到時間",
  "姓名",
  "手機",
  "證婚儀式",
  "午宴",
  "出席人數",
  "飲食需求",
  "兒童椅",
  "交通需求",
  "祝福留言",
  "來源網址",
  "前端送出時間"
];

function doGet() {
  return ContentService
    .createTextOutput("Ray & Catherine RSVP endpoint is running.")
    .setMimeType(ContentService.MimeType.TEXT);
}

function doPost(e) {
  try {
    const params = e && e.parameter ? e.parameter : {};

    if (params.website) {
      return jsonResponse({ ok: true, ignored: true });
    }

    const name = clean(params.name);
    const phone = clean(params.phone);
    const ceremony = clean(params.ceremony);
    const banquet = clean(params.banquet);
    const guests = clean(params.guests);

    if (!name || !phone || !ceremony || !banquet || !guests) {
      return jsonResponse({ ok: false, error: "missing_required_fields" });
    }

    const lock = LockService.getScriptLock();
    lock.waitLock(10000);

    try {
      const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEET_NAME);
      if (!sheet) {
        throw new Error("Sheet not found: " + SHEET_NAME);
      }

      ensureHeaders(sheet);
      sheet.appendRow([
        new Date(),
        name,
        phone,
        ceremony,
        banquet,
        guests,
        clean(params.meal),
        clean(params.childSeat),
        clean(params.transport),
        clean(params.message),
        clean(params.source),
        clean(params.submittedAtClient)
      ]);
    } finally {
      lock.releaseLock();
    }

    return jsonResponse({ ok: true });
  } catch (error) {
    return jsonResponse({ ok: false, error: String(error) });
  }
}

function ensureHeaders(sheet) {
  const current = sheet.getRange(1, 1, 1, HEADERS.length).getValues()[0];
  const hasHeaders = current.some(value => value !== "");
  if (!hasHeaders) {
    sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);
    sheet.setFrozenRows(1);
  }
}

function clean(value) {
  return String(value || "").trim().slice(0, 1000);
}

function jsonResponse(payload) {
  return ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}
