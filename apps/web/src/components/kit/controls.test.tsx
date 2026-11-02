import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it } from "vitest";
import { ChoiceSheet } from "./choice-sheet";
import { NumberStepper } from "./number-stepper";

function Stepper({ start = "", step = 500, min = 1, max = 20_000 }: { start?: string; step?: number; min?: number; max?: number }) {
  const [v, setV] = useState(start);
  return <NumberStepper label="Target" unit="steps" step={step} min={min} max={max} value={v} onChange={setV} />;
}

describe("NumberStepper", () => {
  it("steps on the grid, stays within min/max, and still takes typing (digits only)", () => {
    render(<Stepper start="10000" max={10_500} />);
    const input = screen.getByRole("textbox", { name: "Target" });
    fireEvent.click(screen.getByRole("button", { name: "Target plus 500" }));
    expect(input).toHaveValue("10500");
    expect(screen.getByRole("button", { name: "Target plus 500" })).toBeDisabled();
    fireEvent.change(input, { target: { value: "1x2" } });
    expect(input).toHaveValue("12");
    fireEvent.click(screen.getByRole("button", { name: "Target plus 500" }));
    expect(input).toHaveValue("500");
    fireEvent.click(screen.getByRole("button", { name: "Target minus 500" }));
    expect(input).toHaveValue("1");
  });
});

describe("ChoiceSheet", () => {
  it("shows the choice; the sheet lists every option and one tap picks and closes", () => {
    function Pick() {
      const [v, setV] = useState("karachi");
      return (
        <ChoiceSheet
          label="Method"
          value={v}
          onChange={setV}
          options={[
            { value: "karachi", label: "Karachi" },
            { value: "mwl", label: "Muslim World League" },
          ]}
        />
      );
    }
    render(<Pick />);
    fireEvent.click(screen.getByRole("button", { name: "Method: Karachi" }));
    expect(screen.getByRole("radio", { name: "Karachi" })).toHaveAttribute("aria-checked", "true");
    fireEvent.click(screen.getByRole("radio", { name: "Muslim World League" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Method: Muslim World League" })).toBeInTheDocument();
  });
});
