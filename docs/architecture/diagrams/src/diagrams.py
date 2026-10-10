"""Life v2 diagrams. Run: python docs/architecture/diagrams/src/diagrams.py [name ...]

Writes <name>.svg and <name>.png into docs/architecture/diagrams/.
"""

from __future__ import annotations

import os
import sys

sys.path.insert(0, os.path.dirname(__file__))
from svgkit import (  # noqa: E402
    Diagram, class_box, render, sequence, table_box, tint, stroke, BASE, INK, INK2, BORDER,
)

OUT = os.path.normpath(os.path.join(os.path.dirname(__file__), ".."))
REGISTRY = {}


def diagram(fn):
    REGISTRY[fn.__name__.replace("_", "-")] = fn
    return fn


# =============================================================== 1. context
@diagram
def system_context():
    d = Diagram(1240, 760, "System context", "Who and what the Life app talks to. Solid = now (PWA), dashed = later phases.")
    d.node("sys", 470, 300, 300, 150, ["Life app (v2)", "Offline-first PWA + Fastify API", "Categories · items · Today · rewards"], "box", "blue", 15)
    d.node("user", 90, 320, 170, 110, ["User", "plans the day, logs progress"], "actor", "mauve")
    d.node("friend", 90, 560, 170, 110, ["Friends / group members", "(Phase 9)"], "actor", "peach")
    d.node("admin", 535, 110, 170, 100, ["Platform admin", "weekly / monthly challenges"], "actor", "teal")
    d.node("auth", 930, 120, 240, 80, ["Supabase Auth", "sign-up, sign-in, JWT, JWKS"], "ext")
    d.node("push", 930, 290, 240, 80, ["Web Push services", "FCM · Mozilla · Apple (VAPID)"], "ext")
    d.node("native", 930, 460, 240, 80, ["Device OS notifications", "exact alarms via Capacitor (Phase 11)"], "ext", dashed=True)
    d.node("geo", 930, 610, 240, 80, ["Device location", "lat/lng for prayer times (optional)"], "ext")

    d.edge("user", "sys", "categories, items, check-offs,\nskip / move, settings", sa="r", sb=("l", .35), lpos=.5, ldy=-22)
    d.edge("sys", "user", "Today lists, progress, history,\nbadges, reminders", sa=("l", .7), sb=("r", .75), lpos=.5, ldy=26)
    d.edge("friend", "sys", "join groups, group goals,\nshares & kudos", sa="r", sb=("b", .25), via=[(400, 615), (545, 615)], dashed=True, lpos=.3, ldy=-20)
    d.edge("admin", "sys", "publish challenges", sa="b", sb="t", lpos=.45)
    d.edge("sys", "auth", "verify JWT (JWKS)", sa=("r", .15), sb="l", lpos=.5, ldy=-12)
    d.edge("sys", "push", "send notification", sa=("r", .45), sb="l", lpos=.55, ldy=-12)
    d.edge("sys", "native", "schedule local alarms", sa=("r", .75), sb="l", dashed=True, lpos=.55, ldy=12)
    d.edge("geo", "sys", "coordinates", sa="l", sb=("b", .8), via=[(720, 650)], lpos=.25, ldy=-12)
    return d


# =============================================================== 2. architecture
@diagram
def system_architecture():
    d = Diagram(1460, 960, "System architecture", "Containers and modules. Postgres is the source of truth; each device keeps a per-user SQLite cache and an outbox.")
    # client
    d.group(30, 100, 560, 820, "User device — Next.js PWA", "blue", sub="installable, works offline")
    d.node("ui", 60, 150, 500, 110, ["UI (App Router, React)", "Today · Categories · Item / Plan detail · Progress · Profile", "Add sheet (+) · Onboarding · Groups & leaderboards (later)"], "box", "blue")
    d.node("domain", 60, 300, 500, 130, ["Domain services — @life/shared", "ScheduleExpander · ProgressRule · PrayerTimes (adhan-js)", "Stats (week / month, most-missed) · CadenceChecker", "Zod schemas shared with the API"], "box", "mauve")
    d.node("store", 60, 470, 235, 120, ["Local SQLite", "sql.js, persisted to", "IndexedDB, per user"], "db", "sage")
    d.node("outbox", 325, 470, 235, 120, ["Outbox + sync engine", "queued writes, pull cursor,", "last-write-wins per row"], "box", "sage")
    d.node("sw", 60, 630, 500, 90, ["Service worker (Serwist)", "precache app shell · receive push · notification actions (Done / Snooze)"], "box", "peach")
    d.node("cap", 60, 760, 500, 110, ["Capacitor shell — Phase 11", "same web build in a native wrapper", "local notifications / exact alarms on device"], "box", "grey", dashed=True)
    # server
    d.group(660, 100, 520, 610, "Backend — Fastify API (Node 20, TypeScript)", "teal", sub="REST /v1, JSON, bearer JWT")
    d.node("authmw", 690, 150, 460, 56, ["Auth middleware", "verify Supabase JWT via JWKS → userId"], "box", "teal")
    mods = [
        ("m_sync", "Sync", "pull / push, ownership checks"),
        ("m_set", "Settings & templates", "starter packs, apply"),
        ("m_rem", "Reminders", "subscriptions, triggers"),
        ("m_rew", "Rewards", "points, badges, streaks"),
        ("m_soc", "Social", "friends, groups, shares"),
        ("m_chl", "Challenges & admin", "system goals, leaderboards"),
    ]
    for i, (mid, a, b) in enumerate(mods):
        x = 690 + (i % 2) * 235
        y = 230 + (i // 2) * 82
        d.node(mid, x, y, 225, 66, [a, b], "box", "teal", 12.5)
    d.node("jobs", 690, 490, 460, 190, ["Job worker — pg-boss (Postgres-backed queue)", "reminders.tick (every minute) · reminders.escalate", "rewards.evaluate (on synced completions)", "streaks.rollover (per user midnight)", "challenges.close · leaderboard.snapshot (weekly / monthly)"], "box", "yellow")
    # data / external
    d.node("pg", 1240, 300, 190, 170, ["PostgreSQL", "(Supabase)", "app tables +", "pg-boss schema"], "db", "navy")
    d.node("sauth", 1240, 110, 190, 90, ["Supabase Auth", "users, sessions, JWKS"], "ext")
    d.node("wpush", 1240, 560, 190, 90, ["Web Push services", "FCM · Mozilla · APNs"], "ext")

    d.edge("ui", "domain", "compute Today, rules", sa="b", sb="t", ldx=70)
    d.edge("domain", "store", "read / write rows", sa=("b", .25), sb="t", ldx=-60)
    d.edge("domain", "outbox", "enqueue change", sa=("b", .75), sb="t", ldx=58)
    d.edge("outbox", "store", None, sa="l", sb="r")
    d.edge("outbox", "m_sync", "HTTPS  /v1/sync/pull · push", sa="r", sb="l", via=[(610, 530), (610, 263)], both=True, lpos=.5, ldx=0)
    d.edge("ui", "sauth", "sign in → JWT", sa=("t", .8), sb=("t", .5), via=[(460, 80), (1335, 80)], lpos=.5, ldy=0)
    d.edge("authmw", "sauth", "JWKS", sa="r", sb=("l", .75), lpos=.5, ldy=-10)
    d.path([(1180, 385), (1240, 385)], None)
    d.label(1210, 365, "SQL")
    d.edge("jobs", "pg", "jobs + reads", sa=("r", .2), sb=("l", .85), via=[(1210, 528), (1210, 445)], lpos=.2, ldy=-12)
    d.edge("jobs", "wpush", "send (VAPID)", sa=("r", .75), sb="l", lpos=.5, ldy=-12)
    d.edge("wpush", "sw", "push event", sa="b", sb="r", via=[(1335, 800), (600, 800), (600, 675)], lpos=.4, ldy=-12)
    d.edge("sw", "ui", None, sa=("l", .5), sb=("l", .5), via=[(42, 675), (42, 205)], dashed=True)
    return d


# =============================================================== 3. DFD level 0
@diagram
def dfd_level0():
    d = Diagram(1320, 760, "Data flow — level 0", "The whole system as one process. Rectangles = external entities, rounded = process.")
    d.node("p0", 520, 290, 270, 170, ["0", "Life app", "plan · track · remind · reward · share"], "process", "blue", 15)
    d.node("user", 50, 300, 210, 90, ["User"], "ext")
    d.node("friends", 50, 560, 210, 90, ["Friends / group members"], "ext")
    d.node("admin", 550, 90, 210, 80, ["Platform admin"], "ext")
    d.node("auth", 1060, 120, 210, 80, ["Auth provider", "Supabase Auth"], "ext")
    d.node("push", 1060, 330, 210, 80, ["Push service", "Web Push / OS"], "ext")
    d.node("geo", 1060, 560, 210, 80, ["Device location"], "ext")
    d.edge("user", "p0", "categories, items, schedules,\ncheck-offs, skip / move", sa=("r", .3), sb=("l", .32), ldy=-24)
    d.edge("p0", "user", "Today lists, progress %,\nhistory, badges", sa=("l", .68), sb=("r", .75), ldy=24)
    d.edge("friends", "p0", "invites, group-goal progress, kudos", sa=("r", .3), sb=("b", .3), via=[(605, 587)], lpos=.35, ldy=-12)
    d.edge("p0", "friends", "leaderboards, shared streaks", sa=("b", .55), sb=("r", .75), via=[(668, 627)], lpos=.6, ldy=14)
    d.edge("admin", "p0", "challenge definitions", sa=("b", .35), sb=("t", .35), lpos=.5, ldx=-70)
    d.edge("p0", "admin", "challenge results", sa=("t", .65), sb=("b", .65), lpos=.5, ldx=62)
    d.edge("p0", "auth", "credentials", sa=("r", .15), sb=("l", .35), lpos=.5, ldy=-12)
    d.edge("auth", "p0", "session JWT", sa=("l", .75), sb=("r", .3), lpos=.5, ldy=12)
    d.edge("p0", "push", "reminder / share notifications", sa=("r", .6), sb="l", lpos=.55, ldy=-12)
    d.edge("geo", "p0", "coordinates", sa="l", sb=("r", .9), lpos=.5, ldy=12)
    return d


# =============================================================== 4. DFD level 1
@diagram
def dfd_level1():
    d = Diagram(1630, 1090, "Data flow — level 1", "Processes 1–8, data stores D1–D7. Stores are logical: each exists on the server, and D1–D3 + D7 are cached on the device.")
    P = lambda i, x, y, a, b: d.node(f"p{i}", x, y, 240, 78, [f"{i}.0  {a}", b], "process", "blue", 13)
    S = lambda i, x, y, a, c="sage": d.node(f"d{i}", x, y, 300, 50, [f"D{i}", a], "store", c, 12.5, first_bold=False)
    P(1, 290, 110, "Manage categories & items", "CRUD, tracking, schedule, priority")
    P(2, 290, 330, "Plan the day", "expand schedules, prayer anchors")
    P(3, 290, 540, "Log progress", "done · +/− · typed value · skip · move")
    P(8, 290, 770, "Analyse history", "week / month, most-missed, badges")
    P(5, 1010, 110, "Remind", "due triggers, escalation")
    P(4, 1010, 560, "Sync", "outbox push, pull since cursor")
    P(6, 1010, 770, "Reward", "points, badges, streaks, challenges")
    P(7, 1010, 960, "Social & leaderboards", "friends, groups, goals, shares")
    S(1, 630, 124, "Categories & items")
    S(4, 630, 250, "Reminders & push subscriptions", "yellow")
    S(3, 630, 344, "User settings & prayer times", "mauve")
    S(2, 630, 470, "Occurrences (status, value)")
    S(7, 630, 620, "Outbox (device)", "peach")
    S(5, 630, 790, "Points · badges · streaks", "yellow")
    S(6, 1300, 974, "Groups · goals · leaderboards", "peach")
    d.node("user", 40, 470, 170, 80, ["User"], "ext")
    d.node("friends", 40, 960, 170, 80, ["Friends"], "ext")
    d.node("push", 1380, 114, 180, 70, ["Push service"], "ext")
    d.node("admin", 1380, 774, 180, 70, ["Platform admin"], "ext")

    d.edge("user", "p1", "definitions", sa=("t", .4), sb=("l", .5), lpos=.45, ldx=-30)
    d.edge("p2", "user", "Today lists", sa=("l", .6), sb=("t", .85), lpos=.5, ldx=-10, ldy=-10)
    d.edge("user", "p3", "✓, +500, 10000,\nskip, move", sa=("r", .7), sb=("l", .45), lpos=.62, ldx=10, ldy=-22)
    d.edge("p8", "user", "stats, trends,\nneeds-improvement", sa=("l", .5), sb=("b", .5), lpos=.45, ldx=-20)
    d.edge("p1", "d1", "save", sa=("r", .5), sb=("l", .5), lpos=.5, ldy=-10)
    d.edge("p1", "d4", "reminder rules", sa=("r", .8), sb=("l", .5), lpos=.78, ldx=-62, ldy=6)
    d.edge("d1", "p2", "items + schedules", sa=("b", .1), sb=("t", .75), lpos=.72, ldx=-62)
    d.edge("d3", "p2", "tz, prayer times", sa="l", sb="r", lpos=.5, ldy=-10)
    d.edge("d4", "p5", "due reminders", sa="r", sb=("b", .25), lpos=.5, ldy=10, ldx=40)
    d.edge("d2", "p5", "done yet?", sa=("t", .92), sb=("b", .55), lpos=.55, ldx=36)
    d.edge("p5", "push", "notification", sa="r", sb="l", lpos=.5, ldy=-10)
    d.edge("p3", "d2", "status / value", sa=("r", .25), sb=("l", .5), lpos=.5, ldy=-10)
    d.edge("p3", "d7", "queued change", sa=("r", .75), sb=("l", .5), lpos=.45, ldy=14)
    d.edge("d7", "p4", "pending", sa="r", sb=("l", .6), lpos=.5, ldy=10)
    d.edge("p4", "d2", "merged rows", sa=("t", .25), sb=("r", .6), lpos=.5, ldx=40)
    d.edge("p4", "p6", "synced completions", sa="b", sb="t", lpos=.5, ldx=66)
    d.edge("admin", "p6", "challenges", sa="l", sb="r", lpos=.5, ldy=-10)
    d.edge("p6", "d5", "award", sa="l", sb="r", lpos=.5, ldy=-10)
    d.edge("d5", "p8", "points, badges", sa="l", sb="r", lpos=.5, ldy=-10)
    d.edge("d2", "p8", "history", sa=("b", .1), sb=("t", .75), lpos=.75, ldx=-30)
    d.edge("d5", "p7", "member points", sa=("b", .6), sb=("l", .3), lpos=.5, ldx=-50)
    d.edge("p7", "d6", "goals, ranks", sa="r", sb="l", lpos=.5, ldy=-14)
    d.edge("friends", "p7", "invites, goal progress, kudos", sa=("r", .3), sb=("l", .3), lpos=.5, ldy=-10)
    d.edge("p7", "friends", "leaderboards, shares", sa=("l", .75), sb=("r", .75), lpos=.5, ldy=12)
    return d


# =============================================================== 5. sequences
@diagram
def seq_prayer_offline():
    return sequence(
        "Sequence — one-tap prayer, offline first",
        "Marking Asr while Fajr is still open. No order is enforced; the write is local first and syncs when online.",
        [("user", "User", "mauve"), ("ui", "Today UI", "blue"), ("dom", "Domain services", "mauve"),
         ("db", "Local SQLite", "sage"), ("ob", "Outbox", "sage"), ("api", "Sync API", "teal"),
         ("pg", "Postgres", "navy"), ("rw", "Rewards job", "yellow")],
        [
            ("m", "user", "ui", "tap Asr ✓  (Fajr not marked)"),
            ("m", "ui", "dom", "complete(occurrence: Asr, today)"),
            ("note", "dom", "dom", "No sequence rule: any prayer can be marked; Fajr can stay open or be marked missed."),
            ("m", "dom", "db", "upsert occurrence status=done, completedAt"),
            ("m", "dom", "ob", "enqueue {occurrence, upsert}"),
            ("m", "dom", "ui", "ring 3/5, day %", "r"),
            ("m", "ui", "user", "ring fills, row moves to Done", "r"),
            ("alt", "offline"),
            ("m", "ob", "ob", "keep queued; retry on 'online' event"),
            ("else", "online"),
            ("m", "ob", "api", "POST /v1/sync/push  (Bearer JWT)"),
            ("m", "api", "api", "verify each row belongs to caller"),
            ("m", "api", "pg", "upsert (last-write-wins by updatedAt)"),
            ("m", "api", "rw", "enqueue rewards.evaluate"),
            ("m", "api", "ob", "ack + serverTime", "r"),
            ("m", "ob", "db", "clear sent rows, save cursor"),
            ("end",),
            ("m", "rw", "pg", "points +2, prayer streak check"),
        ])


@diagram
def seq_reminder_escalation():
    return sequence(
        "Sequence — reminder with priority escalation",
        "A critical item repeats its reminder until it is done (bounded by max repeats and quiet hours).",
        [("user", "User", "mauve"), ("ui", "Add sheet", "blue"), ("api", "API · Reminders", "teal"),
         ("pg", "Postgres", "navy"), ("job", "pg-boss worker", "yellow"), ("wp", "Web Push", "grey"),
         ("sw", "Service worker", "peach")],
        [
            ("m", "user", "ui", "add 'Submit FYP report' · critical\nremind 09:00 · repeat every 30 min"),
            ("m", "ui", "api", "sync push: item + reminder"),
            ("m", "api", "pg", "save; nextFireAt = 09:00 in user tz"),
            ("loop", "reminders.tick — every minute"),
            ("m", "job", "pg", "reminders with nextFireAt ≤ now"),
            ("m", "job", "pg", "today's occurrence done?"),
            ("alt", "not done"),
            ("m", "job", "wp", "send payload (VAPID)"),
            ("m", "wp", "sw", "push event"),
            ("m", "sw", "user", "notification · Done · Snooze 10 min"),
            ("m", "job", "pg", "critical: nextFireAt += 30 min (count < max)"),
            ("else", "done or skipped"),
            ("m", "job", "pg", "stop for today; schedule next due date"),
            ("end",),
            ("end",),
            ("opt", "user taps Done on the notification"),
            ("m", "user", "sw", "action: Done"),
            ("m", "sw", "api", "POST occurrence done (queued if offline)"),
            ("m", "api", "pg", "status = done → escalation stops"),
            ("end",),
        ])


@diagram
def seq_open_today():
    return sequence(
        "Sequence — building Today",
        "Occurrences are computed from schedules on the device and stored only once the user touches them.",
        [("user", "User", "mauve"), ("ui", "Today UI", "blue"), ("db", "Local SQLite", "sage"),
         ("pt", "PrayerTimes", "teal"), ("ex", "ScheduleExpander", "mauve"), ("pr", "ProgressRule", "mauve")],
        [
            ("m", "user", "ui", "open app / pick a date on the strip"),
            ("m", "ui", "db", "active items + stored occurrences for date"),
            ("m", "db", "ui", "rows", "r"),
            ("m", "ui", "pt", "times(date, lat/lng, method, madhab)"),
            ("m", "pt", "ui", "Fajr · Sunrise · Zuhr · Asr · Maghrib · Isha", "r"),
            ("m", "ui", "ex", "expand(items, date, prayerTimes)"),
            ("note", "ex", "ex", "once · daily · weekdays · every N days · monthly. 'Surah Kahf · Friday · after Zuhr' → only on Fridays, active Zuhr→Asr. Skips archived items and dates outside activeFrom/Until."),
            ("m", "ex", "ui", "virtual occurrences", "r"),
            ("m", "ui", "ui", "merge with stored (stored wins)"),
            ("m", "ui", "pr", "progress(occurrences)"),
            ("note", "pr", "pr", "required = not optional, not skipped, not moved. % = done ÷ required; nothing required → 100%."),
            ("m", "pr", "ui", "% + counts To Do / In Progress / Done", "r"),
            ("m", "ui", "user", "status tiles, lists, day ring", "r"),
        ])


@diagram
def seq_move_skip():
    return sequence(
        "Sequence — move, skip, or park a task",
        "Flexible days: anything not required today can leave the day without lowering the score.",
        [("user", "User", "mauve"), ("ui", "Today UI", "blue"), ("dom", "Domain services", "mauve"),
         ("db", "Local SQLite", "sage"), ("ob", "Outbox", "sage")],
        [
            ("m", "user", "ui", "long-press 'Edit restaurant vlog' → Move to tomorrow"),
            ("m", "ui", "dom", "move(occurrence, tomorrow)"),
            ("alt", "one-off task"),
            ("m", "dom", "db", "occurrence.date = tomorrow"),
            ("else", "recurring item"),
            ("m", "dom", "db", "today: status = moved, movedTo"),
            ("m", "dom", "db", "tomorrow: extra occurrence, movedFrom"),
            ("end",),
            ("m", "dom", "ob", "enqueue changes"),
            ("m", "dom", "ui", "required −1 → % recalculated", "r"),
            ("alt", "Skip"),
            ("m", "user", "ui", "Skip 'Gym' today"),
            ("m", "ui", "dom", "skip(occurrence)"),
            ("m", "dom", "db", "status = skipped (excluded from %)"),
            ("else", "Pending — no date"),
            ("m", "user", "ui", "Mark pending"),
            ("m", "ui", "dom", "move(occurrence, null)"),
            ("m", "dom", "db", "leaves the day → Pending list"),
            ("end",),
            ("m", "ui", "user", "day can still reach 100%", "r"),
        ])


@diagram
def seq_group_goal():
    return sequence(
        "Sequence — group goal, points and leaderboard (Phase 9)",
        "Rewards are computed on the server only, from synced data, so they cannot be granted by a client.",
        [("m", "Member", "peach"), ("ui", "App", "blue"), ("api", "API · Social", "teal"),
         ("pg", "Postgres", "navy"), ("job", "Rewards worker", "yellow"), ("grp", "Group members", "peach")],
        [
            ("m", "m", "ui", "log 8,000 steps (goal: 70k steps / week)"),
            ("m", "ui", "api", "sync push occurrence (groupGoalId)"),
            ("m", "api", "pg", "save; upsert group_goal_progress"),
            ("m", "api", "job", "rewards.evaluate(user, groupGoal)"),
            ("m", "job", "pg", "sum members' progress this week"),
            ("opt", "goal reached before the deadline"),
            ("m", "job", "pg", "points to each contributor + group points"),
            ("m", "job", "pg", "badge 'Team week'"),
            ("m", "job", "grp", "push: 'Team hit 70k steps!'"),
            ("end",),
            ("loop", "weekly — Sunday 23:59 (group tz)"),
            ("m", "job", "pg", "leaderboard.snapshot (individual + group)"),
            ("end",),
            ("m", "m", "ui", "open Leaderboard"),
            ("m", "ui", "api", "GET /v1/leaderboards?scope=group&period=week"),
            ("m", "api", "ui", "ranks — points only, no private items", "r"),
            ("m", "m", "ui", "share 21-day Fajr streak with a friend"),
            ("m", "ui", "api", "POST /v1/shares {kind: streak}"),
            ("m", "api", "grp", "notification + kudos button"),
        ])


# =============================================================== 6. class diagrams
@diagram
def class_core():
    d = Diagram(1640, 1300, "Class diagram — core domain", "Planning and tracking. «value» = embedded JSON value object; «service» = pure logic in @life/shared.")
    class_box(d, "user", 40, 100, "User", ["id: uuid", "email: string", "displayName: string"], color="grey")
    class_box(d, "settings", 40, 290, "UserSettings", ["timezone: IANA", "location?: LatLng", "calcMethod: string", "madhab: shafi | hanafi", "weekStart: 0..6", "dayParts: DayPart[]", "quietHours?: Range"], color="grey")
    class_box(d, "cat", 380, 100, "Category", ["id: uuid", "name: string", "icon: string", "color: token", "sortOrder: int", "archivedAt?: datetime"], ["progress(date): DayProgress"], color="mauve")
    class_box(d, "cad", 380, 470, "CadenceRule", ["scope: category | plan", "stepKind: string", "rule: gapDays(n) | weekdays[]"], ["check(date): Warning?"], color="mauve")
    class_box(d, "item", 760, 100, "Item", ["id: uuid", "type: task | habit | goal | plan | group", "title: string", "notes?: string", "priority: Priority", "optional: bool", "tracking: Tracking", "schedule: Schedule", "meta: json  (venue, platform, course…)", "parentId?: uuid", "sortOrder: int", "sourceTemplateId?, adoptedAt?"], ["isDue(date, ctx): bool", "children(): Item[]"], color="blue")
    class_box(d, "trk", 1240, 100, "Tracking", ["kind: check | quantity | duration | checklist", "unit?: string  (steps, ml, pages)", "target?: number", "step?: number  (±500)", "checklist?: string[]"], stereo="value", color="teal")
    class_box(d, "sch", 1240, 330, "Schedule", ["kind: once | daily | weekdays |", "      everyNDays | monthly | none", "date?: date", "weekdays?: 0..6[]", "n?: int", "anchor?: Anchor", "activeFrom?, activeUntil?: date"], stereo="value", color="teal")
    class_box(d, "anc", 1240, 640, "Anchor", ["type: time | prayer | dayPart", "time?: HH:mm", "prayer?: fajr … isha | custom key", "relation: before | after | at", "offsetMin: int"], stereo="value", color="teal")
    class_box(d, "occ", 760, 600, "Occurrence", ["id: uuid", "itemId: uuid", "date?: date  (null = pending)", "slot: string", "status: OccStatus", "value?: number", "detail?: json  (checklist, bed/wake…)", "movedTo?, movedFrom?", "startedAt?, completedAt?: datetime"], ["bucket(): todo | in_progress | done"], color="blue")
    class_box(d, "dep", 420, 880, "ItemDependency", ["itemId: uuid", "dependsOnId: uuid", "e.g. Post waits for Payment"], color="mauve")
    class_box(d, "rem", 1240, 900, "Reminder", ["itemId: uuid", "trigger: Anchor | offsetMin", "repeatEveryMin?: int", "repeatUntilDone: bool", "maxRepeats: int", "nextFireAt?: datetime"], ["nextFire(now, ctx): datetime?"], color="yellow")
    class_box(d, "pri", 40, 610, "Priority", ["low · medium · high · critical"], stereo="enum", color="coral")
    class_box(d, "ost", 40, 740, "OccStatus", ["todo · in_progress · done", "skipped · moved · missed"], stereo="enum", color="coral")
    sv = [("ScheduleExpander", "expand(items, date, times)"), ("ProgressRule", "progress(occurrences)"),
          ("PrayerTimeService", "times(date, settings)"), ("CadenceChecker", "validate(plan, date)"),
          ("ReminderScheduler", "nextFire(reminder, now)"), ("SyncEngine", "push() · pull(since)")]
    for i, (n, m) in enumerate(sv):
        class_box(d, f"s{i}", 40 + i * 262, 1150, n, [], [m], stereo="service", color="sage", w=250)
    d.edge("user", "settings", "1", sa="b", sb="t", start="diamond", end=None, lpos=.8, ldx=12)
    d.edge("user", "cat", "1   ·   0..*", sa="r", sb=("l", .25), start="diamond", end=None, lpos=.5, ldy=-12)
    d.edge("cat", "item", "1   ·   0..*", sa=("r", .2), sb=("l", .1), start="diamond", end=None, lpos=.5, ldy=-12)
    d.edge("cat", "cad", "0..*", sa="b", sb="t", start="diamond", end=None, lpos=.7, ldx=18)
    d.edge("item", "trk", None, sa=("r", .2), sb=("l", .3), start="diamond", end=None)
    d.edge("item", "sch", None, sa=("r", .55), sb=("l", .3), start="diamond", end=None)
    d.edge("sch", "anc", "0..1", sa="b", sb="t", start="diamond", end=None, lpos=.5, ldx=22)
    d.edge("item", "occ", "1   ·   0..*", sa="b", sb="t", start="diamond", end=None, lpos=.5, ldx=40)
    d.edge("item", "rem", "0..*", sa=("r", .9), sb=("l", .3), via=[(1180, d.nodes['item'].y + d.nodes['item'].h * .9), (1180, 960)], start="diamond", end=None, lpos=.85, ldy=-10)
    d.edge("rem", "anc", "uses", sa=("t", .5), sb=("b", .5), dashed=True, end="open", lpos=.5, ldx=22)
    d.edge("item", "dep", "plan steps", sa=("l", .85), sb=("r", .3), via=[(715, d.nodes['item'].y + d.nodes['item'].h * .85), (715, d.nodes['dep'].y + d.nodes['dep'].h * .3)], end="open", lpos=.5, ldx=-40)
    n = d.nodes["item"]
    d.path([(n.x + n.w * .75, n.y), (n.x + n.w * .75, n.y - 26), (n.x + n.w + 26, n.y - 26), (n.x + n.w + 26, n.y + 30), (n.x + n.w, n.y + 30)], "parent 0..1 / children *", start="odiamond", end=None, lpos=.35, ldy=-10)
    d.edge("occ", "ost", None, sa=("l", .6), sb="r", dashed=True, end="open")
    d.edge("item", "pri", None, sa=("l", .74), sb=("r", .3), via=[(330, n.y + n.h * .74), (330, 640)], dashed=True, end="open")
    d.label(820, 1110, "«service» classes operate on the entities above (dependencies omitted for clarity)")
    return d


@diagram
def class_engagement():
    d = Diagram(1640, 1170, "Class diagram — rewards & social", "Motivation (Phase 8), social (Phase 9) and platform challenges (Phase 10). All written by server-side services only.")
    class_box(d, "user", 690, 100, "User", ["id: uuid", "displayName", "avatarUrl?"], color="grey")
    class_box(d, "pts", 40, 100, "PointsEntry", ["userId", "amount: int", "reason: string", "sourceType, sourceId  (unique → idempotent)", "createdAt"], color="yellow")
    class_box(d, "streak", 40, 330, "Streak", ["userId", "itemId?  (null = day streak)", "current, longest: int", "lastCountedDate", "freezes: int (max 2)"], color="yellow")
    class_box(d, "bdef", 40, 580, "BadgeDefinition", ["key: string", "name, icon, tier", "rule: json  (streak ≥ 7, …)"], color="yellow")
    class_box(d, "ubadge", 40, 790, "UserBadge", ["userId", "badgeKey", "awardedAt", "context?: json"], color="yellow")
    class_box(d, "fr", 1180, 100, "Friendship", ["userId, friendId", "status: pending | accepted | blocked"], color="peach")
    class_box(d, "grp", 690, 330, "Group", ["id", "name", "ownerId", "inviteCode"], color="peach")
    class_box(d, "gm", 1180, 290, "GroupMember", ["groupId, userId", "role: owner | admin | member", "joinedAt"], color="peach")
    class_box(d, "inv", 1180, 480, "Invite", ["groupId", "code, email?", "status, expiresAt"], color="peach")
    class_box(d, "gg", 690, 560, "GroupGoal", ["groupId", "title", "tracking: Tracking", "period: week | month", "start, end", "rewardPoints"], color="peach")
    class_box(d, "ggp", 690, 820, "GroupGoalProgress", ["goalId, userId", "date", "value"], color="peach")
    class_box(d, "chl", 370, 560, "Challenge", ["scope: platform", "title, rule: json", "startsAt, endsAt", "rewardPoints, badgeKey?"], color="teal")
    class_box(d, "che", 370, 820, "ChallengeEntry", ["challengeId, userId", "progress", "completedAt?"], color="teal")
    class_box(d, "lb", 1180, 650, "LeaderboardSnapshot", ["scope: friends | group | global", "scopeId?", "period, periodStart", "ranks: {userId|groupId, points}[]"], color="teal")
    class_box(d, "share", 1180, 850, "Share", ["fromUserId", "toUserId | groupId", "kind: streak | badge | achievement", "payload, reactions"], color="peach")
    class_box(d, "eng", 40, 1010, "RewardsEngine", [], ["evaluate(event) → PointsEntry, UserBadge", "rollStreaks(user, date) → Streak", "closeChallenge(c) → ChallengeEntry"], stereo="service", color="sage", w=380)
    class_box(d, "lbs", 450, 1010, "LeaderboardService", [], ["snapshot(scope, period) → LeaderboardSnapshot", "rank(scope, period)"], stereo="service", color="sage", w=380)
    class_box(d, "shs", 860, 1010, "ShareService", [], ["share(from, to, kind) → Share", "react(share, kudos)"], stereo="service", color="sage", w=320)
    d.edge("user", "pts", "1 · *", sa=("l", .25), sb=("r", .25), start="diamond", end=None, lpos=.5, ldy=-10)
    d.edge("user", "streak", "1 · *", sa=("l", .75), sb=("r", .3), start="diamond", end=None, lpos=.5, ldy=-10)
    d.edge("bdef", "ubadge", "1 · *", sa="b", sb="t", end=None, lpos=.5, ldx=22)
    d.edge("user", "fr", "*", sa=("r", .3), sb=("l", .3), end=None, lpos=.5, ldy=-10)
    d.edge("grp", "gm", "1 · *", sa=("r", .3), sb=("l", .5), start="diamond", end=None, lpos=.5, ldy=-10)
    d.edge("grp", "inv", "1 · *", sa=("r", .8), sb=("l", .5), start="diamond", end=None, lpos=.5, ldy=-10)
    d.edge("user", "grp", "owns", sa="b", sb="t", end="open", lpos=.5, ldx=26)
    d.edge("grp", "gg", "1 · *", sa="b", sb="t", start="diamond", end=None, lpos=.5, ldx=22)
    d.edge("gg", "ggp", "1 · *", sa="b", sb="t", start="diamond", end=None, lpos=.5, ldx=22)
    d.edge("chl", "che", "1 · *", sa="b", sb="t", start="diamond", end=None, lpos=.5, ldx=22)
    d.edge("user", "share", "sends", sa=("r", .9), sb=("t", .2), via=[(1130, 180), (1130, 830), (1230, 830)], end="open", lpos=.55, ldx=-24)
    return d


# =============================================================== 7. ERDs
@diagram
def erd_core():
    d = Diagram(1660, 1180, "ERD — core tables", "Postgres. Every table also has created_at, updated_at, deleted_at (soft delete, for sync). Local SQLite mirrors the user-owned tables.")
    U, F, P = "UK", "FK", "PK"
    table_box(d, "users", 40, 100, "users", [("id", "uuid = auth uid", P), ("email", "text", U), ("display_name", "text", ""), ("avatar_url", "text", "")], "grey")
    table_box(d, "settings", 40, 290, "user_settings", [("user_id", "uuid", P), ("timezone", "text", ""), ("lat, lng", "numeric", ""), ("calc_method", "text", ""), ("madhab", "text", ""), ("week_start", "smallint", ""), ("day_parts", "jsonb", ""), ("quiet_from, quiet_to", "time", "")], "grey")
    table_box(d, "devices", 40, 590, "devices", [("id", "uuid", P), ("user_id", "uuid", F), ("platform", "text", ""), ("last_sync_at", "timestamptz", "")], "grey")
    table_box(d, "pushsub", 40, 780, "push_subscriptions", [("id", "uuid", P), ("user_id", "uuid", F), ("device_id", "uuid", F), ("endpoint", "text", U), ("p256dh, auth", "text", "")], "grey")
    table_box(d, "cats", 420, 100, "categories", [("id", "uuid", P), ("user_id", "uuid", F), ("name", "text", ""), ("icon, color", "text", ""), ("sort_order", "int", ""), ("archived_at", "timestamptz", ""), ("source_template_id", "uuid", F)], "mauve")
    table_box(d, "items", 800, 100, "items", [("id", "uuid", P), ("user_id", "uuid", F), ("category_id", "uuid", F), ("parent_id", "uuid", F), ("type", "text", ""), ("title, notes", "text", ""), ("priority", "text", ""), ("is_optional", "bool", ""), ("tracking", "jsonb", ""), ("schedule", "jsonb", ""), ("meta", "jsonb", ""), ("group_goal_id", "uuid", F), ("sort_order", "int", ""), ("archived_at", "timestamptz", ""), ("source_template_id, _version", "uuid, int", F), ("adopted_at", "timestamptz", "")], "blue")
    table_box(d, "occ", 800, 690, "occurrences", [("id", "uuid", P), ("user_id", "uuid", F), ("item_id", "uuid", F), ("date", "date (null = pending)", ""), ("slot", "text", ""), ("status", "text", ""), ("value", "numeric", ""), ("detail", "jsonb", ""), ("moved_to, moved_from", "date", ""), ("started_at, completed_at", "timestamptz", ""), ("device_id", "text", ""), ("(item_id, date, slot)", "", U)], "blue")
    table_box(d, "dep", 420, 470, "item_dependencies", [("item_id", "uuid", F), ("depends_on_id", "uuid", F), ("(item_id, depends_on_id)", "", P)], "mauve")
    table_box(d, "cad", 420, 640, "cadence_rules", [("id", "uuid", P), ("user_id", "uuid", F), ("category_id", "uuid", F), ("plan_item_id", "uuid", F), ("step_kind", "text", ""), ("rule", "jsonb", "")], "mauve")
    table_box(d, "rem", 1250, 100, "reminders", [("id", "uuid", P), ("user_id", "uuid", F), ("item_id", "uuid", F), ("trigger", "jsonb", ""), ("repeat_every_min", "int", ""), ("repeat_until_done", "bool", ""), ("max_repeats", "int", ""), ("enabled", "bool", ""), ("next_fire_at", "timestamptz", "")], "yellow")
    table_box(d, "deliv", 1250, 450, "reminder_deliveries", [("id", "uuid", P), ("reminder_id", "uuid", F), ("occurrence_id", "uuid", F), ("fired_at", "timestamptz", ""), ("status", "text", ""), ("acted_at", "timestamptz", "")], "yellow")
    table_box(d, "tpl", 420, 860, "templates", [("id", "uuid", P), ("owner_user_id", "uuid (null = system)", F), ("name", "text", ""), ("items", "jsonb", ""), ("version", "int", ""), ("visibility", "text", "")], "teal")
    one_many = dict(start="one", end="crow")
    d.edge("users", "settings", None, sa="b", sb="t", start="one", end="one")
    d.edge("users", "devices", None, sa=("l", .5), sb=("l", .3), via=[(22, 155), (22, 625)], **one_many)
    d.edge("devices", "pushsub", None, sa="b", sb="t", **one_many)
    d.edge("users", "cats", None, sa="r", sb=("l", .2), **one_many)
    d.edge("cats", "items", None, sa=("r", .3), sb=("l", .12), **one_many)
    n = d.nodes["items"]
    d.path([(n.x + n.w, n.y + 60), (n.x + n.w + 24, n.y + 60), (n.x + n.w + 24, n.y + 100), (n.x + n.w, n.y + 100)], "parent", start="one", end="crow", lpos=.5, ldx=26)
    d.edge("items", "occ", None, sa="b", sb="t", **one_many)
    d.edge("items", "dep", None, sa=("l", .72), sb=("r", .5), **one_many)
    d.edge("cats", "cad", None, sa=("l", .9), sb=("l", .12), via=[(398, d.nodes['cats'].y + d.nodes['cats'].h * .9), (398, d.nodes['cad'].y + d.nodes['cad'].h * .12)], **one_many)
    d.edge("items", "rem", None, sa=("r", .6), sb=("l", .5), **one_many)
    d.edge("rem", "deliv", None, sa="b", sb="t", **one_many)
    d.edge("occ", "deliv", None, sa=("r", .2), sb=("b", .4), via=[(d.nodes['deliv'].x + d.nodes['deliv'].w * .4, d.nodes['occ'].y + d.nodes['occ'].h * .2)], start="one", end="crow")
    d.edge("tpl", "items", "provenance", sa=("r", .2), sb=("l", .93), via=[(772, d.nodes['tpl'].y + d.nodes['tpl'].h * .2), (772, n.y + n.h * .93)], start="one", end="crow", dashed=True, lpos=.3, ldy=-10)
    return d


@diagram
def erd_engagement():
    d = Diagram(1660, 1000, "ERD — rewards & social tables", "All rows written by the API / jobs, never by client sync. Leaderboards read points only; item details stay private.")
    U, F, P = "UK", "FK", "PK"
    table_box(d, "users", 700, 90, "users", [("id", "uuid", P), ("display_name", "text", "")], "grey")
    table_box(d, "pts", 40, 90, "points_ledger", [("id", "uuid", P), ("user_id", "uuid", F), ("amount", "int", ""), ("reason", "text", ""), ("source_type, source_id", "text, uuid", U), ("created_at", "timestamptz", "")], "yellow")
    table_box(d, "streaks", 40, 330, "streaks", [("id", "uuid", P), ("user_id", "uuid", F), ("item_id", "uuid (null = day)", F), ("current, longest", "int", ""), ("last_counted_date", "date", ""), ("freezes", "smallint", "")], "yellow")
    table_box(d, "bdef", 40, 590, "badge_definitions", [("key", "text", P), ("name, icon", "text", ""), ("tier", "smallint", ""), ("rule", "jsonb", "")], "yellow")
    table_box(d, "ub", 40, 790, "user_badges", [("user_id", "uuid", F), ("badge_key", "text", F), ("awarded_at", "timestamptz", ""), ("(user_id, badge_key)", "", P)], "yellow")
    table_box(d, "fr", 1220, 90, "friendships", [("user_id", "uuid", F), ("friend_id", "uuid", F), ("status", "text", ""), ("(user_id, friend_id)", "", P)], "peach")
    table_box(d, "grp", 700, 300, "groups", [("id", "uuid", P), ("name", "text", ""), ("owner_id", "uuid", F), ("invite_code", "text", U)], "peach")
    table_box(d, "gm", 1220, 290, "group_members", [("group_id", "uuid", F), ("user_id", "uuid", F), ("role", "text", ""), ("joined_at", "timestamptz", "")], "peach")
    table_box(d, "inv", 1220, 470, "invites", [("id", "uuid", P), ("group_id", "uuid", F), ("code", "text", U), ("email", "text", ""), ("status, expires_at", "", "")], "peach")
    table_box(d, "gg", 700, 510, "group_goals", [("id", "uuid", P), ("group_id", "uuid", F), ("title", "text", ""), ("tracking", "jsonb", ""), ("period", "text", ""), ("start_date, end_date", "date", ""), ("reward_points", "int", "")], "peach")
    table_box(d, "ggp", 700, 800, "group_goal_progress", [("goal_id", "uuid", F), ("user_id", "uuid", F), ("date", "date", ""), ("value", "numeric", "")], "peach")
    table_box(d, "chl", 380, 510, "challenges", [("id", "uuid", P), ("title", "text", ""), ("rule", "jsonb", ""), ("starts_at, ends_at", "timestamptz", ""), ("reward_points", "int", ""), ("badge_key", "text", F)], "teal")
    table_box(d, "che", 380, 800, "challenge_entries", [("challenge_id", "uuid", F), ("user_id", "uuid", F), ("progress", "numeric", ""), ("completed_at", "timestamptz", "")], "teal")
    table_box(d, "lb", 1220, 660, "leaderboard_snapshots", [("id", "uuid", P), ("scope", "text", ""), ("scope_id", "uuid", ""), ("period, period_start", "text, date", ""), ("ranks", "jsonb", "")], "teal")
    table_box(d, "sh", 1220, 840, "shares", [("id", "uuid", P), ("from_user_id", "uuid", F), ("to_user_id | group_id", "uuid", F), ("kind", "text", ""), ("payload, reactions", "jsonb", "")], "peach")
    om = dict(start="one", end="crow")
    d.edge("users", "pts", None, sa=("l", .4), sb=("r", .3), **om)
    d.edge("users", "streaks", None, sa=("l", .8), sb=("r", .3), via=[(560, d.nodes['users'].y + d.nodes['users'].h * .8), (560, 370)], **om)
    d.edge("bdef", "ub", None, sa="b", sb="t", **om)
    d.edge("users", "fr", None, sa=("r", .5), sb=("l", .5), **om)
    d.edge("users", "grp", "owner", sa="b", sb="t", lpos=.5, ldx=28, **om)
    d.edge("grp", "gm", None, sa=("r", .4), sb=("l", .5), **om)
    d.edge("grp", "inv", None, sa=("r", .8), sb=("l", .4), **om)
    d.edge("grp", "gg", None, sa="b", sb="t", **om)
    d.edge("gg", "ggp", None, sa="b", sb="t", **om)
    d.edge("chl", "che", None, sa="b", sb="t", **om)
    d.edge("bdef", "chl", "reward badge", sa=("r", .5), sb=("l", .4), via=[(330, 640), (330, 560)], start="one", end="crow", dashed=True, lpos=.3, ldy=-10)
    return d


# =============================================================== 8. screen map
@diagram
def screen_map():
    d = Diagram(1500, 860, "Screen map", "Bottom navigation: Today · Categories · + · Progress · Profile. Dashed = later phases.")
    d.node("onb", 40, 120, 220, 100, ["Onboarding", "sign up → pick starter categories", "→ location → notifications"], "plain")
    d.node("nav", 330, 120, 1130, 64, ["Bottom navigation"], "box", "grey")
    tabs = [("today", "Today", "blue"), ("cats", "Categories", "mauve"), ("add", "+  Add", "coral"), ("prog", "Progress", "sage"), ("prof", "Profile", "peach")]
    for i, (tid, label, c) in enumerate(tabs):
        d.node(tid, 350 + i * 222, 230, 200, 60, [label], "box", c, 14)
        d.edge("nav", tid, None, sa=("b", (i * 222 + 100 + 20) / 1130), sb="t")
    d.edge("onb", "today", "first run", sa=("b", .5), sb=("l", .5), via=[(150, 260)], lpos=.6, ldy=-10)
    L = lambda nid, x, y, lines, dashed=False, color="blue": d.node(nid, x, y, 200, 76, lines, "plain", color, 12.5, dashed=dashed)
    L("t1", 350, 340, ["Status tiles", "To Do · In Progress · Done"])
    L("t2", 350, 440, ["Date strip", "past / today / tomorrow+"])
    L("t3", 350, 540, ["Prayer row", "5 chips, one tap each"])
    L("t4", 350, 640, ["Row actions", "skip · move · pending · edit"])
    L("c1", 572, 340, ["Category list", "ring + counts, expand inline"])
    L("c2", 572, 460, ["Category detail", "habits · tasks · plans · goals"])
    L("c3", 572, 580, ["Item detail", "today control + history"])
    L("c4", 572, 700, ["Plan detail", "dated steps, venue, locks"])
    L("a1", 794, 340, ["Quick add", "title · date chip · category"])
    L("a2", 794, 460, ["Full editor", "type, tracking, schedule,", "anchor, priority, reminders"])
    L("p1", 1016, 340, ["Overview", "week / month, by category"])
    L("p2", 1016, 460, ["Streaks & badges"])
    L("p3", 1016, 580, ["Leaderboards", "individual · group"], True)
    L("p4", 1016, 700, ["Groups", "group goals, invites"], True)
    L("f1", 1238, 340, ["Settings", "prayer location & method,", "day parts, theme"])
    L("f2", 1238, 460, ["Notifications", "push, quiet hours"])
    L("f3", 1238, 580, ["Templates", "starter packs"])
    L("f4", 1238, 700, ["Friends & shares"], True)
    for col, ids in (("today", ["t1", "t2", "t3", "t4"]), ("cats", ["c1", "c2", "c3", "c4"]), ("add", ["a1", "a2"]), ("prog", ["p1", "p2", "p3", "p4"]), ("prof", ["f1", "f2", "f3", "f4"])):
        prev = col
        for nid in ids:
            d.edge(prev, nid, None, sa="b", sb="t")
            prev = nid
    d.edge("t1", "c3", "tap row", sa=("r", .5), sb=("l", .3), via=[(560, 378), (560, 603)], lpos=.85, ldx=0, ldy=-10)
    return d


# =============================================================== 9. roadmap
@diagram
def roadmap():
    phases = [
        ("0", "Docs & design system", "R0", 0, 1),
        ("1", "Foundation v2 — auth, schema, sync", "R1", 1, 3),
        ("2", "Today", "R1", 3, 2),
        ("3", "Categories & items", "R1", 4, 3),
        ("4", "Spiritual — prayers & anchors", "R1", 6, 2),
        ("5", "Plans — content & university", "R1", 7, 2),
        ("6", "Reminders (Web Push)", "R2", 9, 2),
        ("7", "History & analytics", "R2", 10, 2),
        ("8", "Motivation — points, badges, streaks", "R2", 11, 2),
        ("9", "Social — friends, groups, leaderboards", "R3", 13, 3),
        ("10", "Platform challenges", "R3", 15, 2),
        ("11", "Native wrap — Capacitor alarms", "R4", 17, 2),
        ("12", "Template library", "R4", 18, 2),
    ]
    colors = {"R0": "grey", "R1": "blue", "R2": "sage", "R3": "peach", "R4": "mauve"}
    names = {"R0": "R0 · Plan", "R1": "R1 · Personal MVP", "R2": "R2 · Habit loop", "R3": "R3 · Social", "R4": "R4 · Native & library"}
    x0, unit, top, rh = 380, 52, 150, 44
    d = Diagram(x0 + unit * 20 + 60, top + rh * len(phases) + 110, "Delivery roadmap", "Indicative sequence in weeks of focused work (one developer). Phases inside a release can overlap.")
    for w in range(0, 21):
        x = x0 + w * unit
        d.back.append(f'<line x1="{x}" y1="{top - 14}" x2="{x}" y2="{top + rh * len(phases)}" stroke="#EEEEF3"/>')
        if w % 2 == 0:
            d.text(x, top - 22, f"w{w}", 11, INK2)
    for i, (num, name, rel, start, dur) in enumerate(phases):
        y = top + i * rh
        d.text(40, y + 27, f"Phase {num}", 12.5, INK2, anchor="start")
        d.text(120, y + 27, name, 13, INK, anchor="start")
        c = colors[rel]
        d.mid.append(f'<rect x="{x0 + start * unit + 2}" y="{y + 9}" width="{dur * unit - 4}" height="{rh - 18}" rx="13" fill="{tint(c, .45)}" stroke="{stroke(c)}"/>')
    lx = 40
    ly = top + rh * len(phases) + 40
    for r, c in colors.items():
        lx += d.chip(lx, ly, names[r], c) + 12
    return d


# =============================================================== 10. palette
@diagram
def palette():
    d = Diagram(1300, 640, "v2 palette — sampled from UI Images/", "Median of a 7×7 pixel patch at each element (scratch script). (d) = derived for contrast, not sampled.")
    rows = [
        ("Surfaces & ink", [("Background", "#F4F4F9", "ref 2 screen"), ("Surface", "#FFFFFF", "cards"), ("Track / chip", "#E5E5EF", "ref 2"), ("Border", "#DBDCE3", "ref 2"), ("Ink", "#1B1A22", "ref 2 heading"), ("Ink 2", "#64656C", "ref 2 body")]),
        ("Status", [("To Do", "#E66473", "ref 3"), ("In Progress", "#EBAC80", "ref 2"), ("Done", "#97BB7D", "ref 2"), ("Skipped / neutral", "#AA8B9A", "ref 2"), ("Primary", "#7293F1", "ref 1"), ("Primary text (d)", "#4766D0", "AA on white")]),
        ("Category pastels", [("Mint", "#D8E7E4", "ref 4"), ("Lilac", "#D7CCEA", "ref 4"), ("Peach", "#E9CFC8", "ref 4"), ("Lime", "#E6ECCA", "ref 4"), ("Pink", "#F6E4E2", "ref 4"), ("Sky", "#86CFE2", "ref 1")]),
    ]
    y = 110
    for title, sw in rows:
        d.text(40, y + 20, title, 14, INK, True, "start")
        for i, (name, hx, src) in enumerate(sw):
            x = 40 + i * 205
            d.mid.append(f'<rect x="{x}" y="{y + 34}" width="190" height="84" rx="16" fill="{hx}" stroke="{BORDER}"/>')
            d.text(x, y + 138, name, 13, INK, True, "start")
            d.text(x, y + 156, f"{hx}  ·  {src}", 11.5, INK2, anchor="start")
        y += 175
    return d


def main(names):
    targets = names or list(REGISTRY)
    for n in targets:
        print("render", n)
        render(REGISTRY[n](), OUT, n)


if __name__ == "__main__":
    main(sys.argv[1:])
