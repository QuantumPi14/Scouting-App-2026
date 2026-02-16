/**
 * Admin password for the scouting app. Set via environment variable
 * VITE_ADMIN_PASSWORD (e.g. in .env.local for dev, or in your host's
 * env vars for production). Required to access the Admin tab (add
 * competitions/teams, export config QR, delete submissions).
 */
export const ADMIN_PASSWORD: string =
  typeof import.meta.env.VITE_ADMIN_PASSWORD === 'string'
    ? import.meta.env.VITE_ADMIN_PASSWORD
    : ''
