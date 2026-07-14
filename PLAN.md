# PLAN: Kids Summer Event Attendance Scanner (QR + Google Sheets)

## Goal

Build a simple, browser-based QR attendance system for a kids' summer event running **Monday–Friday (one week)**. Volunteers open a web page on their phones, scan a QR code on a kid's name tag, and the kid is marked present for the current day in a Google Sheet. No real security needed — this is a low-stakes internal tool. Priorities: **simple, reliable, easy to maintain, free hosting**.

Language of the UI: **Romanian** (event is in Romania). Timezone: **Europe/Bucharest**.

---

## Architecture Overview

Three components:

1. **Google Sheet** — the database (attendance table + scan log).
2. **Google Apps Script Web App** — the backend API attached to the sheet. Deployed as "Execute as: Me", "Who has access: Anyone". Exposes:
   - `doPost` → record a scan
   - `doGet` → return the log / attendance data as JSON (for the admin view)
3. **Static frontend (single-page HTML/JS)** — hosted on **GitHub Pages** (HTTPS is required for camera access). Uses the `html5-qrcode` library for scanning. Calls the Apps Script URL.

**Important constraint:** Do NOT serve the scanner page from Apps Script's own `HtmlService` — its sandboxed iframe frequently blocks camera access on mobile. The frontend must be a static page on GitHub Pages (or any HTTPS static host), calling Apps Script as an API.

Additionally, a **QR name-tag generator**: a Python script that takes the kid list (CSV) and produces a printable A4 PDF of name tags (name + QR code containing only the numeric ID).

---

## Component 1: Google Sheet

Create a spreadsheet named `Prezenta Tabara 2026` with two tabs:

### Tab `Prezenta` (attendance)
| Column | Content |
|---|---|
| A | `ID` (numeric, e.g. 1000, 1001, ...) |
| B | `Nume` (kid's full name) |
| C | `Luni` |
| D | `Marti` |
| E | `Miercuri` |
| F | `Joi` |
| G | `Vineri` |

- On a successful scan, write the **scan time** (`HH:mm`) into the cell for today's column. This doubles as a "P" marker and gives arrival time for free.
- Row 1 = headers. Kid data starts at row 2.

### Tab `Log`
| Column | Content |
|---|---|
| A | `Timestamp` (full date-time, Europe/Bucharest) |
| B | `ID` |
| C | `Nume` |
| D | `Zi` (Luni/Marti/...) |
| E | `Status` (`OK`, `DUPLICAT`, `ID_NECUNOSCUT`) |

Every scan attempt appends a row here — including duplicates and unknown IDs. The log is never overwritten.

---

## Component 2: Google Apps Script Backend

File: `Code.gs` (bound to the spreadsheet). Provide the full code and step-by-step deployment instructions.

### Requirements

- **Script timezone**: set to `Europe/Bucharest` (in `appsscript.json`: `"timeZone": "Europe/Bucharest"`).
- **`doPost(e)`** — expects JSON body `{ "id": "1000" }` (also accept form-encoded / URL parameter fallback, since simple CORS requests are easier). Logic:
  1. Acquire `LockService.getScriptLock()` (wait up to 10 s) to prevent concurrent-write collisions from multiple scanners.
  2. Determine current weekday. If Saturday/Sunday, return `{status: "weekend"}` (or accept a `?day=` override parameter for testing).
  3. Look up the ID in `Prezenta` column A.
     - Not found → append `ID_NECUNOSCUT` row to `Log`, return `{status: "unknown_id", id: ...}`.
  4. If today's cell is already filled → append `DUPLICAT` row to `Log`, return `{status: "duplicate", name: ..., time: <original scan time>}`.
  5. Otherwise write `HH:mm` into today's cell, append `OK` row to `Log`, return `{status: "ok", name: ..., time: ...}`.
- **`doGet(e)`** — routing by parameter:
  - `?action=log` → return the entire `Log` tab as JSON (most recent first).
  - `?action=attendance` → return the `Prezenta` tab as JSON (for a summary table in the admin view).
  - `?action=ping` → return `{status: "ok"}` (used by frontend to verify the URL is configured correctly).
- **CORS**: return `ContentService.createTextOutput(JSON.stringify(...)).setMimeType(ContentService.MimeType.JSON)`. To avoid CORS preflight problems, the frontend should send the POST as `Content-Type: text/plain` with a JSON string body (this is a well-known Apps Script workaround — a plain-text POST is a "simple request" and needs no preflight). Apps Script `doPost` then parses `e.postData.contents` manually.
- No authentication on the API. Accepted trade-off per project owner.

### Deployment instructions to include in the deliverable

1. Extensions → Apps Script, paste code.
2. Deploy → New deployment → Web app → Execute as **Me**, access **Anyone**.
3. Copy the `/exec` URL — this goes into the frontend config.
4. Note: every code change requires **Deploy → Manage deployments → Edit → New version** (a common gotcha; document it).

---

## Component 3: Frontend (GitHub Pages)

A small static site, plain HTML + vanilla JS (no build step, no framework). Files:

```
index.html      → scanner page
admin.html      → log / attendance viewer
config.js       → single line: const API_URL = "https://script.google.com/.../exec";
style.css
```

### Scanner page (`index.html`)

- Library: `html5-qrcode` from CDN (https://unpkg.com/html5-qrcode).
- Big **"Pornește scanarea"** button → starts the rear camera (`facingMode: "environment"`).
- On successful decode:
  1. Immediately **pause scanning** (prevent rapid re-reads of the same code).
  2. Validate the payload: must be a 3–5 digit number. Ignore anything else.
  3. POST to `API_URL`, show a spinner ("Se înregistrează...").
  4. Show a **full-width colored result banner**, large text, readable in sunlight:
     - 🟢 Green: `✓ {Nume} — prezent ({Zi}, {ora})` + short success beep/vibration (`navigator.vibrate`).
     - 🟡 Yellow: `{Nume} a fost deja scanat azi la {ora}` (duplicate — harmless).
     - 🔴 Red: `ID necunoscut: {id}` or network error message.
  5. Banner shows for ~2.5 s (or until tapped), then scanning resumes automatically. The flow must support a **fast check-in line**: scan → green → next kid, no extra taps.
- **Manual fallback**: below the camera, a numeric input + "Marchează prezent" button, for damaged/unreadable tags. Goes through the same POST.
- A small footer link: **"Deschide Google Sheet"** (direct link to the spreadsheet, from config) and **"Admin"** (link to admin.html).
- Mobile-first layout, large touch targets, works on cheap Android phones in Chrome.

### Admin page (`admin.html`)

- Trivial gate: a password prompt compared against a hardcoded constant in `config.js` (e.g. `ADMIN_PASS = "tabara2026"`), remembered in `sessionStorage`. This is cosmetic, not security — that's fine.
- Two views (tabs or buttons):
  1. **Log**: fetch `?action=log`, render as table (Timestamp, ID, Nume, Zi, Status), newest first, with a refresh button and a status filter.
  2. **Prezența pe zile**: fetch `?action=attendance`, render the full table + a per-day count (`Prezenți azi: N`).
- Button linking to the actual Google Sheet.

### Hosting

- Create a public GitHub repo, enable GitHub Pages (deploy from `main` branch, root).
- Document the resulting URL; suggest generating one QR code pointing to the scanner URL itself, to print for volunteers so they can open the app instantly.

---

## Component 4: Name Tag / QR Generator (Python)

Script: `generate_tags.py`

**Tag concept — IMPORTANT:** tags are printed **blank (no names)**, laminated in advance, and the kid's name is written on top with a permanent marker at check-in when the kid first shows up. This means new/unexpected kids can be onboarded on the spot: grab any unused tag, write the name, and register the tag's ID → name in the Google Sheet. Therefore the tag design is:

- A **large blank area** (most of the tag) reserved for the marker-written name.
- The **QR code** in a corner (e.g. bottom-right), encoding ONLY the numeric ID as plain text (e.g. `1001`). Error correction level **H** (tags get crumpled, and marker ink might stray near the code).
- The **ID printed in clear, large, bold digits directly under (or beside) the QR code** — e.g. `1001` at ~14–18 pt. This is essential: it lets a human instantly know which ID a physical tag corresponds to, both when registering a new kid in the sheet and for manual entry if the QR won't scan. A thin border/quiet zone around the QR so marker writing doesn't touch it.

Details:

- Input: no name list needed. The script takes a **count and starting ID** (e.g. `--start 1000 --count 80`) and generates that many sequential tags. Optionally also emit a `kids.csv` skeleton (`id,name` with names empty) matching the generated range, to paste into the Google Sheet's `Prezenta` tab.
- Libraries: `qrcode[pil]`, `reportlab` (PDF layout).
- Output: `nametags.pdf` — A4 pages, grid of tags (suggest 2 columns × 4 rows = 8 tags/page, each ~90×60 mm, with cut lines).

**Backend implication:** because tags exist before kids are assigned to them, the `Prezenta` tab should be pre-filled with ALL generated IDs and empty names. When a scanned ID has an empty name, the backend should still mark attendance and return `{status: "ok", name: ""}`; the frontend shows 🟢 `✓ ID {id} — prezent` plus a hint: `Nume negăsit în tabel — completează numele în Sheet`. This way a brand-new kid can be scanned immediately and the name filled in the sheet whenever convenient. (`ID_NECUNOSCUT` remains only for IDs outside the generated range.)

---

## Build Order / Task Breakdown

1. **Sheet**: define structure (can be created manually; provide exact headers to paste).
2. **Apps Script**: write `Code.gs` + `appsscript.json`, with deployment README.
3. **Frontend**: `index.html`, `admin.html`, `config.js`, `style.css`. Test scanner with a QR generated online containing `1000`.
4. **Tag generator**: `generate_tags.py` + sample `kids.csv` (a few dummy Romanian names) + instructions (`pip install qrcode[pil] reportlab`).
5. **README.md** for the whole project: setup checklist in order (create sheet → deploy script → put URL in config.js → push to GitHub Pages → generate tags → print), plus a "day-of-event" cheat sheet for volunteers and troubleshooting section (camera permission denied, wrong deployment version, weekend testing override).

## Testing Checklist (acceptance criteria)

- [ ] Scanning a valid ID marks today's column with the time and shows the green banner in <3 s.
- [ ] Scanning the same ID again shows the yellow "already scanned" banner and does NOT overwrite the original time.
- [ ] An unknown ID shows red banner and is logged as `ID_NECUNOSCUT`.
- [ ] Two phones scanning different kids at the same time both succeed (LockService works).
- [ ] Manual ID entry works identically to scanning.
- [ ] Admin page shows the log and per-day attendance counts after password entry.
- [ ] `?day=Luni` test override works so the system can be tested on a weekend before the event.
- [ ] Generated PDF prints correctly on A4; QR codes scan reliably from paper, including slightly bent/laminated tags.
- [ ] Each tag shows its ID in clear, large digits next to the QR code, and has ample blank space for a marker-written name.
- [ ] Scanning an ID with an empty name in the sheet still marks attendance and shows the "completează numele" hint.
- [ ] Romanian diacritics (ș, ț, ă, â, î) render correctly in banners and in the sheet.

## Explicit Non-Goals

- No real authentication/authorization, no user accounts, no rate limiting.
- No offline mode (assume phones have mobile data / Wi-Fi).
- No native app, no frameworks, no build tooling — plain static files only.
- No editing/undo in the app; corrections are done directly in the Google Sheet.
