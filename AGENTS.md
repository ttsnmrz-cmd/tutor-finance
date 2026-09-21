# Base44 Dev Environment

## Overview
This is a **static single-page HTML app** (`index.html`) — a tutor CRM ("Tutor Finance").
No build step, no package manager, no framework CLI. The entire app is one self-contained HTML file.

## Stack
- **Frontend**: Plain HTML + inline JavaScript, Tailwind CSS via CDN, Supabase JS client via CDN.
- **Backend**: Remote Supabase project (`https://dmasuczggcxzrxasgoov.supabase.co`) — URL and publishable key are hardcoded in `index.html`. No local database.
- **Schema**: `supabase/migrations/001_crm_v1.sql` defines the tables; already applied on the remote project.

## Running
```
docker compose -f docker-compose.base44.yml up -d
```
Serves `index.html` via nginx on host port 3000. The app talks to the remote Supabase directly from the browser.

## Editing
Edit `index.html` directly. Changes are served immediately from the bind-mounted volume; call `reload_preview` to refresh the browser (no HMR/dev server).

## PWA / Mobile
The app is installable as a Progressive Web App:
- `manifest.json` — web app manifest (name, icons, theme color, standalone display)
- `sw.js` — service worker (cache-first offline support)
- `icon.svg` — app icon (graduation cap on indigo gradient, maskable)
- `index.html` `<head>` — PWA meta tags, manifest link, SW registration
- Mobile bottom navigation bar (`md:hidden`) replaces the desktop header nav on screens < 768px

## Secrets
None required — the Supabase publishable key is embedded in the HTML and the database is hosted remotely.
