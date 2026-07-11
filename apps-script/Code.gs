const SPREADSHEET_ID = "1voXmpkEP9IWwU3OPWjYzK-gXRI6chlp-kQ7fReloNfE";
const SHEET_NAME = "工作表1";
const MAX_TEXT_LENGTH = 1000;
const MAX_GUESTS = 10;

const HEADERS = [
  "建立時間",
  "姓名",
  "手機",
  "是否出席證婚",
  "是否出席午宴",
  "出席人數",
  "飲食需求",
  "素食人數",
  "同行賓客明細",
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
  "guestDetails",
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
        record.guestDetailsText,
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
  const guestDetails = attending ? normalizeGuestDetails(params.guestDetails, params) : [];
  const guests = attending ? guestDetails.length : 0;
  const vegetarianCount = guestDetails.filter((guest) => guest.meal === "素食").length;
  const childSeatCount = guestDetails.filter((guest) => guest.childSeat === "是").length;
  const childSeatNeed = childSeatCount > 0 ? "需要" : "不需要";
  const allergy = attending
    ? guestDetails.filter((guest) => guest.allergy).map((guest) => guest.name + "：" + guest.allergy).join("；")
    : sanitize(params.allergy);

  return {
    name: sanitize(params.name),
    phone: sanitize(params.phone),
    ceremony,
    banquet,
    guests,
    meal: deriveMealSummary(guestDetails, params.meal),
    vegetarianCount,
    guestDetails,
    guestDetailsText: formatGuestDetails(guestDetails),
    allergy: sanitize(allergy),
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
  if ((record.ceremony === "出席" || record.banquet === "出席") && (!Number.isInteger(record.guests) || record.guests < 1 || record.guests > MAX_GUESTS)) {
    errors.push("invalid_guests");
  }
  record.guestDetails.forEach((guest, index) => {
    if (!guest.name) errors.push("missing_guest_name_" + index);
    if (guest.meal !== "葷食" && guest.meal !== "素食") errors.push("invalid_guest_meal_" + index);
    if (guest.childSeat !== "是" && guest.childSeat !== "否") errors.push("invalid_guest_child_seat_" + index);
  });

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

function normalizeGuestDetails(value, params) {
  const parsed = parseGuestDetails(value);
  if (parsed.length) return parsed;

  const fallbackMeal = normalizeMeal(params.meal) === "素食" ? "素食" : "葷食";
  if (params.name) {
    return [{
      role: "本人",
      name: sanitize(params.name),
      meal: fallbackMeal,
      noBeef: "否",
      allergy: sanitize(params.allergy),
      childSeat: "否"
    }];
  }
  return [];
}

function parseGuestDetails(value) {
  if (!value) return [];
  try {
    const rawGuests = JSON.parse(String(value));
    if (!Array.isArray(rawGuests)) return [];
    return rawGuests.slice(0, MAX_GUESTS).map((guest, index) => ({
      role: index === 0 ? "本人" : "家眷",
      name: sanitize(guest && guest.name),
      meal: guest && guest.meal === "素食" ? "素食" : "葷食",
      noBeef: guest && guest.noBeef === "是" ? "是" : "否",
      allergy: guest && guest.noBeef === "是" ? "不吃牛" : sanitize(guest && guest.allergy),
      childSeat: guest && guest.childSeat === "是" ? "是" : "否"
    }));
  } catch (error) {
    return [];
  }
}

function deriveMealSummary(guestDetails, fallback) {
  if (!guestDetails.length) return normalizeMeal(fallback || "葷食");
  const vegetarianCount = guestDetails.filter((guest) => guest.meal === "素食").length;
  if (vegetarianCount === guestDetails.length) return "素食";
  if (vegetarianCount === 0) return "葷食";
  return "葷素皆有";
}

function formatGuestDetails(guestDetails) {
  return guestDetails.map((guest, index) => {
    const role = index === 0 ? "本人" : "家眷" + index;
    const allergy = guest.allergy ? "；" + sanitize(guest.allergy) : "";
    const childSeat = guest.childSeat === "是" ? "；需要兒童椅" : "";
    return (index + 1) + ". " + role + "：" + sanitize(guest.name) + "；" + guest.meal + allergy + childSeat;
  }).join("\n");
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
    // Apps Script renders this inside a nested sandbox iframe, so `parent` is
    // Google's wrapper page, not the host site. Post to both to reach the caller.
    .createHtmlOutput("<!doctype html><meta charset=\"utf-8\"><script>var m=" + safeJson + ";try{window.top.postMessage(m,\"*\");}catch(e){}try{window.parent.postMessage(m,\"*\");}catch(e){}</script>")
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}
