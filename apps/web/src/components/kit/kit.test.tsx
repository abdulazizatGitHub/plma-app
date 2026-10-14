import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { addDays, weekStart } from "./date-strip";
import { Heatmap } from "./heatmap";
import { PopoverMenu, PopoverMenuItem } from "./popover-menu";
import { PrayerRow, type PrayerChip } from "./prayer-row";
import { QuantityStepper, parseQuantity, quantityState } from "./quantity-stepper";
import { Ring } from "./ring";
import { StatusTiles } from "./status-tile";
import { TaskCheck } from "./task-check";

function Stepper({ initial = 4000, step = 500 }: { initial?: number; step?: number }) {
  const [value, setValue] = useState(initial);
  return <QuantityStepper label="Steps" value={value} onChange={setValue} step={step} unit="steps" />;
}

describe("QuantityStepper", () => {
  it("adds and subtracts the configured step", () => {
    render(<Stepper />);
    fireEvent.click(screen.getByRole("button", { name: "Increase Steps by 500" }));
    fireEvent.click(screen.getByRole("button", { name: "Increase Steps by 500" }));
    expect(screen.getByRole("button", { name: /Steps: 5,000 steps/ })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Decrease Steps by 500" }));
    expect(screen.getByRole("button", { name: /Steps: 4,500 steps/ })).toBeInTheDocument();
  });

  it("accepts a typed value such as 10,000", () => {
    render(<Stepper />);
    fireEvent.click(screen.getByRole("button", { name: /Tap to type a value/ }));
    const input = screen.getByRole("textbox", { name: "Steps value" });
    fireEvent.change(input, { target: { value: "10,000" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(screen.getByRole("button", { name: /Steps: 10,000 steps/ })).toBeInTheDocument();
  });

  it("keeps the old value when the typed text is not a number, and never goes below 0", () => {
    render(<Stepper initial={300} />);
    fireEvent.click(screen.getByRole("button", { name: /Tap to type a value/ }));
    const input = screen.getByRole("textbox", { name: "Steps value" });
    fireEvent.change(input, { target: { value: "lots" } });
    fireEvent.blur(input);
    expect(screen.getByRole("button", { name: /Steps: 300 steps/ })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Decrease Steps by 500" }));
    expect(screen.getByRole("button", { name: /Steps: 0 steps/ })).toBeInTheDocument();
  });

  it("parses quantities and derives the status bucket", () => {
    expect(parseQuantity(" 10,000 ")).toBe(10000);
    expect(parseQuantity("1e3")).toBeNull();
    expect(quantityState(0, 10000)).toBe("todo");
    expect(quantityState(4000, 10000)).toBe("in_progress");
    expect(quantityState(10000, 10000)).toBe("done");
  });
});

describe("Ring", () => {
  it.each([0, 50, 100])("renders %i%%", (v) => {
    render(<Ring label={`${v} percent`} value={v} />);
    expect(screen.getByRole("img", { name: `${v} percent` })).toHaveAttribute("data-value", String(v));
  });

  it("draws one segment per prayer with its status", () => {
    const { container } = render(<Ring label="prayers" segments={["done", "missed", "open", "qada", "open"]} />);
    expect(container.querySelectorAll("circle[data-segment]")).toHaveLength(5);
    expect(container.querySelectorAll('circle[data-segment="open"]')).toHaveLength(2);
  });
});

describe("PrayerRow", () => {
  const prayers: PrayerChip[] = [
    { key: "fajr", label: "Fajr", status: "missed" },
    { key: "zuhr", label: "Zuhr", status: "open" },
    { key: "asr", label: "Asr", status: "done" },
  ];

  it("toggles any prayer in any order, even while an earlier one is missed", () => {
    const onToggle = vi.fn();
    render(<PrayerRow prayers={prayers} onToggle={onToggle} />);
    fireEvent.click(screen.getByRole("button", { name: "Zuhr, not marked" }));
    expect(onToggle).toHaveBeenCalledWith("zuhr", expect.any(HTMLElement));
    expect(screen.getByRole("img", { name: "1 of 3 prayers prayed" })).toBeInTheDocument();
  });
});

describe("TaskCheck and StatusTiles", () => {
  it("exposes checkbox state including mixed for in-progress", () => {
    render(<TaskCheck state="in_progress" label="Gym" />);
    expect(screen.getByRole("checkbox", { name: "Gym" })).toHaveAttribute("aria-checked", "mixed");
  });

  it("filters by status and clears when the selected tile is tapped again", () => {
    const onSelect = vi.fn();
    const { rerender } = render(<StatusTiles counts={{ todo: 3, in_progress: 1, done: 2 }} onSelect={onSelect} />);
    fireEvent.click(screen.getByRole("button", { name: /To Do/ }));
    expect(onSelect).toHaveBeenLastCalledWith("todo");
    rerender(<StatusTiles counts={{ todo: 3, in_progress: 1, done: 2 }} selected="todo" onSelect={onSelect} />);
    fireEvent.click(screen.getByRole("button", { name: /To Do/ }));
    expect(onSelect).toHaveBeenLastCalledWith(null);
  });
});

describe("date helpers", () => {
  it("adds days across month ends and finds Monday", () => {
    expect(addDays("2026-10-31", 1)).toBe("2026-11-01");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
    expect(weekStart("2026-10-09")).toBe("2026-10-05"); // Friday → Monday
    expect(weekStart("2026-10-11")).toBe("2026-10-05"); // Sunday → Monday
  });
});

describe("PopoverMenu", () => {
  function Harness({ onPick }: { onPick: () => void }) {
    const [anchor, setAnchor] = useState<HTMLElement | null>(null);
    return (
      <>
        <button type="button" onClick={(e) => setAnchor(e.currentTarget)}>
          More
        </button>
        <span>outside</span>
        <PopoverMenu anchor={anchor} onClose={() => setAnchor(null)} label="Quiz">
          <PopoverMenuItem label="Skip today" onClick={onPick} />
          <PopoverMenuItem label="Move to tomorrow" onClick={onPick} />
        </PopoverMenu>
      </>
    );
  }

  it("opens next to its trigger as a small menu and runs an item", () => {
    const onPick = vi.fn();
    render(<Harness onPick={onPick} />);
    fireEvent.click(screen.getByRole("button", { name: "More" }));
    const menu = screen.getByRole("menu", { name: "Quiz" });
    expect(menu).toHaveStyle({ width: "208px" }); // compact, not a full-width sheet
    expect(menu).toHaveClass("fixed");
    expect(screen.getByRole("menuitem", { name: "Skip today" })).toHaveFocus();
    fireEvent.keyDown(document, { key: "ArrowDown" });
    expect(screen.getByRole("menuitem", { name: "Move to tomorrow" })).toHaveFocus();
    fireEvent.click(screen.getByRole("menuitem", { name: "Move to tomorrow" }));
    expect(onPick).toHaveBeenCalled();
  });

  it("closes on Escape (focus back to the trigger) and on an outside tap", () => {
    render(<Harness onPick={vi.fn()} />);
    const trigger = screen.getByRole("button", { name: "More" });
    fireEvent.click(trigger);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
    fireEvent.click(trigger);
    fireEvent.pointerDown(screen.getByText("outside"));
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });
});

describe("Heatmap", () => {
  it("starts weeks on the user's day (Oct 2026 begins on a Thursday)", () => {
    const lead = (start?: number) => {
      const { container, unmount } = render(<Heatmap month="2026-10" marks={new Map()} onMonth={() => {}} maxMonth="2026-10" weekStart={start} />);
      const n = container.querySelectorAll("ol > li[aria-hidden]").length;
      unmount();
      return n;
    };
    expect(lead()).toBe(3); // Monday first
    expect(lead(0)).toBe(4); // Sunday first
    expect(lead(6)).toBe(5); // Saturday first
  });
});

