# Budget Dashboard — v9

## What's new
- **No more pasting links each time**: Put your CSV URLs in **/public/config.json** (or use Netlify env vars `VITE_CATEGORIES_CSV_URL`, `VITE_INCOME_CSV_URL`, `VITE_BILLS_CSV_URL`). The app auto-loads them.
- **Write-back ready**: Add a `writebackUrl` in `config.json` to enable **append/update/delete** POSTs to Google Sheets via a webhook (see below).
- **Rent Log page** with summary and chart, plus properties/rentals pages.
- Dashboard: Top 5 & Top 20 spend categories and monthly mini-bars.

## How to connect to Google Sheets (read)
1. In your Google Sheet, **File → Share → Publish to web** each tab as **CSV**.
2. Open `public/config.json` and set:
```json
{
  "categoriesCsvUrl": "https://.../pub?gid=...&output=csv",
  "incomeCsvUrl": "https://.../pub?gid=...&output=csv",
  "billsCsvUrl": "https://.../pub?gid=...&output=csv",
  "writebackUrl": ""
}
```
3. Deploy. The app will auto-load from these URLs on first visit and every refresh.

## How to save changes **back** to Google Sheets (write)
**Option A — Google Apps Script (easiest):**
1. In Google Drive: **New → Apps Script**.
2. Paste this code and **Deploy → New deployment → Web app → Anyone with the link**:

```javascript
function doPost(e) {
  const body = JSON.parse(e.postData.contents);
  const sheetName = body.sheet; // e.g. "Bills", "Income", "Categories", "Properties", "Rentals", "RentLog"
  const row = body.row || {};
  const ss = SpreadsheetApp.openByUrl('PASTE_YOUR_SHEET_URL_HERE');
  const sh = ss.getSheetByName(sheetName);
  if (!sh) return ContentService.createTextOutput(JSON.stringify({ ok:false, error:'No sheet' }));

  // Simple append for demo; you can map fields to columns
  const headers = sh.getRange(1,1,1,sh.getLastColumn()).getValues()[0];
  const values = headers.map(h => row[h] ?? row[h.replace(/\s+/g,'')] ?? '');
  sh.appendRow(values);
  return ContentService.createTextOutput(JSON.stringify({ ok:true }))
      .setMimeType(ContentService.MimeType.JSON);
}
```

3. Copy the **web app URL** and put it into `public/config.json` as `"writebackUrl": "https://script.google.com/macros/s/.../exec"`.
4. Now when you **Add/Edit/Delete** rows in the app, it POSTs `{ sheet, row }` to that URL. Adjust the Apps Script to handle updates/deletes as you like.

**Option B — Netlify Function + Google Service Account (more control):**
- Create a Netlify Function that uses `googleapis` to call the Sheets API (requires a service account and sharing the Sheet with that account). Point `writebackUrl` to that function endpoint.
- This avoids exposing your Sheet URL or anonymous access.

## New tabs you might add to your Google Sheet
- `Properties`: Address, Purchase Price, Monthly Mortgage, Interest Rate %, Loan Start, Escrow/Taxes, Notes
- `Rentals`: Address, Tenant, Monthly Rent, Due Day, Deposit, Lease Start, Lease End, Status, Maintenance Notes, Expenses (Last 30d), Notes
- `RentLog`: Date, Property, Tenant, Amount, Method, Notes
```

Deploy: Netlify (build: `npm run build`, publish: `dist`)
