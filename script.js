const APPS_SCRIPT_WEB_APP_URL = "https://script.google.com/macros/s/AKfycbzdbZC5vQkFboX_W12WJ1HukfJEf910LTfAYBIDyeeRCI2VmGu7kAE-BTZnYWyxP5Dv5Q/exec";
const WEDDING_DATE = new Date("2026-10-24T10:30:00+08:00");

const countdownIds = {
  days: document.getElementById("days"),
  hours: document.getElementById("hours"),
  minutes: document.getElementById("minutes"),
  seconds: document.getElementById("seconds"),
};

function updateCountdown() {
  const now = new Date();
  const diff = Math.max(0, WEDDING_DATE.getTime() - now.getTime());
  const totalSeconds = Math.floor(diff / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  countdownIds.days.textContent = String(days);
  countdownIds.hours.textContent = String(hours).padStart(2, "0");
  countdownIds.minutes.textContent = String(minutes).padStart(2, "0");
  countdownIds.seconds.textContent = String(seconds).padStart(2, "0");
}

updateCountdown();
setInterval(updateCountdown, 1000);

const form = document.getElementById("rsvpForm");
const statusNode = document.getElementById("formStatus");

function setStatus(message, isError = false) {
  statusNode.textContent = message;
  statusNode.classList.toggle("is-error", isError);
}

function buildHiddenField(name, value) {
  const input = document.createElement("input");
  input.type = "hidden";
  input.name = name;
  input.value = value;
  return input;
}

function submitWithIframe(formData) {
  return new Promise((resolve, reject) => {
    const iframeName = `rsvp-target-${Date.now()}`;
    const iframe = document.createElement("iframe");
    iframe.name = iframeName;
    iframe.style.display = "none";

    const postForm = document.createElement("form");
    postForm.method = "POST";
    postForm.action = APPS_SCRIPT_WEB_APP_URL;
    postForm.target = iframeName;
    postForm.style.display = "none";

    for (const [name, value] of formData.entries()) {
      postForm.appendChild(buildHiddenField(name, value));
    }

    let submitted = false;
    let timeoutId;
    const cleanup = () => {
      setTimeout(() => {
        iframe.remove();
        postForm.remove();
      }, 1000);
    };

    iframe.addEventListener("load", () => {
      if (!submitted) return;
      clearTimeout(timeoutId);
      cleanup();
      resolve();
    });

    document.body.appendChild(iframe);
    document.body.appendChild(postForm);

    timeoutId = setTimeout(() => {
      cleanup();
      reject(new Error("submit-timeout"));
    }, 12000);

    submitted = true;
    postForm.submit();
  });
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  if (!APPS_SCRIPT_WEB_APP_URL.startsWith("https://script.google.com/macros/s/")) {
    setStatus("表單後端網址設定不完整，請先確認 Apps Script Web App URL。", true);
    return;
  }

  if (!form.reportValidity()) return;

  const submitButton = form.querySelector("button[type='submit']");
  const formData = new FormData(form);
  formData.append("source", window.location.href);
  formData.append("submittedAtClient", new Date().toISOString());

  submitButton.disabled = true;
  setStatus("正在送出回覆...");

  try {
    await submitWithIframe(formData);
    form.reset();
    document.getElementById("guests").value = "1";
    setStatus("已收到你的回覆，謝謝你。");
  } catch (error) {
    setStatus("送出逾時，請稍後再試，或直接聯絡新人確認。", true);
  } finally {
    submitButton.disabled = false;
  }
});
