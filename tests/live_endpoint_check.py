import json
import subprocess
import sys
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CHROME = Path(r"C:\Program Files\Google\Chrome\Application\chrome.exe")
PORT = 8767
ENDPOINT = "https://script.google.com/macros/s/AKfycbzdbZC5vQkFboX_W12WJ1HukfJEf910LTfAYBIDyeeRCI2VmGu7kAE-BTZnYWyxP5Dv5Q/exec"
reports = []


class Handler(BaseHTTPRequestHandler):
    def log_message(self, format, *args):
        return

    def do_GET(self):
        if self.path.startswith("/"):
            html = f"""<!doctype html>
<meta charset="utf-8">
<title>Live endpoint check</title>
<pre id="status">running</pre>
<iframe name="target" style="display:none"></iframe>
<form id="f" action="{ENDPOINT}" method="post" target="target">
  <input name="website" value="">
  <input name="name" value="Codex 新版測試 😊">
  <input name="phone" value="0912-345-678">
  <input name="ceremony" value="出席">
  <input name="banquet" value="出席">
  <input name="guests" value="2">
  <input name="meal" value="葷素皆有">
  <input name="vegetarianCount" value="1">
  <input name="allergy" value="海鮮過敏">
  <input name="childSeatNeed" value="需要">
  <input name="childSeatCount" value="1">
  <input name="transport" value="自行前往">
  <input name="message" value="=FORMULA_TEST 不應被當公式">
  <input name="submittedAtClient" value="{time.strftime('%Y-%m-%dT%H:%M:%S')}">
  <input name="source" value="codex-live-endpoint-check">
  <input name="siteVersion" value="2026-07-09-rsvp-v2">
  <input name="userAgent" value="Codex Chrome endpoint smoke test">
</form>
<script>
  let done = false;
  window.addEventListener("message", (event) => {{
    if (!event.data || event.data.source !== "ray-catherine-rsvp") return;
    done = true;
    document.getElementById("status").textContent = JSON.stringify(event.data);
    navigator.sendBeacon("/report", new Blob([JSON.stringify(event.data)], {{ type: "application/json" }}));
  }});
  setTimeout(() => document.getElementById("f").submit(), 400);
  setTimeout(() => {{
    if (!done) navigator.sendBeacon("/report", new Blob([JSON.stringify({{ ok: false, error: "timeout_waiting_for_postMessage" }})], {{ type: "application/json" }}));
  }}, 15000);
</script>"""
            self.send_response(200)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.end_headers()
            self.wfile.write(html.encode("utf-8"))

    def do_POST(self):
        length = int(self.headers.get("Content-Length", "0") or "0")
        body = self.rfile.read(length).decode("utf-8", errors="replace")
        if self.path == "/report":
            reports.append(json.loads(body))
            self.send_response(204)
            self.end_headers()
            return
        self.send_response(404)
        self.end_headers()


def main():
    server = ThreadingHTTPServer(("127.0.0.1", PORT), Handler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    result = subprocess.run(
        [
            str(CHROME),
            "--headless=new",
            "--disable-gpu",
            "--no-sandbox",
            "--disable-dev-shm-usage",
            "--virtual-time-budget=18000",
            f"http://127.0.0.1:{PORT}/",
        ],
        cwd=ROOT,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
        timeout=30,
    )
    deadline = time.time() + 5
    while time.time() < deadline and not reports:
        time.sleep(0.2)
    server.shutdown()
    if not reports:
      raise RuntimeError(f"no report received, chrome exit={result.returncode}")
    print(json.dumps(reports[-1], ensure_ascii=False, indent=2))
    if not reports[-1].get("ok"):
        sys.exit(1)


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        print(f"live_endpoint_check: failed: {exc}", file=sys.stderr)
        sys.exit(1)
