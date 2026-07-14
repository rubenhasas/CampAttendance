# Prezenta Tabara - QR Attendance Scanner

A simple, browser-based QR attendance system for a kids' summer camp. Volunteers scan QR codes on name tags to mark attendance in a Google Sheet.

## Architecture

1. **Google Sheet** — database (attendance table + scan log)
2. **Google Apps Script** — backend API (doPost/doGet)
3. **Static frontend** — scanner + admin pages (GitHub Pages)
4. **Python script** — QR name tag PDF generator

## Setup Checklist

### 1. Create the Google Sheet

Create a new Google Spreadsheet named `Prezenta Tabara 2026`.

**Tab "Prezenta"** — headers in row 1:

| A | B | C | D | E | F | G | H | I | J | K | L |
|---|---|---|---|---|---|---|---|---|---|---|---|
| ID | Prenume | Nume | Echipa | Varsta | Sex | Localitate | Luni | Marti | Miercuri | Joi | Vineri |

Pre-fill column A with all generated IDs (1000, 1001, ...). Other columns can be filled in as kids arrive.

**Tab "Log"** — headers in row 1:

| A | B | C | D | E |
|---|---|---|---|---|
| Timestamp | ID | Nume | Zi | Status |

### 2. Deploy Google Apps Script

1. In the spreadsheet, go to **Extensions > Apps Script**
2. Delete any existing code, paste the contents of `Code.gs`
3. Click the gear icon (Project Settings), check "Show appsscript.json manifest file", then replace its contents with the provided `appsscript.json`
4. Click **Deploy > New deployment**
5. Type: **Web app**
6. Execute as: **Me**
7. Who has access: **Anyone**
8. Click **Deploy**, authorize when prompted
9. Copy the Web App URL (ending in `/exec`)

**Important:** After any code change, go to **Deploy > Manage deployments > Edit** (pencil icon) > set Version to **New version** > Deploy. If you don't create a new version, changes won't take effect.

### 3. Configure the Frontend

Edit `config.js`:
```js
const API_URL = "https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec";
const SHEET_URL = "https://docs.google.com/spreadsheets/d/YOUR_SHEET_ID/edit";
const ADMIN_PASS = "tabara2026";  // change if desired
```

### 4. Host on GitHub Pages

1. Create a public GitHub repo
2. Push all frontend files (`index.html`, `admin.html`, `config.js`, `style.css`)
3. Go to **Settings > Pages**, deploy from `main` branch, root `/`
4. Your scanner URL will be: `https://YOUR_USERNAME.github.io/YOUR_REPO/`

### 5. Generate Name Tags

```bash
pip install "qrcode[pil]" reportlab
python generate_tags.py --start 1000 --count 80 --csv
```

This generates:
- `nametags.pdf` — A4 pages with 8 tags each (blank tags with QR code + ID number)
- `kids.csv` — skeleton CSV to paste into the Sheet's Prezenta tab

Print the PDF, cut the tags, laminate them. Write kids' names with permanent marker at check-in.

## Day-of-Event Cheat Sheet for Volunteers

1. Open the scanner URL on your phone (bookmark or scan the volunteer QR)
2. Tap **"Porneste scanarea"** and allow camera access
3. Point camera at the kid's name tag QR code
4. Green banner = success, move to next kid
5. Yellow banner = already scanned today (no action needed)
6. Red banner = unknown ID (check the tag number)
7. If the QR won't scan, use the manual ID entry at the bottom

## Testing on Weekends

The system only works Monday–Friday by default. To test on weekends, add `?day=Luni` to the API URL in your POST, or modify the Apps Script call. The frontend sends to the API directly, so for testing you can temporarily modify the `sendId` function to append `?day=Luni` to the API_URL.

## Troubleshooting

| Problem | Solution |
|---|---|
| Camera permission denied | Open phone Settings > Chrome > Permissions > Camera > Allow. The page must be served over HTTPS. |
| "Eroare retea" | Check internet connection. Verify API_URL in config.js is correct. |
| Changes to Apps Script not working | You must create a **new version** in Manage Deployments. |
| QR codes won't scan | Ensure tags are printed clearly. Try manual ID entry as fallback. |
| Wrong day column updated | Check that the spreadsheet's timezone and the script's timezone are both Europe/Bucharest. |

## Files

```
index.html          — Scanner page (main volunteer interface)
admin.html          — Admin page (log viewer, attendance summary)
config.js           — Configuration (API URL, Sheet URL, admin password)
style.css           — Shared styles
Code.gs             — Google Apps Script backend (paste into Apps Script editor)
appsscript.json     — Apps Script manifest (timezone config)
generate_tags.py    — Python script to generate name tag PDF
PLAN.md             — Original project plan
```
