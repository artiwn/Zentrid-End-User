# Zentrid — TypeScript frontend

Zentrid is maintained from TypeScript source and deploys from GitHub to Vercel. The existing interface, routes and API behavior are preserved.



## Pagination Collision & Edit Restoration (v140)

- Pagination controls are isolated into non-overlapping groups.
- Client, Tenant, Plant and Integration live records support explicit browser-only local overrides for editable sections.
- Archived and operational read-only sections remain protected.

See [Pagination collision and edit restoration v140](docs/PAGINATION_EDIT_RESTORATION_V140.md).

## Security Hardening & Browser Policy (v139)

- Auth credentials are tab-scoped in `sessionStorage`; legacy persistent tokens are migrated and removed.
- Vercel and local proxy builds send CSP, framing, MIME, referrer and permissions headers.
- Dynamic links/forms are audited for unsafe protocols and reverse-tabnabbing.
- Strict report-only CSP records remaining inline handler/style debt without breaking the prototype.
- Safe release diagnostics include `ZentridBrowserSecurity.snapshot()` without exporting credential values.

See [Security hardening and browser policy v139](docs/SECURITY_HARDENING_BROWSER_POLICY_V139.md).

## Release Readiness & Production Observability (v138)

Every build now publishes versioned release metadata and every Zentrid page exposes a safe runtime diagnostics panel. The panel reports build/environment information, navigation and resource performance, current freshness/session/form state, recent frontend errors and deployment update availability without exposing tokens, passwords, cookies or credentials. Run `npm run check:release-readiness-observability`. See `docs/RELEASE_READINESS_OBSERVABILITY_V138.md`.

## Error Recovery & Session Resilience (v137)

Zentrid now retries only safe read requests after transient network/server failures, fails fast while offline, coordinates refresh-token work across browser tabs, synchronizes logout/session changes, propagates mutation cache invalidation, and safely removes corrupt persisted cache entries. Run `npm run check:error-recovery-session-resilience`. See `docs/ERROR_RECOVERY_SESSION_RESILIENCE_V137.md`.

## Mutation result foundation (v110)

Active Client, Tenant, Plant and Integration pages now load `assets/js/api-mutations.ts`, a non-throwing typed facade over existing Platform API write operations. It normalizes success/error results, error categories, retry guidance and operation metadata without connecting unfinished UI forms. See `docs/API_MUTATION_RESULTS_V110.md`.

## Repository structure

```text
assets/js/          Browser TypeScript runtime
assets/css/src/     Ordered CSS layers and reusable component modules
assets/data/        Runtime normalization dictionaries
pages/              Zentrid HTML pages
scripts/            Build, verification and development tooling
types/              Shared TypeScript declarations
docs/               Architecture, CI and deployment documentation
proxy-server.ts     Local Express API proxy
```

Generated files are written to `dist/`. Do not edit or commit `dist/` or `node_modules/`.

## Requirements

- Node.js 22, 23 or 24
- npm 10 or newer

`.nvmrc` and `.node-version` select Node.js 24.

## Install

```powershell
npm.cmd ci
```

Use `npm.cmd install` only when intentionally updating dependencies or recreating `package-lock.json`.

## Verify

```powershell
npm.cmd run verify
npm.cmd run smoke:browser
npm.cmd run verify:vercel
```

The checks cover:

- full strict TypeScript;
- browser runtime source references;
- CSS source manifest;
- browser/server build boundaries;
- HTML script and stylesheet references;
- JavaScript syntax;
- local and Vercel output rules;
- auth/API timeout, JWT expiry, role enforcement and 401 refresh behavior;
- DTO contracts, diagnostics, typed read repositories and repository cache/deduplication for active live entities.

## Development

```powershell
npm.cmd run dev
```

Open:

```text
http://localhost:5050/login.html
```

The development runner rebuilds the project and restarts the local proxy after source changes. Stop it with `Ctrl + C`.

## Production-style local run

```powershell
npm.cmd start
```

The local proxy forwards:

- `/api/Auth` to the Zentrid Auth API;
- `/.well-known` to the Zentrid Auth API;
- `/api` to the Zentrid Data API.

Optional environment variables:

```text
PORT
ZENTRID_AUTH_TARGET
ZENTRID_DATA_TARGET
```

## Builds

```powershell
npm.cmd run build
npm.cmd run build:vercel
```

The browser compiler emits classic JavaScript because the current HTML pages use ordered classic `<script>` tags. `proxy-server.ts` is compiled separately as Node CommonJS for local development only.

The CSS source is maintained as ordered layers and reusable modules under `assets/css/src/` and assembled into `dist/assets/css/styles.css` during every build. Shared badge shells and existing semantic tones live in `assets/css/src/components/badge-base.css` and `assets/css/src/components/badge-tones.css`; shared card surfaces live in `assets/css/src/components/card-surfaces.css`; compact buttons live in `assets/css/src/components/compact-actions.css`; primary, secondary and danger actions live in `assets/css/src/components/actions.css`; shared action-container layouts live in `assets/css/src/components/action-layouts.css`; shared detail workspace card shells live in `assets/css/src/components/detail-card-shells.css`; KPI content and late truncation behavior live in `assets/css/src/components/metric-card-content.css` and `assets/css/src/components/metric-card-overflow.css`; information-grid foundations and late cell truncation live in `assets/css/src/components/information-grid-content.css` and `assets/css/src/components/information-cell-overflow.css`; common data-table content and final grid/scroll behavior live in `assets/css/src/components/data-table-content.css` and `assets/css/src/components/data-table-layout.css`. Shared form controls, labels, full-width fields and checkbox-label primitives live in `assets/css/src/components/form-primitives.css`; shared modal overlays, modal cards, right-side drawers and close controls live in `assets/css/src/components/modal-drawer-shells.css`. Unified live-data banners live in `assets/css/src/components/live-data-states.css`; record-level and page-level source provenance lives in `assets/css/src/components/data-source-indicators.css`. Tenant backend lifecycle controls live in `assets/css/src/components/tenant-lifecycle.css`.

## GitHub and Vercel

The repository contains `vercel.json` and a GitHub Actions workflow. Vercel creates a static `dist/` and proxies Zentrid API routes through external rewrites. The local Express proxy is not published in the Vercel output.

See:

- [Auth and API foundation v102](docs/AUTH_API_FOUNDATION_V102.md)
- [Data source provenance v104](docs/DATA_SOURCE_PROVENANCE_V104.md)
- [API contract layer v105](docs/API_CONTRACT_LAYER.md)
- [API contract diagnostics v106](docs/API_CONTRACT_DIAGNOSTICS_V106.md)
- [Typed API repositories v107](docs/API_REPOSITORIES_V107.md)
- [Repository cache and request deduplication v108](docs/REPOSITORY_CACHE_V108.md)
- [Mutation result layer v110](docs/API_MUTATION_RESULTS_V110.md)
- [Tenant lifecycle actions v111](docs/TENANT_LIFECYCLE_V111.md)
- [Vercel deployment](docs/VERCEL_DEPLOYMENT.md)
- [Continuous integration](docs/CI.md)
- [Browser E2E smoke tests v133](docs/BROWSER_E2E_SMOKE_V133.md)
- [Error recovery and session resilience v137](docs/ERROR_RECOVERY_SESSION_RESILIENCE_V137.md)
- [Release readiness and production observability v138](docs/RELEASE_READINESS_OBSERVABILITY_V138.md)
- [Build pipeline](docs/BUILD_PIPELINE.md)
- [CSS architecture](docs/CSS_ARCHITECTURE.md)
- [Compact actions refactor](docs/CSS_COMPACT_ACTIONS_REFACTOR.md)
- [Shared actions refactor](docs/CSS_ACTIONS_REFACTOR.md)
- [Action-container layouts refactor](docs/CSS_ACTION_LAYOUTS_REFACTOR.md)
- [Detail card shells refactor](docs/CSS_DETAIL_CARD_SHELLS_REFACTOR.md)
- [Metric card refactor](docs/CSS_METRIC_CARD_REFACTOR.md)
- [Information grids refactor](docs/CSS_INFORMATION_GRIDS_REFACTOR.md)
- [Data tables refactor](docs/CSS_DATA_TABLES_REFACTOR.md)
- [Form primitives refactor](docs/CSS_FORM_PRIMITIVES_REFACTOR.md)
- [Badge primitives refactor](docs/CSS_BADGES_REFACTOR.md)
- [Modal and drawer shells refactor](docs/CSS_MODAL_DRAWER_SHELLS_REFACTOR.md)
- [UI duplication audit](docs/UI_DUPLICATION_AUDIT_v84.md)

## Development rules

1. Edit TypeScript, HTML, CSS source fragments or runtime data files.
2. Never edit generated JavaScript or CSS inside `dist/`.
3. Run `npm.cmd run verify` before committing.
4. Run `npm.cmd run e2e:browser` after changes that can affect browser behavior.
5. Keep browser runtime files referenced by an HTML page; the source check rejects unused classic runtime scripts.

Cleanup details: [Repository cleanup](docs/REPOSITORY_CLEANUP.md).

## GitHub and npm registry

The repository includes `.github/workflows/ci.yml`. Push the project with Git so hidden/dot-prefixed paths are committed. See `docs/GITHUB_UPLOAD.md`.

`scripts/check-package-registry.js` validates that `package-lock.json` references only `https://registry.npmjs.org/`. Vercel and CI also pass the public registry explicitly to `npm ci`, so deployment does not depend on uploading a hidden `.npmrc` file.

- Unified live-data states for active API pages: loading, live, partial, empty, timeout, unauthorized, forbidden, unavailable, and unavailable backend state.
- Explicit data provenance for active API screens: Live API, Test fixtures, Local changes, and Mixed sources.

## API contract layer (v105)

Active live entities now pass through `assets/js/api-contracts.ts` before reaching page renderers. DTO aliases and normalized mapper functions for Clients, Tenants, Plants, Devices, Alerts, and Integrations are centralized and verified by `npm run check:api-contracts`. See `docs/API_CONTRACT_LAYER.md`.

## Typed API repositories (v107)

Clients, Tenants, Plants, Devices, Alerts and Integrations are now read through `assets/js/api-repositories.ts`. The repository layer owns endpoint selection, pagination, source merging, deduplication and DTO mapping; `live-api-ui.ts` only orchestrates page state and rendering. Run `npm run check:api-repositories` to verify the boundary. See `docs/API_REPOSITORIES_V107.md`.

## Repository cache and request deduplication (v108)

The six active read repositories now use short-lived in-memory caching and share concurrent identical reads. Cached results are cloned per consumer, failures are never cached, auth/session changes clear completed and in-flight entries, and callers can use `forceRefresh` or `maxAgeMs` when fresh data is required. Run `npm run check:repository-cache` to verify the behavior. See `docs/REPOSITORY_CACHE_V108.md`.


## Mutation-aware repository invalidation (v109)

Successful Tenant, Client, Plant and Provider Integration write actions now emit a typed `zentrid:data-mutated` event. The repository layer invalidates only affected cache entries; failed writes keep valid cached data. Integration lifecycle actions also clear dependent Plants, Devices and Alerts caches. Run `npm run check:mutation-invalidation` to verify the behavior. See `docs/MUTATION_CACHE_INVALIDATION_V109.md`.

## Tenant lifecycle actions (v111)

Tenant Detail now performs real backend activate, deactivate and archive operations for Live API Tenant records through `assets/js/tenant-lifecycle.ts` and `ZentridAPIMutations`. Unavailable and local records are gated, destructive actions require confirmation, retriable failures expose Retry, and successful mutations reload from the backend after repository cache invalidation. Run `npm run check:tenant-lifecycle` to verify the workflow. See `docs/TENANT_LIFECYCLE_V111.md`.


## API Field Mapping Audit v128

The live contract layer now exposes a field-level manifest and runtime audit for Clients, Tenants, Plants, Devices, Alerts and Integrations. Run `npm run check:api-field-mapping-audit` or use Platform API Console to review mapped aliases, fallbacks, missing expected fields and unmapped backend fields. See `docs/API_FIELD_MAPPING_AUDIT_V128.md`.

## Performance & Runtime Stability v132

Shared browser scheduling now batches mutation observers, debounces registry search, preserves interaction state during table updates, cancels active repository requests on page exit and disposes lazy-detail observers. Run `npm run check:performance-runtime-stability`. See `docs/PERFORMANCE_RUNTIME_STABILITY_V132.md`.


## Browser E2E Smoke Tests v133

Six deterministic Chrome DevTools Protocol journeys now cover Global Admin login, Clients pagination/query state/modal behavior, Plant and Device lazy relations, Integration synchronization lazy loading, and Platform API Console diagnostics. API calls use synthetic read-only fixtures. Run `npm run check:browser-e2e-smoke` for the manifest/source contract and `npm run e2e:browser` for the full browser suite. See `docs/BROWSER_E2E_SMOKE_V133.md`.
## Visual regression and responsive audit (v134)

Run `npm run visual:browser` to capture eight critical Zentrid surfaces at 1440, 1280, 1024, 768 and 390 CSS pixels. The runner audits viewport overflow, clipped text, mobile target sizing, UX-state width and shell overlap, then writes PNG and JSON artifacts to `artifacts/visual-regression/`. Use `npm run visual:update` to create platform-specific layout baselines.

## Form Readiness for Future APIs v136

Declared Zentrid forms now expose dirty-state protection, validation summaries, typed DTO serialization, safe credential-redacted previews, nullable/enum/file handling and explicit API availability modes. Existing create wizards remain local until their final mutation integration is approved. Run `npm run check:form-readiness-future-apis`. See `docs/FORM_READINESS_FUTURE_APIS_V136.md`.

## Client identity + document upload patch (2026-07-30)

- Individual `Passport / Personal ID` now maps to `identity.registrationNumber`.
- Individual `Tax / Personal ID` now maps to `identity.taxIdVatNumber`.
- Create Client uploads selected files after the client UUID is returned by `POST /api/admin/clients`.
- Client document upload uses `POST /api/admin/clients/{id}/documents` with `multipart/form-data`: `file`, `name`, `type`, and optional `expiry`.
- Multipart requests no longer receive an incorrect JSON `Content-Type` header; the browser supplies the boundary.
- Partial document-upload failure never resubmits the client create mutation. The wizard remains open and reports failed documents.
