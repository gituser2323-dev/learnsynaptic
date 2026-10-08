# Registrations → Google Sheet

Each landing-page registration (name, WhatsApp number, program, source, time) is copied to a Google Sheet.
The CRM (`/api/leads`) stays the source of truth; the sheet is a convenience copy.

## One-time setup

1. Create a Google Sheet. Name the first tab `Registrations`. Put these headers in row 1:
   `Submitted At | Name | WhatsApp | Program | Source`
2. In the sheet: **Extensions → Apps Script**. Replace the code with:

```js
const SECRET = "CHANGE_ME_TO_A_LONG_RANDOM_STRING"; // must equal GOOGLE_SHEET_WEBHOOK_SECRET

function doPost(e) {
  const data = JSON.parse(e.postData.contents);
  if (data.secret !== SECRET) {
    return ContentService.createTextOutput("forbidden").setMimeType(ContentService.MimeType.TEXT);
  }
  const sheet = SpreadsheetApp.getActive().getSheetByName("Registrations");
  // Prefix with ' so Sheets keeps the phone number as text.
  sheet.appendRow([data.submittedAt, data.name, "'" + data.phone, data.program, data.source]);
  return ContentService.createTextOutput("ok").setMimeType(ContentService.MimeType.TEXT);
}
```

3. **Deploy → New deployment → Web app**. Execute as: **Me**. Who has access: **Anyone**. Copy the web app URL.
4. Add to the server environment (`.env.local`, and your host's env settings):

```
GOOGLE_SHEET_WEBHOOK_URL=<the web app URL>
GOOGLE_SHEET_WEBHOOK_SECRET=<the same secret you put in the script>
```

5. Restart the app. Submit a test registration and check the sheet.

If `GOOGLE_SHEET_WEBHOOK_URL` is not set, the route does nothing and registrations still save to the CRM.
Never commit the URL or secret.
