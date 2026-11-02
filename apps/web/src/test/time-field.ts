import { fireEvent, screen, within } from "@testing-library/react";

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Sets a TimeField the way a keyboard user would: open it, "Type it", enter
 * the time, Done. `label` is the field's label (its button reads "Label: …").
 */
export function pickTime(label: string, hhmm: string, root: HTMLElement = document.body) {
  const button = within(root).getByRole("button", { name: new RegExp(`^${escapeRe(label)}:`) });
  if (button.getAttribute("aria-expanded") !== "true") fireEvent.click(button);
  const panel = document.getElementById(button.getAttribute("aria-controls") ?? "");
  if (!panel) throw new Error(`No time panel for ${label}`);
  const p = within(panel);
  if (!p.queryByLabelText(label, { selector: "input" })) fireEvent.click(p.getByRole("button", { name: /Type it/ }));
  fireEvent.change(p.getByLabelText(label, { selector: "input" }), { target: { value: hhmm } });
  fireEvent.click(p.getByRole("button", { name: "Done" }));
  return screen;
}
