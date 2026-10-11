import { render, screen } from "@testing-library/react";
import { buildDay, dayProgress, type Item, type Occurrence } from "@life/shared";
import { describe, expect, it } from "vitest";
import { DaySummaryCard } from "./day-summary";

const USER = "6f1c2b8e-3a4d-4c5e-9f60-718293a4b5c6";
const NOW = "2026-10-01T00:00:00.000Z";
let n = 0;
const uid = () => `00000000-0000-4000-8000-${String(++n).padStart(12, "0")}`;

function item(over: Partial<Item>): Item {
  return {
    id: uid(), userId: USER, createdAt: NOW, updatedAt: NOW, deletedAt: null, categoryId: null, parentId: null, type: "habit", title: "Item", notes: null,
    priority: "medium", isOptional: false, tracking: { v: 1, kind: "check" }, schedule: { v: 1, kind: "daily" }, meta: {}, groupGoalId: null, sortOrder: 0,
    archivedAt: null, sourceTemplateId: null, sourceTemplateVersion: null, adoptedAt: null, ...over,
  };
}

function done(it: Item, date: string): Occurrence {
  return {
    id: uid(), userId: USER, createdAt: NOW, updatedAt: NOW, deletedAt: null, itemId: it.id, date, slot: "",
    status: "done", value: null, detail: {}, completedAt: NOW,
  } as Occurrence;
}

function card(date: string, today: string, streak = { current: 0, best: 0 }) {
  const a = item({ title: "Read" });
  const b = item({ title: "Walk" });
  const rows = buildDay([a, b], [done(a, date)], date);
  return render(
    <DaySummaryCard access={date === today ? "live" : "history"} rows={rows} progress={dayProgress(rows)} prayers={null} date={date} today={today} streak={streak} nextUp="Asr · 3:59 PM" />,
  );
}

describe("DaySummaryCard", () => {
  it("shows the day's percentage, the count, what's next and the streak", () => {
    card("2026-10-12", "2026-10-12", { current: 3, best: 7 });
    expect(screen.getByRole("img", { name: "50% of the day done" })).toBeInTheDocument();
    expect(screen.getByText("1 of 2 done")).toBeInTheDocument();
    expect(screen.getByText(/1 left · next: Asr · 3:59 PM/)).toBeInTheDocument();
    expect(screen.getByText(/perfect days in a row/).textContent).toContain("3");
    expect(screen.getByText(/Best/).textContent).toContain("7");
  });

  it("marks a past day as closed and final, with the rest counted as missed", () => {
    card("2026-10-11", "2026-10-12");
    expect(screen.getByText("final")).toBeInTheDocument();
    expect(screen.getByText(/Day closed — 1 of 2 done/)).toBeInTheDocument();
    expect(screen.getByText(/1 missed/)).toBeInTheDocument();
  });
});
