# v2 Phase 11 — Native wrap (Capacitor)

**Release:** R4 · **Requirements:** REM-05 (alarms), SHR-02 · **Depends on:** 6

## Goal

Real alarm-style reminders and a presence in the app stores, built from the same web code.

## Scope

- A Capacitor project wrapping the Next.js build. Whether to use a static export or a hosted URL is decided in this phase.
- `@capacitor/local-notifications`, with exact alarms on Android.
  - Critical reminders are scheduled locally.
  - The local schedule is mirrored with the server so a reminder doesn't fire twice.
- A share sheet for streak and achievement images, generated client-side from the Ring and Bars components.
- Store listing assets, a privacy policy, and a TestFlight / internal testing track.

## Acceptance

- [ ] A critical reminder rings on Android with the app closed and repeats until Done.
- [ ] iOS local notifications fire on time with the app closed.
- [ ] Sharing a streak image to WhatsApp and Instagram works.
