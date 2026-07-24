# Zentrid End User — v1.9.1

Standalone End User portal with the complete v1.8.1 Zentrid presentation layer restored exactly, including its spacing, cards, tables, drawers, responsive rules and Reports row layout fix.

## v1.9.1 correction

The v1.9 release incorrectly mixed API cleanup with page-renderer replacement. v1.9.1 restores the validated v1.8.1 HTML/CSS/rendering structure and keeps the official End User API adapter isolated from the presentation layer.

Official read endpoints used by the adapter:

- `GET /api/Auth/me`
- `GET /api/plants`
- `GET /api/devices`
- `GET /api/alerts`
- `GET /api/telemetry`

No `/api/admin/*` endpoint is used by `end-user-api.ts`.

## Run

```bash
npm ci
npm run start
```

Open `http://localhost:5050/login.html`.
## API-only conversion status

The End User Profile page reads identity data from `GET /api/Auth/me`. Browser-local profile, preference, notification, delivery and activity records are not used. Profile write controls remain visible but read-only until backend update endpoints are available.


## GitHub and Vercel deployment

This repository is ready for deployment as a static Vercel project.

1. Push the source repository to GitHub. Do not commit `node_modules`, `dist`, `.env`, or `.vercel`.
2. Import the GitHub repository into Vercel.
3. Vercel reads `vercel.json`, installs dependencies with `npm ci`, runs `npm run build:vercel`, and publishes `dist`.
4. Authentication requests are rewritten to `https://fleetosauth.unisys.am` and FleetOS data requests to `https://fleetosapi.unisys.am`.

Useful commands:

```bash
npm run verify:vercel
npm run build:vercel
npm run build
npm run start
```

`build:vercel` creates a static-only `dist` without `proxy-server.js`. The normal `build` and `start` commands keep the local Express proxy workflow unchanged.
