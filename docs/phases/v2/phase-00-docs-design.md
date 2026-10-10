# v2 Phase 0 — Docs and design system

**Release:** R0 · **Requirements:** UI-01 · **Depends on:** —

## Goal

Agree on what v2 is and how it looks before writing feature code.

## Scope

- This documentation pack:
  - REQUIREMENTS_V2, PRD, SYSTEM_DESIGN, DEVELOPMENT_PLAN, DESIGN_SYSTEM_V2
  - diagrams and the compiled PDF
- Tokens from [DESIGN_SYSTEM_V2](../../design/DESIGN_SYSTEM_V2.md) in a new `globals.css` (light and dark). Poppins via `next/font`.
- UI kit components in `apps/web/src/components/ui/`:
  - StatusTile, TaskRow
  - QuantityRow (stepper with typed value)
  - PrayerRow, CategoryCard
  - SegmentedTabs, DateStrip, BottomNav
  - Sheet, Ring, Bars
- A dev-only page `/dev/ui-kit` showing every component in every state.

## Acceptance

- [x] The owner approves the docs pack, including the answers to the open questions in PRD §12. Done 2026-10-08; the answers are recorded in REQUIREMENTS_V2 §3a.
- [x] The owner approves the UI kit at 430 px in light and dark. Approved as-is on 2026-10-09.
- [x] Every text/background pair in the kit passes AA contrast. Enforced by `lib/theme/tokens.test.ts`, which also keeps `globals.css` in sync with `tokens.ts`.
- [x] Component tests: the stepper accepts ±step and typed values; the ring renders 0 / 50 / 100%. See `components/kit/kit.test.tsx`.
