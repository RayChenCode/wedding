const SPREADSHEET_ID = "1voXmpkEP9IWwU3OPWjYzK-gXRI6chlp-kQ7fReloNfE";
const SHEET_RESPONSES = "回覆";
const SHEET_GUESTS = "出席者";
const SHEET_STATS = "統計";
const MAX_TEXT_LENGTH = 1000;
const MAX_JSON_LENGTH = 8000;
const MAX_GUESTS = 10;

// 一筆回覆一列，看得到是誰送的
const RESPONSE_HEADERS = [
  "回覆編號",
  "建立時間",
  "姓名",
  "手機",
  "出席證婚",
  "出席午宴",
  "出席人數",
  "素食人數",
  "不吃牛人數",
  "兒童椅數量",
  "祝福留言",
  "前端送出時間",
  "來源",
  "網站版本",
  "User Agent"
];

// 一人一列，統計就靠這張：列數＝實際出席人數
const GUEST_HEADERS = [
  "回覆編號",
  "建立時間",
  "出席者姓名",
  "身分",
  "聯絡人",
  "聯絡手機",
  "葷素",
  "不吃牛",
  "需要兒童椅",
  "出席證婚",
  "出席午宴"
];

const STATS_ROWS = [
  ["總出席人數", "=COUNTA('出席者'!C2:C)"],
  ["出席證婚人數", "=COUNTIF('出席者'!J2:J,\"出席\")"],
  ["出席午宴人數", "=COUNTIF('出席者'!K2:K,\"出席\")"],
  ["葷食人數", "=COUNTIF('出席者'!G2:G,\"葷食\")"],
  ["素食人數", "=COUNTIF('出席者'!G2:G,\"素食\")"],
  ["不吃牛人數", "=COUNTIF('出席者'!H2:H,\"是\")"],
  ["兒童椅數量", "=COUNTIF('出席者'!I2:I,\"是\")"],
  ["回覆筆數", "=COUNTA('回覆'!A2:A)"],
  ["不出席筆數", "=COUNTIF('回覆'!G2:G,0)"]
];

const ALLOWED_FIELDS = [
  "website",
  "name",
  "phone",
  "ceremony",
  "banquet",
  "guests",
  "guestDetails",
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
      writeRecord(record);
    } finally {
      lock.releaseLock();
    }

    return htmlResponse({ ok: true, responseId: record.responseId });
  } catch (error) {
    return htmlResponse({ ok: false, error: String(error) });
  }
}

function writeRecord(record) {
  const spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
  const responses = ensureSheet(spreadsheet, SHEET_RESPONSES, RESPONSE_HEADERS);
  const guests = ensureSheet(spreadsheet, SHEET_GUESTS, GUEST_HEADERS);
  ensureStatsSheet(spreadsheet);

  const createdAt = new Date();

  responses.appendRow([
    record.responseId,
    createdAt,
    record.name,
    record.phone,
    record.ceremony,
    record.banquet,
    record.guestDetails.length,
    record.guestDetails.filter(function (guest) { return guest.meal === "素食"; }).length,
    record.guestDetails.filter(function (guest) { return guest.noBeef === "是"; }).length,
    record.guestDetails.filter(function (guest) { return guest.childSeat === "是"; }).length,
    record.message,
    record.submittedAtClient,
    record.source,
    record.siteVersion,
    record.userAgent
  ]);

  // 不出席的回覆不寫任何出席者列，「出席者」的列數才會等於真實出席人數
  if (!record.guestDetails.length) {
    return;
  }

  const rows = record.guestDetails.map(function (guest) {
    return [
      record.responseId,
      createdAt,
      guest.name,
      guest.role,
      record.name,
      record.phone,
      guest.meal,
      guest.noBeef,
      guest.childSeat,
      record.ceremony,
      record.banquet
    ];
  });

  guests
    .getRange(guests.getLastRow() + 1, 1, rows.length, GUEST_HEADERS.length)
    .setValues(rows);
}

function filterParams(params) {
  const result = {};
  ALLOWED_FIELDS.forEach(function (field) {
    // guestDetails 是 JSON，不能被 sanitize 的長度上限截斷，否則整包解析不出來
    result[field] = field === "guestDetails"
      ? String(params[field] || "").slice(0, MAX_JSON_LENGTH)
      : sanitize(params[field]);
  });
  return result;
}

function buildRecord(params) {
  const ceremony = normalizeAttendance(params.ceremony);
  const banquet = normalizeAttendance(params.banquet);
  const attending = ceremony === "出席" || banquet === "出席";

  return {
    responseId: Utilities.getUuid().slice(0, 8),
    name: sanitize(params.name),
    phone: sanitize(params.phone),
    ceremony: ceremony,
    banquet: banquet,
    guestDetails: attending ? parseGuestDetails(params.guestDetails) : [],
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
  const attending = record.ceremony === "出席" || record.banquet === "出席";

  if (!record.name) errors.push("missing_name");
  if (!record.phone || !/^\+?\d{8,15}$/.test(phone)) errors.push("invalid_phone");
  if (!record.ceremony) errors.push("missing_ceremony");
  if (!record.banquet) errors.push("missing_banquet");
  if (attending && (record.guestDetails.length < 1 || record.guestDetails.length > MAX_GUESTS)) {
    errors.push("invalid_guests");
  }

  record.guestDetails.forEach(function (guest, index) {
    if (!guest.name) errors.push("missing_guest_name_" + index);
  });

  return errors;
}

function parseGuestDetails(value) {
  if (!value) return [];
  try {
    const rawGuests = JSON.parse(String(value));
    if (!Array.isArray(rawGuests)) return [];
    return rawGuests.slice(0, MAX_GUESTS).map(function (guest, index) {
      return {
        role: index === 0 ? "本人" : "家眷",
        name: sanitize(guest && guest.name),
        meal: guest && guest.meal === "素食" ? "素食" : "葷食",
        noBeef: guest && guest.noBeef === "是" ? "是" : "否",
        childSeat: guest && guest.childSeat === "是" ? "是" : "否"
      };
    });
  } catch (error) {
    return [];
  }
}

function ensureSheet(spreadsheet, name, headers) {
  let sheet = spreadsheet.getSheetByName(name);
  if (!sheet) {
    sheet = spreadsheet.insertSheet(name);
  }

  const current = sheet.getRange(1, 1, 1, headers.length).getValues()[0];
  const mismatch = headers.some(function (header, index) {
    return current[index] !== header;
  });
  if (mismatch) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  }
  sheet.setFrozenRows(1);
  return sheet;
}

// 只建立一次，之後不覆寫，免得蓋掉使用者自己加的公式
function ensureStatsSheet(spreadsheet) {
  if (spreadsheet.getSheetByName(SHEET_STATS)) {
    return;
  }
  const sheet = spreadsheet.insertSheet(SHEET_STATS);
  sheet.getRange(1, 1, STATS_ROWS.length, 2).setValues(STATS_ROWS);
  sheet.setColumnWidth(1, 160);
}

function normalizeAttendance(value) {
  return value === "出席" || value === "不出席" ? value : "";
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
    // Apps Script renders this inside a nested sandbox iframe, so `parent` is
    // Google's wrapper page, not the host site. Post to both to reach the caller.
    .createHtmlOutput("<!doctype html><meta charset=\"utf-8\"><script>var m=" + safeJson + ";try{window.top.postMessage(m,\"*\");}catch(e){}try{window.parent.postMessage(m,\"*\");}catch(e){}</script>")
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}
