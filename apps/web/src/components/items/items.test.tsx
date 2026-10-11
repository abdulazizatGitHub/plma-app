import "fake-indexeddb/auto";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { buildDay, entryState, setQuantity, todayLocalDate, type Item } from "@life/shared";
import initSqlJs, { type SqlJsStatic } from "sql.js";
import type { ReactNode } from "react";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { AddSheetProvider } from "@/components/providers/add-sheet-provider";
import { LocalStore } from "@/lib/v2/local-store";
import { initialState, toDraft, validate, type EditorState } from "./editor-state";
import { ItemEditor } from "./item-editor";
import { newRow } from "./list-editor";

const USER = "6f1c2b8e-3a4d-4c5e-9f60-718293a4b5c6";
const TODAY = "2026-10-10";
let store: LocalStore;

vi.mock("@/components/providers/auth-provider", () => ({ useAuth: () => ({ user: { id: USER, email: "me@example.com" } }) }));
vi.mock("@/components/providers/store-provider", () => ({ useStore: () => ({ store, syncSoon: vi.fn() }) }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }), useSearchParams: () => new URLSearchParams() }));
vi.mock("next/link", () => ({ default: ({ children, href }: { children: ReactNode; href: string }) => <a href={href}>{children}</a> }));

let SQL: SqlJsStatic;
let n = 0;
const uid = () => `00000000-0000-4000-8000-${String(++n).padStart(12, "0")}`;
const items = () => store.query("items", `WHERE "deleted_at" IS NULL ORDER BY "sort_order"`) as unknown as Item[];

beforeAll(async () => {
  SQL = await initSqlJs();
});
beforeEach(async () => {
  store = await LocalStore.open(uid(), { sqlJs: SQL });
});

const state = (over: Partial<EditorState>): EditorState => ({ ...initialState(null, [], {}, TODAY), title: "X", ...over });

describe("editor validation", () => {
  it("needs a unit and whole numbers for counts", () => {
    expect(validate(state({ kind: "habit", track: "quantity", unit: "", step: "0" }))).toMatchObject({ unit: expect.any(String), step: expect.any(String) });
    expect(validate(state({ kind: "habit", track: "quantity", unit: "steps", target: "10000", step: "500" }))).toEqual({});
  });

  it("needs at least one day for weekday habits, and an end not before the start", () => {
    expect(validate(state({ kind: "habit", repeat: "weekdays", weekdays: [] })).weekdays).toBeTruthy();
    expect(validate(state({ kind: "habit", activeFrom: "2026-10-10", activeUntil: "2026-10-01" })).range).toBeTruthy();
  });

  it("needs at least one checklist step and one routine sub-item", () => {
    expect(validate(state({ kind: "habit", track: "checklist", steps: [newRow(" ")] })).steps).toBeTruthy();
    expect(validate(state({ kind: "group", children: [newRow("")] })).children).toBeTruthy();
  });

  it("builds a weekdays [Mon, Wed, Fri] habit with an active range", () => {
    const { draft } = toDraft(state({ kind: "habit", repeat: "weekdays", weekdays: [5, 1, 3], activeFrom: "2026-10-12" }), TODAY);
    expect(draft.schedule).toEqual({ v: 1, kind: "weekdays", weekdays: [1, 3, 5], activeFrom: "2026-10-12" });
  });
});

function renderEditor(props: Partial<Parameters<typeof ItemEditor>[0]> = {}) {
  const onSaved = vi.fn();
  render(
    <AddSheetProvider>
      <ItemEditor item={null} existingChildren={[]} preset={{}} onSaved={onSaved} onCancel={vi.fn()} {...props} />
    </AddSheetProvider>,
  );
  return onSaved;
}

describe("ItemEditor", () => {
  it("creates Steps as a count habit (10,000, step 500); +500 twice then 10000 completes it", async () => {
    const onSaved = renderEditor();
    fireEvent.change(screen.getByLabelText(/^Name/), { target: { value: "Steps" } });
    fireEvent.click(screen.getByRole("button", { name: "Habit · repeats" }));
    fireEvent.click(screen.getByRole("tab", { name: "Count" }));
    fireEvent.change(screen.getByLabelText(/^Unit/), { target: { value: "steps" } });
    fireEvent.change(screen.getByLabelText(/^Target/), { target: { value: "10a000" } });
    expect(screen.getByLabelText(/^Target/)).toHaveValue("10000"); // digits only
    fireEvent.change(screen.getByLabelText(/^Step/), { target: { value: "500" } });
    fireEvent.click(screen.getByRole("button", { name: "Add" }));
    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    const [steps] = items();
    expect(steps).toMatchObject({ type: "habit", tracking: { kind: "quantity", unit: "steps", target: 10000, step: 500 }, schedule: { kind: "daily" } });

    const ctx = { userId: USER, now: new Date().toISOString(), deviceId: null };
    const occs: Parameters<typeof buildDay>[1] = [];
    const day = todayLocalDate(); // the habit exists from the day it was created
    const entry = () => buildDay([steps], occs, day)[0];
    const log = async (v: number) => {
      const [c] = await setQuantity(entry(), day, v, ctx);
      occs.splice(0, occs.length, c.row as (typeof occs)[number]);
    };
    await log(500);
    await log(1000);
    expect(entryState(entry())).toBe("in_progress");
    await log(10000);
    expect(entryState(entry())).toBe("done");
  });

  it("keeps Add disabled until valid and says why", () => {
    renderEditor();
    expect(screen.getByRole("button", { name: "Add" })).toBeDisabled();
    expect(screen.getByText("Give it a name.")).toBeInTheDocument();
  });

  it("creates a routine with five sub-items on chosen days", async () => {
    const onSaved = renderEditor();
    fireEvent.change(screen.getByLabelText(/^Name/), { target: { value: "Gym — Push day" } });
    fireEvent.click(screen.getByRole("button", { name: "Routine · sub-items" }));
    const subs = within(screen.getByRole("region", { name: "Sub-items" }));
    for (let i = 0; i < 3; i++) fireEvent.click(subs.getByRole("button", { name: "Add sub-item" }));
    ["Bench", "OHP", "Incline", "Laterals", "Pushdown"].forEach((t, i) => fireEvent.change(subs.getByLabelText(`Sub-item ${i + 1}`), { target: { value: t } }));
    fireEvent.click(screen.getByRole("checkbox", { name: "Repeats" }));
    fireEvent.click(screen.getByRole("button", { name: "Some days" }));
    fireEvent.click(screen.getByRole("button", { name: "Tue" })); // weekdays default Mon–Fri → drop Tue and Thu
    fireEvent.click(screen.getByRole("button", { name: "Thu" }));
    fireEvent.click(screen.getByRole("button", { name: "Add" }));
    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    const rows = items();
    const parent = rows.find((i) => i.type === "group")!;
    expect(parent.schedule).toEqual({ v: 1, kind: "weekdays", weekdays: [1, 3, 5] });
    const kids = rows.filter((i) => i.parentId === parent.id);
    expect(kids.map((k) => k.title)).toEqual(["Bench", "OHP", "Incline", "Laterals", "Pushdown"]);
    expect(kids.every((k) => JSON.stringify(k.schedule) === JSON.stringify(parent.schedule))).toBe(true);
  });

  it("edits a routine: rename, remove and reorder sub-items", async () => {
    const onSaved = renderEditor();
    fireEvent.change(screen.getByLabelText(/^Name/), { target: { value: "Morning" } });
    fireEvent.click(screen.getByRole("button", { name: "Routine · sub-items" }));
    const subs = within(screen.getByRole("region", { name: "Sub-items" }));
    fireEvent.change(subs.getByLabelText("Sub-item 1"), { target: { value: "Water" } });
    fireEvent.change(subs.getByLabelText("Sub-item 2"), { target: { value: "Stretch" } });
    fireEvent.click(screen.getByRole("button", { name: "Add" }));
    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    const parent = items().find((i) => i.type === "group")!;
    const kids = items().filter((i) => i.parentId === parent.id);

    document.body.innerHTML = "";
    const onEdited = renderEditor({ item: parent, existingChildren: kids });
    const edit = within(screen.getByRole("region", { name: "Sub-items" }));
    fireEvent.click(edit.getByRole("button", { name: "Move Stretch up" }));
    fireEvent.click(edit.getByRole("button", { name: "Remove Water" }));
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(onEdited).toHaveBeenCalled());
    expect(items().filter((i) => i.parentId === parent.id).map((k) => k.title)).toEqual(["Stretch"]);
  });

  it("builds Surah Kahf · Fridays · after Zuhr", async () => {
    const onSaved = renderEditor();
    fireEvent.change(screen.getByLabelText(/^Name/), { target: { value: "Surah Kahf" } });
    fireEvent.click(screen.getByRole("button", { name: "Habit · repeats" }));
    fireEvent.click(screen.getByRole("button", { name: "Some days" }));
    for (const d of ["Mon", "Tue", "Wed", "Thu"]) fireEvent.click(screen.getByRole("button", { name: d })); // keep Fri
    fireEvent.click(screen.getByRole("button", { name: "Around a prayer" }));
    fireEvent.change(screen.getByLabelText("Prayer"), { target: { value: "dhuhr" } });
    expect(screen.getByText(/Shown from that prayer until the next one/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Add" }));
    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    expect(items()[0].schedule).toEqual({ v: 1, kind: "weekdays", weekdays: [5], anchor: { type: "prayer", prayer: "dhuhr", relation: "after", offsetMin: 0 } });
  });

  it("an item at a set time of day needs a valid time", () => {
    renderEditor();
    fireEvent.change(screen.getByLabelText(/^Name/), { target: { value: "Walk" } });
    fireEvent.click(screen.getByRole("button", { name: "Habit · repeats" }));
    fireEvent.click(screen.getByRole("button", { name: "At a time" }));
    expect(screen.getByRole("button", { name: "Add" })).toBeDisabled();
    fireEvent.change(screen.getByLabelText(/^Time\*?$/), { target: { value: "07:30" } });
    expect(screen.getByRole("button", { name: "Add" })).toBeEnabled();
  });
});
