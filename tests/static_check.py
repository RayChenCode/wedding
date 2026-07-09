import json
import re
import subprocess
import sys
from html.parser import HTMLParser
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
HTML = ROOT / "index.html"


class PageParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.ids = []
        self.labels = []
        self.inputs = []
        self.resources = []
        self.pictures = 0

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if "id" in attrs:
            self.ids.append(attrs["id"])
        if tag == "label" and "for" in attrs:
            self.labels.append(attrs["for"])
        if tag in {"input", "select", "textarea"}:
            self.inputs.append((tag, attrs))
        if tag in {"script", "img", "source"} and attrs.get("src"):
            self.resources.append(attrs["src"])
        if tag == "link" and attrs.get("href"):
            rel = attrs.get("rel", "")
            if "stylesheet" in rel or "icon" in rel:
                self.resources.append(attrs["href"])
        if tag == "picture":
            self.pictures += 1


def fail(message):
    print(f"FAIL: {message}")
    return False


def ffprobe_image(path):
    result = subprocess.run(
        [
            "ffprobe",
            "-v",
            "error",
            "-select_streams",
            "v:0",
            "-show_entries",
            "stream=width,height",
            "-of",
            "json",
            str(path),
        ],
        capture_output=True,
        text=True,
        check=True,
    )
    data = json.loads(result.stdout)
    stream = data["streams"][0]
    return int(stream["width"]), int(stream["height"])


def main():
    ok = True
    parser = PageParser()
    parser.feed(HTML.read_text(encoding="utf-8"))

    seen = set()
    duplicates = sorted({item for item in parser.ids if item in seen or seen.add(item)})
    if duplicates:
        ok = fail(f"duplicate ids: {duplicates}") and ok

    input_ids = {attrs.get("id") for _, attrs in parser.inputs if attrs.get("id")}
    for label_for in parser.labels:
        if label_for not in input_ids:
            ok = fail(f"label target missing: {label_for}") and ok

    for tag, attrs in parser.inputs:
        if tag != "input" or attrs.get("type") not in {"hidden", "radio"}:
            if not attrs.get("name"):
                ok = fail(f"form control missing name: {attrs}") and ok

    for src in sorted(set(parser.resources)):
        if src.startswith(("http://", "https://", "data:")):
            continue
        clean = src.split("#", 1)[0].split("?", 1)[0]
        if not (ROOT / clean).exists():
            ok = fail(f"missing resource: {src}") and ok

    html_text = HTML.read_text(encoding="utf-8")
    for match in re.finditer(r'<img\b[^>]*src="([^"]+)"[^>]*>', html_text):
        tag = match.group(0)
        src = match.group(1)
        if "width=" not in tag or "height=" not in tag:
            ok = fail(f"image missing width/height: {src}") and ok
        image_path = ROOT / src
        try:
            width, height = ffprobe_image(image_path)
            if width <= 0 or height <= 0:
                ok = fail(f"invalid image dimensions: {src}") and ok
        except Exception as exc:
            ok = fail(f"unreadable image {src}: {exc}") and ok

    if parser.pictures < 4:
        ok = fail("expected WebP picture fallbacks") and ok

    if "https://script.google.com/macros/s/" not in (ROOT / "script.js").read_text(encoding="utf-8"):
        ok = fail("Apps Script URL missing from script.js") and ok

    if not ok:
        sys.exit(1)
    print("static_check: ok")


if __name__ == "__main__":
    main()
