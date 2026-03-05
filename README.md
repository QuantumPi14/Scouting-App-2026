# Umoja Robotics Scouting App (2026)

Offline‑first web app for FRC‑style scouting, built for use by many scouts across multiple events. It runs entirely in the browser (PWA) and stores data locally, with QR codes and JSON files for sharing between devices.

## Live app & Admin

- **Admin password**: `Georgio`
- Use Admin to:
  - Add/edit competitions and team lists
  - Load/clear demo “Test” data for practice
  - Export config QR to give everyone the same competitions/teams

## Key features

- **Offline‑first PWA** – works in the stands with no network.
- **Scouting form**
  - Pit stats (drivetrain, climb info, intake, etc.)
  - Game stats with 2 periods of hub scoring (robot + human player)
  - Auto path markers on a field image (start/end/waypoints) with gallery replay.
- **Data sharing**
  - Chunked **QR codes** for config + scouting data (v2 CBOR payload, header+records).
  - **JSON export/import**:
    - From Create QR page: export filtered scouting data as a `.json` file.
    - On Scan QR page: “Import JSON file” to merge a `.json` export.
    - On iOS, JSON export works with the system share sheet (e.g. AirDrop).

## Getting started (local dev)

Requires Node 18+.

```bash
git clone https://github.com/<your-org-or-user>/Scouting-App-2026.git
cd Scouting-App-2026
npm install
npm run dev

You can make your own edits like changing the password, editing data parameters, etc by cloning and running the app yourself. 

This just means you'd  have to set up the deployment as well (if you don't know how, use vercel, it's free).