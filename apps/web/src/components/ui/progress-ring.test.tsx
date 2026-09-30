import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ProgressRing } from "./progress-ring";

describe("ProgressRing", () => {
  it("exposes its label as the accessible name and renders centred content", () => {
    render(
      <ProgressRing label="43% of today's habits done" value={43}>
        <span>43%</span>
      </ProgressRing>,
    );
    expect(screen.getByRole("img", { name: "43% of today's habits done" })).toBeInTheDocument();
    expect(screen.getByText("43%")).toBeInTheDocument();
  });

  it("clamps the continuous value to 0–100", () => {
    const { rerender } = render(<ProgressRing label="ring" value={150} />);
    expect(screen.getByRole("img")).toHaveAttribute("data-value", "100");
    rerender(<ProgressRing label="ring" value={-20} />);
    expect(screen.getByRole("img")).toHaveAttribute("data-value", "0");
  });

  it("draws one arc per segment and marks which are filled", () => {
    const { container } = render(
      <ProgressRing label="prayers" size="xl" segments={["red", null, "green", null, null]} />,
    );
    expect(container.querySelectorAll("circle[data-segment]")).toHaveLength(5);
    expect(container.querySelectorAll('circle[data-segment="filled"]')).toHaveLength(2);
  });
});
