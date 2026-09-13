'use client';

// The rail, settled.
//
// B1: each group is its own bordered block rather than a heading above a run,
// because this direction already draws a container with a 3px border and a
// group is one. Overview stays outside every block — it is the page about all
// three groups, so putting it inside one would be a claim that is not true.
import { RailIcon } from './rail-icon.js';
import { GROUPS, type Group, type Item } from './rail-models.js';

const ENTRY =
  'flex min-h-11 w-full items-center gap-2.5 px-3 py-2.5 text-left text-sm transition-colors';
const ACTIVE = 'border-3 border-line-strong bg-accent font-bold text-on-fill shadow-sm';
const IDLE =
  'border-3 border-transparent font-medium text-ink-2 hover:border-line-strong hover:bg-bg-grain hover:text-ink';
const HEADING = 'px-3 py-2 font-mono text-[10px] tracking-[0.14em] text-muted uppercase';

export interface RailProps {
  readonly activeId: string;
  readonly onSelect: (id: string) => void;
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
      </button>
    </li>
  );
}

function Entries({
  group,
  activeId,
  onSelect,
}: {
  readonly group: Group;
  readonly activeId: string;
  readonly onSelect: (id: string) => void;
}) {
  return (
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
  );
}

export function Rail({ activeId, onSelect }: RailProps) {
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

      <div className="flex min-h-0 flex-1 flex-col gap-2.5 overflow-y-auto p-2.5">
        {GROUPS.map((group) =>
          group.heading === null ? (
            <Entries
              key={group.id}
              group={group}
              activeId={activeId}
              onSelect={onSelect}
            />
          ) : (
            <div key={group.id} className="border-3 border-line bg-bg">
              <span className={`${HEADING} block border-b-3 border-line`}>
                {group.heading}
              </span>
              <div className="p-1.5">
                <Entries group={group} activeId={activeId} onSelect={onSelect} />
              </div>
            </div>
          ),
        )}
      </div>

      <p className="m-0 border-t-3 border-line-strong px-4 py-3 font-mono text-[10px] tracking-[0.1em] text-muted uppercase">
        Read only
      </p>
    </nav>
  );
}
