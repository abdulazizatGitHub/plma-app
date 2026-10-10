# v2 Phase 5 — Plans: content, university, cadence

**Release:** R1 · **Requirements:** PLN-01…06 · **Depends on:** 3

## Goal

Multi-step, dated plans for things like restaurant collabs and university work, with optional cadence rules.

## Scope

- **Plan detail:**
  - steps on a timeline, with dates
  - venue, contact, and notes
  - a lock icon on dependent steps, with the reason
- **Editing `item_dependencies`:** "this step waits for…".
- **Presets:**
  - **Content collab:** Shoot, Edit, Payment cleared, Post. Post depends on Payment.
  - **University:** Assignment, Quiz, Presentation, Teacher meeting, FYP task or meeting, plus a course field.
- **Cadence rules** per category or plan:
  - gap days between steps
  - allowed weekdays per step kind
  - `CadenceChecker` shows warnings and the next valid dates in the date picker.
- **Behaviour:**
  - Steps appear on Today on their dates.
  - The last step done completes the plan.

## Acceptance

- [ ] "Collab — Café X" with shoot Tue, edit Wed, post Fri. Post stays locked until Payment cleared is ticked.
- [ ] Rule "post weekdays Tue/Fri, gap ≥ 1 day": picking Thursday shows a warning and suggests Friday. Saving anyway is still allowed.
- [ ] Quiz on 12 Oct 10:00 for course "DSA" appears on Today on 12 Oct.
- [ ] A content category with no active plans shows "Nothing upcoming" and no warning.
