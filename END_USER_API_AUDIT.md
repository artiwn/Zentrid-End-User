# Zentrid End User API Audit — v1.9

## Audit basis

The frontend contract was audited against the uploaded FleetOS backend source, primarily:

- `FleetOS.WebAPI/Controllers/EndUserController.cs`
- `FleetOS.WebAPI/Models/UserExperienceModels.cs`
- the UI dashboard controller and service used by `/api/Ui/dashboard`

This is a static source-contract audit. The build environment could not resolve the deployed `fleetosauth.unisys.am` / `fleetosapi.unisys.am` hosts, so an authenticated live-network regression was not claimed.

## Implemented backend resources

| Frontend resource | Endpoint | Main backend fields used | Frontend behavior |
|---|---|---|---|
| Dashboard | `GET /api/Ui/dashboard?page=&size=&period=` | Dashboard aggregates, plants, devices, alerts and energy depending on response | Overview and My Plant enrichment |
| Overview | `GET /api/EndUser/overview` | `greeting`, `systemStatus`, `powerNowKilowatts`, `todayEnergyKilowattHours`, `activeAlerts`, `primaryPlantName`, `deviceCount`, `energyTrend`, `notifications` | Owner overview, no local KPI substitution |
| Plants | `GET /api/EndUser/plants` | `plantId`, `plantName`, `location`, `status`, `lifetimeGenerationKilowattHours`, `todayGenerationKilowattHours` | Plant identity and generation fields; unavailable capacity/contract fields remain N/A |
| Devices | `GET /api/EndUser/devices` | `deviceId`, `deviceName`, `deviceType`, `status`, `plantName`, `currentPowerKilowatts` plus page metadata | Device list/detail; unsupported serial/model/firmware fields remain N/A |
| Alerts | `GET /api/EndUser/alerts` | `alertId`, `title`, `severity`, `source`, `isActive`, `createdAt` | Alert list/detail; unsupported impact, workflow and revenue estimates remain N/A |
| Energy | `GET /api/EndUser/energy?period=` | `periodGenerationKilowattHours`, `periodConsumptionKilowattHours`, `periodLabel`, `energyChart` | Today/Week/Month/Year generation and consumption; sold/imported/revenue remain N/A |
| Reports | `GET /api/EndUser/reports` | `reportId`, `title`, `description`, `createdAt`, `downloadUrl` | Server-provided report library and metadata preview |
| Profile | `GET /api/EndUser/profile` | `userId`, `userName`, `fullName`, `email`, `role`, `tenantName`, `permissions` | Read-only authenticated identity and scope |

## Missing or unconfirmed backend capabilities

| Capability | Status in supplied backend | v1.9 frontend policy |
|---|---|---|
| Energy sales and tariff data | No confirmed End User endpoint | `Not available`; no estimated local record |
| Settlements and payments | No confirmed End User endpoint | Empty capability state; no invoices/payment fixtures |
| Sales agreement/buyer details | No confirmed End User endpoint | `Not available` |
| Report generation | No confirmed create/generate endpoint | Generate controls disabled with an explanation |
| Report file download | DTO contains `downloadUrl`, but no matching controller was confirmed in the audited source | Download is attempted only when the API supplies a URL; failures are shown honestly |
| Profile update | No confirmed End User write endpoint | API identity remains read-only |
| Notification preferences | No confirmed write/read preference endpoint | Read-only; displayed only when returned by the profile API |
| Monthly report delivery | No confirmed endpoint | Read-only; displayed only when returned by the profile API |

## Production data safeguards

- Removed legacy `/api/admin/plants`, `/api/admin/devices` and `/api/admin/alerts` fallbacks.
- Removed frontend fixtures identified by IDs and values such as `ALT-OWNER-*`, `INV-ARM-*`, `RPT-OWNER-*`, test plant names and fixed revenue/energy figures.
- API failures cannot silently become valid-looking business data.
- A successful empty response is distinct from a network/API error.
- Last-known snapshots are stored per JWT subject and expire after seven days.
- Snapshot data is labelled cached/stale in the UI.
- Unsupported values use `Not available` rather than zero.
- End User role enforcement remains separate from tenant/global administration.

## Backend work required before full production sign-off

1. Add owner-scoped finance endpoints for sales, tariffs, settlements, payments and agreements.
2. Add report generation/status/download endpoints or confirm the actual existing download route.
3. Add profile and preference write endpoints with validation and audit history.
4. Confirm server-side owner/tenant scoping for every resource; frontend filtering is not a security boundary.
5. Define consistent error payloads and pagination conventions.
6. Validate the deployed endpoints through authenticated integration tests using an `EndUser` account.
7. Replace any synthetic values generated inside backend services with authoritative production sources before business use.

## Release conclusion

The v1.9 frontend is production-clean in the sense that it consumes only the documented End User contract, removes local business-data fixtures, and exposes backend gaps honestly. Full business production readiness still depends on the missing backend capabilities and live authenticated integration testing listed above.
