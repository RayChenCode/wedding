const SITE_CONFIG = {
  version: "2026-07-09-rsvp-v2",
  appsScriptUrl: "https://script.google.com/macros/s/AKfycbzdbZC5vQkFboX_W12WJ1HukfJEf910LTfAYBIDyeeRCI2VmGu7kAE-BTZnYWyxP5Dv5Q/exec",
  weddingDate: "2026-10-24T10:30:00+08:00",
  dateDisplay: "2026.10.24",
  timeDisplay: "星期六 · 10:30 簽到 · 11:00 證婚 · 12:00 午宴",
  venueName: "CHALET V",
  venueAddress: "104 臺北市中山區成功里植福路 8 號",
  entranceNote: "入口於典華停車場後方木門處，抵達後請依現場指引入場。",
  parkingNote: "賓客可享典華停車場 4 小時免費停車；車位先到先停，停滿為主。婚禮桌上會提供停車折抵 QR code，請自行掃碼折抵。",
  transitNote: "搭乘捷運可由文湖線劍南路站或大直站一帶轉乘步行/計程車前往；自行開車請導航至植福路 8 號或典華停車場。",
  venueLatLng: "25.0837339,121.5550552",
  mapUrl: "https://maps.app.goo.gl/ew2wu86Gp4oGTyzo9",
  mapEmbedUrl: "https://www.google.com/maps?q=25.0837339,121.5550552&hl=zh-TW&z=17&output=embed",
  googleDirectionsUrl: "https://www.google.com/maps/dir/?api=1&destination=25.0837339%2C121.5550552",
  appleDirectionsUrl: "https://maps.apple.com/?daddr=25.0837339,121.5550552&dirflg=d",
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

document.querySelectorAll("[data-config-src]").forEach((node) => {
  const key = node.dataset.configSrc;
  if (SITE_CONFIG[key]) node.src = SITE_CONFIG[key];
});

const COPY_FEEDBACK_MS = 1800;
const LEGACY_FALLBACK_DELAY_MS = 8000;
const isAppleDevice = /iPhone|iPad|iPod|Macintosh/.test(navigator.userAgent);

if (isAppleDevice) {
  const google = document.querySelector('[data-nav="google"]');
  const apple = document.querySelector('[data-nav="apple"]');
  if (google && apple) {
    google.classList.remove("is-primary");
    apple.classList.add("is-primary");
    apple.parentNode.insertBefore(apple, google);
  }
}

const copyButton = document.getElementById("copy-address");

if (copyButton) {
  copyButton.addEventListener("click", async () => {
    const address = SITE_CONFIG[copyButton.dataset.copy];
    if (!address) return;

    const original = copyButton.textContent;
    try {
      await navigator.clipboard.writeText(address);
      copyButton.textContent = "已複製地址";
    } catch (error) {
      copyButton.textContent = "請長按地址複製";
    }
    window.setTimeout(() => {
      copyButton.textContent = original;
    }, COPY_FEEDBACK_MS);
  });
}

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

/**
 * 主視覺輪播：每張照片都有一張「去背人像」疊層，人像永遠在所有底圖之上。
 * 節奏：底圖 1 → 疊上人像 1 → 底圖 2 出現（人像 1 仍留著）→ 收掉人像 1，只剩底圖 2 → 疊上人像 2 → ...
 * 所有切換都是瞬間的，不做過場動畫（見 styles.css）。
 */
const bases = [...document.querySelectorAll(".hero-base")];
const cuts = [...document.querySelectorAll(".hero-cut")];
const dots = [...document.querySelectorAll(".carousel-dots button")];

const BASE_HOLD_MS = 480; // 只有底圖的停留時間
const CUT_HOLD_MS = 640; // 底圖 + 自己的人像共存
const OVERLAP_MS = 640; // 下一張底圖出現、上一張人像仍留著

const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

let activeIndex = 0;
let previousIndex = -1;
let timer = null;

function renderCarousel(cutIndex) {
  bases.forEach((base, index) => {
    base.classList.toggle("is-active", index === activeIndex);
    base.classList.toggle("is-prev", index === previousIndex);
  });
  cuts.forEach((cut, index) => {
    cut.classList.toggle("is-on", index === cutIndex);
  });
  dots.forEach((dot, index) => {
    dot.classList.toggle("is-active", index === activeIndex);
  });
}

function runCycle() {
  renderCarousel(activeIndex); // 疊上目前這張的人像

  timer = setTimeout(() => {
    const holdingCut = activeIndex;
    previousIndex = activeIndex;
    activeIndex = (activeIndex + 1) % bases.length;
    renderCarousel(holdingCut); // 下一張底圖出現，上一張人像仍浮在最上層

    timer = setTimeout(() => {
      renderCarousel(null); // 收掉人像，只剩新底圖
      timer = setTimeout(runCycle, BASE_HOLD_MS);
    }, OVERLAP_MS);
  }, CUT_HOLD_MS);
}

function goToSlide(index) {
  clearTimeout(timer);
  previousIndex = activeIndex;
  activeIndex = (index + bases.length) % bases.length;
  renderCarousel(null);
  if (!prefersReducedMotion.matches) {
    timer = setTimeout(runCycle, BASE_HOLD_MS);
  }
}

if (bases.length) {
  renderCarousel(null);
  dots.forEach((dot, index) => {
    dot.addEventListener("click", () => goToSlide(index));
  });

  if (!prefersReducedMotion.matches) {
    timer = setTimeout(runCycle, BASE_HOLD_MS);
  }
}

/**
 * 相簿：3D 翻頁。每一頁翻走後露出下一頁，不循環，
 * 所以第一頁的「上一張」與最後一頁的「下一張」會 disabled。
 */
const albumStage = document.querySelector("[data-album]");
const albumPages = [...document.querySelectorAll(".album__page")];
const albumPrevButton = document.querySelector("[data-album-prev]");
const albumNextButton = document.querySelector("[data-album-next]");
const albumCurrentLabel = document.querySelector("[data-album-current]");
const albumTotalLabel = document.querySelector("[data-album-total]");
const SWIPE_THRESHOLD_PX = 40;

let albumIndex = 0;
let swipeStartX = null;

function renderAlbum() {
  albumPages.forEach((page, index) => {
    page.classList.toggle("is-flipped", index < albumIndex);
    page.classList.toggle("is-active", index === albumIndex);
    // 已翻走的頁疊在最上層才不會擋住目前這頁，後面的頁依序往下疊
    page.style.zIndex = String(index < albumIndex ? albumPages.length + index : albumPages.length - index);
  });
  if (albumCurrentLabel) albumCurrentLabel.textContent = String(albumIndex + 1);
  if (albumPrevButton) albumPrevButton.disabled = albumIndex === 0;
  if (albumNextButton) albumNextButton.disabled = albumIndex === albumPages.length - 1;
}

function goToPage(index) {
  albumIndex = Math.min(Math.max(index, 0), albumPages.length - 1);
  renderAlbum();
}

if (albumPages.length) {
  if (albumTotalLabel) albumTotalLabel.textContent = String(albumPages.length);
  renderAlbum();

  albumPrevButton?.addEventListener("click", () => goToPage(albumIndex - 1));
  albumNextButton?.addEventListener("click", () => goToPage(albumIndex + 1));

  albumStage?.addEventListener("keydown", (event) => {
    if (event.key === "ArrowLeft") goToPage(albumIndex - 1);
    if (event.key === "ArrowRight") goToPage(albumIndex + 1);
  });

  albumStage?.addEventListener("pointerdown", (event) => {
    swipeStartX = event.clientX;
  });

  albumStage?.addEventListener("pointerup", (event) => {
    if (swipeStartX === null) return;
    const deltaX = event.clientX - swipeStartX;
    swipeStartX = null;
    if (Math.abs(deltaX) < SWIPE_THRESHOLD_PX) return;
    goToPage(deltaX < 0 ? albumIndex + 1 : albumIndex - 1);
  });
}

/**
 * 捲動進場：元素進入視窗後才浮現，只播一次。
 * 除了 HTML 上手動標的 [data-reveal]，其餘區塊在這裡自動掛上並做出時間差。
 */
const REVEAL_TARGETS = [
  ".section",
  ".album",
  ".ticket",
  ".timeline li",
  ".note-grid article",
  ".schedule-meta",
  ".map-frame",
  ".map-actions",
  ".countdown",
  "footer p",
];

function setupReveals() {
  REVEAL_TARGETS.forEach((selector) => {
    document.querySelectorAll(selector).forEach((node, index) => {
      if (node.hasAttribute("data-reveal")) {
        return;
      }
      node.setAttribute("data-reveal", "");
      node.style.setProperty("--reveal-delay", `${Math.min(index, 5) * 110}ms`);
    });
  });

  const revealables = [...document.querySelectorAll("[data-reveal]")];

  if (prefersReducedMotion.matches || !("IntersectionObserver" in window)) {
    revealables.forEach((node) => node.classList.add("is-revealed"));
    return;
  }

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) {
          return;
        }
        entry.target.classList.add("is-revealed");
        observer.unobserve(entry.target);
      });
    },
    { threshold: 0.18, rootMargin: "0px 0px -8% 0px" }
  );

  revealables.forEach((node) => observer.observe(node));
}

setupReveals();

const form = document.getElementById("rsvpForm");
const statusNode = document.getElementById("formStatus");
const guestsInput = document.getElementById("guests");
const guestSection = document.getElementById("guestSection");
const guestList = document.getElementById("guestList");
const addGuestButton = document.getElementById("addGuest");
const guestCountSummary = document.getElementById("guestCountSummary");
const guestDetailsInput = document.getElementById("guestDetails");
const vegetarianCountInput = document.getElementById("vegetarianCount");
const mealInput = document.getElementById("meal");
const allergyInput = document.getElementById("allergy");
const ceremonyInput = document.getElementById("ceremony");
const banquetInput = document.getElementById("banquet");
const childSeatNeedInput = document.getElementById("childSeatNeed");
const childSeatCountInput = document.getElementById("childSeatCount");
const attendingOnlyFields = [...form.querySelectorAll("[data-attending-only]")];

let nextGuestId = 1;
let guestRows = [
  {
    id: 0,
    role: "本人",
    name: "",
    meal: "葷食",
    noBeef: "否",
    childSeat: "否",
  },
];

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

function setGuestError(message) {
  const errorNode = document.getElementById("guestDetailsError");
  if (errorNode) errorNode.textContent = message;
}

function syncAttendancePlan() {
  const plan = fieldValue("attendancePlan");
  const values = {
    ceremony_banquet: ["出席", "出席"],
    banquet: ["不出席", "出席"],
    none: ["不出席", "不出席"],
  }[plan] || ["", ""];
  ceremonyInput.value = values[0];
  banquetInput.value = values[1];
}

function isAttendingAnyEvent() {
  syncAttendancePlan();
  return fieldValue("ceremony") === "出席" || fieldValue("banquet") === "出席";
}

function isNotAttendingAllEvents() {
  syncAttendancePlan();
  return fieldValue("ceremony") === "不出席" && fieldValue("banquet") === "不出席";
}

function normalizePhone(phone) {
  return phone.replace(/[\s\-()#]/g, "");
}

function escapeHtml(value) {
  return String(value || "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#039;",
  })[char]);
}

function ensurePrimaryGuest() {
  if (!guestRows.length || guestRows[0].role !== "本人") {
    guestRows.unshift({ id: 0, role: "本人", name: "", meal: "葷食", noBeef: "否", childSeat: "否" });
  }
  guestRows[0].name = fieldValue("name");
}

function getGuestDetails() {
  ensurePrimaryGuest();
  if (!isAttendingAnyEvent()) return [];
  return guestRows.map((guest, index) => ({
    role: index === 0 ? "本人" : "家眷",
    name: index === 0 ? fieldValue("name") : String(guest.name || "").trim(),
    meal: guest.meal === "素食" ? "素食" : "葷食",
    noBeef: guest.noBeef === "是" ? "是" : "否",
    allergy: guest.noBeef === "是" ? "不吃牛" : "",
    childSeat: guest.childSeat === "是" ? "是" : "否",
  }));
}

function deriveMealSummary(details) {
  if (!details.length) return "";
  const vegetarianCount = details.filter((guest) => guest.meal === "素食").length;
  if (vegetarianCount === details.length) return "素食";
  if (vegetarianCount === 0) return "葷食";
  return "葷素皆有";
}

function syncGuestHiddenFields() {
  const details = getGuestDetails();
  const vegetarianCount = details.filter((guest) => guest.meal === "素食").length;
  const allergySummary = details
    .filter((guest) => guest.allergy)
    .map((guest) => `${guest.name || guest.role}：${guest.allergy}`)
    .join("；");
  const childSeatCount = details.filter((guest) => guest.childSeat === "是").length;

  guestsInput.value = String(details.length);
  vegetarianCountInput.value = String(vegetarianCount);
  mealInput.value = deriveMealSummary(details);
  allergyInput.value = allergySummary;
  childSeatNeedInput.value = childSeatCount > 0 ? "需要" : "不需要";
  childSeatCountInput.value = String(childSeatCount);
  guestDetailsInput.value = details.length ? JSON.stringify(details) : "";

  if (guestCountSummary) {
    guestCountSummary.textContent = details.length ? `${details.length} 位` : "不出席";
  }
}

/** checkbox 用勾選狀態換成「是／否」，其餘欄位直接取值。 */
function readGuestFieldValue(target) {
  if (target.type === "checkbox") {
    return target.checked ? "是" : "否";
  }
  return target.value;
}

function renderGuestList() {
  ensurePrimaryGuest();
  if (!guestList) return;

  guestList.innerHTML = guestRows.map((guest, index) => {
    const isPrimary = index === 0;
    const roleLabel = isPrimary ? "本人" : `家眷 ${index}`;
    const nameValue = isPrimary ? fieldValue("name") : guest.name;
    const escapedName = escapeHtml(nameValue);
    const meatChecked = guest.meal !== "素食" ? " checked" : "";
    const vegChecked = guest.meal === "素食" ? " checked" : "";
    const seatYesChecked = guest.childSeat === "是" ? " checked" : "";
    const seatNoChecked = guest.childSeat !== "是" ? " checked" : "";
    const noBeefChecked = guest.noBeef === "是" ? " checked" : "";
    const removeButton = isPrimary
      ? "<span class=\"guest-card__hint\">姓名由上方同步</span>"
      : `<button class="guest-card__remove" type="button" data-remove-guest="${index}">移除</button>`;

    return `
      <article class="guest-card" data-guest-index="${index}">
        <div class="guest-card__title">
          <span>${roleLabel}</span>
          ${removeButton}
        </div>
        <div class="guest-card__grid">
          <label>
            <span>姓名 <em>*</em></span>
            <input type="text" name="guestUiName${index}" value="${escapedName}" ${isPrimary ? "readonly aria-describedby=\"name\"" : `data-guest-field="name" data-guest-index="${index}" autocomplete="name"`}>
          </label>
          <fieldset class="guest-card__meal">
            <legend>葷素 <span>*</span></legend>
            <label><input type="radio" name="guestUiMeal${index}" value="葷食" data-guest-field="meal" data-guest-index="${index}"${meatChecked}> 葷食</label>
            <label><input type="radio" name="guestUiMeal${index}" value="素食" data-guest-field="meal" data-guest-index="${index}"${vegChecked}> 素食</label>
          </fieldset>
          <fieldset class="guest-card__seat">
            <legend>是否需要兒童椅</legend>
            <label><input type="radio" name="guestUiChildSeat${index}" value="是" data-guest-field="childSeat" data-guest-index="${index}"${seatYesChecked}> 需要</label>
            <label><input type="radio" name="guestUiChildSeat${index}" value="否" data-guest-field="childSeat" data-guest-index="${index}"${seatNoChecked}> 不需要</label>
          </fieldset>
          <label class="guest-card__nobeef">
            <input type="checkbox" name="guestUiNoBeef${index}" data-guest-field="noBeef" data-guest-index="${index}"${noBeefChecked}>
            <span>我不吃牛</span>
          </label>
        </div>
      </article>
    `;
  }).join("");

  syncGuestHiddenFields();
}

function validateGuests(pushError) {
  if (!isAttendingAnyEvent()) return true;

  const details = getGuestDetails();
  if (details.length < 1 || details.length > 10) {
    pushError("guestDetails", "出席者需為 1 到 10 位。");
    return false;
  }

  const missingName = details.findIndex((guest) => !guest.name);
  if (missingName >= 0) {
    pushError("guestDetails", missingName === 0 ? "請先填寫本人姓名。" : `請填寫家眷 ${missingName} 的姓名。`);
    return false;
  }

  const invalidMeal = details.findIndex((guest) => !["葷食", "素食"].includes(guest.meal));
  if (invalidMeal >= 0) {
    pushError("guestDetails", `請選擇${invalidMeal === 0 ? "本人" : `家眷 ${invalidMeal}`}的葷素。`);
    return false;
  }

  const invalidChildSeat = details.findIndex((guest) => !["是", "否"].includes(guest.childSeat));
  if (invalidChildSeat >= 0) {
    pushError("guestDetails", `請選擇${invalidChildSeat === 0 ? "本人" : `家眷 ${invalidChildSeat}`}是否需要兒童椅。`);
    return false;
  }

  return true;
}

function validateForm() {
  clearErrors();
  const errors = [];
  const pushError = (name, message) => {
    errors.push(name);
    if (name === "guestDetails") {
      setGuestError(message);
    } else {
      setFieldError(name, message);
    }
  };

  if (!fieldValue("name")) pushError("name", "請填寫姓名。");

  const phone = fieldValue("phone");
  const normalizedPhone = normalizePhone(phone);
  if (!phone) {
    pushError("phone", "請填寫手機。");
  } else if (!/^\+?\d{8,15}$/.test(normalizedPhone)) {
    pushError("phone", "請填寫可聯絡的電話號碼。");
  }

  syncAttendancePlan();
  if (!fieldValue("attendancePlan")) pushError("attendancePlan", "請選擇出席安排。");

  if (isAttendingAnyEvent()) {
    validateGuests(pushError);
  } else if (isNotAttendingAllEvents()) {
    guestsInput.value = "0";
    vegetarianCountInput.value = "0";
    mealInput.value = "";
    allergyInput.value = "";
    guestDetailsInput.value = "";
  }

  if (errors.length) {
    const firstField = errors[0] === "guestDetails" ? guestList.querySelector("input") : form.elements[errors[0]];
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
  syncAttendancePlan();
  const attending = isAttendingAnyEvent();

  attendingOnlyFields.forEach((node) => {
    node.classList.toggle("is-hidden", !attending);
    node.querySelectorAll("input, select, textarea, button").forEach((field) => {
      if (field.id === "addGuest") return;
      field.disabled = !attending;
    });
  });

  if (isNotAttendingAllEvents()) {
    guestsInput.value = "0";
    vegetarianCountInput.value = "0";
    mealInput.value = "";
    allergyInput.value = "";
    childSeatNeedInput.value = "不需要";
    childSeatCountInput.value = "0";
    guestDetailsInput.value = "";
  } else {
    renderGuestList();
  }
}

form.addEventListener("change", syncConditionalFields);
form.addEventListener("input", (event) => {
  const target = event.target;
  if (target.id === "name") {
    renderGuestList();
    syncConditionalFields();
    return;
  }
  if (target.dataset.guestField) {
    const index = Number(target.dataset.guestIndex);
    const guest = guestRows[index];
    if (!guest) return;
    guest[target.dataset.guestField] = readGuestFieldValue(target);
    syncGuestHiddenFields();
    return;
  }
  syncConditionalFields();
});
guestList.addEventListener("change", (event) => {
  const target = event.target;
  if (!target.dataset.guestField) return;
  const index = Number(target.dataset.guestIndex);
  const guest = guestRows[index];
  if (!guest) return;
  guest[target.dataset.guestField] = readGuestFieldValue(target);
  syncGuestHiddenFields();
});
guestList.addEventListener("click", (event) => {
  const removeIndex = event.target.dataset.removeGuest;
  if (!removeIndex) return;
  const index = Number(removeIndex);
  if (index > 0) {
    guestRows.splice(index, 1);
    renderGuestList();
    syncConditionalFields();
  }
});
addGuestButton.addEventListener("click", () => {
  if (guestRows.length >= 10) {
    setGuestError("最多可填寫 10 位出席者。");
    return;
  }
  guestRows.push({
    id: nextGuestId++,
    role: "家眷",
    name: "",
    meal: "葷食",
    noBeef: "否",
    childSeat: "否",
  });
  renderGuestList();
  syncConditionalFields();
  const newCard = guestList.querySelector(`[data-guest-index="${guestRows.length - 1}"] input[data-guest-field="name"]`);
  if (newCard) newCard.focus();
});
renderGuestList();
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

    // The iframe firing `load` only proves Google answered, not that the row was
    // written. Wait long enough for the real postMessage (~3.5s observed) to win;
    // only assume success if it never arrives.
    const onLegacyLoad = () => {
      if (!submitted) return;
      if (!SITE_CONFIG.legacyIframeLoadFallback) return;
      window.setTimeout(() => {
        cleanup();
        resolve({ ok: true, legacyFallback: true });
      }, LEGACY_FALLBACK_DELAY_MS);
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
  syncGuestHiddenFields();

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
    guestRows = [{ id: 0, role: "本人", name: "", meal: "葷食", noBeef: "否", childSeat: "否" }];
    guestsInput.value = "1";
    renderGuestList();
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
    form.querySelector("input[name='attendancePlan'][value='ceremony_banquet']").checked = true;
    guestRows = [
      { id: 0, role: "本人", name: "截圖測試", meal: "葷食", noBeef: "否", childSeat: "否" },
      { id: nextGuestId++, role: "家眷", name: "同行家人", meal: "素食", noBeef: "是", childSeat: "是" },
    ];
    renderGuestList();
    syncConditionalFields();
    form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
  }
}

applyTestView();
