const SITE_CONFIG = {
  version: "2026-07-09-rsvp-v2",
  appsScriptUrl: "https://script.google.com/macros/s/AKfycbzdbZC5vQkFboX_W12WJ1HukfJEf910LTfAYBIDyeeRCI2VmGu7kAE-BTZnYWyxP5Dv5Q/exec",
  weddingDate: "2026-10-24T10:30:00+08:00",
  dateDisplay: "2026.10.24",
  timeDisplay: "Saturday · 10:30 簽到 · 11:00 證婚 · 12:00 午宴",
  venueName: "CHALET V",
  venueAddress: "104 臺北市中山區成功里植福路 8 號",
  entranceNote: "入口於典華停車場後方木門處，抵達後請依現場指引入場。",
  parkingNote: "賓客可享典華停車場 4 小時免費停車；車位先到先停，停滿為主。婚禮桌上會提供停車折抵 QR code，請自行掃碼折抵。",
  transitNote: "搭乘捷運可由文湖線劍南路站或大直站一帶轉乘步行/計程車前往；自行開車請導航至植福路 8 號或典華停車場。",
  mapUrl: "https://www.google.com/maps/search/?api=1&query=104%E8%87%BA%E5%8C%97%E5%B8%82%E4%B8%AD%E5%B1%B1%E5%8D%80%E6%88%90%E5%8A%9F%E9%87%8C%E6%A4%8D%E7%A6%8F%E8%B7%AF8%E8%99%9F",
  rsvpDeadline: "請於 2026/07/31 前完成回覆，方便我們安排座位與餐點。",
  legacyIframeLoadFallback: true
};

const WEDDING_DATE = new Date(SITE_CONFIG.weddingDate);
const QUERY = new URLSearchParams(window.location.search);
let isSubmitting = false;
let submitTimer = 0;

document.querySelectorAll("[data-config]").forEach((node) => {
  const key = node.dataset.config;
  if (SITE_CONFIG[key]) node.textContent = SITE_CONFIG[key];
});

document.querySelectorAll("[data-config-link]").forEach((node) => {
  const key = node.dataset.configLink;
  if (SITE_CONFIG[key]) {
    node.href = SITE_CONFIG[key];
  } else {
    node.classList.add("is-disabled");
    node.removeAttribute("href");
    node.setAttribute("aria-disabled", "true");
  }
});

const countdownIds = {
  days: document.getElementById("days"),
  hours: document.getElementById("hours"),
  minutes: document.getElementById("minutes"),
  seconds: document.getElementById("seconds"),
};

function updateCountdown(now = new Date()) {
  const title = document.getElementById("countdownTitle");
  const diff = WEDDING_DATE.getTime() - now.getTime();

  if (!Number.isFinite(diff)) {
    title.textContent = "婚禮日期確認中";
    Object.values(countdownIds).forEach((node) => {
      node.textContent = "0";
    });
    return;
  }

  if (diff <= 0) {
    title.textContent = "謝謝你的祝福";
    Object.values(countdownIds).forEach((node) => {
      node.textContent = "0";
    });
    return;
  }

  const totalSeconds = Math.floor(diff / 1000);
  countdownIds.days.textContent = String(Math.floor(totalSeconds / 86400));
  countdownIds.hours.textContent = String(Math.floor((totalSeconds % 86400) / 3600)).padStart(2, "0");
  countdownIds.minutes.textContent = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, "0");
  countdownIds.seconds.textContent = String(totalSeconds % 60).padStart(2, "0");
}

updateCountdown();
setInterval(updateCountdown, 1000);

const slides = [...document.querySelectorAll(".slide")];
const dots = [...document.querySelectorAll(".carousel-dots button")];
let activeSlide = 0;

function showSlide(index) {
  activeSlide = (index + slides.length) % slides.length;
  slides.forEach((slide, slideIndex) => {
    slide.classList.toggle("is-active", slideIndex === activeSlide);
  });
  dots.forEach((dot, dotIndex) => {
    dot.classList.toggle("is-active", dotIndex === activeSlide);
  });
}

dots.forEach((dot, index) => {
  dot.addEventListener("click", () => showSlide(index));
});

if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
  setInterval(() => showSlide(activeSlide + 1), 5200);
}

const form = document.getElementById("rsvpForm");
const statusNode = document.getElementById("formStatus");
const childSeatNeed = document.getElementById("childSeatNeed");
const childSeatCountField = document.getElementById("childSeatCountField");
const guestsInput = document.getElementById("guests");

function setStatus(message, isError = false) {
  statusNode.textContent = message;
  statusNode.classList.toggle("is-error", isError);
}

function clearErrors() {
  form.querySelectorAll(".field-error").forEach((node) => {
    node.textContent = "";
  });
  form.querySelectorAll("[aria-invalid='true']").forEach((node) => {
    node.removeAttribute("aria-invalid");
  });
}

function fieldValue(name) {
  const field = form.elements[name];
  if (!field) return "";
  if (field instanceof RadioNodeList) {
    return field.value || "";
  }
  return String(field.value || "").trim();
}

function setFieldError(name, message) {
  const errorNode = document.getElementById(`${name}Error`);
  const field = form.elements[name];
  if (errorNode) errorNode.textContent = message;
  if (field) {
    const target = field instanceof RadioNodeList ? [...field].find((item) => item.name === name) : field;
    if (target) target.setAttribute("aria-invalid", "true");
  }
}

function isAttendingAnyEvent() {
  return fieldValue("ceremony") === "出席" || fieldValue("banquet") === "出席";
}

function isNotAttendingAllEvents() {
  return fieldValue("ceremony") === "不出席" && fieldValue("banquet") === "不出席";
}

function normalizePhone(phone) {
  return phone.replace(/[\s\-()#]/g, "");
}

function validateForm() {
  clearErrors();
  const errors = [];
  const pushError = (name, message) => {
    errors.push(name);
    setFieldError(name, message);
  };

  if (!fieldValue("name")) pushError("name", "請填寫姓名。");

  const phone = fieldValue("phone");
  const normalizedPhone = normalizePhone(phone);
  if (!phone) {
    pushError("phone", "請填寫手機。");
  } else if (!/^\+?\d{8,15}$/.test(normalizedPhone)) {
    pushError("phone", "請填寫可聯絡的電話號碼。");
  }

  if (!fieldValue("ceremony")) pushError("ceremony", "請選擇是否出席證婚儀式。");
  if (!fieldValue("banquet")) pushError("banquet", "請選擇是否出席午宴。");

  const guests = Number(fieldValue("guests"));
  if (isAttendingAnyEvent()) {
    if (!Number.isInteger(guests) || guests < 1 || guests > 10) {
      pushError("guests", "出席人數需為 1 到 10 人。");
    }
  } else if (isNotAttendingAllEvents()) {
    guestsInput.value = "0";
  }

  const vegetarianCount = Number(fieldValue("vegetarianCount") || 0);
  if (!Number.isInteger(vegetarianCount) || vegetarianCount < 0 || vegetarianCount > Math.max(10, guests)) {
    pushError("vegetarianCount", "素食人數需為 0 到 10 人。");
  } else if (isAttendingAnyEvent() && vegetarianCount > guests) {
    pushError("vegetarianCount", "素食人數不可超過出席人數。");
  }

  if (fieldValue("childSeatNeed") === "需要") {
    const childSeatCount = Number(fieldValue("childSeatCount"));
    if (!Number.isInteger(childSeatCount) || childSeatCount < 1 || childSeatCount > 5) {
      pushError("childSeatCount", "請填寫 1 到 5 張兒童椅。");
    }
  }

  if (errors.length) {
    const firstField = form.elements[errors[0]];
    const firstNode = firstField instanceof RadioNodeList ? [...firstField][0] : firstField;
    if (firstNode) {
      firstNode.focus({ preventScroll: true });
      firstNode.scrollIntoView({ behavior: "smooth", block: "center" });
    }
    setStatus("請確認上方欄位後再送出。", true);
    return false;
  }

  return true;
}

function syncConditionalFields() {
  const needsSeat = fieldValue("childSeatNeed") === "需要";
  childSeatCountField.classList.toggle("is-hidden", !needsSeat);
  document.getElementById("childSeatCount").disabled = !needsSeat;

  if (isNotAttendingAllEvents()) {
    guestsInput.value = "0";
    guestsInput.disabled = true;
  } else {
    guestsInput.disabled = false;
    if (Number(guestsInput.value) < 1) guestsInput.value = "1";
  }
}

form.addEventListener("change", syncConditionalFields);
syncConditionalFields();

function buildHiddenField(name, value) {
  const input = document.createElement("input");
  input.type = "hidden";
  input.name = name;
  input.value = value;
  return input;
}

function submitWithIframe(formData) {
  const mockRsvp = QUERY.get("mockRsvp");
  if (mockRsvp) {
    return new Promise((resolve, reject) => {
      window.setTimeout(() => {
        if (mockRsvp === "success") resolve({ ok: true, mocked: true });
        else reject(new Error(mockRsvp));
      }, 350);
    });
  }

  return new Promise((resolve, reject) => {
    const iframeName = `rsvp-target-${Date.now()}`;
    const iframe = document.createElement("iframe");
    iframe.name = iframeName;
    iframe.title = "RSVP submission result";
    iframe.className = "submit-frame";

    const postForm = document.createElement("form");
    postForm.method = "POST";
    postForm.action = SITE_CONFIG.appsScriptUrl;
    postForm.target = iframeName;
    postForm.className = "submit-form";
    let submitted = false;

    for (const [name, value] of formData.entries()) {
      postForm.appendChild(buildHiddenField(name, value));
    }

    const cleanup = () => {
      window.removeEventListener("message", onMessage);
      iframe.removeEventListener("load", onLegacyLoad);
      clearTimeout(submitTimer);
      setTimeout(() => {
        iframe.remove();
        postForm.remove();
      }, 400);
    };

    const onMessage = (event) => {
      if (!event.data || event.data.source !== "ray-catherine-rsvp") return;
      cleanup();
      if (event.data.ok) {
        resolve(event.data);
      } else {
        reject(new Error(event.data.error || "submit_failed"));
      }
    };

    const onLegacyLoad = () => {
      if (!submitted) return;
      if (!SITE_CONFIG.legacyIframeLoadFallback) return;
      window.setTimeout(() => {
        cleanup();
        resolve({ ok: true, legacyFallback: true });
      }, 700);
    };

    window.addEventListener("message", onMessage);
    iframe.addEventListener("load", onLegacyLoad);
    document.body.appendChild(iframe);
    document.body.appendChild(postForm);

    submitTimer = window.setTimeout(() => {
      cleanup();
      reject(new Error("submit_timeout"));
    }, 15000);

    submitted = true;
    postForm.submit();
  });
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  if (isSubmitting) return;

  if (!SITE_CONFIG.appsScriptUrl.startsWith("https://script.google.com/macros/s/") || !SITE_CONFIG.appsScriptUrl.endsWith("/exec")) {
    setStatus("表單後端網址設定不完整，請先確認 Apps Script Web App URL。", true);
    return;
  }

  if (!validateForm()) return;

  const submitButton = form.querySelector("button[type='submit']");
  const formData = new FormData(form);
  formData.set("guests", isAttendingAnyEvent() ? fieldValue("guests") : "0");
  formData.append("source", window.location.href);
  formData.append("siteVersion", SITE_CONFIG.version);
  formData.append("submittedAtClient", new Date().toISOString());
  formData.append("userAgent", navigator.userAgent);

  isSubmitting = true;
  submitButton.disabled = true;
  setStatus("正在送出回覆...");

  try {
    await submitWithIframe(formData);
    form.reset();
    guestsInput.value = "1";
    syncConditionalFields();
    setStatus("已收到你的回覆，謝謝你。");
  } catch (error) {
    setStatus("送出失敗或逾時，請稍後再試。", true);
  } finally {
    isSubmitting = false;
    submitButton.disabled = false;
  }
});

window.__weddingSite = {
  SITE_CONFIG,
  updateCountdown,
  validateForm,
  syncConditionalFields,
};

async function applyTestView() {
  const testView = QUERY.get("testView");
  if (!testView) return;
  document.body.classList.add(`test-view-${testView}`);
  await new Promise((resolve) => window.setTimeout(resolve, 500));
  document.documentElement.style.scrollBehavior = "auto";
  const scrollToRsvp = () => {
    const top = document.getElementById("rsvp").getBoundingClientRect().top + window.scrollY - 20;
    window.scrollTo(0, top);
  };
  const scrollToSchedule = () => {
    const top = document.getElementById("schedule").getBoundingClientRect().top + window.scrollY - 20;
    window.scrollTo(0, top);
  };

  if (testView === "schedule") {
    scrollToSchedule();
  }

  if (testView === "form") {
    scrollToRsvp();
  }

  if (testView === "form-error") {
    scrollToRsvp();
    form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
  }

  if (testView === "form-success") {
    scrollToRsvp();
    document.getElementById("name").value = "截圖測試";
    document.getElementById("phone").value = "0912345678";
    form.querySelector("input[name='ceremony'][value='出席']").checked = true;
    form.querySelector("input[name='banquet'][value='出席']").checked = true;
    document.getElementById("guests").value = "2";
    document.getElementById("vegetarianCount").value = "1";
    syncConditionalFields();
    form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
  }
}

applyTestView();
