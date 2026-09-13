'use client';

// One rail, drawn from one model.
//
// The three models differ in shape, not in styling: the same entry, the same
// heading and the same active state are used by all of them, so what a reader
// compares is the navigation rather than three different paint jobs.
import { RailIcon } from './rail-icon.js';
import type { Group, Item, Model } from './rail-models.js';

/** The entry's own chrome, active and idle. Ghost when idle, filled when not. */
const ENTRY =
  'flex min-h-11 w-full items-center gap-2.5 px-3 py-2.5 text-left text-sm transition-colors';
const ACTIVE = 'border-3 border-line-strong bg-accent font-bold text-on-fill shadow-sm';
const IDLE =
  'border-3 border-transparent font-medium text-ink-2 hover:border-line-strong hover:bg-bg-grain hover:text-ink';

export interface RailProps {
  readonly model: Model;
  readonly activeId: string;
  readonly onSelect: (id: string) => void;
  /** Group ids the reader has folded away. Only model B can have any. */
  readonly folded: ReadonlySet<string>;
  readonly onToggleGroup: (id: string) => void;
}

function Entry({
  item,
  active,
  onSelect,
}: {
  readonly item: Item;
  readonly active: boolean;
  readonly onSelect: (id: string) => void;
}) {
  return (
    <li>
      <button
        type="button"
        aria-current={active ? 'page' : undefined}
        onClick={() => {
          onSelect(item.id);
        }}
        className={`${ENTRY} ${active ? ACTIVE : IDLE}`}
      >
        <RailIcon name={item.icon} />
        <span className="min-w-0 flex-1 truncate">{item.label}</span>
        {/* The one thing an entry says about its own page: health is a live
            probe, so the rail can carry its answer without opening it. */}
        {item.id === 'health' ? (
          <span className="size-2.5 shrink-0 border-2 border-line-strong bg-green" />
        ) : null}
        {item.tabs === undefined ? null : (
          <span className="shrink-0 font-mono text-[10px] text-muted">
            {item.tabs.length}
          </span>
        )}
      </button>
    </li>
  );
}

function Heading({
  group,
  folded,
  onToggle,
}: {
  readonly group: Group;
  readonly folded: boolean;
  readonly onToggle: (id: string) => void;
}) {
  return (
    <button
      type="button"
      aria-expanded={!folded}
      onClick={() => {
        onToggle(group.id);
      }}
      className="flex min-h-11 w-full items-center justify-between px-3 py-2 text-left"
    >
      <span className="font-mono text-[10px] tracking-[0.14em] text-muted uppercase">
        {group.heading}
      </span>
      <span
        className={`font-mono text-[11px] text-muted transition-transform ${
          folded ? '' : 'rotate-90'
        }`}
        aria-hidden
      >
        &gt;
      </span>
    </button>
  );
}

export function Rail({ model, activeId, onSelect, folded, onToggleGroup }: RailProps) {
  return (
    <nav
      aria-label="Admin sections"
      className="flex h-full flex-col border-r-3 border-line-strong bg-surface"
    >
      <div className="flex flex-col gap-1 border-b-3 border-line-strong px-4 py-4">
        <span className="font-mono text-base font-bold tracking-[0.06em] text-ink">
          WIKIFAKE
        </span>
        <span className="font-mono text-[10px] tracking-[0.18em] text-muted uppercase">
          Administration
        </span>
      </div>

      <div className="flex flex-1 flex-col gap-1.5 overflow-y-auto p-2.5">
        {model.groups.map((group) => {
          const isFolded = folded.has(group.id);
          return (
            <div key={group.id} className="flex flex-col gap-1">
              {group.heading === null ? null : (
                <Heading group={group} folded={isFolded} onToggle={onToggleGroup} />
              )}
              {isFolded ? null : (
                <ul className="flex list-none flex-col gap-1.5 p-0">
                  {group.items.map((item) => (
                    <Entry
                      key={item.id}
                      item={item}
                      active={item.id === activeId}
                      onSelect={onSelect}
                    />
                  ))}
                </ul>
              )}
            </div>
          );
        })}
      </div>

      <p className="m-0 border-t-3 border-line-strong px-4 py-3 font-mono text-[10px] tracking-[0.1em] text-muted uppercase">
        Read only
      </p>
    </nav>
  );
}
