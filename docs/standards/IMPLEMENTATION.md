# Implementation standards

## PWA

- **Manifest:** `apps/web/public/manifest.json` — `display: standalone`, theme `#fdf2f8` (rose-50 family)
- **Service worker:** Serwist; precache shell; **network-first** for API; no caching of authenticated sync POST bodies
- **Install:** meet Lighthouse installability (HTTPS, manifest, SW)

## Offline-first data flow

```
UI → local SQLite (read/write) → sync queue → API → Postgres (when online)
         ↑ pull delta on reconnect ────────────────┘
```

- Reads prefer local DB for snappy dashboard; background refresh when online
- Show sync status indicator when queue non-empty or sync failed (Phase 02+)

## Feature extensibility (CRD §24)

- New habit types added via `habit_definitions` + optional `tracking_method` enum extension — not hardcoded-only switches
- Predefined modules (prayer, quran) may use dedicated tables for stats efficiency but must register into dashboard aggregation

## UI/UX (CRD §22)

- Soft feminine palette: rose/blush/cream, rounded cards, generous whitespace
- Bottom nav fixed; content scrolls; min tap target 44px
- Progress: bars and check states; avoid dense tables on mobile

## Time & locale

- Store dates as **local calendar date** (`YYYY-MM-DD`) for daily habits; instants in UTC for sleep timestamps
- Week starts Monday unless user setting added later

## Notifications (Phase 12)

- Web Push + in-app; each category toggle in settings
- Document iOS PWA push limitations in PROJECT.md if hit

## Phase gate

Before marking phase Done: phase MD acceptance criteria checked, PROGRESS updated, blockers in PROJECT.md.
