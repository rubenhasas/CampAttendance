# Changelog

## 2026-07-14 — Initial Build

### Created
- **Google Apps Script backend** (`Code.gs`, `appsscript.json`)
  - `doPost`: scan ID, mark attendance (HH:mm) in the day column, log to Log tab
  - `doGet`: actions `ping`, `log`, `attendance` returning JSON
  - LockService for concurrent scan safety
  - Weekend detection with `?day=` override for testing
  - Handles empty names (tags assigned before kids registered)
- **Scanner page** (`index.html`)
  - QR scanning via html5-qrcode library (rear camera)
  - Color-coded banners: green (OK), yellow (duplicate), red (error)
  - Manual ID entry fallback
  - Live attendance counter ("Prezenti azi: X / Total"), refreshes after each scan
  - Vibration feedback on success
- **Admin page** (`admin.html`)
  - Three tabs: Prezenta (default), Statistici, Log
  - Prezenta: sortable attendance table (click column headers), columns: ID, Prenume, Nume, Echipa, Varsta, Sex, Lu-Vi
  - Statistici: breakdown tables per day for Total, Echipe, Sex, Varsta, Localitate — each with a Total row
  - Log: scan log with status filter (OK/DUPLICAT/ID_NECUNOSCUT)
- **Shared styles** (`style.css`) — mobile-first, large touch targets
- **Config** (`config.js`) — API URL, Sheet URL
- **Python tag generator** (`generate_tags.py`)
  - Generates A4 PDF with landscape tags (90x63mm), 2x4 grid (8/page)
  - QR code with error correction H, large ID digits below
  - Blank space for marker-written names
  - Optional `--csv` flag to generate skeleton kids.csv
- **README.md** — full setup guide, volunteer cheat sheet, troubleshooting
- **GitHub Pages** deployment workflow

### Google Sheet structure
- Tab `Prezenta`: ID, Prenume, Nume, Echipa, Varsta, Sex, Localitate, Luni-Vineri
- Tab `Log`: Timestamp, ID, Nume, Zi, Status

### Decisions
- No authentication on API (accepted trade-off)
- No admin password (removed after initial implementation)
- Frontend sends POST as `Content-Type: text/plain` to avoid CORS preflight
- Tags are printed blank (no names), laminated, names written with marker at check-in
- Day columns show HH:mm scan time (parsed from Date objects in the Sheet)
