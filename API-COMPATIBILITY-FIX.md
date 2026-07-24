# End User API compatibility fix

The deployed backend Swagger exposes these authenticated resources used by the End User portal:

- `GET /api/Auth/me`
- `GET /api/plants`
- `GET /api/devices`
- `GET /api/alerts`
- `GET /api/telemetry`

The deployed backend does not expose `/api/EndUser/*` or `/api/Ui/dashboard`. The frontend adapter therefore no longer sends requests to those known-missing routes.

Current mapping:

- Overview / My Plant: composed from Plants, Devices, Alerts and Telemetry.
- Devices: `/api/devices`.
- Alerts: `/api/alerts`.
- Energy: `/api/telemetry` (only explicit returned energy/power values are displayed).
- Profile: `/api/Auth/me`.
- Reports, dedicated Dashboard/Overview, Sales/Settlements: empty/read-only until backend endpoints are provided.

No HTML or CSS files were changed by this compatibility patch.
