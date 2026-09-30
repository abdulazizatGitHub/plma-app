import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { WeeklyBars } from "./weekly-bars";

const WEEK = [
  { date: "2026-09-22", value: 0 },
  { date: "2026-09-23", value: 20 },
  { date: "2026-09-24", value: 40 },
  { date: "2026-09-25", value: 60 },
  { date: "2026-09-26", value: 80 },
  { date: "2026-09-27", value: 100 },
  { date: "2026-09-28", value: 50 },
];

describe("WeeklyBars", () => {
  it("renders one bar per day and highlights only the last (today)", () => {
    const { container } = render(<WeeklyBars days={WEEK} max={100} />);
    const bars = container.querySelectorAll("[data-bar]");
    expect(bars).toHaveLength(7);
    expect(container.querySelectorAll('[data-today="true"]')).toHaveLength(1);
    expect(bars[6]).toHaveAttribute("data-today", "true");
  });

  it("scales bar height to the value, with a visible minimum for zero days", () => {
    const { container } = render(<WeeklyBars days={WEEK} max={100} />);
    const bars = container.querySelectorAll<HTMLElement>("[data-bar]");
    expect(bars[5].style.height).toBe("100%");
    expect(bars[2].style.height).toBe("40%");
    expect(bars[0].style.height).toBe("6%");
  });

  it("summarises every day in its accessible label", () => {
    render(<WeeklyBars days={WEEK} max={100} formatValue={(v) => `${v}%`} />);
    const chart = screen.getByRole("img");
    expect(chart.getAttribute("aria-label")).toContain("100%");
    expect(chart.getAttribute("aria-label")?.split(", ")).toHaveLength(7);
  });
});
