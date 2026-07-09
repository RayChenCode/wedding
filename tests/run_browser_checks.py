import json
import subprocess
import sys
import threading
import time
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import quote

ROOT = Path(__file__).resolve().parents[1]
SCREENSHOTS = ROOT / "test-results" / "screenshots"
CHROME = Path(r"C:\Program Files\Google\Chrome\Application\chrome.exe")
PORT = 8765

reports = []


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def log_message(self, format, *args):
        return

    def do_POST(self):
        length = int(self.headers.get("Content-Length", "0") or "0")
        body = self.rfile.read(length).decode("utf-8", errors="replace")
        if self.path == "/browser-report":
            reports.append(json.loads(body))
            self.send_response(204)
            self.end_headers()
            return
        self.send_response(404)
        self.end_headers()


def run_chrome(args, timeout=45):
    base = [
        str(CHROME),
        "--headless=new",
        "--disable-gpu",
        "--no-sandbox",
        "--disable-dev-shm-usage",
        "--hide-scrollbars",
    ]
    return subprocess.run(base + args, cwd=ROOT, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=timeout)


def screenshot(name, width, height, url):
    path = SCREENSHOTS / name
    result = run_chrome(
        [
            f"--window-size={width},{height}",
            "--force-device-scale-factor=1",
            "--virtual-time-budget=10000",
            f"--screenshot={path}",
            url,
        ],
        timeout=60,
    )
    if result.returncode != 0:
        raise RuntimeError(f"Chrome screenshot failed for {name}: {result.stderr}")
    if not path.exists() or path.stat().st_size < 10_000:
        raise RuntimeError(f"Screenshot missing or too small: {path}")
    return str(path)


def main():
    if not CHROME.exists():
        raise SystemExit(f"Chrome not found: {CHROME}")

    SCREENSHOTS.mkdir(parents=True, exist_ok=True)
    server = ThreadingHTTPServer(("127.0.0.1", PORT), Handler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()

    base_url = f"http://127.0.0.1:{PORT}/"
    report_url = quote(f"{base_url}browser-report", safe="")
    test_url = f"{base_url}tests/browser-tests.html?report={report_url}"

    run_chrome(
        [
            "--window-size=390,844",
            "--virtual-time-budget=9000",
            "--screenshot=" + str(SCREENSHOTS / "browser-test-run.png"),
            test_url,
        ],
        timeout=60,
    )

    deadline = time.time() + 8
    while time.time() < deadline and not reports:
        time.sleep(0.2)

    if not reports:
        raise RuntimeError("Browser test report was not received")
    if not reports[-1].get("ok"):
        raise RuntimeError("Browser tests failed: " + json.dumps(reports[-1], ensure_ascii=False))

    shots = [
        ("desktop-home.png", 1366, 768, base_url),
        ("desktop-schedule.png", 1366, 768, base_url + "?testView=schedule#schedule"),
        ("desktop-form.png", 1366, 768, base_url + "?testView=form#rsvp"),
        ("mobile-home.png", 390, 844, base_url),
        ("mobile-form.png", 390, 844, base_url + "?testView=form#rsvp"),
        ("form-validation-error.png", 390, 844, base_url + "?testView=form-error#rsvp"),
        ("form-success.png", 390, 844, base_url + "?mockRsvp=success&testView=form-success#rsvp"),
    ]
    paths = [screenshot(*shot) for shot in shots]

    server.shutdown()
    print(json.dumps({"browser_checks": "ok", "screenshots": paths, "results": reports[-1]}, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        print(f"browser_checks: failed: {exc}", file=sys.stderr)
        sys.exit(1)
