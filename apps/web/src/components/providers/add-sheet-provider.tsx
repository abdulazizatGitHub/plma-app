"use client";

import { createTask, todayLocalDate, updateTask, type DayEntry, type Item, type TaskDraft } from "@life/shared";
import { useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Sheet, Toast, type ToastData } from "@/components/kit";
import { ReminderSheet } from "@/components/reminders/reminder-sheet";
import { MoveSheet } from "@/components/today/move-sheet";
import { TaskForm } from "@/components/today/task-form";
import { whenLabel } from "@/lib/v2/dates";
import { useActions, useCategories, useNextSortOrder } from "@/lib/v2/use-day";
import { useToday } from "@/lib/v2/use-today";

type AddSheetState = {
  /** Opens quick add; the day defaults to the one shown on Today. */
  openAdd: () => void;
  openEdit: (item: Item) => void;
  /** "Remind me…" for one row on one day (today only, or its everyday reminder). */
  openReminder: (entry: DayEntry, date: string) => void;
  /** "Move to a date…": chips and a calendar; one tap moves it. */
  openMove: (entry: DayEntry, from: string) => void;
  /** Today tells us which day is on screen, so + plans *that* day. */
  setDefaultDate: (date: string | null) => void;
  /** Today registers how to jump to a day (for the toast's "View"). */
  registerShowDay: (show: ((date: string) => void) | null) => void;
  /** Short confirmation above the nav. */
  notify: (toast: ToastData) => void;
};

const AddSheetContext = createContext<AddSheetState | null>(null);

type Mode = { kind: "add" } | { kind: "edit"; item: Item } | null;

const TOAST_MS = 5000;

export function AddSheetProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<Mode>(null);
  const [defaultDate, setDefaultDate] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastData | null>(null);
  const [reminderFor, setReminderFor] = useState<{ entry: DayEntry; date: string } | null>(null);
  const [moveFor, setMoveFor] = useState<{ entry: DayEntry; from: string } | null>(null);
  const showDay = useRef<((date: string) => void) | null>(null);
  const categories = useCategories();
  const run = useActions();
  const nextSortOrder = useNextSortOrder();
  const router = useRouter();
  const appToday = useToday();
  const close = useCallback(() => setMode(null), []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), TOAST_MS);
    return () => clearTimeout(t);
  }, [toast]);

  const value = useMemo<AddSheetState>(
    () => ({
      openAdd: () => setMode({ kind: "add" }),
      openEdit: (item) => setMode({ kind: "edit", item }),
      openReminder: (entry, date) => setReminderFor({ entry, date }),
      openMove: (entry, from) => setMoveFor({ entry, from }),
      setDefaultDate,
      registerShowDay: (show) => {
        showDay.current = show;
      },
      notify: setToast,
    }),
    [],
  );

  /** Tell the user where the task went, with a way to get there (owner: tasks seemed to vanish). */
  const confirm = (draft: TaskDraft, edited: boolean, remind?: () => void) => {
    const today = appToday ?? todayLocalDate();
    const verb = edited ? "Saved" : "Added";
    if (draft.date === null) {
      setToast({ message: `${verb} to Pending`, action: { label: "View", onClick: () => router.push("/pending") } });
      return;
    }
    const where = whenLabel(draft.date, today, ", ");
    if (draft.date === (defaultDate ?? today) && showDay.current) {
      // It's on screen already, so the toast offers the next likely step: a reminder.
      setToast({ message: `${verb} to ${where}`, action: remind && draft.date >= today ? { label: "Remind me", onClick: remind } : undefined });
      return;
    }
    const target = draft.date;
    setToast({
      message: `${verb} to ${where}`,
      action: {
        label: "View",
        onClick: () => {
          if (showDay.current) showDay.current(target);
          else router.push("/");
        },
      },
    });
  };

  const editing = mode?.kind === "edit" ? mode.item : null;
  return (
    <AddSheetContext.Provider value={value}>
      {children}
      <Sheet open={mode !== null} onClose={close} title={editing ? "Edit task" : "Add a task"}>
        {mode ? (
          <TaskForm
            // Remount per open so fields reset.
            key={editing?.id ?? `add-${defaultDate}`}
            categories={categories}
            showDate={!editing || editing.schedule.kind === "once"}
            initial={
              editing
                ? {
                    title: editing.title,
                    date: editing.schedule.kind === "once" ? editing.schedule.date : null,
                    time: editing.schedule.kind === "once" ? (editing.schedule.time ?? null) : null,
                    categoryId: editing.categoryId,
                    priority: editing.priority,
                  }
                : { date: defaultDate ?? appToday ?? todayLocalDate() }
            }
            submitLabel={editing ? "Save" : "Add task"}
            onNewPlan={
              editing
                ? undefined
                : () => {
                    close();
                    router.push("/plans?new=1");
                  }
            }
            onMoreOptions={(draft) => {
              close();
              const q = new URLSearchParams();
              if (editing) q.set("id", editing.id);
              else {
                if (draft.title.trim()) q.set("title", draft.title.trim());
                q.set("date", draft.date ?? "none");
                if (draft.time) q.set("time", draft.time);
                if (draft.categoryId) q.set("category", draft.categoryId);
                q.set("priority", draft.priority);
              }
              router.push(`/items/edit?${q.toString()}`);
            }}
            onSubmit={(draft) => {
              const id = editing?.id ?? crypto.randomUUID();
              let saved: Item | null = null;
              void run((ctx) => {
                const changes = editing ? updateTask(editing, draft, ctx) : createTask(id, draft, nextSortOrder(), ctx);
                saved = (changes.find((c) => c.entity === "items" && c.row.id === id)?.row as Item | undefined) ?? null;
                return changes;
              });
              close();
              const day = draft.date;
              confirm(draft, Boolean(editing), () => {
                if (saved && day) setReminderFor({ entry: { key: `${id}|`, item: saved, slot: "", occurrence: null }, date: day });
              });
            }}
          />
        ) : null}
      </Sheet>
      <ReminderSheet entry={reminderFor?.entry ?? null} date={reminderFor?.date ?? ""} today={appToday ?? todayLocalDate()} onClose={() => setReminderFor(null)} />
      <MoveSheet
        entry={moveFor?.entry ?? null}
        from={moveFor?.from ?? ""}
        today={appToday ?? todayLocalDate()}
        onClose={() => setMoveFor(null)}
        onMoved={(to) => {
          const today = appToday ?? todayLocalDate();
          setToast({
            message: `Moved to ${whenLabel(to, today, ", ")}`,
            action: showDay.current ? { label: "View", onClick: () => showDay.current?.(to) } : undefined,
          });
        }}
      />
      <Toast toast={toast} onClose={() => setToast(null)} />
    </AddSheetContext.Provider>
  );
}

export function useAddSheet() {
  const ctx = useContext(AddSheetContext);
  if (!ctx) throw new Error("useAddSheet must be used within AddSheetProvider");
  return ctx;
}
