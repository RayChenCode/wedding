# Ray & Catherine Wedding Invitation

Static wedding invitation site for GitHub Pages, with RSVP submissions written to Google Sheets through Google Apps Script.

## Google Apps Script deployment

The site is currently wired to this Web App URL:

`https://script.google.com/macros/s/AKfycbzdbZC5vQkFboX_W12WJ1HukfJEf910LTfAYBIDyeeRCI2VmGu7kAE-BTZnYWyxP5Dv5Q/exec`

To redeploy or replace the endpoint:

1. Open the RSVP spreadsheet:
   `https://docs.google.com/spreadsheets/d/1voXmpkEP9IWwU3OPWjYzK-gXRI6chlp-kQ7fReloNfE/edit`
2. Go to `Extensions` -> `Apps Script`.
3. Paste the contents of `apps-script/Code.gs` into the Apps Script editor.
4. Click `Deploy` -> `New deployment`.
5. Select type `Web app`.
6. Set:
   - Execute as: `Me`
   - Who has access: `Anyone`
7. Deploy and authorize permissions.
8. Copy the Web App URL.
9. Replace `APPS_SCRIPT_WEB_APP_URL` in `script.js` with that URL.

## Local preview

Open `index.html` directly in a browser, or serve this folder with any static file server.

## GitHub Pages

Publish from the `main` branch root. The final URL should be:

`https://raychencode.github.io/wedding/`
