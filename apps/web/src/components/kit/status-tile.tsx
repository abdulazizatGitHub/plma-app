import { CheckCircle2, CircleDashed, Clock3 } from "lucide-react";

export type ItemState = "todo" | "in_progress" | "done";

const META: Record<ItemState, { label: string; fill: string; Icon: typeof Clock3 }> = {
  todo: { label: "To Do", fill: "bg-todo", Icon: Clock3 },
  in_progress: { label: "In Progress", fill: "bg-progress", Icon: CircleDashed },
  done: { label: "Done", fill: "bg-done", Icon: CheckCircle2 },
};

type StatusTileProps = {
  state: ItemState;
  count: number;
  selected?: boolean;
  onSelect?: (state: ItemState) => void;
};

/** Colored count tile (owner refs 2 & 3). Tapping filters the list below. */
export function StatusTile({ state, count, selected = false, onSelect }: StatusTileProps) {
  const { label, fill, Icon } = META[state];
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={() => onSelect?.(state)}
      className={`transition-token press-pop flex min-h-[68px] flex-1 flex-col justify-between rounded-[16px] p-2.5 text-left text-on-fill ${fill} ${
        selected ? "ring-2 ring-ink ring-offset-2 ring-offset-bg" : ""
      }`}
    >
      <Icon className="h-4 w-4 self-end opacity-80" aria-hidden />
      <span>
        <span className="block text-lg leading-tight font-semibold">{count}</span>
        <span className="block text-[11.5px] font-medium">{label}</span>
      </span>
    </button>
  );
}

type StatusTilesProps = {
  counts: Record<ItemState, number>;
  selected?: ItemState | null;
  onSelect?: (state: ItemState | null) => void;
};

/** Three tiles; tapping the selected one again clears the filter. */
export function StatusTiles({ counts, selected = null, onSelect }: StatusTilesProps) {
  return (
    <div className="flex gap-2">
      {(Object.keys(META) as ItemState[]).map((state) => (
        <StatusTile
          key={state}
          state={state}
          count={counts[state]}
          selected={selected === state}
          onSelect={(s) => onSelect?.(selected === s ? null : s)}
        />
      ))}
    </div>
  );
}
