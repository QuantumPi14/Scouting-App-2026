# Umoja Robotics Scouting App v0.0

FRC scouting app that works offline. Data can be shared via QR codes.

## Setup

1. `npm install`
2. Add the 2026 field image: place your field map image at **`public/field-2026.png`** (same image you provided for the auto path feature).
3. **Admin password**: edit **`src/admin/config.ts`** and set `ADMIN_PASSWORD` to your chosen password.
4. `npm run dev` to start the dev server.

## Build & deploy

- `npm run build` ? output in `dist/`
- Deploy the `dist/` folder to any static host (Vercel, Netlify, GitHub Pages, etc.). Use HTTPS.
- Share the app URL with your team. They open it once (ideally on Wi?Fi), then can use it offline.
- **Update app**: After you redeploy, users get the new version when they tap **Update app** in the header.

## First use

1. Open **Admin**, enter the password, then add a competition (e.g. Durham) and paste team numbers (and optional names), one per line: `7712, Umoja` or `7712`. Save.
2. On the home page, select the competition, then search by team number or match number. Open a team ? **Current data** or **Add data**.
3. **Create QR** (from Home) exports scout data. **Scan QR** imports data. From Admin, **Export config QR** exports only competitions and team lists for others to scan.

## After you deploy

- Host the `dist/` folder on a static host with HTTPS (e.g. Vercel, Netlify).
- Share the app URL with your team. They open it once (on Wi-Fi), then can use it offline.
- To change the **admin password**, edit `src/admin/config.ts` (see `ADMIN_PASSWORD`) and redeploy.
- After you redeploy a new version, users see **Update app** in the header when a new version is available; they tap it to refresh.
