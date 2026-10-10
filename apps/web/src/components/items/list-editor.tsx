"use client";

import { ArrowDown, ArrowUp, Plus, X } from "lucide-react";

export type ListRow = { key: string; id?: string; title: string };

let seq = 0;
export const newRow = (title = "", id?: string): ListRow => ({ key: `row-${++seq}`, id, title });

/**
 * Editable ordered list (checklist steps, routine sub-items): type, reorder
 * with ↑/↓, remove, add. Empty rows are ignored on save.
 */
export function ListEditor({
  legend,
  rows,
  onChange,
  max,
  maxLength,
  placeholder,
  addLabel,
  error,
}: {
  legend: string;
  rows: ListRow[];
  onChange: (rows: ListRow[]) => void;
  max: number;
  maxLength: number;
  placeholder: string;
  addLabel: string;
  error?: string | null;
}) {
  const move = (i: number, dir: -1 | 1) => {
    const next = [...rows];
    [next[i], next[i + dir]] = [next[i + dir], next[i]];
    onChange(next);
  };
  return (
    <fieldset>
      <legend className="mb-1 text-[12px] font-medium text-ink">{legend}</legend>
      <ol className="space-y-1.5">
        {rows.map((row, i) => (
          <li key={row.key} className="flex items-center gap-1">
            <span className="w-5 shrink-0 text-right text-[12px] text-ink-2" aria-hidden>
              {i + 1}.
            </span>
            <input
              value={row.title}
              maxLength={maxLength}
              placeholder={placeholder}
              aria-label={`${legend} ${i + 1}`}
              onChange={(e) => onChange(rows.map((r) => (r.key === row.key ? { ...r, title: e.target.value } : r)))}
              className="h-9 min-w-0 flex-1 rounded-[10px] border border-border bg-surface px-2.5 text-[14px] text-ink placeholder:text-ink-2/70 focus:border-primary-strong focus:outline-none"
            />
            <button type="button" aria-label={`Move ${row.title || `row ${i + 1}`} up`} disabled={i === 0} onClick={() => move(i, -1)} className="inline-flex h-8 w-8 items-center justify-center rounded-full text-ink-2 hover:bg-track disabled:opacity-30">
              <ArrowUp className="h-3.5 w-3.5" aria-hidden />
            </button>
            <button
              type="button"
              aria-label={`Move ${row.title || `row ${i + 1}`} down`}
              disabled={i === rows.length - 1}
              onClick={() => move(i, 1)}
              className="inline-flex h-8 w-8 items-center justify-center rounded-full text-ink-2 hover:bg-track disabled:opacity-30"
            >
              <ArrowDown className="h-3.5 w-3.5" aria-hidden />
            </button>
            <button type="button" aria-label={`Remove ${row.title || `row ${i + 1}`}`} onClick={() => onChange(rows.filter((r) => r.key !== row.key))} className="inline-flex h-8 w-8 items-center justify-center rounded-full text-ink-2 hover:bg-track">
              <X className="h-3.5 w-3.5" aria-hidden />
            </button>
          </li>
        ))}
      </ol>
      {rows.length < max ? (
        <button type="button" onClick={() => onChange([...rows, newRow()])} className="mt-1.5 flex min-h-8 items-center gap-1 rounded-full px-2 text-[12px] font-medium text-link hover:bg-track">
          <Plus className="h-3.5 w-3.5" aria-hidden /> {addLabel}
        </button>
      ) : null}
      {error ? (
        <p role="alert" className="mt-1 text-[12px] text-ink">
          <span aria-hidden className="mr-1.5 inline-block h-2 w-2 rounded-full bg-todo" />
          {error}
        </p>
      ) : null}
    </fieldset>
  );
}
