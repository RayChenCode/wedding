# Ray & Catherine Wedding Invitation

Pure static wedding invitation site for GitHub Pages. The site uses local wedding photos, a hand-drawn paper invitation style, an in-page RSVP form, and Google Apps Script to write submissions to Google Sheets.

Production URL:

`https://raychencode.github.io/wedding/`

RSVP spreadsheet:

`https://docs.google.com/spreadsheets/d/1voXmpkEP9IWwU3OPWjYzK-gXRI6chlp-kQ7fReloNfE/edit`

## Structure

- `index.html` - static page markup
- `styles.css` - responsive invitation styling
- `script.js` - carousel, countdown, validation, conditional RSVP fields, and submission
- `apps-script/Code.gs` - Google Apps Script Web App backend
- `assets/photos/` - JPEG fallback images
- `assets/photos-webp/` - WebP optimized images
- `tests/` - local static and browser smoke tests

## RSVP fields

The form writes these columns to Google Sheets:

- 建立時間
- 姓名
- 手機
- 是否出席證婚
- 是否出席午宴
- 出席人數
- 飲食需求
- 素食人數
- 同行賓客明細
- 特殊飲食
- 是否需要兒童椅
- 兒童椅數量
- 交通需求
- 祝福留言
- 前端送出時間
- 來源
- 網站版本
- User Agent

## Google Apps Script deployment

The frontend is configured to post to:

`https://script.google.com/macros/s/AKfycbzdbZC5vQkFboX_W12WJ1HukfJEf910LTfAYBIDyeeRCI2VmGu7kAE-BTZnYWyxP5Dv5Q/exec`

To update the backend:

1. Open the RSVP spreadsheet.
2. Go to `Extensions` -> `Apps Script`.
3. Replace `Code.gs` with `apps-script/Code.gs`.
4. Click Save.
5. Click `Deploy` -> `Manage deployments`.
6. Edit the Web App deployment.
7. Select `New version`.
8. Confirm:
   - Execute as: `Me`
   - Who has access: `Anyone`
9. Deploy and keep using the `/exec` Web App URL.

The Apps Script backend uses a field whitelist, required-field validation, honeypot handling, header initialization, locked append writes, JSON/HTML responses, and spreadsheet formula-injection protection.

The RSVP form collects attendee details per person. The first attendee is the respondent, and additional family members can be added in the form. The frontend sends a `guestDetails` summary, while Apps Script recalculates total attendee count, vegetarian count, meal summary, and allergy summary before writing to the sheet.

## Local preview

Open `index.html` directly in a browser, or serve the folder with:

```powershell
python -m http.server 8000
```

Then open `http://localhost:8000/`.

## Tests

Static resource and HTML checks:

```powershell
python tests/static_check.py
```

Browser DOM smoke test with Chrome headless:

```powershell
& "C:\Program Files\Google\Chrome\Application\chrome.exe" --headless=new --disable-gpu --allow-file-access-from-files --dump-dom "file:///C:/Users/miser/claude_workspace/form_%E7%B5%90%E5%A9%9A%E8%A1%A8%E5%96%AE/tests/browser-tests.html"
```

Screenshots are generated under:

`test-results/screenshots/`

## GitHub Pages

Publish from:

- branch: `main`
- folder: `/`

Expected URL:

`https://raychencode.github.io/wedding/`
