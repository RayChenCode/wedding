const SPREADSHEET_ID = "1voXmpkEP9IWwU3OPWjYzK-gXRI6chlp-kQ7fReloNfE";
const SHEET_NAME = "工作表1";
const MAX_TEXT_LENGTH = 1000;

const HEADERS = [
  "建立時間",
  "姓名",
  "手機",
  "是否出席證婚",
  "是否出席午宴",
  "出席人數",
  "飲食需求",
  "素食人數",
  "特殊飲食",
  "是否需要兒童椅",
  "兒童椅數量",
  "交通需求",
  "祝福留言",
  "前端送出時間",
  "來源",
  "網站版本",
  "User Agent"
];

const ALLOWED_FIELDS = [
  "website",
  "name",
  "phone",
  "ceremony",
  "banquet",
  "guests",
  "meal",
  "vegetarianCount",
  "allergy",
  "childSeatNeed",
  "childSeatCount",
  "transport",
  "message",
  "submittedAtClient",
  "source",
  "siteVersion",
  "userAgent"
];

function doGet() {
  return jsonResponse({ ok: true, service: "Ray & Catherine RSVP endpoint" });
}

function doPost(e) {
  try {
    const params = filterParams(e && e.parameter ? e.parameter : {});

    if (params.website) {
      return htmlResponse({ ok: true, ignored: true });
    }

    const record = buildRecord(params);
    const errors = validateRecord(record);
    if (errors.length) {
      return htmlResponse({ ok: false, error: errors.join(",") });
    }

    const lock = LockService.getScriptLock();
    lock.waitLock(10000);

    try {
      const spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
      let sheet = spreadsheet.getSheetByName(SHEET_NAME);
      if (!sheet) {
        sheet = spreadsheet.insertSheet(SHEET_NAME);
      }

      ensureHeaders(sheet);
      sheet.appendRow([
        new Date(),
        record.name,
        record.phone,
        record.ceremony,
        record.banquet,
        record.guests,
        record.meal,
        record.vegetarianCount,
        record.allergy,
        record.childSeatNeed,
        record.childSeatCount,
        record.transport,
        record.message,
        record.submittedAtClient,
        record.source,
        record.siteVersion,
        record.userAgent
      ]);
    } finally {
      lock.releaseLock();
    }

    return htmlResponse({ ok: true });
  } catch (error) {
    return htmlResponse({ ok: false, error: String(error) });
  }
}

function filterParams(params) {
  const result = {};
  ALLOWED_FIELDS.forEach((field) => {
    result[field] = sanitize(params[field]);
  });
  return result;
}

function buildRecord(params) {
  const ceremony = normalizeAttendance(params.ceremony);
  const banquet = normalizeAttendance(params.banquet);
  const attending = ceremony === "出席" || banquet === "出席";
  const guests = attending ? clampInteger(params.guests, 1, 10, NaN) : 0;
  const vegetarianCount = clampInteger(params.vegetarianCount || "0", 0, 10, 0);
  const childSeatNeed = params.childSeatNeed === "需要" ? "需要" : "不需要";
  const childSeatCount = childSeatNeed === "需要" ? clampInteger(params.childSeatCount, 1, 5, NaN) : 0;

  return {
    name: sanitize(params.name),
    phone: sanitize(params.phone),
    ceremony,
    banquet,
    guests,
    meal: normalizeMeal(params.meal),
    vegetarianCount,
    allergy: sanitize(params.allergy),
    childSeatNeed,
    childSeatCount,
    transport: sanitize(params.transport),
    message: sanitize(params.message),
    submittedAtClient: sanitize(params.submittedAtClient),
    source: sanitize(params.source),
    siteVersion: sanitize(params.siteVersion),
    userAgent: sanitize(params.userAgent)
  };
}

function validateRecord(record) {
  const errors = [];
  const phone = record.phone.replace(/[\s\-()#]/g, "");

  if (!record.name) errors.push("missing_name");
  if (!record.phone || !/^\+?\d{8,15}$/.test(phone)) errors.push("invalid_phone");
  if (!record.ceremony) errors.push("missing_ceremony");
  if (!record.banquet) errors.push("missing_banquet");
  if ((record.ceremony === "出席" || record.banquet === "出席") && (!Number.isInteger(record.guests) || record.guests < 1 || record.guests > 10)) {
    errors.push("invalid_guests");
  }
  if (record.vegetarianCount > record.guests && record.guests > 0) errors.push("invalid_vegetarian_count");
  if (record.childSeatNeed === "需要" && (!Number.isInteger(record.childSeatCount) || record.childSeatCount < 1 || record.childSeatCount > 5)) {
    errors.push("invalid_child_seat_count");
  }

  return errors;
}

function ensureHeaders(sheet) {
  const current = sheet.getRange(1, 1, 1, HEADERS.length).getValues()[0];
  const mismatch = HEADERS.some((header, index) => current[index] !== header);
  if (mismatch) {
    sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);
  }
  sheet.setFrozenRows(1);
}

function normalizeAttendance(value) {
  return value === "出席" || value === "不出席" ? value : "";
}

function normalizeMeal(value) {
  return ["葷食", "素食", "葷素皆有", "特殊飲食需求"].includes(value) ? value : "葷食";
}

function clampInteger(value, min, max, fallback) {
  const number = Number(value);
  if (!Number.isInteger(number) || number < min || number > max) return fallback;
  return number;
}

function sanitize(value) {
  const text = String(value || "").trim().slice(0, MAX_TEXT_LENGTH);
  return /^[=+\-@]/.test(text) ? "'" + text : text;
}

function jsonResponse(payload) {
  return ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}

function htmlResponse(payload) {
  const safeJson = JSON.stringify(Object.assign({ source: "ray-catherine-rsvp" }, payload)).replace(/</g, "\\u003c");
  return HtmlService
    .createHtmlOutput("<!doctype html><meta charset=\"utf-8\"><script>window.parent.postMessage(" + safeJson + ", \"*\");</script>")
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}
